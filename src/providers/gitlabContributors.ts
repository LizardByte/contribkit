import type { Provider, Sponsorship } from '../types'
import { $fetch } from 'ofetch'

interface GitLabContributor {
  name: string
  email: string
  commits: number
}

interface GitLabUser {
  id: number
  username: string
  name: string
  avatar_url: string
  web_url: string
}

export const GitlabContributorsProvider: Provider = {
  name: 'gitlabContributors',
  fetchSponsors(config) {
    if (!config.gitlabContributors?.repoId)
      throw new Error('Gitlab repoId is required')

    return fetchGitlabContributors(
      config.gitlabContributors?.token || config.token!,
      config.gitlabContributors.repoId,
      config.gitlabContributors?.minContributions,
    )
  },
}

export async function fetchGitlabContributors(
  token: string,
  repoId: number,
  minContributions: number = 1,
): Promise<Sponsorship[]> {
  if (!token)
    throw new Error('Gitlab token is required')
  if (!repoId)
    throw new Error('Gitlab repoId is required')

  const allContributors: GitLabContributor[] = []

  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const response = await $fetch<typeof allContributors>(
      `https://gitlab.com/api/v4/projects/${repoId}/repository/contributors`,
      {
        query: {
          page: String(page),
          per_page: '100',
          sort: 'desc',
        },
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response || !response.length)
      break

    allContributors.push(...response)

    // Gitlab returns exactly 100 items when there are more pages
    hasNextPage = response.length === 100
    page++
  }

  const sponsorships: Sponsorship[] = []

  for (const contributor of allContributors) {
    if (contributor.commits < minContributions)
      continue

    try {
      const userDetails = await $fetch<GitLabUser[]>('https://gitlab.com/api/v4/users', {
        query: {
          search: contributor.email,
        },
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      })

      if (userDetails && userDetails.length > 0) {
        const user = userDetails[0]
        sponsorships.push({
          sponsor: {
            type: 'User',
            login: user.username,
            name: user.username, // user.name is also available
            avatarUrl: user.avatar_url,
            linkUrl: user.web_url,
          },
          isOneTime: false,
          monthlyDollars: contributor.commits,
          privacyLevel: 'PUBLIC',
          tierName: 'Contributor',
          createdAt: new Date().toISOString(),
          provider: 'gitlabContributors',
        })
      }
    }
    catch (error) {
      console.warn(`Failed to fetch user details for ${contributor.email}:`, error)
    }
  }

  return sponsorships
}
