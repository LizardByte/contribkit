import type { ContribkitConfig, ContribkitRenderer, Sponsorship } from '../types'
import { partitionTiers } from '../configs'
import { tierPresets } from '../configs/tier-presets'
import { SvgComposer } from '../processing/svg'

export async function tiersComposer(composer: SvgComposer, sponsors: Sponsorship[], config: ContribkitConfig) {
  const tierPartitions = partitionTiers(sponsors, config.tiers!, config.includePastSponsors)

  composer.addSpan(config.padding?.top ?? 20)

  for (const partition of tierPartitions)
    await composeTier(composer, partition.sponsors, partition.tier, config)

  composer.addSpan(config.padding?.bottom ?? 20)
}

async function composeTier(composer: SvgComposer, sponsors: Sponsorship[], tier: NonNullable<ContribkitConfig['tiers']>[number], config: ContribkitConfig) {
  tier.composeBefore?.(composer, sponsors, config)
  if (tier.compose)
    tier.compose(composer, sponsors, config)
  else
    await composePresetTier(composer, sponsors, tier)
  tier.composeAfter?.(composer, sponsors, config)
}

async function composePresetTier(composer: SvgComposer, sponsors: Sponsorship[], tier: NonNullable<ContribkitConfig['tiers']>[number]) {
  const preset = tier.preset || tierPresets.base
  if (!sponsors.length || !preset.avatar.size)
    return

  const paddingTop = tier.padding?.top ?? 20
  const paddingBottom = tier.padding?.bottom ?? 10
  if (paddingTop)
    composer.addSpan(paddingTop)
  if (tier.title) {
    composer
      .addTitle(tier.title)
      .addSpan(5)
  }
  await composer.addSponsorGrid(sponsors, preset)
  if (paddingBottom)
    composer.addSpan(paddingBottom)
}

export const tiersRenderer: ContribkitRenderer = {
  name: 'contribkit:tiers',
  async renderSVG(config, sponsors) {
    const composer = new SvgComposer(config)
    await (config.customComposer || tiersComposer)(composer, sponsors, config)
    return composer.generateSvg()
  },
}
