import type { Provider, Sponsorship } from '../types'
import { $fetch } from 'ofetch'

export const GitHubContributionsProvider: Provider = {
  name: 'githubContributions',
  fetchSponsors(config) {
    if (!config.githubContributions?.login)
      throw new Error('GitHub login is required for githubContributions provider')

    return fetchGitHubContributions(
      config.githubContributions?.token || config.token!,
      config.githubContributions.login,
      config.githubContributions.maxContributions,
      config.githubContributions.logarithmicScaling,
    )
  },
}

interface RepositoryOwner {
  login: string
  url: string
  avatarUrl: string
  __typename: 'User' | 'Organization'
}

interface RepoNode {
  name: string
  nameWithOwner: string
  url: string
  owner: RepositoryOwner
}

type GraphQLFetch = <T>(body: any) => Promise<T>

function createGraphQLFetch(token: string): GraphQLFetch {
  return async <T>(body: any): Promise<T> => {
    return await $fetch<T>('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    })
  }
}

async function fetchUserCreationDate(graphqlFetch: GraphQLFetch, login: string): Promise<Date> {
  const userInfoQuery = `
    query($login: String!) {
      user(login: $login) {
        createdAt
      }
    }
  `
  const userInfo = await graphqlFetch<{ data: { user: { createdAt: string } } }>({
    query: userInfoQuery,
    variables: { login },
  })
  return new Date(userInfo.data.user.createdAt)
}

function generateYearRanges(accountCreated: Date, now: Date): Array<{ from: string; to: string }> {
  const years: Array<{ from: string; to: string }> = []
  for (let year = accountCreated.getFullYear(); year <= now.getFullYear(); year++) {
    const from = year === accountCreated.getFullYear()
      ? accountCreated.toISOString()
      : `${year}-01-01T00:00:00Z`
    const to = year === now.getFullYear()
      ? now.toISOString()
      : `${year}-12-31T23:59:59Z`
    years.push({ from, to })
  }
  return years
}

async function fetchContributionsForYear(
  graphqlFetch: GraphQLFetch,
  login: string,
  from: string,
  to: string,
): Promise<RepoNode[]> {
  const contributionsQuery = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          commitContributionsByRepository {
            repository {
              name
              nameWithOwner
              url
              owner { login url avatarUrl __typename }
            }
          }
        }
      }
    }
  `
  type ContributionsResponse = { data: { user: { contributionsCollection: { commitContributionsByRepository: Array<{ repository: RepoNode }> } } } }
  const contributionsResp: ContributionsResponse = await graphqlFetch<ContributionsResponse>({
    query: contributionsQuery,
    variables: { login, from, to },
  })
  return contributionsResp.data.user.contributionsCollection.commitContributionsByRepository
    .map(item => item.repository)
    .filter(repo => repo?.nameWithOwner)
}

async function discoverReposFromContributions(
  graphqlFetch: GraphQLFetch,
  login: string,
  repoMap: Map<string, RepoNode>,
): Promise<void> {
  console.log(`[contribkit][githubContributions] fetching contribution timeline to discover more repos...`)
  try {
    const accountCreated = await fetchUserCreationDate(graphqlFetch, login)
    const now = new Date()
    const years = generateYearRanges(accountCreated, now)

    console.log(`[contribkit][githubContributions] querying contributions across ${years.length} years...`)

    for (const { from, to } of years) {
      try {
        const repos = await fetchContributionsForYear(graphqlFetch, login, from, to)
        for (const repo of repos) {
          repoMap.set(repo.nameWithOwner, repo)
        }
      }
      catch (e: any) {
        console.warn(`[contribkit][githubContributions] failed contributions query for ${from.slice(0, 4)}:`, e.message)
      }
    }
  }
  catch (e: any) {
    console.warn(`[contribkit][githubContributions] contribution timeline discovery failed:`, e.message)
  }
}

async function discoverReposFromMergedPRs(
  graphqlFetch: GraphQLFetch,
  login: string,
  repoMap: Map<string, RepoNode>,
): Promise<void> {
  console.log(`[contribkit][githubContributions] searching for repos with merged PRs...`)
  try {
    const searchQueryBase = `is:pr is:merged author:${login}`
    let searchAfter: string | null = null
    let page = 0
    const maxPages = 10

    do {
      type SearchResponse = { data: { search: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; edges: Array<{ node: { repository?: RepoNode } }> } } }
      const response: SearchResponse = await graphqlFetch<SearchResponse>({
        query: `
          query($searchQuery: String!, $after: String) {
            search(query: $searchQuery, type: ISSUE, first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              edges { node { ... on PullRequest { repository { name nameWithOwner url owner { login url avatarUrl __typename } } } } }
            }
          }
        `,
        variables: { searchQuery: searchQueryBase, after: searchAfter },
      })

      for (const edge of response.data.search.edges) {
        const r = edge.node.repository
        if (r?.nameWithOwner)
          repoMap.set(r.nameWithOwner, r)
      }

      searchAfter = response.data.search.pageInfo.endCursor
      page++

      if (response.data.search.pageInfo.hasNextPage && page < maxPages)
        console.log(`[contribkit][githubContributions] merged PR search page ${page}, ${repoMap.size} repos so far`)
    } while (searchAfter && page < maxPages)
  }
  catch (e: any) {
    console.warn(`[contribkit][githubContributions] merged PR search failed:`, e.message)
  }
}

async function fetchPRCountForRepo(
  graphqlFetch: GraphQLFetch,
  repo: RepoNode,
  login: string,
): Promise<number> {
  const searchQuery = `repo:${repo.nameWithOwner} is:pr is:merged author:${login}`
  try {
    const response = await graphqlFetch<{
      data: { search: { issueCount: number } }
    }>({
      query: `query($q: String!) { search(query: $q, type: ISSUE) { issueCount } }`,
      variables: { q: searchQuery },
    })
    return response.data.search.issueCount
  }
  catch (e: any) {
    console.warn(`[contribkit][githubContributions] failed PR count for ${repo.nameWithOwner}:`, e.message)
    return 0
  }
}

async function fetchMergedPRCounts(
  graphqlFetch: GraphQLFetch,
  allRepos: RepoNode[],
  login: string,
): Promise<Map<string, number>> {
  console.log(`[contribkit][githubContributions] fetching merged PR counts per repository...`)
  const repoPRs = new Map<string, number>()
  const batchSize = 10

  for (let i = 0; i < allRepos.length; i += batchSize) {
    const batch = allRepos.slice(i, i + batchSize)
    const counts = await Promise.all(batch.map(repo => fetchPRCountForRepo(graphqlFetch, repo, login)))

    for (let index = 0; index < batch.length; index++) {
      const count = counts[index]
      if (count > 0)
        repoPRs.set(batch[index].nameWithOwner, count)
    }

    if (i + batchSize < allRepos.length)
      console.log(`[contribkit][githubContributions] processed PR batches for ${Math.min(i + batchSize, allRepos.length)}/${allRepos.length} repos...`)
  }

  console.log(`[contribkit][githubContributions] found merged PR counts for ${repoPRs.size} repositories`)
  return repoPRs
}

function aggregateByOwner(results: Array<{ repo: RepoNode; prs: number }>): Map<string, { owner: RepositoryOwner; totalPRs: number; repos: Array<{ repo: RepoNode; prs: number }> }> {
  const aggregated = new Map<string, { owner: RepositoryOwner; totalPRs: number; repos: Array<{ repo: RepoNode; prs: number }> }>()

  for (const { repo, prs } of results) {
    const key = `${repo.owner.__typename}:${repo.owner.login}`
    const existing = aggregated.get(key)

    if (existing) {
      existing.totalPRs += prs
      existing.repos.push({ repo, prs })
    }
    else {
      aggregated.set(key, { owner: repo.owner, totalPRs: prs, repos: [{ repo, prs }] })
    }
  }

  return aggregated
}

function logConsolidatedOwners(aggregated: Map<string, { owner: RepositoryOwner; totalPRs: number; repos: Array<{ repo: RepoNode; prs: number }> }>): void {
  const consolidated = Array.from(aggregated.values()).filter(a => a.repos.length > 1)
  if (consolidated.length) {
    console.log(`[contribkit][githubContributions] consolidated ${consolidated.length} owners with multiple repos:`)
    for (const { owner, repos, totalPRs } of consolidated.toSorted((a, b) => b.repos.length - a.repos.length).slice(0, 10))
      console.log(`  - ${owner.login}: ${repos.length} repos, ${totalPRs} merged PRs`)
    if (consolidated.length > 10)
      console.log(`  ... and ${consolidated.length - 10} more`)
  }
}

function applyContributionScaling(
  totalPRs: number,
  maxContributions?: number,
  logarithmicScaling?: boolean,
): number {
  let scaled = totalPRs

  // Apply logarithmic scaling if enabled
  if (logarithmicScaling && scaled > 0) {
    // Use log10(x + 1) to handle values smoothly
    // Multiply by 10 to keep numbers in a reasonable range
    scaled = Math.log10(scaled + 1) * 10
  }

  // Apply max cap if specified
  if (maxContributions !== undefined && scaled > maxContributions) {
    scaled = maxContributions
  }

  return scaled
}

function convertToSponsorships(
  aggregated: Map<string, { owner: RepositoryOwner; totalPRs: number; repos: Array<{ repo: RepoNode; prs: number }> }>,
  maxContributions?: number,
  logarithmicScaling?: boolean,
): Sponsorship[] {
  return Array.from(aggregated.values())
    .sort((a, b) => b.totalPRs - a.totalPRs)
    .map(({ owner, totalPRs, repos }) => {
      const scaledPRs = applyContributionScaling(totalPRs, maxContributions, logarithmicScaling)
      const linkUrl = repos.length === 1 ? repos[0].repo.url : owner.url
      return {
        sponsor: { type: owner.__typename, login: owner.login, name: owner.login, avatarUrl: owner.avatarUrl, linkUrl, socialLogins: { github: owner.login } },
        isOneTime: false,
        monthlyDollars: scaledPRs,
        privacyLevel: 'PUBLIC',
        tierName: 'Repository',
        createdAt: new Date().toISOString(),
        provider: 'githubContributions',
        raw: { owner, totalPRs, scaledPRs, repoCount: repos.length },
      }
    })
}

export async function fetchGitHubContributions(
  token: string,
  login: string,
  maxContributions?: number,
  logarithmicScaling?: boolean,
): Promise<Sponsorship[]> {
  if (!token)
    throw new Error('GitHub token is required')

  if (!login)
    throw new Error('GitHub login is required')

  const graphqlFetch = createGraphQLFetch(token)

  console.log(`[contribkit][githubContributions] discovering repositories (sources: contributionsCollection + merged PR search)...`)

  const repoMap = new Map<string, RepoNode>()

  await discoverReposFromContributions(graphqlFetch, login, repoMap)
  console.log(`[contribkit][githubContributions] found ${repoMap.size} repos after contribution timeline`)

  await discoverReposFromMergedPRs(graphqlFetch, login, repoMap)
  console.log(`[contribkit][githubContributions] found ${repoMap.size} repos after merged PR search`)

  const allRepos = Array.from(repoMap.values())
  console.log(`[contribkit][githubContributions] discovered ${allRepos.length} total unique repositories`)

  const repoPRs = await fetchMergedPRCounts(graphqlFetch, allRepos, login)

  const results: Array<{ repo: RepoNode; prs: number }> = []
  for (const repo of allRepos) {
    const prs = repoPRs.get(repo.nameWithOwner) || 0
    if (prs > 0)
      results.push({ repo, prs })
  }
  console.log(`[contribkit][githubContributions] computed merged PR counts for ${results.length} repositories (from ${allRepos.length} total repos with PRs)`)

  const aggregated = aggregateByOwner(results)
  logConsolidatedOwners(aggregated)

  const scalingInfo = []
  if (maxContributions !== undefined)
    scalingInfo.push(`max cap: ${maxContributions}`)
  if (logarithmicScaling)
    scalingInfo.push('logarithmic scaling enabled')
  if (scalingInfo.length > 0)
    console.log(`[contribkit][githubContributions] applying contribution scaling: ${scalingInfo.join(', ')}`)

  return convertToSponsorships(aggregated, maxContributions, logarithmicScaling)
}
