import type { ContribkitConfig } from './types'
import cac from 'cac'
import { version } from '../package.json'
import { run } from './run'

const cli = cac('contributors-svg')
  .version(version)
  .help()

cli
  .command('[outputDir]', 'Generate contributors SVG')
  .option('--width, -w <width>', 'SVG width', { default: 800 })
  .option('--fallback-avatar, --fallback <url>', 'Fallback avatar URL')
  .option('--force, -f', 'Force regeneration', { default: false })
  .option('--name <name>', 'Name')
  .option('--filter <filter>', 'Filter contributors')
  .option('--output-dir, -o, --dir <dir>', 'Output directory')
  .action(async (outputDir: string, options) => {
    const config = options as ContribkitConfig

    if (outputDir)
      config.outputDir = outputDir

    if (options.filter)
      config.filter = createFilterFromString(options.filter)

    await run(config)
  })

cli.parse()

/**
 * Create filter function from templates like
 * - `<10`
 * - `>=10`
 * @param template
 */
function createFilterFromString(template: string): ContribkitConfig['filter'] {
  const [_, op, value] = template.split(/([<>=]+)/)
  const num = Number.parseInt(value)
  if (op === '<')
    return s => s.monthlyDollars < num
  if (op === '<=')
    return s => s.monthlyDollars <= num
  if (op === '>')
    return s => s.monthlyDollars > num
  if (op === '>=')
    return s => s.monthlyDollars >= num
  throw new Error(`Unable to parse filter template ${template}`)
}
