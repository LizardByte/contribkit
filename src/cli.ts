import type { ContribkitConfig } from './types.js'
import cac from 'cac'
import { version } from '../package.json'
import { getCredentials } from './configs/credentials.js'
import { loadConfig } from './configs/index.js'
import { DEFAULT_KOFI_DATA_FILE, startKofiWebhookServer } from './providers/kofi.js'
import { run } from './run.js'

const RE_FILTER = /^(<=?|>=?)(\d+)$/
const cli = cac('contributors-svg')
  .version(version)
  .help()

cli
  .command('kofi-webhook', 'Receive and store Ko-fi payment webhooks')
  .option('--host <host>', 'Host to listen on', { default: '127.0.0.1' })
  .option('--port <port>', 'Port to listen on', { default: 3456 })
  .option('--path <path>', 'Webhook path', { default: '/kofi' })
  .option('--data-file <file>', 'Ko-fi event store')
  .action(async (options) => {
    const config = await loadConfig()
    const verificationToken = getCredentials(config).kofi?.verificationToken
    if (!verificationToken) {
      throw new Error('Ko-fi verification token is required')
    }
    const dataFile = options.dataFile || config.kofi?.dataFile || DEFAULT_KOFI_DATA_FILE
    const port = Number.parseInt(options.port)
    await startKofiWebhookServer({
      verificationToken,
      dataFile,
      host: options.host,
      port,
      path: options.path,
    })
    console.log(`[contribkit] Ko-fi webhook listening on http://${options.host}:${port}${options.path}`)
    console.log(`[contribkit] Storing sanitized events in ${resolveDisplayPath(dataFile)}`)
  })

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
  const match = RE_FILTER.exec(template)
  if (!match)
    throw new Error(`Unable to parse filter template ${template}`)

  const [, op, value] = match
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

function resolveDisplayPath(path: string) {
  return path.replaceAll('\\', '/')
}
