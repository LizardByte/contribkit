import type { ContribkitConfig, ContribkitRenderer, Sponsorship } from '../types'
import { partitionTiers } from '../configs'
import { tierPresets } from '../configs/tier-presets'
import { SvgComposer } from '../processing/svg'

export async function tiersComposer(composer: SvgComposer, sponsors: Sponsorship[], config: ContribkitConfig) {
  const tierPartitions = partitionTiers(sponsors, config.tiers!, config.includePastSponsors)

  composer.addSpan(config.padding?.top ?? 20)

  for (const { tier: t, sponsors } of tierPartitions) {
    t.composeBefore?.(composer, sponsors, config)
    if (t.compose) {
      t.compose(composer, sponsors, config)
    }
    else {
      const preset = t.preset || tierPresets.base
      if (sponsors.length && preset.avatar.size) {
        const paddingTop = t.padding?.top ?? 20
        const paddingBottom = t.padding?.bottom ?? 10
        if (paddingTop)
          composer.addSpan(paddingTop)
        if (t.title) {
          composer
            .addTitle(t.title)
            .addSpan(5)
        }
        await composer.addSponsorGrid(sponsors, preset)
        if (paddingBottom)
          composer.addSpan(paddingBottom)
      }
    }
    t.composeAfter?.(composer, sponsors, config)
  }

  composer.addSpan(config.padding?.bottom ?? 20)
}

export const tiersRenderer: ContribkitRenderer = {
  name: 'contribkit:tiers',
  async renderSVG(config, sponsors) {
    const composer = new SvgComposer(config)
    await (config.customComposer || tiersComposer)(composer, sponsors, config)
    return composer.generateSvg()
  },
}
