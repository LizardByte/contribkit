import type { ContribkitConfig, GitHubAccountType } from '../types'
import process from 'node:process'
import dotenv from 'dotenv'

function getDeprecatedEnv(name: string, replacement: string) {
  const value = process.env[name]
  if (value)
    console.warn(`[contribkit] env.${name} is deprecated, use env.${replacement} instead`)
  return value
}

export function loadEnv(): Partial<ContribkitConfig> {
  dotenv.config()

  const config: Partial<ContribkitConfig> = {
    github: {
      login: process.env.CONTRIBKIT_GITHUB_LOGIN || process.env.GITHUB_LOGIN,
      token: process.env.CONTRIBKIT_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
      type: (process.env.CONTRIBKIT_GITHUB_TYPE || process.env.GITHUB_TYPE) as GitHubAccountType | undefined,
    },
    patreon: {
      token: process.env.CONTRIBKIT_PATREON_TOKEN || process.env.PATREON_TOKEN,
    },
    opencollective: {
      key: process.env.CONTRIBKIT_OPENCOLLECTIVE_KEY || process.env.OPENCOLLECTIVE_KEY,
      id: process.env.CONTRIBKIT_OPENCOLLECTIVE_ID || process.env.OPENCOLLECTIVE_ID,
      slug: process.env.CONTRIBKIT_OPENCOLLECTIVE_SLUG || process.env.OPENCOLLECTIVE_SLUG,
      githubHandle: process.env.CONTRIBKIT_OPENCOLLECTIVE_GH_HANDLE || process.env.OPENCOLLECTIVE_GH_HANDLE,
      type: process.env.CONTRIBKIT_OPENCOLLECTIVE_TYPE || process.env.OPENCOLLECTIVE_TYPE,
    },
    afdian: {
      userId: process.env.CONTRIBKIT_AFDIAN_USER_ID || process.env.AFDIAN_USER_ID,
      token: process.env.CONTRIBKIT_AFDIAN_TOKEN || process.env.AFDIAN_TOKEN,
      exechangeRate: Number.parseFloat(process.env.CONTRIBKIT_AFDIAN_EXECHANGERATE || process.env.AFDIAN_EXECHANGERATE || '0') || undefined,
    },
    polar: {
      token: process.env.CONTRIBKIT_POLAR_TOKEN || process.env.POLAR_TOKEN,
      organization: process.env.CONTRIBKIT_POLAR_ORGANIZATION || process.env.POLAR_ORGANIZATION,
    },
    liberapay: {
      login: process.env.CONTRIBKIT_LIBERAPAY_LOGIN || process.env.LIBERAPAY_LOGIN,
    },
    outputDir: process.env.CONTRIBKIT_DIR,
    githubContributors: {
      login: process.env.CONTRIBKIT_GITHUB_CONTRIBUTORS_LOGIN,
      token: process.env.CONTRIBKIT_GITHUB_CONTRIBUTORS_TOKEN,
      minContributions: Number(process.env.CONTRIBKIT_GITHUB_CONTRIBUTORS_MIN) || 1,
      repo: process.env.CONTRIBKIT_GITHUB_CONTRIBUTORS_REPO,
    },
    gitlabContributors: {
      token: process.env.CONTRIBKIT_GITLAB_CONTRIBUTORS_TOKEN,
      minContributions: Number(process.env.CONTRIBKIT_GITLAB_CONTRIBUTORS_MIN) || 1,
      repoId: Number(process.env.CONTRIBKIT_GITLAB_CONTRIBUTORS_REPO_ID),
    },
    crowdinContributors: {
      token: process.env.CONTRIBKIT_CROWDIN_TOKEN,
      projectId: Number(process.env.CONTRIBKIT_CROWDIN_PROJECT_ID),
      minTranslations: Number(process.env.CONTRIBKIT_CROWDIN_MIN_TRANSLATIONS) || 1,
    },
  }

  // remove undefined keys
  return JSON.parse(JSON.stringify(config))
}
