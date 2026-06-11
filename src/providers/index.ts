import type { ContribkitConfig, Provider, ProviderName } from '../types'
import { getCredentials } from '../configs/credentials'
import { AfdianProvider } from './afdian'
import { CrowdinContributorsProvider } from './crowdinContributors'
import { GitHubProvider } from './github'
import { GitHubContributorsProvider } from './githubContributors'
import { GitHubContributionsProvider } from './githubContributions'
import { GitlabContributorsProvider } from './gitlabContributors'
import { LiberapayProvider } from './liberapay'
import { OpenCollectiveProvider } from './opencollective'
import { PatreonProvider } from './patreon'
import { PolarProvider } from './polar'

export * from './github'

export const ProvidersMap = {
  github: GitHubProvider,
  patreon: PatreonProvider,
  opencollective: OpenCollectiveProvider,
  afdian: AfdianProvider,
  polar: PolarProvider,
  liberapay: LiberapayProvider,
  githubContributors: GitHubContributorsProvider,
  githubContributions: GitHubContributionsProvider,
  gitlabContributors: GitlabContributorsProvider,
  crowdinContributors: CrowdinContributorsProvider,
}

export function guessProviders(config: ContribkitConfig) {
  const items: ProviderName[] = []
  const credentials = getCredentials(config)
  const providerChecks: [ProviderName, boolean | string | number | undefined][] = [
    ['github', config.github?.login],
    ['patreon', credentials.patreon?.token],
    ['opencollective', config.opencollective?.id || config.opencollective?.slug || config.opencollective?.githubHandle],
    ['afdian', config.afdian?.userId && credentials.afdian?.token],
    ['polar', credentials.polar?.token],
    ['liberapay', config.liberapay?.login],
    ['githubContributors', config.githubContributors?.login && credentials.githubContributors?.token],
    ['githubContributions', config.githubContributions?.login && credentials.githubContributions?.token],
    ['gitlabContributors', credentials.gitlabContributors?.token && config.gitlabContributors?.repoId],
    ['crowdinContributors', config.crowdinContributors?.token && config.crowdinContributors?.projectId],
  ]

  for (const [provider, enabled] of providerChecks) {
    if (enabled)
      items.push(provider)
  }

  // fallback
  if (!items.length)
    items.push('github')

  return items
}

export function resolveProviders(names: (ProviderName | Provider)[]) {
  return Array.from(new Set(names))
    .map((i) => {
      if (typeof i === 'string') {
        const provider = ProvidersMap[i]
        if (!provider)
          throw new Error(`Unknown provider: ${i}`)
        return provider
      }
      return i
    })
}

export async function fetchSponsors(config: ContribkitConfig) {
  const providers = resolveProviders(guessProviders(config))
  const sponsorships = await Promise.all(
    providers.map(provider => provider.fetchSponsors(config)),
  )

  return sponsorships.flat(1)
}
