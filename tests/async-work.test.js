import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from '@jest/globals'

// Run the TypeScript modules with the same loader as the development CLI.
// A separate process lets each case intercept fetch before ofetch is imported.
function runScenario(scenario) {
  execFileSync(process.execPath, [
    '--import', 'tsx',
    resolve('tests/fixtures/async-work.mjs'),
    scenario,
  ], { encoding: 'utf8', timeout: 10000 })
}

describe('independent asynchronous work', () => {
  it.each([
    {
      name: 'overlaps yearly queries with a cap and keeps year order when deduplicating',
      scenario: 'github',
    },
    {
      name: 'retains successful years when one contribution query fails',
      scenario: 'github-failure',
    },
    {
      name: 'keeps PR-count requests capped and fills free slots without waiting for a batch',
      scenario: 'github-counts',
    },
    {
      name: 'overlaps GitLab lookups with a cap, preserving contributor order and partial results',
      scenario: 'gitlab',
    },
    {
      name: 'renders circle badges in packed order with unchanged SVG output',
      scenario: 'circles',
    },
    {
      name: 'propagates circle image processing failures',
      scenario: 'circles-failure',
    },
  ])('$name', ({ scenario }) => {
    expect(() => runScenario(scenario)).not.toThrow()
  })
})
