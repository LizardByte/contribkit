import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { codecovVitePlugin } from '@codecov/vite-plugin'
import { defineConfig } from 'vite'

import packageJson from './package.json'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const runtimeDependencies = Object.keys(packageJson.dependencies)
const nodeBuiltins = new Set([
  ...builtinModules,
  ...builtinModules.map(module => `node:${module}`),
])

function isExternal(id: string) {
  return nodeBuiltins.has(id) || runtimeDependencies.some(dependency => (
    id === dependency || id.startsWith(`${dependency}/`)
  ))
}

export default defineConfig({
  build: {
    copyPublicDir: false,
    emptyOutDir: true,
    lib: {
      entry: {
        index: resolve(rootDir, 'src/index.ts'),
        cli: resolve(rootDir, 'src/cli.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.mjs`,
    },
    minify: false,
    rollupOptions: {
      external: isExternal,
      output: {
        chunkFileNames: 'chunks/[name]-[hash].mjs',
      },
    },
    target: 'esnext',
  },
  plugins: [
    // The Codecov vite plugin should be after all other plugins
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: 'contribkit',
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  resolve: {
    alias: {
      contribkit: resolve(rootDir, 'src/index.ts'),
    },
  },
})
