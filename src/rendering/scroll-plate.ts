import * as T from 'three';
import type { EncounterTexture } from '../assets/catalog';
import { encounterTextureUrl } from '../encounter-texture';
import { HEIGHT, WIDTH } from '../playfield';

export const PLATE_GUTTER = 4;
const MAX_TILE_WIDTH = 720;

export function plateSlice(width: number, height: number, index: number, screens: number) {
  const w = Math.min(MAX_TILE_WIDTH, width), h = Math.round(w * HEIGHT / WIDTH);
  const padded = h + 2 * PLATE_GUTTER;
  return {
    width: w, height: padded, screenHeight: h, sourceY: height - (index + 1) * height / screens,
    cropStart: PLATE_GUTTER / padded, cropEnd: (h + PLATE_GUTTER) / padded,
  };
}

export function cutPlateTile(source: CanvasImageSource, width: number, height: number, index: number, screens: number) {
  const tile = plateSlice(width, height, index, screens);
  const canvas = document.createElement('canvas');
  canvas.width = tile.width;
  canvas.height = tile.height;
  const context = canvas.getContext('2d');
  if (!context) throw Error('No canvas context for scrolling plate');
  const sourceHeight = height / screens;
  const scale = tile.screenHeight / sourceHeight;
  const top = Math.max(0, tile.sourceY - PLATE_GUTTER / scale);
  const bottom = Math.min(height, tile.sourceY + sourceHeight + PLATE_GUTTER / scale);
  // Retain the neighboring pixels in each gutter. Both sides of a seam
  // can filter the same source pixels at fractional scroll positions.
  context.drawImage(source, 0, top, width, bottom - top,
    0, PLATE_GUTTER + (top - tile.sourceY) * scale, tile.width, (bottom - top) * scale);
  if (index === screens - 1) context.drawImage(canvas, 0, PLATE_GUTTER, tile.width, 1, 0, 0, tile.width, PLATE_GUTTER);
  if (index === 0) context.drawImage(canvas, 0, tile.height - PLATE_GUTTER - 1, tile.width, 1, 0, tile.height - PLATE_GUTTER, tile.width, PLATE_GUTTER);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.generateMipmaps = false;
  map.minFilter = map.magFilter = T.LinearFilter;
  return map;
}

export function disposePlateTiles(tiles: readonly T.CanvasTexture[]) {
  for (const tile of tiles) {
    tile.dispose();
    const canvas = tile.image as HTMLCanvasElement;
    canvas.width = canvas.height = 1;
  }
}

// Keep the decoded strip off the GPU and publish the complete set at once.
export function loadScrollPlate(name: EncounterTexture, screens: number, signal: AbortSignal) {
  const url = encounterTextureUrl(name);
  if (!url || signal.aborted) return Promise.resolve<T.CanvasTexture[]>([]);
  return new Promise<T.CanvasTexture[]>(resolve => {
    const image = new Image();
    const tiles: T.CanvasTexture[] = [];
    let pending = true;
    const finish = (success: boolean) => {
      if (!pending) return;
      pending = false;
      clearTimeout(deadline);
      signal.removeEventListener('abort', cancel);
      image.onload = image.onerror = null;
      image.src = '';
      if (!success) disposePlateTiles(tiles);
      resolve(success ? tiles : []);
    };
    const cancel = () => finish(false);
    const deadline = window.setTimeout(cancel, 20000);
    signal.addEventListener('abort', cancel, { once: true });
    image.onerror = cancel;
    image.onload = async () => {
      try {
        for (let i = 0; i < screens; i++) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          if (!pending || signal.aborted) { cancel(); return; }
          tiles.push(cutPlateTile(image, image.naturalWidth, image.naturalHeight, i, screens));
        }
        finish(true);
      } catch { cancel(); }
    };
    image.src = url;
  });
}
