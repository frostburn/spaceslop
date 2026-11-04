import { existsSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const icons = [192, 512].flatMap((size) => {
  const src = `icons/spaceslop-${size}.png`;
  return existsSync(new URL(`./public/${src}`, import.meta.url))
    ? [{ src, sizes: `${size}x${size}`, type: 'image/png' }]
    : [];
});

const pilotDir = new URL('./public/pilots/', import.meta.url);
const portraits = existsSync(pilotDir)
  ? readdirSync(pilotDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[a-z]+\.png$/.test(entry.name))
    .map((entry) => `pilots/${entry.name}`)
  : [];

const armorPath = 'encounters/interceptor-metal.png';
const armorTexture = existsSync(new URL(`./public/${armorPath}`, import.meta.url)) ? armorPath : '';

export default defineConfig({
  define: {
    __PILOT_PORTRAITS__: JSON.stringify(portraits),
    __INTERCEPTOR_METAL__: JSON.stringify(armorTexture),
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: armorTexture ? [...portraits, armorTexture] : portraits,
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
