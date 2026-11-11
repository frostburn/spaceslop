import * as T from 'three';
import { flagshipPorts, trenchPorts } from './route';

function plate(width: number, height: number, paint: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d')!);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

function circle(c: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  c.beginPath();
  c.arc(x, y, radius, 0, 2 * Math.PI);
}

function globe(c: CanvasRenderingContext2D, x: number, y: number, radius: number, light: string, mid: string, dark: string) {
  const gradient = c.createLinearGradient(x - radius, y - radius, x + radius * .8, y + radius);
  gradient.addColorStop(0, light);
  gradient.addColorStop(.52, mid);
  gradient.addColorStop(1, dark);
  circle(c, x, y, radius);
  c.fillStyle = gradient;
  c.fill();
}

export function fallbackFleetSky() {
  return plate(540, 960, c => {
    const haze = c.createRadialGradient(405, 235, 0, 405, 235, 725);
    haze.addColorStop(0, '#122139');
    haze.addColorStop(.58, '#091222');
    haze.addColorStop(1, '#050910');
    c.fillStyle = haze;
    c.fillRect(0, 0, 540, 960);
    let seed = 419;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let i = 1; i <= 1050; i++) {
      const x = random() * 539, y = random() * 959;
      const size = i % 31 === 0 ? 1.55 : .62 + (i % 5) * .12;
      c.fillStyle = i % 13 === 0 ? 'rgba(251,194,151,.7)' : `rgba(182,213,245,${.17 + (i % 9) * .055})`;
      c.fillRect(x, y, size, size);
    }

    const cx = 365, cy = 202;
    function rings(front: boolean) {
      for (const [tilt, size, color] of [[-.84, 108, '#768994'], [.26, 145, '#b9a58b']] as const) {
        for (const shift of [0, 5, 8]) {
          c.beginPath();
          c.ellipse(cx, cy, size + shift, (size + shift) * .28, tilt, 0, front ? Math.PI : 2 * Math.PI);
          c.lineWidth = shift === 5 ? 1.6 : 3.6;
          c.strokeStyle = color;
          c.globalAlpha = shift === 5 ? .31 : .59;
          c.stroke();
        }
      }
      c.globalAlpha = 1;
    }
    rings(false);
    globe(c, cx, cy, 63, '#bdd3dc', '#496880', '#101829');
    c.save();
    c.clip();
    for (let i = -6; i <= 6; i++) {
      c.strokeStyle = i % 2 ? '#95acba26' : '#182e4663';
      c.lineWidth = 2 + (i * i % 9);
      c.beginPath();
      c.ellipse(cx - 2, cy + i * 10, 68, 18 + Math.abs(i), -.09, .04, Math.PI);
      c.stroke();
    }
    c.restore();
    rings(true);
    globe(c, 192, 129, 10, '#d5dce4', '#697887', '#101421');
    globe(c, 470, 334, 18, '#dca689', '#8c6354', '#251d24');
  });
}

export function fallbackFleetPlanets() {
  return plate(320, 320, c => {
    const glow = c.createRadialGradient(122, 120, 83, 122, 120, 104);
    glow.addColorStop(0, '#5df5f4');
    glow.addColorStop(.51, '#4bc5ebaa');
    glow.addColorStop(.8, '#7266ed3a');
    glow.addColorStop(1, '#7266ed00');
    circle(c, 122, 120, 104);
    c.fillStyle = glow;
    c.fill();
    globe(c, 122, 120, 92, '#5fbed6', '#235b8b', '#122343');
    c.save();
    c.clip();
    c.fillStyle = '#598569';
    c.fill(new Path2D('M54 89 Q80 55 121 62 L145 51 L156 76 L137 88 L166 107 L164 124 L132 142 L120 174 L96 156 L83 125 L62 122 Z'));
    c.fillStyle = '#326048';
    c.fill(new Path2D('M184 115 L216 105 L229 149 L194 181 L168 164 L178 151 Z'));
    c.strokeStyle = '#d5e8eb73';
    c.lineWidth = 3.5;
    for (const [x, y, w] of [[92, 86, 57], [130, 126, 91], [160, 158, 70]]) {
      c.beginPath();
      c.moveTo(x - w, y + 9);
      c.bezierCurveTo(x - 11, y + 22, x + 4, y - 25, x + w, y - 9);
      c.stroke();
    }
    c.restore();
    globe(c, 245, 243, 43, '#e1aa6c', '#ab5d39', '#4b2831');
    c.save();
    c.clip();
    c.fillStyle = '#315e65';
    c.fill(new Path2D('M230 231 L239 221 L248 226 L264 227 L263 237 L247 247 L238 239 Z'));
    c.strokeStyle = '#5f7771';
    c.lineWidth = 1.2;
    c.stroke(new Path2D('M248 240 Q260 246 246 253 T250 274 M235 229 Q220 222 216 207'));
    c.restore();
  });
}

const flagshipOutline = 'M500 22 C490 146 410 241 414 356 L402 523 Q390 640 407 794 Q413 916 391 1099 L385 1417 Q392 1530 350 1646 Q314 1776 364 1904 Q393 1973 475 1955 L500 1980 L525 1955 Q607 1973 636 1904 Q686 1776 650 1646 Q608 1530 615 1417 L609 1099 Q587 916 593 794 Q610 640 598 523 L586 356 C590 241 510 146 500 22 Z';
const trenchOutline = 'M500 20 C477 190 384 230 340 359 Q268 480 169 521 Q102 630 135 796 Q61 900 61 1037 Q58 1151 140 1225 Q110 1360 92 1516 Q49 1701 125 1887 L179 1977 L238 1941 L267 1973 Q357 1887 366 1758 Q372 1648 435 1628 Q500 1607 565 1628 Q628 1648 634 1758 Q643 1887 733 1973 L762 1941 L821 1977 L875 1887 Q951 1701 908 1516 Q890 1360 860 1225 Q942 1151 939 1037 Q939 900 865 796 Q898 630 831 521 Q732 480 660 359 C616 230 523 190 500 20 Z';
const trenchFloor = 'M412 485 L450 535 L482 486 L517 523 L571 477 L603 523 L630 805 L681 853 L680 1013 L633 1055 L619 1515 Q624 1582 671 1734 L639 1800 Q619 1645 565 1620 Q500 1596 435 1620 Q381 1645 361 1800 L329 1734 Q376 1582 381 1515 L367 1055 L320 1013 L319 853 L370 805 L397 533 Z';

export function fallbackPleiadianHull(trench: boolean) {
  return plate(512, 1024, c => {
    c.scale(.512, .512);
    const outline = new Path2D(trench ? trenchOutline : flagshipOutline);
    const steel = c.createLinearGradient(60, 0, 920, 430);
    steel.addColorStop(0, '#847869');
    steel.addColorStop(.2, '#c7b9a2');
    steel.addColorStop(.42, '#e4dcc7');
    steel.addColorStop(.69, '#b5a694');
    steel.addColorStop(1, '#6c6257');
    c.fillStyle = steel;
    c.fill(outline);
    c.save();
    c.clip(outline);
    c.strokeStyle = '#5d4a38';
    c.lineWidth = 18;
    c.stroke(outline);
    c.strokeStyle = '#d0a669';
    c.lineWidth = 8;
    c.stroke(outline);

    for (let i = 0; i < 24; i++) {
      const y = 235 + i * 68;
      c.strokeStyle = i % 3 === 0 ? '#856d4f96' : '#776e6155';
      c.lineWidth = i % 3 === 0 ? 3 : 1.6;
      c.stroke(new Path2D(`M45 ${y - 30} L360 ${y + 28} L515 ${y - 17} L960 ${y + 37}`));
    }
    for (const side of [-1, 1]) {
      const x = 500 + side * (trench ? 253 : 73);
      const spine = new Path2D(`M500 22 Q${x + side * 20} 400 ${x} 685 Q${x - side * 45} 1070 ${x} 1380 L${x + side * 23} 1860`);
      c.strokeStyle = '#8f6b42';
      c.lineWidth = trench ? 18 : 13;
      c.stroke(spine);
      c.strokeStyle = '#d5b275';
      c.lineWidth = 4;
      c.stroke(spine);
      globe(c, 500 + side * (trench ? 249 : 86), 1848, trench ? 87 : 55, '#ae9166', '#776648', '#382f29');
      globe(c, 500 + side * (trench ? 249 : 86), 1848, trench ? 64 : 38, '#59bddd', '#205479', '#0b233a');
    }
    if (trench) {
      const lane = new Path2D(trenchFloor);
      c.fillStyle = '#343e49';
      c.fill(lane);
      c.strokeStyle = '#6b5136';
      c.lineWidth = 19;
      c.stroke(lane);
      c.strokeStyle = '#ae9873';
      c.lineWidth = 4;
      c.stroke(lane);
      c.save();
      c.clip(lane);
      c.strokeStyle = '#171f2b88';
      c.lineWidth = 3;
      for (let y = 535; y < 1680; y += 47) {
        c.beginPath(); c.moveTo(305, y); c.lineTo(694, y); c.stroke();
      }
      c.restore();
      c.fillStyle = '#72cfe9';
      for (let y = 570; y < 1570; y += 96) {
        const inset = y > 853 && y < 1013 ? 184 : 134;
        c.fillRect(500 - inset + 8, y, 5, 26);
        c.fillRect(500 + inset - 13, y, 5, 26);
      }
    } else {
      c.fillStyle = '#263647';
      c.fill(new Path2D('M500 62 L524 408 L520 1331 L500 1710 L478 1327 L477 422 Z'));
      c.fillStyle = '#77bdc9';
      for (let y = 416; y < 1310; y += 36) c.fillRect(495, y, 10, 6);
    }

    for (const [u, v] of trench ? trenchPorts : flagshipPorts) {
      globe(c, u * 1000, v * 2000, 22, '#dfbc82', '#9d784d', '#4f422f');
      globe(c, u * 1000, v * 2000, 16, '#47515d', '#222b37', '#10141b');
    }
    c.restore();
  });
}
