import type { ContribkitConfig, GitHubAccountType } from '../types'
import process from 'node:process'
import dotenv from 'dotenv'
import { loadEnvCredentials, pruneUndefined } from './credentials'

export interface EnvConfig {
  config: Partial<ContribkitConfig>
  credentials: ReturnType<typeof loadEnvCredentials>
}

export function loadEnv(): EnvConfig {
  dotenv.config({ quiet: true })

  const config: Partial<ContribkitConfig> = {
    mode: process.env.CONTRIBKIT_MODE as ContribkitConfig['mode'] | undefined,
    github: {
      login: process.env.CONTRIBKIT_GITHUB_LOGIN || process.env.GITHUB_LOGIN,
      type: (process.env.CONTRIBKIT_GITHUB_TYPE || process.env.GITHUB_TYPE) as GitHubAccountType | undefined,
    },
    opencollective: {
      id: process.env.CONTRIBKIT_OPENCOLLECTIVE_ID || process.env.OPENCOLLECTIVE_ID,
      slug: process.env.CONTRIBKIT_OPENCOLLECTIVE_SLUG || process.env.OPENCOLLECTIVE_SLUG,
      githubHandle: process.env.CONTRIBKIT_OPENCOLLECTIVE_GH_HANDLE || process.env.OPENCOLLECTIVE_GH_HANDLE,
      type: process.env.CONTRIBKIT_OPENCOLLECTIVE_TYPE || process.env.OPENCOLLECTIVE_TYPE,
    },
    afdian: {
      userId: process.env.CONTRIBKIT_AFDIAN_USER_ID || process.env.AFDIAN_USER_ID,
      exchangeRate: Number.parseFloat(process.env.CONTRIBKIT_AFDIAN_EXCHANGE_RATE || process.env.AFDIAN_EXCHANGE_RATE || '0') || undefined,
    },
    polar: {
      organization: process.env.CONTRIBKIT_POLAR_ORGANIZATION || process.env.POLAR_ORGANIZATION,
    },
    liberapay: {
      login: process.env.CONTRIBKIT_LIBERAPAY_LOGIN || process.env.LIBERAPAY_LOGIN,
    },
    outputDir: process.env.CONTRIBKIT_DIR,
    githubContributors: {
      login: process.env.CONTRIBKIT_GITHUB_CONTRIBUTORS_LOGIN,
      minContributions: Number(process.env.CONTRIBKIT_GITHUB_CONTRIBUTORS_MIN) || 1,
      repo: process.env.CONTRIBKIT_GITHUB_CONTRIBUTORS_REPO,
    },
    gitlabContributors: {
      minContributions: Number(process.env.CONTRIBKIT_GITLAB_CONTRIBUTORS_MIN) || 1,
      repoId: Number(process.env.CONTRIBKIT_GITLAB_CONTRIBUTORS_REPO_ID),
    },
    crowdinContributors: {
      token: process.env.CONTRIBKIT_CROWDIN_TOKEN,
      projectId: Number(process.env.CONTRIBKIT_CROWDIN_PROJECT_ID),
      minTranslations: Number(process.env.CONTRIBKIT_CROWDIN_MIN_TRANSLATIONS) || 1,
    },
    githubContributions: {
      login: process.env.CONTRIBKIT_GITHUB_CONTRIBUTIONS_LOGIN,
      maxContributions: Number(process.env.CONTRIBKIT_GITHUB_CONTRIBUTIONS_MAX) || undefined,
      logarithmicScaling: process.env.CONTRIBKIT_GITHUB_CONTRIBUTIONS_LOGARITHMIC === 'true',
    },
  }

  // remove undefined keys
  return {
    config: pruneUndefined(config),
    credentials: loadEnvCredentials(),
  }
}
