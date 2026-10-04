import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

function json(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}

// Hold the first group of requests so concurrency and ordering checks do not
// depend on elapsed-time comparisons or external services.
function requestGate(size) {
  let active = 0
  let maximum = 0
  let started = 0
  let release
  let ready
  const pending = new Promise(resolve => release = resolve)
  const filled = new Promise(resolve => ready = resolve)

  return {
    async wait() {
      active++
      started++
      maximum = Math.max(maximum, active)
      if (started === size)
        ready()
      try {
        await pending
      }
      finally {
        active--
      }
    },
    async open() {
      let timer
      try {
        await Promise.race([
          filled,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Only ${started} requests started before the gate opened`)), 1000)
          }),
        ])
      }
      finally {
        clearTimeout(timer)
      }
      // Let queued microtasks run so an unbounded implementation exceeds size.
      await delay(0)
      assert.equal(started, size)
      release()
    },
    verify() {
      assert.equal(active, 0)
      assert.equal(maximum, size)
    },
  }
}

function repository(year) {
  return {
    name: 'repo',
    nameWithOwner: 'owner/repo',
    url: `https://github.com/owner/repo?year=${year}`,
    owner: { login: 'owner', url: 'https://github.com/owner', avatarUrl: 'avatar', __typename: 'User' },
  }
}

async function github(failYear) {
  const finalYear = new Date().getFullYear()
  const firstYear = finalYear - 13
  const gate = requestGate(10)
  const warnings = []
  const completed = []
  console.warn = (...args) => warnings.push(args.join(' '))

  globalThis.fetch = async (_url, options) => {
    const { query, variables } = JSON.parse(options.body)
    if (query.includes('createdAt'))
      return json({ data: { user: { createdAt: `${firstYear}-01-01T00:00:00Z` } } })
    if (query.includes('contributionsCollection')) {
      const year = Number(variables.from.slice(0, 4))
      await gate.wait()
      // The first year finishes last in the initial group.
      if (year === firstYear)
        await delay(30)
      completed.push(year)
      if (failYear && year === finalYear)
        throw new Error('year unavailable')
      return json({ data: { user: { contributionsCollection: {
        commitContributionsByRepository: [{ repository: repository(year) }],
      } } } })
    }
    if (query.includes('pageInfo'))
      return json({ data: { search: { pageInfo: { hasNextPage: false, endCursor: null }, edges: [] } } })
    return json({ data: { search: { issueCount: 3 } } })
  }

  const { fetchGitHubContributions } = await import('../../src/providers/githubContributions.ts')
  const result = fetchGitHubContributions('test-token', 'contributor')
  await gate.open()
  const sponsorships = await result
  gate.verify()
  assert.notEqual(completed[0], firstYear)
  assert.equal(sponsorships.length, 1)
  assert.equal(sponsorships[0].sponsor.linkUrl, repository(failYear ? finalYear - 1 : finalYear).url)
  assert.equal(sponsorships[0].monthlyDollars, 3)
  assert.equal(warnings.length, failYear ? 1 : 0)
}

async function githubCounts() {
  const repos = Array.from({ length: 25 }, (_, i) => ({
    ...repository(new Date().getFullYear()),
    nameWithOwner: `owner${i}/repo`,
    owner: { ...repository(0).owner, login: `owner${i}` },
  }))
  const gate = requestGate(10)
  const warnings = []
  const completed = []
  let active = 0
  let maximum = 0
  let releaseSlowRequest
  const nextRequestStarted = new Promise(resolve => releaseSlowRequest = resolve)
  console.warn = (...args) => warnings.push(args.join(' '))

  globalThis.fetch = async (_url, options) => {
    const { query, variables } = JSON.parse(options.body)
    if (query.includes('createdAt'))
      return json({ data: { user: { createdAt: `${new Date().getFullYear()}-01-01T00:00:00Z` } } })
    if (query.includes('contributionsCollection'))
      return json({ data: { user: { contributionsCollection: {
        commitContributionsByRepository: repos.map(repository => ({ repository })),
      } } } })
    if (query.includes('pageInfo'))
      return json({ data: { search: { pageInfo: { hasNextPage: false, endCursor: null }, edges: [] } } })

    const index = Number(/repo:owner(\d+)\/repo/.exec(variables.q)[1])
    active++
    maximum = Math.max(maximum, active)
    try {
      await gate.wait()
      // A batch barrier would keep request 10 queued behind request 0.
      if (index === 0) {
        let timer
        try {
          await Promise.race([
            nextRequestStarted,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('PR-count requests stalled behind a batch barrier')), 1000)
            }),
          ])
        }
        finally {
          clearTimeout(timer)
        }
      }
      if (index === 10)
        releaseSlowRequest()
      completed.push(index)
      if (index === 3)
        return new Response('count unavailable', { status: 400 })
      return json({ data: { search: { issueCount: index === 4 ? 0 : 1 } } })
    }
    finally {
      active--
    }
  }

  const { fetchGitHubContributions } = await import('../../src/providers/githubContributions.ts')
  const result = fetchGitHubContributions('test-token', 'contributor')
  await gate.open()
  const sponsorships = await result
  assert.equal(active, 0)
  assert.equal(maximum, 10)
  assert.equal(completed.length, repos.length)
  assert.ok(completed.indexOf(10) < completed.indexOf(0))
  assert.deepEqual(sponsorships.map(ship => ship.sponsor.login),
    repos.filter((_, i) => i !== 3 && i !== 4).map(repo => repo.owner.login))
  assert.ok(sponsorships.every(ship => ship.monthlyDollars === 1))
  assert.equal(warnings.length, 1)
}

async function gitlab() {
  const contributors = Array.from({ length: 101 }, (_, i) => ({
    name: `user${i}`, email: `${i}@example.test`, commits: i < 24 ? 2 : 0,
  }))
  const gate = requestGate(10)
  const pages = []
  const searched = []
  const warnings = []
  console.warn = (...args) => warnings.push(args.join(' '))

  globalThis.fetch = async (input) => {
    const url = new URL(input)
    if (url.pathname.endsWith('/contributors')) {
      const page = Number(url.searchParams.get('page'))
      pages.push(page)
      return json(contributors.slice((page - 1) * 100, page * 100))
    }
    const index = Number(url.searchParams.get('search').split('@')[0])
    searched.push(index)
    await gate.wait()
    if (index === 0)
      await delay(30)
    if (index === 3)
      return new Response('user unavailable', { status: 400 })
    return json(index === 4 ? [] : [{
      id: index, username: `user${index}`, name: `User ${index}`,
      avatar_url: `avatar${index}`, web_url: `https://gitlab.com/user${index}`,
    }])
  }

  const { fetchGitlabContributors } = await import('../../src/providers/gitlabContributors.ts')
  const result = fetchGitlabContributors('test-token', 123, 2)
  await gate.open()
  const sponsorships = await result
  gate.verify()
  assert.deepEqual(pages, [1, 2])
  assert.equal(searched.length, 24)
  assert.deepEqual(sponsorships.map(ship => ship.sponsor.login),
    Array.from({ length: 24 }, (_, i) => i).filter(i => i !== 3 && i !== 4).map(i => `user${i}`))
  assert.ok(sponsorships.every(ship => ship.monthlyDollars === 2))
  assert.equal(warnings.length, 1)
}

async function circles(failImage) {
  const { default: sharp } = await import('sharp')
  const { hierarchy, pack } = await import('d3-hierarchy')
  const { circlesRenderer } = await import('../../src/renders/circles.ts')
  const { generateBadge, SvgComposer } = await import('../../src/processing/svg.ts')
  const avatar = await sharp({ create: { width: 4, height: 4, channels: 4, background: 'red' } }).png().toBuffer()
  const sponsors = Array.from({ length: 20 }, (_, i) => ({
    sponsor: {
      type: 'User', login: `user${i}`, name: `User ${i}`, avatarUrl: 'avatar',
      avatarBuffer: failImage && i === 0 ? Buffer.from('invalid image') : avatar,
    },
    monthlyDollars: 20 - i,
  }))
  const config = {
    width: 200, imageFormat: 'png', svgInlineCSS: '', includePastSponsors: true,
    circles: { weightInterop: ship => ship.monthlyDollars },
  }
  if (failImage) {
    await assert.rejects(circlesRenderer.renderSVG(config, sponsors), /unsupported image format/i)
    return
  }

  const svg = await circlesRenderer.renderSVG(config, sponsors)
  const root = hierarchy({ ...sponsors[0], children: sponsors, id: 'root' })
    .sum(config.circles.weightInterop)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const packed = pack().size([config.width, config.width]).padding(config.width / 400)(root).descendants().slice(1)
  const composer = new SvgComposer(config)
  // Reference the original badge coordinates and packed order.
  const badges = await Promise.all(packed.map(circle =>
    generateBadge(circle.x - circle.r, circle.y - circle.r, circle.data.sponsor, {
      name: false, boxHeight: circle.r * 2, boxWidth: circle.r * 2, avatar: { size: circle.r * 2 },
    }, 0.5, config.imageFormat)))
  badges.forEach(badge => composer.addRaw(badge))
  composer.height = config.width
  assert.equal(svg, composer.generateSvg())
  assert.equal(await circlesRenderer.renderSVG(config, []), new SvgComposer(config).addSpan(config.width).generateSvg())
}

const scenarios = {
  'github': () => github(false),
  'github-failure': () => github(true),
  'github-counts': githubCounts,
  'gitlab': gitlab,
  'circles': () => circles(false),
  'circles-failure': () => circles(true),
}

assert.ok(Object.hasOwn(scenarios, process.argv[2]), 'Unknown test scenario')
await scenarios[process.argv[2]]()
