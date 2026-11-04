import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const icons = [192, 512].flatMap((size) => {
  const src = `icons/spaceslop-${size}.png`;
  return existsSync(new URL(`./public/${src}`, import.meta.url))
    ? [{ src, sizes: `${size}x${size}`, type: 'image/png' }]
    : [];
});

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',
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
