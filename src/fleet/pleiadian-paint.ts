import * as T from 'three';

export function pleiadianPaint(damaged: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const finishCanvas = document.createElement('canvas');
  finishCanvas.width = canvas.width;
  finishCanvas.height = canvas.height;
  const c = canvas.getContext('2d')!;
  const finish = finishCanvas.getContext('2d')!;
  c.fillStyle = damaged ? '#a89d84' : '#ded6bf';
  c.fillRect(0, 0, 256, 320);
  // Green is roughness and blue is metalness. Keep the finish map linear.
  finish.fillStyle = damaged ? '#00b809' : '#006d08';
  finish.fillRect(0, 0, 256, 320);

  // Painted from nose to stern in the same coordinates as the hull's planar UVs.
  for (const side of [-1, 1]) {
    for (const context of [c, finish]) {
      context.save();
      context.translate(128, 0);
      context.scale(side, 1);
    }
    c.fillStyle = damaged ? '#5e625c' : '#657e8c';
    c.fill(new Path2D('M4 20 Q13 63 22 107 Q43 145 101 205 L108 230 Q46 188 22 150 L7 121 Z'));
    const inlay = new Path2D('M1 16 Q10 84 30 137 Q48 168 104 208 M36 176 Q40 211 68 241 L70 275');
    c.strokeStyle = damaged ? '#a78352' : '#e7bc78';
    c.lineWidth = 12;
    c.stroke(inlay);
    finish.strokeStyle = damaged ? '#009a79' : '#0038ef';
    finish.lineWidth = 12;
    finish.stroke(inlay);
    c.strokeStyle = damaged ? '#68605b' : '#8e806d';
    c.lineWidth = 4;
    c.stroke(new Path2D('M8 100 L40 123 L69 125 M10 187 L35 207 L94 222 M12 262 L63 278'));
    c.fillStyle = damaged ? '#3b3b3e' : '#304451';
    for (let i = 0; i < 4; i++) c.fillRect(42 + i * 5, 235 + i * 2, 3, 14);
    c.restore();
    finish.restore();
  }

  let seed = 2027;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let i = 0; i < 1400; i++) {
    const x = random() * 256, y = random() * 320;
    c.fillStyle = i % 4 === 0 ? '#fff6db50' : '#48382e24';
    c.fillRect(x, y, 1 + 3 * random(), 2 + 5 * random());
  }
  if (damaged) {
    for (const [x, y, radius] of [[70, 266, 72], [176, 240, 65], [154, 150, 42]]) {
      const burn = c.createRadialGradient(x, y, 5, x, y, radius);
      burn.addColorStop(0, '#222127ee');
      burn.addColorStop(.56, '#432c22a0');
      burn.addColorStop(1, '#5b412600');
      c.fillStyle = burn;
      c.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
      const ash = finish.createRadialGradient(x, y, 5, x, y, radius);
      ash.addColorStop(0, '#00ef04');
      ash.addColorStop(.63, '#00d106b0');
      ash.addColorStop(1, '#00d10600');
      finish.fillStyle = ash;
      finish.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
    }
    c.strokeStyle = '#2f2928d0';
    c.lineWidth = 5;
    c.stroke(new Path2D('M70 300 L83 253 L102 228 L98 196 M178 260 L167 212 L143 191'));
  }
  const albedo = new T.CanvasTexture(canvas);
  albedo.colorSpace = T.SRGBColorSpace;
  return { albedo, finish: new T.CanvasTexture(finishCanvas) };
}
