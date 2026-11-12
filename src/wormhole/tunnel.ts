import * as T from 'three';
import { HEIGHT, WIDTH } from '../playfield';
import type { WormholeReflectionPose } from './reflection';
import type { wormholeFrame } from './route';
import type { fonsPhase, fonsRocks } from './fons/combat';
import { createFonsBackdrop } from './fons/backdrop';
import type { FonsVariant } from './fons/variants';
import { wallRiftShape } from './fons/wall-rift';
import { titanEcho } from './titan-echo';

export function createWormholeTunnel(apertureY: number, reflection: T.Texture) {
  const backdrop = createFonsBackdrop();
  const uniforms = {
    ...backdrop.uniforms,
    travel: { value: 0 },
    lensCenter: { value: new T.Vector2(0, apertureY) },
    lensRadius: { value: .04 },
    lensStrength: { value: 0 },
    echo: { value: 0 },
    waveRadius: { value: .2 },
    waveStrength: { value: 0 },
    fighterReflection: { value: reflection as T.Texture | null },
    reflectionPlane: { value: new T.Vector4(0, 0, 1, 0) },
    reflectionStrength: { value: 0 },
    finale: { value: 0 },
    storm: { value: new T.Vector2() },
    cover: { value: [new T.Vector4(), new T.Vector4()] },
    wallRifts: { value: [new T.Vector4(), new T.Vector4()] },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 screen;
      void main() {
        screen = position.xy * vec2(${WIDTH / HEIGHT}, 1.0);
        gl_Position = vec4(position.xy, .999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 screen;
      uniform vec2 lensCenter;
      uniform float travel, lensRadius, lensStrength, echo, waveRadius, waveStrength;
      uniform sampler2D fighterReflection;
      uniform vec4 reflectionPlane;
      uniform float reflectionStrength;
      uniform float finale;
      uniform vec2 storm;
      uniform vec4 cover[2];
      uniform vec4 wallRifts[2];
      ${titanEcho}
      ${wallRiftShape}
      ${backdrop.fragmentShader}

      float lobe(float phase, float tightness) {
        return pow(max(0.0, .5 + .5 * cos(phase)), tightness);
      }

      vec2 rotateRay(vec2 ray, float angle) {
        float c = cos(angle), s = sin(angle);
        return vec2(c * ray.x - s * ray.y, s * ray.x + c * ray.y);
      }

      vec3 stars(vec2 ray, float scale, float seed) {
        vec2 grid = ray * scale;
        vec2 cell = floor(grid);
        vec2 center = vec2(cloudHash(cell + seed), cloudHash(cell + seed + 19.1));
        vec2 offset = fract(grid) - (.23 + .54 * center);
        float footprint = min(.13, .32 * length(fwidth(grid)));
        float radius = mix(.026, .089, center.y * center.y);
        float point = 1.0 - smoothstep(radius, radius + footprint + .01, length(offset));
        float light = step(.76, cloudHash(cell + seed - 6.7)) * point;
        vec3 color = mix(vec3(.16, .32, .76), vec3(.94, .77, .54), center.x);
        return color * light * (.23 + .7 * center.y * center.y);
      }

      vec3 reflectedWall(vec3 color, vec3 wallTint, float ripple, float theta) {
        if (reflectionStrength < .001) return color;
        vec2 q = screen - reflectionPlane.xy;
        vec2 normal = reflectionPlane.zw;
        vec2 tangent = vec2(-normal.y, normal.x);
        float across = dot(q, normal);
        float along = dot(q, tangent);
        if (abs(across) > .18 || abs(along) > .46) return color;

        // The same traveling folds that turn the starlight shear the mirror.
        // Reverse the wall-normal axis and stretch the image along the wall.
        float shear = ripple + along * 29.0;
        across += .018 * sin(shear) + .009 * sin(shear * 1.9 - theta);
        along += .016 * cos(shear * .81) + along * .12 * cos(ripple);
        vec2 uv = vec2(.5) - normal * (across / .226) + tangent * (along / .68);
        vec4 ship = texture2D(fighterReflection, uv) * .82;
        ship += texture2D(fighterReflection, uv + tangent * .068 - normal * .038) * .18;
        float edge = max(smoothstep(.36, .54, abs(screen.x)), smoothstep(.75, .97, abs(screen.y)));
        float amount = reflectionStrength * (.40 + .60 * edge) * (.68 + .32 * lobe(shear, 1.7));
        vec3 glaze = mix(vec3(.52, .82, 1.0), wallTint * 1.5, .26);
        return color * (1.0 - ship.a * amount * .40) + ship.rgb * glaze * amount;
      }

      vec2 bendAtRift(vec2 ray, vec4 rift) {
        if (rift.z < .002) return ray;
        vec2 p = screen - rift.xy;
        float radius = fonsRiftRadius(fonsRiftLocal(p, rift.w), storm.x);
        float wake = exp(-abs(radius - rift.z) * 2.4) * rift.z;
        vec2 turn = vec2(-p.y, p.x) * rift.w;
        return ray + (-p * .53 + turn * .39) * wake;
      }

      vec3 showRift(vec3 color, vec4 rift) {
        if (rift.z < .002) return color;
        vec2 p = screen - rift.xy;
        vec2 local = fonsRiftLocal(p, rift.w);
        float angle = atan(local.y, local.x + .000001);
        float edge = fonsRiftRadius(local, storm.x) - rift.z;
        float inside = 1.0 - smoothstep(-.065, .021, edge);
        float ribs = .53 + .47 * lobe(angle * 5.0 + storm.x * 7.0, 3.0);
        float arc = exp(-abs(edge) * 38.0) * ribs;
        float halo = exp(-abs(edge) * 10.0) * (.46 + .54 * sin(angle * 2.0 + 1.4) * sin(angle * 2.0 + 1.4));
        vec3 beyond = vec3(.006, .002, .023) + stars(screen * 1.48 + vec2(.18,.08), 31.0, 45.0) * .62;
        vec3 violet = mix(vec3(.48,.07,1.1), vec3(.21,.61,1.23), lobe(angle * 2.0 + .44, 3.0));
        color = mix(color, beyond, inside * smoothstep(.0,.24,rift.z) * .96);
        return color + rift.z * violet * (arc * .81 + halo * .30);
      }

      vec3 corruptedRain(vec3 color) {
        if (storm.y <= 0.0) return color;
        float safe = 0.0;
        for (int i=0; i<2; i++) {
          vec4 stone = cover[i];
          float width = 1.0-smoothstep(stone.z-.003, stone.z+.003, abs(screen.x-stone.x));
          safe = max(safe, stone.w * width * step(screen.y,stone.y));
        }
        float x = screen.x + .004 * sin(screen.y * 27.0 + storm.x * 12.0)
                           + .0025 * sin(screen.y * 61.0 - storm.x * 19.0);
        float column = x * 30.0;
        float cell = floor(column);
        float q = fract(column) - .5;
        float fall = screen.y * 5.2 + storm.x * 9.1 + cloudHash(vec2(cell, 31.4)) * 5.4;
        float breakage = cloudNoise(vec2(cell * .73, fall));
        float splinter = cloudNoise(vec2(cell + 26.0, fall * 3.7));
        float bend = (breakage - .5) * .27 + (splinter-.5)*.10;
        float edge = abs(q - bend);
        float shard = smoothstep(.16,.46,breakage) * (.59+.41*pow(.5+.5*cos(fall*7.5),1.4));
        float boundary = .17 + .10 * breakage + .047 * splinter;
        float cut = (1.0 - smoothstep(boundary-.028,boundary+.027,edge)) * shard;
        float fissure = exp(-abs(edge-boundary)*21.0) * shard;
        vec3 negative = 1.0 - sqrt(clamp(color * 1.6, 0.0, 1.0));
        float rip = smoothstep(.73,.92,breakage) * smoothstep(.35,.86,splinter);
        vec3 torn = mix(vec3(.010,.001,.027), negative * vec3(.36,.13,.52), rip);
        vec3 hazard = mix(color, torn, cut * .97) + vec3(.50,.043,1.08) * fissure * .94;
        return mix(color, hazard, (1.0-safe)*storm.y);
      }

      void main() {
        vec2 delta = screen - lensCenter;
        float lensDistance = length(delta);
        float lensSquared = lensRadius * lensRadius;
        float core = .14 * lensSquared;
        // Ray deflection flips sign inside the critical curve. Sources on the
        // far wall can appear on both sides of the ring without copying a frame.
        float bend = lensStrength * (lensSquared + core) / (dot(delta, delta) + core);
        vec2 ray = screen - delta * bend;
        ray = bendAtInvictus(ray);
        for (int i=0; i<2; i++) ray = bendAtRift(ray, wallRifts[i]);

        vec2 axis = vec2(0.0, ${apertureY.toFixed(8)});
        vec2 fromAxis = ray - axis;
        float radius = length(fromAxis);
        float depth = .91 / max(.066, radius);
        float z = travel + depth;
        float angle = atan(fromAxis.y, fromAxis.x + .000001);
        float twist = .37 * z + .46 * sin(.54 * z) + .17 * sin(z * 1.29 + 1.2);
        float theta = angle + twist;
        vec2 turn = vec2(cos(theta), sin(theta));
        float cloud = cloudNoise(turn * 3.8 + vec2(z * .45, z * .27));
        float distanceFade = smoothstep(.058, .265, radius);
        float fine = distanceFade * (1.0 - smoothstep(.08, .46, fwidth(depth)));
        float folded = lobe(3.0 * theta + .68 * sin(z * .88), 2.3);
        float strandPhase = theta * 9.0 + sin(z * 1.13) * .57 + .23 * sin(theta * 5.0 - z);
        float strands = lobe(strandPhase, 16.0) * (.22 + .78 * folded) * fine;
        float threads = lobe(theta * 27.0 + sin(z * 1.6 + theta * 5.0), 22.0) * cloud * fine;
        float ripple = z * 2.7 + .87 * cos(theta * 2.0) + cloud;
        float wave = lobe(ripple, 12.0) * fine;
        float cold = .5 + .5 * cos(theta + .8 * sin(z * .28));
        vec3 violet = mix(vec3(.11, .032, .27), vec3(.24, .032, .29), finale);
        vec3 cyan = mix(vec3(.033, .32, .58), vec3(.035, .17, .31), finale);
        vec3 tone = mix(violet, cyan, cold);
        vec3 wall = tone * (.022 + .30 * folded * (.18 + .82 * cloud));
        wall += mix(tone, vec3(.22, .66, .94), .43) * (strands * .27 + threads * .07);
        wall += tone * wave * (.035 + .10 * folded);

        float stripAngle = theta * 2.0 - .53 + .49 * sin(z * .52);
        float strip = smoothstep(.49, .86, cos(stripAngle)) * distanceFade * echo;
        if (strip > .003) {
          float across = clamp(.5 + .61 * sin(stripAngle), 0.0, 1.0);
          vec3 vista = titanVista(vec2(z * .86 + .37 * cos(theta), across));
          wall = mix(wall, vista * (.30 + .25 * folded), strip * .94);
          wall += vec3(.69, .23, .08) * lobe(stripAngle + .71, 58.0) * .14 * echo * fine;
        }

        vec3 color = vec3(.0018, .0032, .012);
        color += wall * distanceFade;
        color += vec3(.039, .12, .21) * exp(-radius * 6.5) * (.65 + .35 * cloud);
        // Two depths share the tunnel's helices and traveling ripples. The
        // throat tapers out the turn so the distant sky resolves without aliasing.
        float starTurn = distanceFade * (.32 * twist + .27 * sin(ripple) + .15 * sin(z * 1.49 - 3.0 * theta));
        float starStretch = distanceFade * (.079 * cos(ripple) + .041 * sin(z * 1.57 + theta * 2.0));
        vec2 nearStars = axis + rotateRay(fromAxis, starTurn) * (1.0 + starStretch);
        vec2 farStars = axis + rotateRay(fromAxis, starTurn * .57) * (1.0 + starStretch * .68);
        color += (stars(nearStars, 31.0, 12.0) + .31 * stars(farStars, 57.0, 73.0)) * mix(.83, .32, distanceFade);
        // A distant crescent and nebula give the negative mirror recognizable
        // landmarks as the head-on tunnel opens into the final chamber.
        vec2 moon = ray - vec2(-.40,.77);
        float moonEdge = length(moon)-.128;
        float disc = 1.0-smoothstep(-.003,.003,moonEdge);
        float crescent = disc * smoothstep(-.007,.008,length(moon+vec2(.050,-.030))-.127);
        float atmosphere = exp(-abs(moonEdge)*72.0) * smoothstep(-.04,.07,moon.x-moon.y*.5);
        float moonAmount = max(0.0, finale - royalBackdrop.x - royalBackdrop.y);
        color = mix(color, color*.11, disc*moonAmount);
        color += moonAmount * vec3(1.1,.31,.065) * (crescent*.81 + atmosphere*.29);
        float nebula = smoothstep(.25,.93,cloud) * lobe(theta*2.0-z*.25,3.4);
        color += finale*vec3(.15,.012,.135)*nebula*distanceFade;
        color = showFonsBackdrop(color, ray, screen, storm.x);
        color = reflectedWall(color, tone, ripple, theta);

        float orbit = atan(delta.y, delta.x + .000001);
        float rim = abs(lensDistance - lensRadius * (1.0 + .017 * sin(orbit * 3.0 + travel)));
        float ringShape = .49 + .51 * lobe(orbit * 2.0 - travel * .41, 2.0);
        float width = max(.0012, .74 * fwidth(lensDistance));
        float coreLight = 1.0 - smoothstep(width, width * 3.25, rim);
        float bloom = exp(-rim * 78.0);
        float scatter = exp(-rim * 23.0);
        vec3 lensColor = mix(vec3(.25, .67, 1.0), vec3(1.0, .51, .21), echo);
        color += lensColor * lensStrength * ringShape * (coreLight * 1.9 + .63 * bloom + .17 * scatter);
        color += lensColor * .15 * echo * lensStrength * (1.0 - smoothstep(0.0, lensRadius, lensDistance));
        float shock = exp(-abs(lensDistance - waveRadius) * 36.0);
        color += lensColor * shock * distanceFade * waveStrength * (.13 + .63 * folded);

        // Retain contrast along the flight lane while the walls move around it.
        float lane = (1.0 - smoothstep(.16, .45, abs(screen.x))) * (1.0 - smoothstep(.31, .65, screen.y));
        color *= 1.0 - .34 * lane;
        for (int i=0; i<2; i++) color = showRift(color, wallRifts[i]);
        color = corruptedRain(color);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const root = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  root.name = 'wormhole-tunnel';
  root.frustumCulled = false;
  root.renderOrder = -100;
  return {
    root,
    textures: backdrop.textures,
    pose(frame: ReturnType<typeof wormholeFrame>, mirror: WormholeReflectionPose) {
      uniforms.travel.value = frame.travel;
      uniforms.lensCenter.value.set(frame.lensX, apertureY + frame.lensY);
      uniforms.lensRadius.value = frame.lensRadius;
      uniforms.lensStrength.value = frame.lensStrength;
      uniforms.echo.value = frame.echo;
      uniforms.waveRadius.value = frame.waveRadius;
      uniforms.waveStrength.value = frame.waveStrength;
      uniforms.reflectionStrength.value = mirror?.strength ?? 0;
      if (mirror) uniforms.reflectionPlane.value.set(mirror.x, mirror.y, mirror.nx, mirror.ny);
    },
    setFons(variant: FonsVariant, time: number, amount: number, state?: ReturnType<typeof fonsPhase>, rocks?: ReturnType<typeof fonsRocks>) {
      backdrop.update(variant, time, amount);
      uniforms.finale.value = amount;
      uniforms.storm.value.set(time, state ? state.rain ? 1 : .19 * state.warning : 0);
      for (const [index, shadow] of uniforms.cover.value.entries()) {
        const rock = rocks?.[index];
        const rift = uniforms.wallRifts.value[index];
        if (rock) {
          shadow.set(rock.x / (HEIGHT / 2), rock.y / (HEIGHT / 2), rock.cover / (HEIGHT / 2), Number(rock.covering));
          rift.set(rock.rift.x / (HEIGHT / 2), rock.rift.y / (HEIGHT / 2), rock.rift.opening, rock.rift.side);
        } else {
          shadow.set(0, 0, 0, 0);
          rift.set(0, 0, 0, 0);
        }
      }
    },
    clearReflection() { uniforms.fighterReflection.value = null; },
  };
}
