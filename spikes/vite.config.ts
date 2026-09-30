// Throwaway spike build (PKR-015). SPIKE_PHASER=3|4 picks the engine; the same source builds
// against both. Not part of the workspaces, so `npm run build` / the Slicer never see it.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const ver = process.env['SPIKE_PHASER'] === '4' ? '4' : '3';
const name = `phaser${ver}`;
const repoBase = process.env['BASE_PATH'] ?? '/'; // e.g. /PokeRPG/spikes/ in CI
const base = `${repoBase.replace(/\/?$/, '/')}${name}/`;
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  base,
  resolve: { alias: { phaser: here(ver === '4' ? '../node_modules/phaser4' : '../node_modules/phaser') } },
  build: { outDir: here(`dist/${name}`), emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Own cache id and the spike's own scope, so this can never touch the installed Slicer PWA.
      workbox: {
        cacheId: `spike-${name}`,
        globPatterns: ['**/*.{js,css,html,png,json,wav,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
      },
      scope: base,
      manifest: {
        id: base,
        name: `PKR-015 spike Phaser ${ver}`,
        short_name: `Spike P${ver}`,
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#000000',
        theme_color: '#000000',
        start_url: base,
        scope: base,
        icons: [],
      },
    }),
  ],
});
