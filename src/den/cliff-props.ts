import * as T from 'three';
import { HEIGHT, WIDTH } from '../playfield';
import type { LevelFrame } from '../rendering/level';
import { DEN_PLATE_WIDTH as PLATE_WIDTH, DEN_SCREEN_HEIGHT as SCREEN_HEIGHT, DEN_SCREENS } from './route';

const ATLAS = 1254;
const propDepth = .99995;
type Sprite = {
  crop: readonly [left: number, top: number, right: number, bottom: number];
  pivot: readonly [x: number, y: number];
};

const single = { crop: [220, 78, 407, 536], pivot: [314, 512] } as const;
const twin = { crop: [730, 126, 1143, 499], pivot: [936, 478] } as const;
const pennant = { crop: [212, 665, 415, 1224], pivot: [314, 668] } as const;
const standard = { crop: [785, 742, 1089, 1140], pivot: [937, 745] } as const;
const rod = { crop: [464, 550, 624, 578], pivot: [544, 564] } as const;
const shadow = { crop: [470, 590, 622, 644], pivot: [546, 617] } as const;
const stacks = [
  { x: 123, y: 9284, width: 32, sprite: single, mouths: [[313, 151]] },
  { x: 185, y: 6958, width: 57, sprite: twin, mouths: [[846, 199], [1027, 199]] },
  { x: 207, y: 7664, width: 34, sprite: single, mouths: [[313, 151]] },
] as const;
const banners = [
  { x: 358, y: 8867, width: 35, sprite: pennant },
  { x: 145, y: 7092, width: 40, sprite: standard },
  { x: 406, y: 7408, width: 36, sprite: pennant },
  { x: 376, y: 2994, width: 40, sprite: pennant },
  { x: 403, y: 3254, width: 40, sprite: standard },
] as const;

function fallbackAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d')!;
  c.scale(512 / ATLAS, 512 / ATLAS);
  function metal(x: number, width: number) {
    const gradient = c.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, '#241e20');
    gradient.addColorStop(.45, '#4c4240');
    gradient.addColorStop(.83, '#986c48');
    gradient.addColorStop(1, '#382923');
    return gradient;
  }
  function flange(x: number, y: number, w: number, h: number) {
    c.fillStyle = metal(x, w);
    c.beginPath();
    c.roundRect(x, y, w, h, 10);
    c.fill();
    c.fillStyle = '#bc8b60';
    for (const edge of [x + 15, x + w - 15]) {
      c.beginPath(); c.ellipse(edge, y + h * .73, 7, 5, 0, 0, Math.PI * 2); c.fill();
    }
  }
  function pipe(x: number, y: number, base: number) {
    const ellipse = (ry: number, rx: number, height: number, fill: string | CanvasGradient) => {
      c.fillStyle = fill;
      c.beginPath(); c.ellipse(x, ry, rx, height, 0, 0, Math.PI * 2); c.fill();
    };
    c.fillStyle = metal(x - 79, 158);
    c.fillRect(x - 79, y, 158, base - y);
    ellipse(base, 79, 29, metal(x - 79, 158));
    for (const band of [y + (base - y) * .65, base - 12]) ellipse(band, 82, 16, metal(x - 82, 164));
    ellipse(y + 13, 90, 72, metal(x - 90, 180));
    ellipse(y, 90, 68, metal(x - 90, 180));
    ellipse(y - 2, 73, 51, '#100d0e');
  }
  flange(224, 425, 179, 102);
  pipe(313, 151, 465);
  flange(734, 385, 405, 104);
  pipe(846, 199, 411);
  pipe(1027, 199, 411);
  for (const { crop: [l, t, r, b] } of [pennant, standard]) {
    const x = (l + r) / 2, w = r - l, h = b - t;
    const cloth = c.createLinearGradient(l, t, r, t);
    cloth.addColorStop(0, '#421c17');
    cloth.addColorStop(.35, '#873325');
    cloth.addColorStop(.66, '#67261e');
    cloth.addColorStop(1, '#913b2a');
    c.fillStyle = cloth;
    c.beginPath();
    c.moveTo(l + 4, t + 3); c.lineTo(r - 4, t + 3);
    c.lineTo(r - w * .08, t + h * .81); c.lineTo(r - w * .28, t + h * .86);
    c.lineTo(x, b - 5); c.lineTo(l + w * .29, t + h * .86);
    c.lineTo(l + w * .08, t + h * .9); c.closePath(); c.fill();
    c.fillStyle = '#c5a078';
    for (let i = -1; i <= 1; i++) {
      c.beginPath(); c.moveTo(x - w * .23 + i * w * .16, t + h * .57);
      c.quadraticCurveTo(x - w * .20 + i * w * .16, t + h * .42, x + w * .20 + i * w * .16, t + h * .26);
      c.lineTo(x - w * .08 + i * w * .16, t + h * .51); c.closePath(); c.fill();
    }
  }
  flange(466, 554, 156, 20);
  c.save();
  c.translate(546, 617);
  c.scale(75, 25);
  const shade = c.createRadialGradient(0, 0, .14, 0, 0, 1);
  shade.addColorStop(0, '#120d0be0');
  shade.addColorStop(1, '#120d0b00');
  c.fillStyle = shade;
  c.fillRect(-1, -1, 2, 2);
  c.restore();
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return map;
}

function propCard(sprite: Sprite, width: number, at: T.Vector2, map: T.Texture,
  clock: { value: number }, order: number, cloth = false) {
  const [l, t, r, b] = sprite.crop, [px, py] = sprite.pivot;
  const scale = width / (r - l);
  const geometry = new T.PlaneGeometry(1, 1, cloth ? 10 : 1, cloth ? 22 : 1);
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) position.setXYZ(i,
    (l + (r - l) * uv.getX(i) - px) * scale / PLATE_WIDTH,
    (py - b + (b - t) * uv.getY(i)) * scale / SCREEN_HEIGHT, 0);
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      map: { value: map }, at: { value: at }, clock, cloth: { value: Number(cloth) },
      wake: { value: 0 }, width: { value: width / PLATE_WIDTH },
      rect: { value: new T.Vector4(l / ATLAS, 1 - b / ATLAS, r / ATLAS, 1 - t / ATLAS) },
    },
    vertexShader: `
      uniform vec2 at;
      uniform float clock, cloth, width, wake;
      varying vec2 artUV;
      varying float light;
      void main() {
        float tail = pow(1.0 - uv.y, 1.55) * cloth;
        float phase = 2.5 * clock + 51.0 * at.x + 7.6 * uv.y;
        float fold = sin(phase + uv.x * 3.1);
        vec2 p = at + position.xy;
        p.x += width * tail * ((.10 + .31 * wake) * fold + .23 * wake);
        p.y += width * tail * (.06 + .16 * wake) * (.55 + .45 * sin(phase - uv.x * 4.0));
        light = 1.0 + .13 * tail * cos(phase + uv.x * 3.1);
        artUV = uv;
        gl_Position = vec4(p * 2.0 - 1.0, ${propDepth}, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec4 rect;
      varying vec2 artUV;
      varying float light;
      void main() {
        vec4 art = texture2D(map, mix(rect.xy, rect.zw, artUV));
        if (art.a < .035) discard;
        gl_FragColor = vec4(art.rgb * light * .76, art.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return mesh;
}

function chimneySmoke(clock: { value: number }) {
  const plume: number[] = [];
  for (const { x, y, width, sprite, mouths } of stacks) {
    const scale = width / (sprite.crop[2] - sprite.crop[0]);
    for (const [mx, my] of mouths) {
      const u = (x + (mx - sprite.pivot[0]) * scale) / PLATE_WIDTH;
      const v = DEN_SCREENS - (y + (my - sprite.pivot[1]) * scale) / SCREEN_HEIGHT;
      for (let i = 0; i < 12; i++) plume.push(u, v, 83 * scale / PLATE_WIDTH, i / 12);
    }
  }
  const plane = new T.PlaneGeometry(1, 1);
  const geometry = new T.InstancedBufferGeometry();
  geometry.setIndex(plane.index);
  geometry.setAttribute('position', plane.getAttribute('position'));
  geometry.setAttribute('uv', plane.getAttribute('uv'));
  geometry.setAttribute('vent', new T.InstancedBufferAttribute(new Float32Array(plume), 4));
  geometry.instanceCount = plume.length / 4;
  plane.dispose();
  const material = new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { clock, scroll: { value: 0 } },
    vertexShader: `
      attribute vec4 vent;
      uniform float clock, scroll;
      varying vec2 puffUV;
      varying float density, seed;
      void main() {
        float life = fract(clock * .35 + vent.w + vent.y * .41);
        seed = 13.0 * vent.y + 83.0 * vent.w;
        float spread = life * life;
        vec2 p = vent.xy - vec2(0.0, scroll);
        p += vec2(.15 * life + .027 * spread * sin(seed),
                  .092 * life + .028 * life * sin(seed + life * 4.0));
        float size = vent.z * (1.12 + 3.9 * life);
        p += position.xy * size * vec2(1.30, ${PLATE_WIDTH / SCREEN_HEIGHT});
        puffUV = uv;
        density = .54 * smoothstep(0.0, .085, life) * pow(1.0 - life, 1.25);
        gl_Position = vec4(p * 2.0 - 1.0, ${propDepth}, 1.0);
      }`,
    fragmentShader: `
      varying vec2 puffUV;
      varying float density, seed;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
          mix(hash(i + vec2(0,1)), hash(i + 1.0), f.x), f.y);
      }
      void main() {
        vec2 p = puffUV * 2.0 - 1.0;
        float grain = .66 * noise(p * 2.6 + seed) + .34 * noise(p * 5.7 - seed);
        float soft = 1.0 - smoothstep(.19, 1.0, length(p) + .34 * (grain - .5));
        float alpha = soft * density * (.45 + .85 * grain);
        if (alpha < .004) discard;
        vec3 dark = vec3(.14, .121, .114), light = vec3(.51, .45, .41);
        gl_FragColor = vec4(mix(dark, light, grain * .68 + puffUV.x * .22), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = 'den-chimney-smoke';
  mesh.frustumCulled = false;
  mesh.renderOrder = -986;
  return mesh;
}

export function createDenCliffProps() {
  const root = new T.Group();
  root.name = 'den-cliff-props';
  const fallback = fallbackAtlas();
  const clock = { value: 0 };
  const smoke = chimneySmoke(clock);
  const fittings = stacks.map(({ x, y, width, sprite }) => {
    const at = new T.Vector2(x / PLATE_WIDTH, 0);
    const foot = propCard(shadow, width * 1.85, at, fallback, clock, -990);
    const stack = propCard(sprite, width, at, fallback, clock, -989);
    stack.name = 'den-chimney';
    root.add(foot, stack);
    return { y, at, foot, stack };
  });
  const flags = banners.map(({ x, y, width, sprite }) => {
    const at = new T.Vector2(x / PLATE_WIDTH, 0);
    const cloth = propCard(sprite, width, at, fallback, clock, -988, true);
    const rail = propCard(rod, width * 1.12, at, fallback, clock, -987);
    cloth.name = 'den-banner';
    root.add(cloth, rail);
    return { y, at, cloth, rail, wake: cloth.material.uniforms.wake };
  });
  root.add(smoke);
  return {
    root,
    fallback,
    setArt(map: T.Texture) {
      const image = map.image as { width: number; height: number } | undefined;
      if (!image?.width || image.width !== image.height) throw new Error('Unsupported Den scenery atlas layout');
      for (const { stack } of fittings) stack.material.uniforms.map.value = map;
      for (const { cloth } of flags) cloth.material.uniforms.map.value = map;
    },
    prime() { root.children.forEach(child => { child.visible = true; }); },
    update(scroll: number, { flight, animationTime, elapsed, newFlight, fighterSpeed, droneSpeed }: LevelFrame) {
      clock.value = animationTime;
      smoke.material.uniforms.scroll.value = scroll;
      smoke.visible = false;
      for (const { y, at, foot, stack } of fittings) {
        at.y = DEN_SCREENS - y / SCREEN_HEIGHT - scroll;
        foot.visible = stack.visible = at.y > -.13 && at.y < 1.17;
        smoke.visible ||= at.y > -.25 && at.y < 1.16;
      }
      for (const { y, at, cloth, rail, wake } of flags) {
        at.y = DEN_SCREENS - y / SCREEN_HEIGHT - scroll;
        cloth.visible = rail.visible = at.y > -.02 && at.y < 1.16;
        if (newFlight || !cloth.visible) wake.value = 0;
        if (!cloth.visible || elapsed <= 0) continue;
        const x = (at.x - .5) * WIDTH, yWorld = (at.y - .54) * HEIGHT;
        const influence = (actor: { x: number; y: number }, speed: number) =>
          (1 - T.MathUtils.smoothstep(Math.hypot(actor.x - x, actor.y - yWorld), .25, 1.85))
          * T.MathUtils.smoothstep(speed, .1, 3.4);
        let impulse = flight.hull > 0 ? Math.max(
          influence(flight.player, fighterSpeed + 1.4), influence(flight.drone, droneSpeed + 1.4),
        ) : 0;
        for (const enemy of flight.enemies) if (enemy.den && enemy.age >= 0 && enemy.hp > 0)
          impulse = Math.max(impulse, influence(enemy, 3.5));
        wake.value = T.MathUtils.damp(wake.value, impulse, impulse > wake.value ? 9 : 3, elapsed);
      }
    },
  };
}
