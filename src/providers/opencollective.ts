import type { Provider, Sponsorship } from '../types'
import { $fetch } from 'ofetch'
import { getCredentials } from '../configs/credentials'
import { normalizeUrl } from '../utils'

interface SocialLink {
  type: string
  url: string
}

export const OpenCollectiveProvider: Provider = {
  name: 'opencollective',
  fetchSponsors(config) {
    if (config.mode === 'sponsees') {
      const slug = config.opencollective?.slug || config.opencollective?.id
      return fetchOpenCollectiveSponsors(
        getCredentials(config).opencollective?.key,
        undefined,
        slug,
        config.opencollective?.githubHandle,
        true,
        true,
      )
    }

    return fetchOpenCollectiveSponsors(
      getCredentials(config).opencollective?.key,
      config.opencollective?.id,
      config.opencollective?.slug,
      config.opencollective?.githubHandle,
      config.includePastSponsors,
    )
  },
}

const API = 'https://api.opencollective.com/graphql/v2/'
const graphql = String.raw

export async function fetchOpenCollectiveSponsors(
  key?: string,
  id?: string,
  slug?: string,
  githubHandle?: string,
  includePastSponsors?: boolean,
  sponseesMode = false,
): Promise<Sponsorship[]> {
  const apiKey = requireOpenCollectiveOptions(key, id, slug, githubHandle)
  const includePast = includePastSponsors || sponseesMode
  const sponsors = sponseesMode
    ? []
    : await fetchOpenCollectiveOrders(apiKey, id, slug, githubHandle, includePast)
  const monthlyTransactions = await fetchOpenCollectiveTransactions(apiKey, id, slug, githubHandle, includePast, sponseesMode)
  const sponsorships: [string, Sponsorship][] = sponsors
    .map(createSponsorFromOrder)
    .filter((sponsorship): sponsorship is [string, Sponsorship] => sponsorship !== null)

  const monthlySponsorships: [string, Sponsorship][] = monthlyTransactions
    .map(t => createSponsorFromTransaction(t, sponsorships.map(i => i[1].raw.id), sponseesMode))
    .filter((sponsorship): sponsorship is [string, Sponsorship] => sponsorship !== null && sponsorship !== undefined)

  return sponseesMode
    ? mergeSponseeSponsorships(sponsorships.concat(monthlySponsorships))
    : mergeSponsorSponsorships(sponsorships, monthlySponsorships)
}

function requireOpenCollectiveOptions(key?: string, id?: string, slug?: string, githubHandle?: string) {
  if (!key)
    throw new Error('OpenCollective api key is required')
  if (!slug && !id && !githubHandle)
    throw new Error('OpenCollective collective id or slug or GitHub handle is required')
  return key
}

async function fetchOpenCollectiveOrders(
  key: string,
  id: string | undefined,
  slug: string | undefined,
  githubHandle: string | undefined,
  includePastSponsors: boolean,
) {
  return await fetchOpenCollectivePages(
    key,
    offset => makeSubscriptionsQuery(id, slug, githubHandle, offset, !includePastSponsors),
    data => data.data.account.orders,
  )
}

async function fetchOpenCollectiveTransactions(
  key: string,
  id: string | undefined,
  slug: string | undefined,
  githubHandle: string | undefined,
  includePastSponsors: boolean,
  sponseesMode: boolean,
) {
  const dateFrom = getTransactionsStartDate(includePastSponsors)
  return await fetchOpenCollectivePages(
    key,
    offset => makeTransactionsQuery(id, slug, githubHandle, offset, dateFrom, undefined, sponseesMode),
    data => data.data.account.transactions,
  )
}

function getTransactionsStartDate(includePastSponsors: boolean) {
  const now = new Date()
  return includePastSponsors
    ? undefined
    : new Date(now.getFullYear(), now.getMonth(), 1)
}

async function fetchOpenCollectivePages(
  key: string,
  makeQuery: (offset: number) => string,
  getConnection: (data: any) => { nodes?: any[], totalCount: number },
) {
  const nodes: any[] = []
  let offset: number | undefined = 0
  while (offset !== undefined) {
    const data = await fetchOpenCollectivePage(key, makeQuery(offset))
    const connection = getConnection(data)
    const pageNodes = connection.nodes ?? []
    nodes.push(...pageNodes)
    offset = getNextOffset(offset, pageNodes.length, connection.totalCount)
  }
  return nodes
}

async function fetchOpenCollectivePage(key: string, query: string) {
  return await $fetch(API, {
    method: 'POST',
    body: { query },
    headers: {
      'Api-Key': `${key}`,
      'Content-Type': 'application/json',
    },
  }) as any
}

function getNextOffset(offset: number, nodeCount: number, totalCount: number) {
  if (nodeCount === 0)
    return undefined
  return totalCount > offset + nodeCount ? offset + nodeCount : undefined
}

function mergeSponseeSponsorships(sponsorships: [string, Sponsorship][]) {
  const processed = new Map<string, Sponsorship>()
  for (const [id, sponsor] of sponsorships)
    mergeSponseeSponsor(processed, id, sponsor)
  return Array.from(processed.values())
}

function mergeSponseeSponsor(processed: Map<string, Sponsorship>, id: string, sponsor: Sponsorship) {
  const existingSponsor = processed.get(id)
  if (!existingSponsor) {
    processed.set(id, sponsor)
    return
  }

  existingSponsor.monthlyDollars += sponsor.monthlyDollars
  existingSponsor.isOneTime = Boolean(existingSponsor.isOneTime && sponsor.isOneTime)
  if (isEarlierSponsor(sponsor, existingSponsor))
    existingSponsor.createdAt = sponsor.createdAt
}

function isEarlierSponsor(sponsor: Sponsorship, existingSponsor: Sponsorship) {
  return !!sponsor.createdAt && (!existingSponsor.createdAt || sponsor.createdAt.localeCompare(existingSponsor.createdAt) < 0)
}

function mergeSponsorSponsorships(sponsorships: [string, Sponsorship][], monthlySponsorships: [string, Sponsorship][]) {
  const processed = keepLatestSponsorships(sponsorships)
  const transactionsBySponsorId = keepLatestSponsorships(monthlySponsorships, mergeSameMonthSponsorship)
  return Array.from(processed.values()).concat(Array.from(transactionsBySponsorId.values()))
}

function keepLatestSponsorships(
  sponsorships: [string, Sponsorship][],
  mergeOlder?: (existingSponsor: Sponsorship, sponsor: Sponsorship) => void,
) {
  const processed = new Map<string, Sponsorship>()
  for (const [id, sponsor] of sponsorships)
    keepLatestSponsorship(processed, id, sponsor, mergeOlder)
  return processed
}

function keepLatestSponsorship(
  processed: Map<string, Sponsorship>,
  id: string,
  sponsor: Sponsorship,
  mergeOlder?: (existingSponsor: Sponsorship, sponsor: Sponsorship) => void,
) {
  const existingSponsor = processed.get(id)
  if (!existingSponsor) {
    processed.set(id, sponsor)
    return
  }

  if (toDate(sponsor.createdAt) >= toDate(existingSponsor.createdAt))
    processed.set(id, sponsor)
  else
    mergeOlder?.(existingSponsor, sponsor)
}

function mergeSameMonthSponsorship(existingSponsor: Sponsorship, sponsor: Sponsorship) {
  if (isSameMonth(toDate(existingSponsor.createdAt), toDate(sponsor.createdAt)))
    existingSponsor.monthlyDollars += sponsor.monthlyDollars
}

function createSponsorFromOrder(order: any): [string, Sponsorship] | undefined {
  const slug = order.fromAccount.slug
  if (slug === 'github-sponsors') // ignore github sponsors
    return undefined

  let monthlyDollars: number = order.amount.value
  if (order.status !== 'ACTIVE')
    monthlyDollars = -1

  else if (order.frequency === 'MONTHLY')
    monthlyDollars = order.amount.value

  else if (order.frequency === 'YEARLY')
    monthlyDollars = order.amount.value / 12

  else if (order.frequency === 'ONETIME')
    monthlyDollars = order.amount.value

  const sponsor: Sponsorship = {
    sponsor: {
      name: order.fromAccount.name,
      type: getAccountType(order.fromAccount.type),
      login: slug,
      avatarUrl: order.fromAccount.imageUrl,
      websiteUrl: normalizeUrl(getBestUrl(order.fromAccount.socialLinks)),
      linkUrl: `https://opencollective.com/${slug}`,
      socialLogins: getSocialLogins(slug, order.fromAccount.socialLinks),
    },
    isOneTime: order.frequency === 'ONETIME',
    monthlyDollars,
    privacyLevel: order.fromAccount.isIncognito ? 'PRIVATE' : 'PUBLIC',
    tierName: order.tier?.name,
    createdAt: order.createdAt,
    raw: order,
  }

  return [order.fromAccount.id, sponsor]
}

function createSponsorFromTransaction(transaction: any, excludeOrders: string[], sponseesMode = false): [string, Sponsorship] | undefined {
  const account = sponseesMode ? transaction.toAccount : transaction.fromAccount
  if (!account?.slug)
    return undefined

  const slug = account.slug
  if (slug === 'github-sponsors') // ignore github sponsors
    return undefined

  if (excludeOrders.includes(transaction.order?.id))
    return undefined

  const sponsor: Sponsorship = {
    sponsor: {
      name: account.name,
      type: getAccountType(account.type),
      login: slug,
      avatarUrl: account.imageUrl,
      websiteUrl: normalizeUrl(getBestUrl(account.socialLinks ?? [])),
      linkUrl: `https://opencollective.com/${slug}`,
      socialLogins: getSocialLogins(slug, account.socialLinks),
    },
    isOneTime: transaction.order?.frequency === 'ONETIME',
    monthlyDollars: getTransactionMonthlyDollars(transaction, sponseesMode),
    privacyLevel: getTransactionPrivacyLevel(account, sponseesMode),
    tierName: transaction.order?.tier?.name ?? transaction.tier?.name,
    createdAt: getTransactionCreatedAt(transaction, sponseesMode),
    raw: transaction,
  }

  return [account.id || slug, sponsor]
}

function getTransactionMonthlyDollars(transaction: any, sponseesMode: boolean) {
  if (sponseesMode)
    return Math.abs(transaction.amount.value)
  if (transaction.order?.status !== 'ACTIVE')
    return getInactiveTransactionMonthlyDollars(transaction)
  if (transaction.order?.frequency === 'MONTHLY')
    return transaction.order?.amount.value
  if (transaction.order?.frequency === 'YEARLY')
    return transaction.order?.amount.value / 12
  return transaction.amount.value
}

function getInactiveTransactionMonthlyDollars(transaction: any) {
  const firstDayOfCurrentMonth = new Date(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
  return new Date(transaction.createdAt) < firstDayOfCurrentMonth
    ? -1
    : transaction.amount.value
}

function getTransactionPrivacyLevel(account: any, sponseesMode: boolean): 'PUBLIC' | 'PRIVATE' {
  if (sponseesMode)
    return 'PUBLIC'
  return account.isIncognito ? 'PRIVATE' : 'PUBLIC'
}

function getTransactionCreatedAt(transaction: any, sponseesMode: boolean) {
  if (sponseesMode || transaction.order?.frequency === 'ONETIME')
    return transaction.createdAt
  return transaction.order?.createdAt
}

/**
 * Make a partial query for the OpenCollective API.
 * This is used to query for either a collective or an account.
 * If `id` is set, it will query for a collective.
 * If `slug` is set, it will query for an account.
 * If `githubHandle` is set, it will query for an account.
 * If none of the above are set, an error will be thrown.
 *
 * @param id Collective id
 * @param slug Collective slug
 * @param githubHandle GitHub handle
 * @returns The partial query
 * @see makeQuery
 * @see fetchOpenCollectiveSponsors
 */
function makeAccountQueryPartial(id?: string, slug?: string, githubHandle?: string) {
  if (id)
    return `id: "${id}"`
  else if (slug)
    return `slug: "${slug}"`
  else if (githubHandle)
    return `githubHandle: "${githubHandle}"`
  else
    throw new Error('OpenCollective collective id or slug or GitHub handle is required')
}

function makeTransactionsQuery(
  id?: string,
  slug?: string,
  githubHandle?: string,
  offset?: number,
  dateFrom?: Date,
  dateTo?: Date,
  sponseesMode = false,
) {
  const accountQueryPartial = makeAccountQueryPartial(id, slug, githubHandle)
  const dateFromParam = dateFrom ? `, dateFrom: "${dateFrom.toISOString()}"` : ''
  const dateToParam = dateTo ? `, dateTo: "${dateTo.toISOString()}"` : ''
  const type = sponseesMode ? 'DEBIT' : 'CREDIT'
  const accountField = sponseesMode ? 'toAccount' : 'fromAccount'
  return graphql`{
    account(${accountQueryPartial}) {
      transactions(limit: 1000, offset:${offset}, type: ${type} ${dateFromParam} ${dateToParam}) {
        offset
        limit
        totalCount
        nodes {
          type
          kind
          id
          order {
            id
            status
            frequency
            tier {
              name
            }
            createdAt
            amount {
              value
            }
          }
          createdAt
          amount {
            value
          }
          ${accountField} {
            name
            id
            slug
            type
            githubHandle
            socialLinks {
              url
              type
            }
            isIncognito
            imageUrl(height: 460, format: png)
          }
        }
      }
    }
  }`
}

function makeSubscriptionsQuery(
  id?: string,
  slug?: string,
  githubHandle?: string,
  offset?: number,
  activeOnly?: boolean,
) {
  const activeOrNot = activeOnly ? 'onlyActiveSubscriptions: true' : 'onlySubscriptions: true'
  return graphql`{
    account(${makeAccountQueryPartial(id, slug, githubHandle)}) {
      orders(limit: 1000, offset:${offset}, ${activeOrNot}, filter: INCOMING) {
        nodes {
          id
          createdAt
          frequency
          status
          tier {
            name
          }
          amount {
            value
          }
          totalDonations {
            value
          }
          fromAccount {
            name
            id
            slug
            type
            socialLinks {
              url
              type
            }
            isIncognito
            imageUrl(height: 460, format: png)
          }
        }
      }
    }
  }`
}

/**
 * Get the account type from the API values.
 *
 * @param type The type of the account from the API
 * @returns The account type
 */
function getAccountType(type: string): 'User' | 'Organization' {
  switch (type) {
    case 'INDIVIDUAL':
      return 'User'
    case 'ORGANIZATION':
    case 'COLLECTIVE':
    case 'FUND':
    case 'PROJECT':
    case 'EVENT':
    case 'VENDOR':
    case 'BOT':
      return 'Organization'
    default:
      throw new Error(`Unknown account type: ${type}`)
  }
}

/**
 * Get the best URL from a list of social links.
 * The best URL is the first URL in a priority order,
 * with WEBSITE being the highest priority.
 * The rest of the order is somewhat arbitrary.
 *
 * @param socialLinks List of social links
 * @returns The best URL or `undefined` if no URL is found
 * @see makeQuery
 */
function getBestUrl(socialLinks: SocialLink[]): string | undefined {
  const urls = socialLinks
    .filter(i => i.type === 'WEBSITE' || i.type === 'GITHUB' || i.type === 'GITLAB' || i.type === 'TWITTER'
      || i.type === 'FACEBOOK' || i.type === 'YOUTUBE' || i.type === 'INSTAGRAM'
      || i.type === 'LINKEDIN' || i.type === 'DISCORD' || i.type === 'TUMBLR')
    .map(i => i.url)

  return urls[0]
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function toDate(value: string | undefined) {
  return new Date(value ?? Number.NaN)
}

const RE_GITHUB_URL = /github\.com\/([^/]*)/

function getSocialLogins(opencollectiveLogin: string, socialLinks: SocialLink[] = []): Record<string, string> {
  const socialLogins: Record<string, string> = {}
  for (const link of socialLinks) {
    if (link.type === 'GITHUB') {
      const login = RE_GITHUB_URL.exec(link.url)?.[1]
      if (login)
        socialLogins.github = login
    }
  }
  if (opencollectiveLogin)
    socialLogins.opencollective = opencollectiveLogin
  return socialLogins
}
