import type { Provider } from '../types.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCredentials } from '../configs/credentials.js'
import { loadEnv } from '../configs/env.js'
import { GitHubProvider } from './github.js'
import { guessProviders, ProvidersMap, resolveProviders } from './index.js'

afterEach(() => vi.unstubAllEnvs())

describe('guessProviders', () => {
  it('falls back to github when nothing is configured', () => {
    expect(guessProviders({})).toEqual(['github'])
  })

  it('detects each provider from its required config', () => {
    expect(guessProviders({ github: { login: 'antfu' } })).toEqual(['github'])
    expect(guessProviders({ credentials: { patreon: { token: 't' } } } as Parameters<typeof guessProviders>[0])).toEqual(['patreon'])
    expect(guessProviders({ opencollective: { slug: 'antfu' } })).toEqual(['opencollective'])
    expect(guessProviders({ afdian: { userId: 'u' }, credentials: { afdian: { token: 't' } } } as Parameters<typeof guessProviders>[0])).toEqual(['afdian'])
    expect(guessProviders({ credentials: { polar: { token: 't' } } } as Parameters<typeof guessProviders>[0])).toEqual(['polar'])
    expect(guessProviders({ liberapay: { login: 'antfu' } })).toEqual(['liberapay'])
    expect(guessProviders({ credentials: { kofi: { verificationToken: 't' } } } as Parameters<typeof guessProviders>[0])).toEqual(['kofi'])
    expect(guessProviders({ kofi: { dataFile: './events.json' } })).toEqual(['kofi'])
  })

  it('reads Ko-fi credentials separately from the public config', () => {
    vi.stubEnv('CONTRIBKIT_KOFI_VERIFICATION_TOKEN', 'webhook-token')
    vi.stubEnv('CONTRIBKIT_KOFI_DATA_FILE', './events.json')
    const env = loadEnv()
    expect(env.config.kofi).toEqual({ dataFile: './events.json' })
    expect(getCredentials(env.config).kofi).toEqual({ verificationToken: 'webhook-token' })
    expect(guessProviders(env.config)).toEqual(['kofi'])
  })

  it('ignores providers with incomplete config', () => {
    // afdian needs both userId and token
    expect(guessProviders({ afdian: { userId: 'u' } })).toEqual(['github'])
    // github needs a login
    expect(guessProviders({ github: {} })).toEqual(['github'])
  })

  it('collects multiple providers in declaration order', () => {
    expect(guessProviders({
      github: { login: 'antfu' },
      credentials: { polar: { token: 't' } },
      kofi: { dataFile: './events.json' },
    } as Parameters<typeof guessProviders>[0])).toEqual(['github', 'polar', 'kofi'])
  })
})

describe('resolveProviders', () => {
  it('maps provider names to their implementations', () => {
    expect(resolveProviders(['github'])).toEqual([GitHubProvider])
  })

  it('deduplicates repeated names', () => {
    expect(resolveProviders(['github', 'github'])).toEqual([GitHubProvider])
  })

  it('passes custom provider objects through untouched', () => {
    const custom: Provider = { name: 'custom', fetchSponsors: async () => [] }
    expect(resolveProviders([custom])).toEqual([custom])
  })

  it('throws on an unknown provider name', () => {
    // @ts-expect-error deliberately invalid provider name
    expect(() => resolveProviders(['nope'])).toThrow('Unknown provider: nope')
  })

  it('exposes every known provider in ProvidersMap', () => {
    expect(Object.keys(ProvidersMap)).toEqual([
      'github',
      'patreon',
      'opencollective',
      'afdian',
      'polar',
      'liberapay',
      'githubContributors',
      'githubContributions',
      'gitlabContributors',
      'crowdinContributors',
      'kofi',
    ])
  })
})
