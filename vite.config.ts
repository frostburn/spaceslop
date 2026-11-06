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

const encounterTextures = Object.fromEntries(Object.entries({
  ventMortar: 'encounters/vent-barnacle.png',
  ventAtlas: 'encounters/vent-formations.png',
  ioBasalt: 'encounters/io-basalt.png',
  ioCeramic: 'encounters/io-ceramic.png',
  armor: 'encounters/interceptor-metal.png',
  feathers: 'encounters/feather-vane.png',
  scales: 'encounters/draconian-scales.png',
  preserve: 'encounters/preserve-backdrop.png',
  shipyard: 'encounters/shipyard-backdrop.png',
  hive: 'encounters/broodlock-foreground.png',
  hiveMask: 'encounters/broodlock-mines-mask.png',
  hiveStars: 'encounters/broodlock-stars.png',
  hiveMines: 'encounters/broodlock-mines.png',
  chitin: 'encounters/ant-chitin.png',
  fungus: 'encounters/broodlock-fungus.png',
  mold: 'encounters/ant-mold.png',
  ice: 'encounters/frostwake-ice.png',
  rock: 'encounters/frostwake-rock.png',
  galaxy: 'encounters/frostwake-galaxy.png',
  marine: 'encounters/marine-hide.png',
  titan: 'encounters/titan-research-ground-10screens.png',
  titanRobot: 'encounters/titan-maintenance-parts.png',
  titanChitin: 'encounters/titan-chitin.png',
}).filter(([, src]) => existsSync(new URL(`./public/${src}`, import.meta.url))));

export default defineConfig({
  define: {
    __PILOT_PORTRAITS__: JSON.stringify(portraits),
    __ENCOUNTER_TEXTURES__: JSON.stringify(encounterTextures),
  },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      workbox: { maximumFileSizeToCacheInBytes: 24 * 1024 * 1024 },
      includeAssets: [...portraits, ...Object.values(encounterTextures)],
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
