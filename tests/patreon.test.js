import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, it } from '@jest/globals'

it('fetches Patreon campaigns and paginated members using API v2', () => {
  // Intercept fetch before importing ofetch, using the development CLI's loader.
  expect(() => execFileSync(process.execPath, [
    '--import', 'tsx',
    resolve('tests/fixtures/patreon.mjs'),
  ], { encoding: 'utf8', timeout: 10000 })).not.toThrow()
})
