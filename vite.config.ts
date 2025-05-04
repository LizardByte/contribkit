import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import ts from 'typescript'
import { codecovVitePlugin } from "@codecov/vite-plugin";

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        cli: resolve(__dirname, 'src/cli.ts')
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.mjs`
    },
    rollupOptions: {
      external: [
        /node:.*/,
        '@crowdin/crowdin-api-client',
        '@fast-csv/parse',
        'ansis',
        'cac',
        'consola',
        'dotenv',
        'fs',
        'normalize-url',
        'ofetch',
        'p-limit',
        'sharp',
        'stream',
        'string_decoder',
        'unconfig'
      ],
      plugins: [
        nodeResolve({
          preferBuiltins: true
        }),
        commonjs()
      ]
    },
    emptyOutDir: true,
  },
  plugins: [
    dts({
      tsconfigPath: './tsconfig.json',
      compilerOptions: {
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        target: ts.ScriptTarget.ESNext,
      },
    exclude: ['example/**/*'],
    }),
    // The Codecov vite plugin should be after all other plugins
    codecovVitePlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "contribkit",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
  resolve: {
    alias: {
      'contribkit': resolve(__dirname, './src/index.ts'),
    }
  }
})
