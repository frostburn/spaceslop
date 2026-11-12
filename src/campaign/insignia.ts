import { RANK_ATLAS_CELL, type Rank } from './ranks';

type Point = readonly [number, number];
type Metal = readonly [string, string, string, string];
const silver: Metal = ['#f1fbff', '#b7d1e4', '#6a819b', '#d5e6f2'];
const gold: Metal = ['#fff4bb', '#e0a953', '#986033', '#ffd88e'];

function polygon(points: readonly Point[]) {
  const path = new Path2D();
  path.moveTo(...points[0]);
  for (const point of points.slice(1)) path.lineTo(...point);
  path.closePath();
  return path;
}

function pin(ctx: CanvasRenderingContext2D, shape: Path2D, metal: Metal) {
  const sheen = ctx.createLinearGradient(24, 15, 103, 110);
  sheen.addColorStop(0, metal[0]);
  sheen.addColorStop(.47, metal[1]);
  sheen.addColorStop(.51, metal[2]);
  sheen.addColorStop(1, metal[1]);
  ctx.fillStyle = sheen;
  ctx.fill(shape);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = metal[3];
  ctx.stroke(shape);
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, metal: Metal) {
  const clip = Math.min(4, h / 3);
  pin(ctx, polygon([[x + clip, y], [x + w - clip, y], [x + w, y + clip], [x + w, y + h - clip],
    [x + w - clip, y + h], [x + clip, y + h], [x, y + h - clip], [x, y + clip]]), metal);
}

function star(cx: number, cy: number, tips: number, outer: number, inner: number) {
  return polygon(Array.from({ length: tips * 2 }, (_, i) => {
    const angle = i * Math.PI / tips - Math.PI / 2;
    const radius = i % 2 ? inner : outer;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  }));
}

function enlisted(ctx: CanvasRenderingContext2D, sergeant: boolean) {
  const shield = polygon([[64, 13], [105, 37], [105, 88], [64, 112], [23, 88], [23, 37]]);
  ctx.fillStyle = '#18334e';
  ctx.fill(shield);
  ctx.strokeStyle = '#8daecb';
  ctx.lineWidth = 3.8;
  ctx.stroke(shield);
  pin(ctx, polygon([[64, 30], [83, 60], [64, 54], [45, 60]]), silver);
  for (const y of [66, 77, 88]) {
    const x = y === 88 ? 42 : 36;
    if (sergeant)
      pin(ctx, polygon([[x, y - 3], [64, y + 5], [128 - x, y - 3], [128 - x, y + 2], [64, y + 11], [x, y + 2]]), silver);
    else bar(ctx, x, y, 128 - x * 2, 4, silver);
  }
}

function orbit(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, angle: number, start: number, end: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, angle, start, end);
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = '#c39558';
  ctx.stroke();
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = '#fff1b5';
  ctx.stroke();
}

function marshal(ctx: CanvasRenderingContext2D, rank: 'solarMarshal' | 'sectorMarshal' | 'galacticMarshal') {
  const tau = 2 * Math.PI;
  if (rank === 'solarMarshal') {
    orbit(ctx, 64, 54, 38, 38, 0, 0, tau);
    pin(ctx, star(64, 54, 8, 29, 17), gold);
  } else if (rank === 'sectorMarshal') {
    orbit(ctx, 64, 53, 43, 20, -.55, 0, tau);
    pin(ctx, star(64, 54, 4, 39, 11), gold);
    pin(ctx, star(64, 54, 4, 16, 4), silver);
  } else {
    orbit(ctx, 64, 53, 43, 27, -.39, -.45, 3.95);
    orbit(ctx, 64, 53, 32, 17, -.39, 2.70, 7.12);
    orbit(ctx, 64, 53, 44, 27, -.39, 3.25, 5.46);
    pin(ctx, star(64, 53, 4, 23, 8), silver);
  }
  for (const x of [40, 57, 74]) bar(ctx, x, 99, 14, 7, gold);
}

export function drawRankInsignia(ctx: CanvasRenderingContext2D, rank: Rank, x = 0, y = 0, size = RANK_ATLAS_CELL) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / RANK_ATLAS_CELL, size / RANK_ATLAS_CELL);
  switch (rank) {
    case 'specialist4':
    case 'sergeant':
      enlisted(ctx, rank === 'sergeant');
      break;
    case 'secondLt':
    case 'firstLt':
      bar(ctx, 50, 24, 28, 80, rank === 'secondLt' ? gold : silver);
      break;
    case 'captain':
      bar(ctx, 43, 38, 42, 12, silver);
      bar(ctx, 43, 78, 42, 12, silver);
      bar(ctx, 32, 24, 22, 80, silver);
      bar(ctx, 74, 24, 22, 80, silver);
      break;
    case 'major':
      pin(ctx, new Path2D('M64 16 Q73 29 72 38 Q90 29 92 45 Q94 51 84 59 Q101 54 103 67 Q104 80 85 84 Q91 96 69 96 L68 112 H60 L59 96 Q37 96 43 84 Q24 80 25 67 Q27 54 44 59 Q34 51 36 45 Q38 29 56 38 Q55 29 64 16 Z'), gold);
      ctx.strokeStyle = '#ffe9ac';
      ctx.lineWidth = 2.5;
      ctx.stroke(new Path2D('M64 99 V35 M64 77 L43 69 M64 77 L85 69 M64 60 L51 48 M64 60 L77 48'));
      break;
    case 'colonel':
      pin(ctx, polygon([[11, 32], [32, 37], [53, 48], [61, 43], [59, 35], [72, 30], [81, 34],
        [73, 40], [75, 48], [97, 37], [117, 32], [111, 49], [106, 53], [104, 63],
        [95, 66], [92, 75], [76, 77], [75, 89], [87, 103], [64, 99], [41, 103], [53, 89],
        [52, 77], [36, 75], [33, 66], [24, 63], [22, 53], [17, 49]]), silver);
      ctx.strokeStyle = '#536b83';
      ctx.lineWidth = 2.5;
      ctx.stroke(new Path2D('M23 51 L51 61 M31 64 L51 68 M105 51 L77 61 M97 64 L77 68 M64 84 V94'));
      break;
    case 'brigadier':
      pin(ctx, star(64, 65, 5, 47, 20), silver);
      break;
    case 'solarMarshal':
    case 'sectorMarshal':
    case 'galacticMarshal':
      marshal(ctx, rank);
      break;
  }
  ctx.restore();
}
