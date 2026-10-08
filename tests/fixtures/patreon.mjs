import assert from 'node:assert/strict'

const apiBase = 'https://www.patreon.com/api/oauth2/v2'
const membersPath = '/api/oauth2/v2/campaigns/1234560/members'
const nextPage = `${apiBase}/campaigns/1234560/members?page%5Bcursor%5D=second-page`
const pledgeStart = '2026-01-01T00:00:00Z'
const requests = []

function memberPage(rows, next) {
  return {
    data: rows.map(({ name, status, cents, gifted }) => ({
      id: `member-${name}`,
      type: 'member',
      attributes: {
        currently_entitled_amount_cents: cents,
        patron_status: status,
        pledge_relationship_start: pledgeStart,
        lifetime_support_cents: cents,
      },
      relationships: {
        user: { data: { id: name, type: 'user' } },
        currently_entitled_tiers: { data: gifted ? [{ id: 'tier', type: 'tier' }] : [] },
      },
    })),
    included: [
      ...rows.map(({ name }) => ({
        id: name,
        type: 'user',
        attributes: {
          first_name: name,
          full_name: `${name} Patron`,
          image_url: `https://example.com/${name}.png`,
          url: `https://www.patreon.com/${name}`,
        },
      })),
      { id: 'tier', type: 'tier', attributes: { amount_cents: 1000 } },
    ],
    links: { next },
  }
}

globalThis.fetch = async (request, options) => {
  const url = new URL(request)
  requests.push(url.href)
  assert.equal(url.origin, 'https://www.patreon.com')
  assert.ok(url.pathname.startsWith('/api/oauth2/v2/'), 'All Patreon requests must use API v2')
  assert.equal(options.method, 'GET')
  assert.equal(new Headers(options.headers).get('Authorization'), 'bearer test-token')

  let response
  if (url.pathname === '/api/oauth2/v2/campaigns') {
    assert.equal(url.searchParams.get('include'), null, 'Do not send the v1 include=null parameter')
    // API v2 returns resource IDs even when no attributes are requested.
    response = { data: [{ id: '1234560', type: 'campaign', attributes: {} }] }
  }
  else {
    assert.equal(url.pathname, membersPath)
    if (url.searchParams.has('page[cursor]')) {
      assert.equal(url.href, nextPage)
      response = memberPage([
        { name: 'gifted', status: 'active_patron', cents: 0, gifted: true },
        { name: 'former', status: 'former_patron', cents: 500 },
        { name: 'declined', status: 'declined_patron', cents: 500 },
      ], null)
    }
    else {
      assert.equal(url.searchParams.get('include'), 'user,currently_entitled_tiers')
      assert.ok(url.searchParams.get('fields[member]').includes('patron_status'))
      assert.ok(url.searchParams.get('fields[user]').includes('full_name'))
      assert.equal(url.searchParams.get('fields[tier]'), 'amount_cents')
      response = memberPage([
        { name: 'active', status: 'active_patron', cents: 599 },
        { name: 'free', status: null, cents: 0 },
      ], nextPage)
    }
  }
  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  })
}

const { fetchPatreonSponsors } = await import('../../src/providers/patreon.ts')
const sponsorships = await fetchPatreonSponsors('test-token')
assert.equal(requests.length, 3)
assert.equal(requests[0], `${apiBase}/campaigns`)
assert.equal(requests[2], nextPage)
assert.deepEqual(sponsorships.map(({ sponsor, monthlyDollars }) => [sponsor.login, monthlyDollars]), [
  ['active', 5],
  ['gifted', 10],
  ['former', -1],
  ['declined', -1],
])
assert.deepEqual(sponsorships[0], {
  sponsor: {
    avatarUrl: 'https://example.com/active.png',
    login: 'active',
    name: 'active Patron',
    type: 'User',
    linkUrl: 'https://www.patreon.com/active',
  },
  isOneTime: false,
  monthlyDollars: 5,
  privacyLevel: 'PUBLIC',
  tierName: 'Patreon',
  createdAt: pledgeStart,
})
