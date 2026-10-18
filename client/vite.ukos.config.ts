import { cp, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config.js';

const runtime = fileURLToPath(
  new URL('./prototypes/runtime/', import.meta.url)
);

export default mergeConfig(
  baseConfig,
  defineConfig({
    publicDir: false,
    worker: { format: 'es' },
    build: {
      outDir: 'dist-ukos',
      rollupOptions: {
        input: fileURLToPath(
          new URL('./prototypes/ukos.html', import.meta.url)
        ),
      },
    },
    plugins: [
      {
        name: 'ukos-local-runtime',
        async buildStart() {
          await readFile(
            new URL('./prototypes/runtime/manifest.json', import.meta.url)
          );
        },
        async closeBundle() {
          await cp(
            runtime,
            fileURLToPath(
              new URL('./dist-ukos/prototypes/runtime/', import.meta.url)
            ),
            { recursive: true }
          );
        },
      },
    ],
  })
);
