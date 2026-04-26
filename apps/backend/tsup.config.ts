import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  outDir: 'dist',
  target: 'es2022',
  // Native modules and optional deps that cannot be bundled
  external: [
    'isolated-vm',
    'dockerode',
    '@prisma/client',
    'prisma',
  ],
  noExternal: [],
  esbuildOptions(options) {
    options.platform = 'node'
  },
})
