import type { Buffer } from 'node:buffer'
import type { ContribkitConfig, ContribkitMainConfig, ContribkitRenderer, ContribkitRenderOptions, SponsorMatcher, Sponsorship } from './types'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { notNullish } from '@antfu/utils'
import c from 'ansis'
import { consola } from 'consola'
import { version } from '../package.json'
import { parseCache, stringifyCache } from './cache'
import { loadConfig } from './configs'
import { resolveAvatars, svgToPng, svgToWebp } from './processing/image'
import { guessProviders, resolveProviders } from './providers'
import { builtinRenderers } from './renders'
import { outputFormats } from './types'

type Logger = typeof consola
type ResolvedConfig = Required<ContribkitConfig>
type ResolvedMainConfig = Required<ContribkitMainConfig>
type Replacement = ((sponsor: Sponsorship) => string) | [string, string]

export {
  tiersComposer as defaultComposer,
  // default
  tiersRenderer as defaultRenderer,

  tiersComposer,
  tiersRenderer,
} from './renders/tiers'

function r(path: string) {
  return `./${relative(process.cwd(), path)}`
}

export async function run(inlineConfig?: ContribkitConfig, t = consola) {
  t.log(formatHeader())

  const fullConfig = await loadConfig(inlineConfig)
  const config = fullConfig as ResolvedMainConfig
  const dir = resolve(process.cwd(), config.outputDir)
  const cacheFile = resolveCacheFile(dir, config)
  const providers = resolveProviders(config.providers ?? guessProviders(config))

  validateRenderNames(config.renders, fullConfig)

  const linksReplacements = normalizeReplacements(config.replaceLinks)
  const avatarsReplacements = normalizeReplacements(config.replaceAvatars)

  let allSponsors = await getSponsors(
    config,
    providers,
    cacheFile,
    linksReplacements,
    avatarsReplacements,
    t,
  )

  sortSponsors(allSponsors)

  allSponsors = (await config.onSponsorsReady?.(allSponsors)) ?? allSponsors
  await renderSponsors(fullConfig, config, allSponsors, t)
}

function formatHeader() {
  const title = c.magenta.bold('ContribKit')
  const versionText = c.dim(`v${version}`)
  return `\n${title} ${versionText}\n`
}

function resolveCacheFile(dir: string, config: ResolvedMainConfig) {
  const filename = config.mode === 'sponsees'
    ? config.cacheFileSponsees
    : config.cacheFile
  return resolve(dir, filename)
}

function validateRenderNames(renders: ContribkitConfig['renders'], fullConfig: ResolvedConfig) {
  const names = new Set<string>()
  for (const [idx, renderOptions] of (renders ?? []).entries()) {
    const name = renderOptions.name || fullConfig.name || fullConfig.mode
    if (names.has(name))
      throw new Error(`Duplicate render name: ${name} at index ${idx}`)
    names.add(name)
  }
}

async function getSponsors(
  config: ResolvedMainConfig,
  providers: ReturnType<typeof resolveProviders>,
  cacheFile: string,
  linksReplacements: Replacement[],
  avatarsReplacements: Replacement[],
  t: Logger,
) {
  if (fs.existsSync(cacheFile) && !config.force)
    return await loadSponsorsFromCache(cacheFile, t)

  const allSponsors = await fetchFreshSponsors(config, providers, linksReplacements, avatarsReplacements, t)
  await writeSponsorsCache(cacheFile, allSponsors)
  return allSponsors
}

async function loadSponsorsFromCache(cacheFile: string, t: Logger) {
  const allSponsors = parseCache(await fsp.readFile(cacheFile, 'utf8'))
  t.success(`Loaded from cache ${r(cacheFile)}`)
  return allSponsors
}

async function fetchFreshSponsors(
  config: ResolvedMainConfig,
  providers: ReturnType<typeof resolveProviders>,
  linksReplacements: Replacement[],
  avatarsReplacements: Replacement[],
  t: Logger,
) {
  let allSponsors = await fetchProviderSponsors(config, providers, t)
  allSponsors = (await config.onSponsorsAllFetched?.(allSponsors)) ?? allSponsors
  allSponsors = mergeSponsorGroups(allSponsors, config, t)
  applySponsorReplacements(allSponsors, linksReplacements, avatarsReplacements)

  t.info('Resolving avatars...')
  await resolveAvatars(allSponsors, config.fallbackAvatar, t)
  t.success('Avatars resolved')

  return allSponsors
}

async function fetchProviderSponsors(config: ResolvedMainConfig, providers: ReturnType<typeof resolveProviders>, t: Logger) {
  const allSponsors: Sponsorship[] = []
  for (const provider of providers) {
    t.info(`Fetching sponsorships from ${provider.name}...`)
    let sponsors = await provider.fetchSponsors(config)
    sponsors.forEach(s => s.provider = provider.name)
    sponsors = (await config.onSponsorsFetched?.(sponsors, provider.name)) ?? sponsors
    t.success(`${sponsors.length} sponsorships fetched from ${provider.name}`)
    allSponsors.push(...sponsors)
  }
  return allSponsors
}

function mergeSponsorGroups(allSponsors: Sponsorship[], config: ResolvedMainConfig, t: Logger) {
  const sponsorsMergeMap = new Map<Sponsorship, Set<Sponsorship>>()
  applyConfiguredMergeRules(sponsorsMergeMap, allSponsors, config, t)
  applyAutoMerge(sponsorsMergeMap, allSponsors, config)
  return applyMergedSponsors(sponsorsMergeMap, allSponsors, t)
}

function applyConfiguredMergeRules(
  sponsorsMergeMap: Map<Sponsorship, Set<Sponsorship>>,
  allSponsors: Sponsorship[],
  config: ResolvedMainConfig,
  t: Logger,
) {
  for (const rule of config.mergeSponsors || []) {
    if (typeof rule === 'function')
      applyCustomMergeRule(sponsorsMergeMap, allSponsors, rule)
    else
      applyMatcherMergeRule(sponsorsMergeMap, allSponsors, rule, t)
  }
}

function applyCustomMergeRule(
  sponsorsMergeMap: Map<Sponsorship, Set<Sponsorship>>,
  allSponsors: Sponsorship[],
  rule: (sponsor: Sponsorship, allSponsors: Sponsorship[]) => Sponsorship[] | void,
) {
  for (const ship of allSponsors) {
    const result = rule(ship, allSponsors)
    if (result)
      pushSponsorGroup(sponsorsMergeMap, result)
  }
}

function applyMatcherMergeRule(
  sponsorsMergeMap: Map<Sponsorship, Set<Sponsorship>>,
  allSponsors: Sponsorship[],
  rule: SponsorMatcher[],
  t: Logger,
) {
  const group = rule.flatMap((matcher) => {
    const matched = allSponsors.filter(s => matchSponsor(s, matcher))
    if (!matched.length)
      t.warn(`No sponsor matched for ${JSON.stringify(matcher)}`)
    return matched
  })
  pushSponsorGroup(sponsorsMergeMap, group)
}

function applyAutoMerge(
  sponsorsMergeMap: Map<Sponsorship, Set<Sponsorship>>,
  allSponsors: Sponsorship[],
  config: ResolvedMainConfig,
) {
  if (!config.sponsorsAutoMerge)
    return

  for (const ship of allSponsors) {
    for (const [provider, login] of Object.entries(ship.sponsor.socialLogins ?? {})) {
      const matched = allSponsors.filter(s => s.sponsor.login === login && s.provider === provider)
      pushSponsorGroup(sponsorsMergeMap, [ship, ...matched])
    }
  }
}

function applyMergedSponsors(sponsorsMergeMap: Map<Sponsorship, Set<Sponsorship>>, allSponsors: Sponsorship[], t: Logger) {
  const removeSponsors = new Set<Sponsorship>()
  const groups = new Set(sponsorsMergeMap.values())
  for (const group of groups) {
    if (group.size === 1)
      continue
    const sorted = [...group]
      .sort((a, b) => allSponsors.indexOf(a) - allSponsors.indexOf(b))

    t.info(`Merging ${formatMergedSponsors(sorted)}`)

    for (const s of sorted.slice(1))
      removeSponsors.add(s)
    mergeSponsors(sorted[0], sorted.slice(1))
  }

  return allSponsors.filter(s => !removeSponsors.has(s))
}

function formatMergedSponsors(sponsors: Sponsorship[]) {
  return sponsors.map(i => c.cyan(`@${i.sponsor.login}(${i.provider})`)).join(' + ')
}

function applySponsorReplacements(sponsors: Sponsorship[], linksReplacements: Replacement[], avatarsReplacements: Replacement[]) {
  for (const ship of sponsors) {
    ship.sponsor.linkUrl = findReplacement(linksReplacements, ship, ship.sponsor.linkUrl) ?? ship.sponsor.linkUrl
    ship.sponsor.avatarUrl = findReplacement(avatarsReplacements, ship, ship.sponsor.avatarUrl) ?? ship.sponsor.avatarUrl
  }
}

function findReplacement(replacements: Replacement[], ship: Sponsorship, current: string | undefined) {
  for (const replacement of replacements) {
    const result = getReplacementValue(replacement, ship, current)
    if (result)
      return result
  }
}

function getReplacementValue(replacement: Replacement, ship: Sponsorship, current: string | undefined) {
  if (typeof replacement === 'function')
    return replacement(ship)
  return replacement[0] === current ? replacement[1] : undefined
}

async function writeSponsorsCache(cacheFile: string, allSponsors: Sponsorship[]) {
  await fsp.mkdir(dirname(cacheFile), { recursive: true })
  await fsp.writeFile(cacheFile, stringifyCache(allSponsors))
}

function sortSponsors(allSponsors: Sponsorship[]) {
  allSponsors.sort((a, b) =>
    b.monthlyDollars - a.monthlyDollars // DESC amount
    || Date.parse(b.createdAt!) - Date.parse(a.createdAt!) // DESC date
    || (b.sponsor.login ?? b.sponsor.name).localeCompare(a.sponsor.login ?? a.sponsor.name), // ASC name
  )
}

async function renderSponsors(
  fullConfig: ResolvedConfig,
  config: ResolvedMainConfig,
  allSponsors: Sponsorship[],
  t: Logger,
) {
  if (!config.renders?.length) {
    const renderer = builtinRenderers[fullConfig.renderer ?? 'tiers']
    await applyRenderer(
      renderer,
      config,
      fullConfig,
      allSponsors,
      t,
    )
    return
  }

  t.info(`Generating with ${config.renders.length} renders...`)
  await Promise.all(config.renders.map(renderOptions =>
    renderWithOptions(fullConfig, config, renderOptions, allSponsors, t),
  ))
}

async function renderWithOptions(
  fullConfig: ResolvedConfig,
  config: ResolvedMainConfig,
  renderOptions: ContribkitRenderOptions,
  allSponsors: Sponsorship[],
  t: Logger,
) {
  const mergedOptions = {
    ...fullConfig,
    ...renderOptions,
  }
  const renderer = builtinRenderers[mergedOptions.renderer ?? 'tiers']
  await applyRenderer(
    renderer,
    config,
    mergedOptions,
    allSponsors,
    t,
  )
}

export async function applyRenderer(
  renderer: ContribkitRenderer,
  config: Required<ContribkitMainConfig>,
  renderOptions: Required<ContribkitRenderOptions>,
  sponsors: Sponsorship[],
  t = consola,
) {
  sponsors = [...sponsors]
  sponsors = (await renderOptions.onBeforeRenderer?.(sponsors)) ?? sponsors

  const logPrefix = c.dim`[${renderOptions.name}]`
  const dir = resolve(process.cwd(), config.outputDir)
  await fsp.mkdir(dir, { recursive: true })

  if (renderOptions.filter)
    sponsors = sponsors.filter(s => renderOptions.filter(s, sponsors) !== false)
  if (!renderOptions.includePrivate)
    sponsors = sponsors.filter(s => s.privacyLevel !== 'PRIVATE')

  renderOptions.imageFormat ??= 'webp'

  const processingSvg = (async () => {
    let svgWebp = await renderer.renderSVG(renderOptions, sponsors)

    if (renderOptions.onSvgGenerated) {
      svgWebp = (await renderOptions.onSvgGenerated(svgWebp)) ?? svgWebp
    }
    return svgWebp
  })()

  if (renderOptions.formats) {
    let svgPng: Promise<string> | undefined

    await Promise.all(renderOptions.formats.map(async (format) => {
      if (!outputFormats.includes(format))
        throw new Error(`Unsupported format: ${format}`)

      const path = join(dir, `${renderOptions.name}.${format}`)

      let data: string | Buffer

      if (format === 'svg') {
        t.info(`${logPrefix} Composing SVG...`)
        data = await processingSvg
      }
      else if (format === 'json') {
        data = JSON.stringify(sponsors, null, 2)
      }
      else {
        svgPng ??= renderer.renderSVG({
          ...renderOptions,
          imageFormat: 'png',
        }, sponsors)

        const pngSvg = await svgPng
        data = format === 'png'
          ? await svgToPng(pngSvg)
          : await svgToWebp(pngSvg)
      }

      await fsp.writeFile(path, data)

      t.success(`${logPrefix} Wrote to ${r(path)}`)
    }))
  }
}

function pushSponsorGroup(sponsorsMergeMap: Map<Sponsorship, Set<Sponsorship>>, group: Sponsorship[]) {
  const existingSets = new Set(group.map(s => sponsorsMergeMap.get(s)).filter(notNullish))
  let set = existingSets.values().next().value
  if (!set) {
    set = new Set(group)
  }
  // Multiple sets, merge them into one
  else if (existingSets.size > 1) {
    set = new Set()
    for (const existingSet of existingSets) {
      for (const sponsor of existingSet)
        set.add(sponsor)
    }
  }

  for (const sponsor of group) {
    set.add(sponsor)
    sponsorsMergeMap.set(sponsor, set)
  }
}

function matchSponsor(sponsor: Sponsorship, matcher: SponsorMatcher) {
  if (matcher.provider && sponsor.provider !== matcher.provider)
    return false
  if (matcher.login && sponsor.sponsor.login !== matcher.login)
    return false
  if (matcher.name && sponsor.sponsor.name !== matcher.name)
    return false
  if (matcher.type && sponsor.sponsor.type !== matcher.type)
    return false
  return true
}

function mergeSponsors(main: Sponsorship, sponsors: Sponsorship[]) {
  const all = [main, ...sponsors]
  main.isOneTime = all.every(s => s.isOneTime)
  main.expireAt = all.map(s => s.expireAt).filter(notNullish).sort((a, b) => b.localeCompare(a))[0]
  main.createdAt = all.map(s => s.createdAt).filter(notNullish).sort((a, b) => a.localeCompare(b))[0]
  main.monthlyDollars = all.every(s => s.monthlyDollars === -1)
    ? -1
    : all.filter(s => s.monthlyDollars > 0).reduce((a, b) => a + b.monthlyDollars, 0)
  main.provider = [...new Set(all.map(s => s.provider))].join('+')
  return main
}

function normalizeReplacements(replaces: ContribkitMainConfig['replaceLinks']) {
  const array = (Array.isArray(replaces) ? replaces : [replaces]).filter(notNullish)
  const entries: Replacement[] = []
  for (const item of array) {
    if (typeof item === 'function')
      entries.push(item)
    else
      entries.push(...Object.entries(item) as [string, string][])
  }
  return entries
}
