import type { Buffer } from 'node:buffer'
import type { SvgComposer } from './processing/svg'

export type ImageFormat = 'png' | 'webp'

export interface BadgePreset {
  boxWidth: number
  boxHeight: number
  avatar: {
    size: number
    classes?: string
  }
  name?: false | {
    color?: string
    classes?: string
    maxLength?: number
  }
  container?: {
    sidePadding?: number
  }
  classes?: string
}

export interface TierPartition {
  monthlyDollars: number
  tier: Tier
  sponsors: Sponsorship[]
}

export interface Provider {
  name: string
  fetchSponsors: (config: ContribkitConfig) => Promise<Sponsorship[]>
}

export interface Sponsor {
  type: 'User' | 'Organization'
  login: string
  name: string
  avatarUrl: string
  avatarBuffer?: Buffer
  websiteUrl?: string
  linkUrl?: string
  /**
   * Map of logins of other social accounts
   *
   * @example
   * ```json
   * {
   *   'github': 'antfu',
   *   'opencollective': 'antfu',
   * }
   * ```
   *
   * This would allow us to merge sponsors from different platforms.
   */
  socialLogins?: Record<string, string>
}

export interface Sponsorship {
  sponsor: Sponsor
  monthlyDollars: number
  privacyLevel?: 'PUBLIC' | 'PRIVATE'
  tierName?: string
  createdAt?: string
  expireAt?: string
  isOneTime?: boolean
  provider?: ProviderName | string
  /**
   * Raw data from provider
   */
  raw?: any
}

export const outputFormats = ['svg', 'png', 'webp', 'json'] as const

export type OutputFormat = typeof outputFormats[number]

export type ProviderName = 'github' | 'patreon' | 'opencollective' | 'afdian' | 'polar' | 'liberapay' | 'githubContributors' | 'gitlabContributors' | 'crowdinContributors'

export type GitHubAccountType = 'user' | 'organization'

export interface ProvidersConfig {
  github?: {
    /**
     * User id of your GitHub account.
     *
     * Will read from `CONTRIBKIT_GITHUB_LOGIN` environment variable if not set.
     */
    login?: string
    /**
     * GitHub Token that have access to your sponsorships.
     *
     * Will read from `CONTRIBKIT_GITHUB_TOKEN` environment variable if not set.
     *
     * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
     */
    token?: string
    /**
     * The account type for sponsorships.
     *
     * Possible values are `user`(default) and `organization`.
     * Will read from `CONTRIBKIT_GITHUB_TYPE` environment variable if not set.
     */
    type?: GitHubAccountType
  }
  patreon?: {
    /**
     * Patreon Token that have access to your sponsorships.
     *
     * Will read from `CONTRIBKIT_PATREON_TOKEN` environment variable if not set.
     *
     * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
     */
    token?: string
  }
  opencollective?: {
    /**
     * Api key of your OpenCollective account.
     *
     * Will read from `CONTRIBKIT_OPENCOLLECTIVE_KEY` environment variable if not set.
     *
     * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
     */
    key?: string
    /**
     * The id of your account.
     *
     * Will read from `CONTRIBKIT_OPENCOLLECTIVE_ID` environment variable if not set.
     */
    id?: string
    /**
     * The slug of your account.
     *
     * Will read from `CONTRIBKIT_OPENCOLLECTIVE_SLUG` environment variable if not set.
     */
    slug?: string
    /**
     * The GitHub handle of your account.
     *
     * Will read from `CONTRIBKIT_OPENCOLLECTIVE_GH_HANDLE` environment variable if not set.
     */
    githubHandle?: string
    /*
    * The type of your account. (`collective` or `individual`)
    *
    * Will read from `CONTRIBKIT_OPENCOLLECTIVE_TYPE` environment variable if not set.
    */
    type?: string
  }
  afdian?: {
    /**
     * The userId of your Afdian.
     *
     * Will read from `CONTRIBKIT_AFDIAN_USER_ID` environment variable if not set.
     *
     * @see https://afdian.net/dashboard/dev
     */
    userId?: string
    /**
     * Afdian Token that have access to your sponsorships.
     *
     * Will read from `CONTRIBKIT_AFDIAN_TOKEN` environment variable if not set.
     *
     * @see https://afdian.net/dashboard/dev
     * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
     */
    token?: string
    /**
     * Exchange rate of USD to CNY
     *
     * @default 6.5
     */
    exechangeRate?: number
    /**
     * Include one-time purchases
     * @default true
     */
    includePurchases?: boolean
    /**
     * One-time purchase effectivity period in days
     * @default 30
     */
    purchaseEffectivity?: number
  }

  polar?: {
    /**
     * Polar token that have access to your sponsorships.
     *
     * Will read from `CONTRIBKIT_POLAR_TOKEN` environment variable if not set.
     *
     * @see https://polar.sh/settings
     * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
     */
    token?: string
    /**
     * The name of the organization to fetch sponsorships from. If not set, it will fetch the sponsorships of the user.
     *
     * Will read from `CONTRIBKIT_POLAR_ORGANIZATION` environment variable if not set.
     */
    organization?: string
  }

  liberapay?: {
    /**
     * The name of the Liberapay profile.
     *
     * Will read from `CONTRIBKIT_LIBERAPAY_LOGIN` environment variable if not set.
     */
    login?: string
  }

  githubContributors?: {
    /**
     * User id of your GitHub account.
     *
     * Will read from `CONTRIBKIT_GITHUB_CONTRIBUTORS_LOGIN` environment variable if not set.
     */
    login?: string
    /**
     * GitHub Token that have access to your sponsorships.
     *
     * Will read from `CONTRIBKIT_GITHUB_CONTRIBUTORS_TOKEN` environment variable if not set.
     *
     * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
     */
    token?: string
    /**
     * The minimum number of contributions to be considered a sponsor.
     *
     * @default 1
     */
    minContributions?: number
    /**
     * The repository to fetch contributors from.
     *
     * Will read from `CONTRIBKIT_GITHUB_CONTRIBUTORS_REPO` environment variable if not set.
     */
    repo?: string
  }

  gitlabContributors?: {
    /**
     * Gitlab Token that have access contributors.
     *
     * Will read from `CONTRIBKIT_GITLAB_CONTRIBUTORS_TOKEN` environment variable if not set.
     *
     * @deprecated It's not recommended set this value directly, pass from env or use `.env` file.
     */
    token?: string
    /**
     * The minimum number of contributions to be considered a sponsor.
     *
     * @default 1
     */
    minContributions?: number
    /**
     * The repository ID to fetch contributors from.
     *
     * Will read from `CONTRIBKIT_GITLAB_CONTRIBUTORS_REPO_ID` environment variable if not set.
     */
    repoId?: number
  }

  crowdinContributors?: {
    /**
     * The Crowdin API token.
     *
     * Will read from `CONTRIBKIT_CROWDIN_TOKEN` environment variable if not set.
     */
    token?: string
    /**
     * The project id on Crowdin.
     *
     * Will read from `CONTRIBKIT_CROWDIN_PROJECT_ID` environment variable if not set.
     */
    projectId?: number
    /**
     * The minimum number of translations to be considered a sponsor.
     *
     * @default 100
     */
    minTranslations?: number
  }
}

export interface ContribkitRenderOptions {
  /**
   * Name of exported files
   *
   * @default 'sponsors'
   */
  name?: string

  /**
   * Renderer to use
   *
   * @default 'tiers'
   */
  renderer?: 'tiers' | 'circles'

  /**
   * Output formats
   *
   * @default ['json', 'svg', 'png']
   */
  formats?: OutputFormat[]

  /**
   * Compose the SVG
   */
  customComposer?: (composer: SvgComposer, sponsors: Sponsorship[], config: ContribkitConfig) => PromiseLike<void> | void

  /**
   * Filter of sponsorships to render in the final image.
   */
  filter?: (sponsor: Sponsorship, all: Sponsorship[]) => boolean | void

  /**
   * Tiers
   *
   * Only effective when using `tiers` renderer.
   */
  tiers?: Tier[]

  /**
   * Options for rendering circles
   *
   * Only effective when using `circles` renderer.
   */
  circles?: CircleRenderOptions

  /**
   * Width of the image.
   *
   * @default 800
   */
  width?: number

  /**
   * Padding of image container
   */
  padding?: {
    top?: number
    bottom?: number
  }

  /**
   * Inline CSS of generated SVG
   */
  svgInlineCSS?: string

  /**
   * Whether to display the private sponsors
   *
   * @default false
   */
  includePrivate?: boolean

  /**
   * Whether to display the past sponsors
   * Currently only works with GitHub provider
   *
   * @default auto detect based on tiers
   */
  includePastSponsors?: boolean

  /**
   * Format of embedded images
   *
   * @default 'webp'
   */
  imageFormat?: ImageFormat

  /**
   * Hook to modify sponsors data before rendering.
   */
  onBeforeRenderer?: (sponsors: Sponsorship[]) => PromiseLike<void | Sponsorship[]> | void | Sponsorship[]

  /**
   * Hook to get or modify the SVG before writing.
   */
  onSvgGenerated?: (svg: string) => PromiseLike<string | void | undefined | null> | string | void | undefined | null
}

export interface ContribkitConfig extends ProvidersConfig, ContribkitRenderOptions {
  /**
   * @deprecated use `github.login` instead
   */
  login?: string

  /**
   * @deprecated use `github.token` instead
   */
  token?: string

  /**
   * @default auto detect based on the config provided
   */
  providers?: (ProviderName | Provider)[]

  /**
   * By pass cache
   */
  force?: boolean

  /**
   * Path to cache file
   *
   * @default './contribkit/.cache.json'
   */
  cacheFile?: string

  /**
   * Directory of output files.
   *
   * @default './contribkit'
   */
  outputDir?: string

  /**
   * Replace links in the sponsors data.
   */
  replaceLinks?: Record<string, string> | (((sponsor: Sponsorship) => string) | Record<string, string>)[]

  /**
   * Replace avatar link in the sponsors data.
   */
  replaceAvatars?: Record<string, string> | (((sponsor: Sponsorship) => string) | Record<string, string>)[]

  /**
   * Merge multiple sponsors, useful for combining sponsors from different providers.
   *
   * @example
   * ```js
   * mergeSponsors: [
   *   // Array of sponsor matchers
   *   [{ login: 'antfu', provider: 'github' }, { login: 'antfu', provider: 'patreon' }],
   *   // custom functions to find matched sponsors
   *   (sponsor, allSponsors) => {
   *     return allSponsors.filter(s => s.sponsor.login === sponsor.sponsor.login)
   *   }
   * ]
   * ```
   */
  mergeSponsors?: (SponsorMatcher[] | ((sponsor: Sponsorship, allSponsors: Sponsorship[]) => Sponsorship[] | void))[]

  /**
   * Merge sponsorships from same sponsor on different providers,
   * based on their connection account on each platform.
   *
   * @default false
   */
  sponsorsAutoMerge?: boolean

  /**
   * Hook to modify sponsors data for each provider.
   */
  onSponsorsFetched?: (sponsors: Sponsorship[], provider: ProviderName | string) => PromiseLike<void | Sponsorship[]> | void | Sponsorship[]

  /**
   * Hook to modify merged sponsors data before fetching the avatars.
   */
  onSponsorsAllFetched?: (sponsors: Sponsorship[]) => PromiseLike<void | Sponsorship[]> | void | Sponsorship[]

  /**
   * Hook to modify sponsors data before rendering.
   */
  onSponsorsReady?: (sponsors: Sponsorship[]) => PromiseLike<void | Sponsorship[]> | void | Sponsorship[]

  /**
   * Url to fallback avatar.
   * Setting false to disable fallback avatar.
   */
  fallbackAvatar?: string | false | Buffer | Promise<Buffer>

  /**
   * Configs for multiple renders
   */
  renders?: ContribkitRenderOptions[]

  /**
   * Prorates one-time to the current month's tier
   */
  prorateOnetime?: boolean
}

export interface SponsorMatcher extends Partial<Pick<Sponsor, 'login' | 'name' | 'type'>> {
  provider?: ProviderName | string
}

export type ContribkitMainConfig = Omit<ContribkitConfig, keyof ContribkitRenderOptions>

export interface ContribkitRenderer {
  name: string
  renderSVG: (config: Required<ContribkitRenderOptions>, sponsors: Sponsorship[]) => Promise<string>
}

export interface CircleRenderOptions {
  /**
   * Min radius for sponsors
   *
   * @default 10
   */
  radiusMin?: number
  /**
   * Max radius for sponsors
   *
   * @default 300
   */
  radiusMax?: number
  /**
   * Radius for past sponsors
   *
   * @default 5
   */
  radiusPast?: number
  /**
   * Custom function to calculate the weight of the sponsor.
   *
   * When provided, `radiusMin`, `radiusMax` and `radiusPast` will be ignored.
   */
  weightInterop?: (sponsor: Sponsorship, maxAmount: number) => number
}

export interface Tier {
  /**
   * The lower bound of the tier (inclusive)
   */
  monthlyDollars?: number
  title?: string
  preset?: BadgePreset
  padding?: {
    top?: number
    bottom?: number
  }
  /**
   * Replace the default composer with your own.
   */
  compose?: (composer: SvgComposer, sponsors: Sponsorship[], config: ContribkitConfig) => void
  /**
   * Compose the SVG before the main composer.
   */
  composeBefore?: (composer: SvgComposer, tierSponsors: Sponsorship[], config: ContribkitConfig) => void
  /**
   * Compose the SVG after the main composer.
   */
  composeAfter?: (composer: SvgComposer, tierSponsors: Sponsorship[], config: ContribkitConfig) => void
}
