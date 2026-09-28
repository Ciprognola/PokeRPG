import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// CI sets BASE_PATH to the GitHub Pages sub-path (e.g. /PokeRPG/slicer/).
const base = process.env['BASE_PATH'] ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'PokeRPG Slicer',
        short_name: 'Slicer',
        description:
          'Cuts, aligns and validates character sprite sheets. Runs offline on your device.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#14161c',
        theme_color: '#14161c',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'] },
    }),
  ],
});
