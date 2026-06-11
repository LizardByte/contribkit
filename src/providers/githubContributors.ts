import type { Provider, Sponsorship } from '../types'
import { $fetch } from 'ofetch'
import { getCredentials } from '../configs/credentials'

export const GitHubContributorsProvider: Provider = {
  name: 'githubContributors',
  fetchSponsors(config) {
    if (!config.githubContributors?.repo)
      throw new Error('GitHub repository is required')

    return fetchGitHubContributors(
      getCredentials(config).githubContributors?.token,
      config.githubContributors.login,
      config.githubContributors.repo,
      config.githubContributors?.minContributions,
    )
  },
}

export async function fetchGitHubContributors(
  token: string | undefined,
  login: string | undefined,
  repo: string,
  minContributions = 1,
): Promise<Sponsorship[]> {
  if (!token)
    throw new Error('GitHub token is required')

  if (!login)
    throw new Error('GitHub login is required')

  if (!repo)
    throw new Error('GitHub repository is required')

  const allContributors: Array<{
    login: string
    contributions: number
    type: string
    url: string
    avatar_url: string
  }> = []

  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const response = await $fetch<typeof allContributors>(
      `https://api.github.com/repos/${login}/${repo}/contributors`,
      {
        query: {
          page: String(page),
          per_page: '100',
        },
        headers: {
          Authorization: `bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    )

    if (!response?.length)
      break

    allContributors.push(...response)

    // GitHub returns exactly 100 items when there are more pages
    hasNextPage = response.length === 100
    page++
  }

  return allContributors
    .filter(contributor =>
      contributor.type === 'User'
      && contributor.contributions >= minContributions,
    )
    .map(contributor => ({
      sponsor: {
        type: 'User',
        login: contributor.login,
        name: contributor.login,
        avatarUrl: contributor.avatar_url,
        linkUrl: contributor.url,
      },
      isOneTime: false,
      monthlyDollars: contributor.contributions,
      privacyLevel: 'PUBLIC',
      tierName: 'Contributor',
      createdAt: new Date().toISOString(),
      provider: 'githubContributors',
    }))
}
