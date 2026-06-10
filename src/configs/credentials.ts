import type { ContribkitConfig } from '../types'
import process from 'node:process'
import dotenv from 'dotenv'

export interface EnvCredentials {
  github?: {
    token?: string
  }
  patreon?: {
    token?: string
  }
  opencollective?: {
    key?: string
  }
  afdian?: {
    token?: string
  }
  polar?: {
    token?: string
  }
  githubContributors?: {
    token?: string
  }
  gitlabContributors?: {
    token?: string
  }
  githubContributions?: {
    token?: string
  }
}

interface ConfigWithCredentials extends ContribkitConfig {
  credentials?: EnvCredentials
}

export function loadEnvCredentials(): EnvCredentials {
  dotenv.config({ quiet: true })

  return JSON.parse(JSON.stringify({
    github: {
      token: process.env.CONTRIBKIT_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
    },
    patreon: {
      token: process.env.CONTRIBKIT_PATREON_TOKEN || process.env.PATREON_TOKEN,
    },
    opencollective: {
      key: process.env.CONTRIBKIT_OPENCOLLECTIVE_KEY || process.env.OPENCOLLECTIVE_KEY,
    },
    afdian: {
      token: process.env.CONTRIBKIT_AFDIAN_TOKEN || process.env.AFDIAN_TOKEN,
    },
    polar: {
      token: process.env.CONTRIBKIT_POLAR_TOKEN || process.env.POLAR_TOKEN,
    },
    githubContributors: {
      token: process.env.CONTRIBKIT_GITHUB_CONTRIBUTORS_TOKEN,
    },
    gitlabContributors: {
      token: process.env.CONTRIBKIT_GITLAB_CONTRIBUTORS_TOKEN,
    },
    githubContributions: {
      token: process.env.CONTRIBKIT_GITHUB_CONTRIBUTIONS_TOKEN,
    },
  }))
}

export function getCredentials(config: ContribkitConfig): EnvCredentials {
  return (config as ConfigWithCredentials).credentials ?? loadEnvCredentials()
}
