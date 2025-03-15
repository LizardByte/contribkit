# ContribKit

[![GitHub stars](https://img.shields.io/github/stars/lizardbyte/contribkit.svg?logo=github&style=for-the-badge)](https://github.com/LizardByte/contribkit)
[![GitHub Workflow Status (CI)](https://img.shields.io/github/actions/workflow/status/lizardbyte/contribkit/ci.yml.svg?branch=master&label=CI%20build&logo=github&style=for-the-badge)](https://github.com/LizardByte/contribkit/actions/workflows/CI.yml?query=branch%3Amaster)
[![Codecov](https://img.shields.io/codecov/c/gh/LizardByte/contribkit?token=1234&style=for-the-badge&logo=codecov&label=codecov)](https://codecov.io/gh/LizardByte/contribkit)
[![NPM Monthly Downloads](https://img.shields.io/npm/dm/%40lizardbyte%2Fcontribkit?style=for-the-badge&logo=npm&label=npm%20downloads/m)](https://www.npmjs.com/package/@lizardbyte/contribkit)
[![NPM Version](https://img.shields.io/npm/v/%40lizardbyte%2Fcontribkit?style=for-the-badge&logo=npm&label=npm%20version)](https://www.npmjs.com/package/@lizardbyte/contribkit)

Toolkit for fetching contributor info and generating contributor images.
This is a fork of [sponsorkit](https://github.com/antfu-collective/sponsorkit) that supports contributors.

Supports:

- [**GitHub Sponsors**](https://github.com/sponsors)
- [**Patreon**](https://www.patreon.com/)
- [**OpenCollective**](https://opencollective.com/)
- [**Afdian**](https://afdian.com/)
- [**Polar**](https://polar.sh/)
- [**Liberapay**](https://liberapay.com/)

## Usage

Create `.env` file with:

```ini
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

Run:

```base
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
