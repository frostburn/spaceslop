import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { textureFiles } from './src/assets/catalog';
import { levelPackages } from './scripts/level-packages';

const icons = [192, 512].flatMap((size) => {

  const src = `icons/spaceslop-${size}.png`;

  return existsSync(new URL(`./public/${src}`, import.meta.url))
    ? [{
      src,
      sizes: `${size}x${size}`,
      type: 'image/png'
    }]
    : [];

});

const pilotDir = new URL('./public/pilots/', import.meta.url);
const portraits = existsSync(pilotDir)
  ? readdirSync(pilotDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[a-z]+\.png$/.test(entry.name))
    .map((entry) => `pilots/${entry.name}`)
  : [];

function versioned(src: string) {
  return src + '?v=' + createHash('sha256').update(readFileSync(new URL('./public/' + src, import.meta.url))).digest('hex').slice(0, 12);
}
const encounterTextures = Object.fromEntries(Object.entries(textureFiles).filter(([, src]) => existsSync(new URL('./public/' + src, import.meta.url))).map(([key, src]) => [key, versioned(src)]));
const portraitUrls = Object.fromEntries(portraits.map(src => [src, versioned(src)]));
const packages = levelPackages(encounterTextures, Object.values(portraitUrls));

export default defineConfig({

  define: {

    __PILOT_PORTRAITS__: JSON.stringify(portraits),

    __PILOT_URLS__: JSON.stringify(portraitUrls),

    __ENCOUNTER_TEXTURES__: JSON.stringify(encounterTextures),

  },

  build: { chunkSizeWarningLimit: 700, rollupOptions: { output: { manualChunks: { three: ['three'] } } } },

  plugins: [packages.plugin,
  VitePWA({

    registerType: 'prompt',

    workbox: {

      clientsClaim: true,
      cleanupOutdatedCaches: true,

      maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,

      globPatterns: ['**/*.{js,css,html,json}'],

      manifestTransforms: [async entries => ({ manifest: entries.filter(e => packages.shellFiles.has(e.url)), warnings: [] })],

      navigateFallback: 'index.html',

      runtimeCaching: [{
        urlPattern: ({ request }) => ['script', 'style', 'image'].includes(request.destination),
        handler: 'CacheFirst',
        options: { cacheName: 'spaceslop-runtime-v1', cacheableResponse: { statuses: [0, 200] } }
      }],

    },

    includeAssets: [],

    manifest: {

      name: 'Spaceslop',

      short_name: 'Spaceslop',

      display: 'standalone',

      orientation: 'portrait',

      background_color: '#080b14',

      theme_color: '#080b14',

      icons,

    },

  }),
  ],

});
