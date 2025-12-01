# ContribKit

[![GitHub stars](https://img.shields.io/github/stars/lizardbyte/contribkit.svg?logo=github&style=for-the-badge)](https://github.com/LizardByte/contribkit)
[![GitHub Workflow Status (CI)](https://img.shields.io/github/actions/workflow/status/lizardbyte/contribkit/_ci-node.yml.svg?branch=master&label=CI%20build&logo=github&style=for-the-badge)](https://github.com/LizardByte/contribkit/actions/workflows/_ci-node.yml?query=branch%3Amaster)
[![Codecov](https://img.shields.io/codecov/c/gh/LizardByte/contribkit?token=WBivqQDwFw&style=for-the-badge&logo=codecov&label=codecov)](https://codecov.io/gh/LizardByte/contribkit)
[![NPM Monthly Downloads](https://img.shields.io/npm/dm/%40lizardbyte%2Fcontribkit?style=for-the-badge&logo=npm&label=npm%20downloads/m)](https://www.npmjs.com/package/@lizardbyte/contribkit)
[![NPM Version](https://img.shields.io/npm/v/%40lizardbyte%2Fcontribkit?style=for-the-badge&logo=npm&label=npm%20version)](https://www.npmjs.com/package/@lizardbyte/contribkit)

Toolkit for fetching contributor info and generating contributor images.
This is a fork of [sponsorkit](https://github.com/antfu-collective/sponsorkit) that supports contributors.

Supports:

- Contributors:
  - [**CrowdIn**](https://crowdin.com)
  - [**GitHub Contributors**](https://github.com) (contributors to a specific repository)
  - [**GitHub Contributions**](https://github.com) (merged PRs aggregated by repository owner across all repos for a single user)
  - [**Gitlab**](https://gitlab.com)
- Sponsors:
  - [**GitHub Sponsors**](https://github.com/sponsors)
  - [**Patreon**](https://www.patreon.com/)
  - [**OpenCollective**](https://opencollective.com/)
  - [**Afdian**](https://afdian.com/)
  - [**Polar**](https://polar.sh/)
  - [**Liberapay**](https://liberapay.com/)

## Usage

Create `.env` file with:

```ini
;; Contributors

; CrowdInContributors provider.
CONTRIBKIT_CROWDIN_TOKEN=
CONTRIBKIT_CROWDIN_PROJECT_ID=
CONTRIBKIT_CROWDIN_MIN_TRANSLATIONS=1

; GitHubContributors provider.
; Token requires the `public_repo` and `read:user` scopes.
; This provider tracks all contributors to a specific repository.
CONTRIBKIT_GITHUB_CONTRIBUTORS_TOKEN=
CONTRIBKIT_GITHUB_CONTRIBUTORS_LOGIN=
CONTRIBKIT_GITHUB_CONTRIBUTORS_MIN=1
CONTRIBKIT_GITHUB_CONTRIBUTORS_REPO=

; GitHubContributions provider.
; Token requires the `read:user` scope.
; This provider aggregates merged pull requests across all repositories by repository owner (user or organization).
; Each owner appears once with the total merged PRs you authored to their repos.
; Avatar and link point to the owner (or to the repo if only one repo per owner).
; Only merged PRs are counted - open or closed-without-merge PRs are excluded.
CONTRIBKIT_GITHUB_CONTRIBUTIONS_TOKEN=
CONTRIBKIT_GITHUB_CONTRIBUTIONS_LOGIN=
; Optional: Cap the maximum contribution count per org/user (useful for circles visualization)
CONTRIBKIT_GITHUB_CONTRIBUTIONS_MAX=
; Optional: Apply logarithmic scaling to reduce dominance of high contributors (true/false)
CONTRIBKIT_GITHUB_CONTRIBUTIONS_LOGARITHMIC=

; GitlabContributors provider.
; Token requires the `read_api` and `read_user` scopes.
CONTRIBKIT_GITLAB_CONTRIBUTORS_TOKEN=
CONTRIBKIT_GITLAB_CONTRIBUTORS_MIN=1
CONTRIBKIT_GITLAB_CONTRIBUTORS_REPO_ID=

;; Sponsors

; GitHub provider.
; Token requires the `read:user` and `read:org` scopes.
CONTRIBKIT_GITHUB_TOKEN=
CONTRIBKIT_GITHUB_LOGIN=

; Patreon provider.
; Create v2 API key at https://www.patreon.com/portal/registration/register-clients
; and use the "Creator’s Access Token".
CONTRIBKIT_PATREON_TOKEN=

; OpenCollective provider.
; Create an API key at https://opencollective.com/applications
CONTRIBKIT_OPENCOLLECTIVE_KEY=
; and provide the ID, slug or GitHub handle of your account.
CONTRIBKIT_OPENCOLLECTIVE_ID=
; or
CONTRIBKIT_OPENCOLLECTIVE_SLUG=
; or
CONTRIBKIT_OPENCOLLECTIVE_GH_HANDLE=
; If it is a personal account, set it to `person`. Otherwise not set or set to `collective`
CONTRIBKIT_OPENCOLLECTIVE_TYPE=

; Afdian provider.
; Get user_id at https://afdian.com/dashboard/dev
CONTRIBKIT_AFDIAN_USER_ID=
; Create token at https://afdian.com/dashboard/dev
CONTRIBKIT_AFDIAN_TOKEN=

; Polar provider.
; Get your token at https://polar.sh/settings
CONTRIBKIT_POLAR_TOKEN=
; The name of the organization to fetch sponsorships from.
CONTRIBKIT_POLAR_ORGANIZATION=

; Liberapay provider.
; The name of the profile.
CONTRIBKIT_LIBERAPAY_LOGIN=
```

> Only one provider is required to be configured.

> ![NOTE]
> The contributor providers are intended to be separated from each other, unlike the sponsor providers.
> This will require different env variables to be set for each provider, and to be created from separate
> commands.

#### GitHub Provider Options

There are two GitHub contributor providers available:

- **GitHubContributors**: Tracks all contributors to a specific repository (e.g., `owner/repo`). Each contributor appears once with their actual contribution count to that repository.
- **GitHubContributions**: Aggregates a single user's **merged pull requests** across all repositories, grouped by repository owner (user or organization). Each owner appears once with the total merged PRs. The avatar and link point to the owner (or to the specific repo if only one repo per owner).

Use **GitHubContributors** when you want to showcase everyone who has contributed to your project with their contribution counts.
Use **GitHubContributions** when you want to understand where a single user's completed contributions (merged PRs) have gone, without overwhelming duplicates per repo under the same owner.

**GitHubContributions accuracy**:
- Counts only **merged** pull requests - open or closed-without-merge PRs are excluded
- Discovers repos via **2 sources**:
  1. **contributionsCollection** - Yearly commit timeline (full history) for discovering repositories you have committed to
  2. **Search API** - Repositories where you have merged PRs (`is:pr is:merged author:login`)
- When an owner has only one repo, the link points to that repo; otherwise to the owner profile

Run:

```bash
npx contribkit
```

[Example Setup](./example/) | [GitHub Actions Setup](https://github.com/antfu/static/blob/master/.github/workflows/scheduler.yml) | [Generated SVG](https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg)

### Configurations

Create `contribkit.config.js` file with:

```ts
import { defineConfig, tierPresets } from '@lizardbyte/contribkit'

export default defineConfig({
  // Providers configs
  github: {
    login: 'antfu',
    type: 'user',
  },
  opencollective: {
    // ...
  },
  patreon: {
    // ...
  },
  afdian: {
    // ...
  },
  polar: {
    // ...
  },
  liberapay: {
    // ...
  },

  // For contributor providers:
  githubContributions: {
    login: 'username',
  },

  // Rendering configs
  width: 800,
  renderer: 'tiers', // or 'circles'
  formats: ['json', 'svg', 'png', 'webp'],
  tiers: [
    // Past sponsors, currently only supports GitHub
    {
      title: 'Past Sponsors',
      monthlyDollars: -1,
      preset: tierPresets.xs,
    },
    // Default tier
    {
      title: 'Backers',
      preset: tierPresets.base,
    },
    {
      title: 'Sponsors',
      monthlyDollars: 10,
      preset: tierPresets.medium,
    },
    {
      title: 'Silver Sponsors',
      monthlyDollars: 50,
      preset: tierPresets.large,
    },
    {
      title: 'Gold Sponsors',
      monthlyDollars: 100,
      preset: tierPresets.xl,
    },
  ],
})
```

Also check [the example](./example/).

### Programmatic Utilities

You can also use ContribKit programmatically:

```ts
import { fetchSponsors } from '@lizardbyte/contribkit'

const sponsors = await fetchSponsors({
  github: {
    token,
    login,
  },
  // ...
})
```

Check the type definition or source code for more utils available.

### Renderers

We provide two renderers built-in:

- `tiers`: Render sponsors in tiers.
- `circles`: Render sponsors in packed circles.

#### Tiers Renderer

```ts
export default defineConfig({
  renderer: 'tiers',
  // ...
})
```

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

#### Circles Renderer

```ts
export default defineConfig({
  renderer: 'circles',
  // ...
})
```

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.circles.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.circles.svg'/>
  </a>
</p>

### Multiple Renders

We also support rendering multiple images at once with different configurations, via `renders` field:

```ts
import { defineConfig, tierPresets } from '@lizardbyte/contribkit'

export default defineConfig({
  // Providers configs
  github: { /* ... */ },

  // Default configs
  width: 800,
  tiers: [
    /* ... */
  ],

  // Define multiple renders, each will inherit the top-level configs
  renders: [
    {
      name: 'sponsors.tiers',
      formats: ['svg'],
    },
    {
      name: 'sponsors.wide',
      width: 1200,
    },
    {
      name: 'sponsors.circles',
      renderer: 'circles',
      width: 600,
    },
    // ...
  ],
})
```
