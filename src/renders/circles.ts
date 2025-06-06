import type { ContribkitRenderer, Sponsorship } from '../types'
import { generateBadge, SvgComposer } from '../processing/svg'

export const circlesRenderer: ContribkitRenderer = {
  name: 'contribkit:circles',
  async renderSVG(config, sponsors) {
    const { hierarchy, pack } = await import('d3-hierarchy')
    const composer = new SvgComposer(config)

    const amountMax = Math.max(...sponsors.map(sponsor => sponsor.monthlyDollars))
    const {
      radiusMax = 300,
      radiusMin = 10,
      radiusPast = 5,
      weightInterop = defaultInterop,
    } = config.circles || {}

    function defaultInterop(sponsor: Sponsorship) {
      return sponsor.monthlyDollars < 0
        ? radiusPast
        : lerp(radiusMin, radiusMax, (Math.max(0.1, sponsor.monthlyDollars || 0) / amountMax) ** 0.9)
    }

    if (!config.includePastSponsors)
      sponsors = sponsors.filter(sponsor => sponsor.monthlyDollars > 0)

    const root = hierarchy({ ...sponsors[0], children: sponsors, id: 'root' })
      .sum(d => weightInterop(d, amountMax))
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    const p = pack<typeof sponsors[0]>()
    p.size([config.width, config.width])
    p.padding(config.width / 400)
    const circles = p(root as any).descendants().slice(1)

    for (const circle of circles) {
      composer.addRaw(await generateBadge(
        circle.x - circle.r,
        circle.y - circle.r,
        circle.data.sponsor,
        {
          name: false,
          boxHeight: circle.r * 2,
          boxWidth: circle.r * 2,
          avatar: {
            size: circle.r * 2,
          },
        },
        0.5,
        config.imageFormat,
      ))
    }

    composer.height = config.width

    return composer.generateSvg()
  },
}

function lerp(a: number, b: number, t: number) {
  if (t < 0)
    return a
  return a + (b - a) * t
}
