import * as T from 'three';
import type { Flight } from '../../game';
import { fonsBeams, fonsPose, fonsRocks, fonsPhase } from './combat';

function asteroid(seed: number) {
  const shape = new T.IcosahedronGeometry(1, 5);
  const p = shape.attributes.position;
  const colors: number[] = [];
  const slate = new T.Color(0x353641), facets = new T.Color(0x888187), color = new T.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const coarse = Math.sin(x * 4.6 + z * 3.2 + seed) * Math.cos(y * 4.3 - z * 3.4);
    const chips = Math.sin(x * 13.2 - y * 8.5 + z * 6.4) * Math.cos(y * 12.2 + x * 7.8 + seed);
    const height = .94 + coarse * .105 + chips * .075;
    p.setXYZ(i, x * height, y * height, z * height);
    color.copy(slate).lerp(facets, T.MathUtils.clamp(.41 + .28 * coarse + .28 * chips, 0, 1));
    colors.push(color.r, color.g, color.b);
  }
  shape.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  shape.computeVertexNormals();
  return shape;
}

function streak(kind: 'beam' | 'pull', plane: T.PlaneGeometry) {
  const draw = new T.ShaderMaterial({
    uniforms: { power: { value: 0 }, clock: { value: 0 }, firing: { value: false } },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: /* glsl */ `
      varying vec2 v;
      uniform float power,clock;
      uniform bool firing;
      void main() {
        float d = abs(v.x * 2.0 - 1.0);
        float endFade = smoothstep(0.0,.025,v.y) * (1.0-smoothstep(.986,1.0,v.y));
        ${kind === 'beam' ? `
          float edge=exp(-abs(d-.56)*18.0);
          float center=1.0-smoothstep(.52,.67,d);
          float pulse=.62+.38*sin(v.y*57.0-clock*16.0);
          vec3 color=vec3(.009,.002,.018)+edge*vec3(.59,.077,1.06)*(1.0+pulse*.46);
          float opacity=max(center*.95,edge*.87)*power*endFade;
          if(!firing){
            color=vec3(.57,.18,1.0);
            opacity=exp(-d*20.0)*power*.7*smoothstep(-.1,.5,sin(v.y*146.0-clock*8.0))*endFade;
          }
        ` : `
          float sweep = v.y * 24.0 + clock * 9.0;
          float arc = sin(v.y * 18.0 + clock * 4.0) * .36;
          float strand=exp(-abs(v.x*2.0-1.0-arc)*13.0)+.48*exp(-abs(v.x*2.0-1.0+arc)*10.0);
          vec3 color=mix(vec3(.038,.81,.52),vec3(.14,.88,1.38),.5+.5*sin(sweep));
          float opacity=power*strand*endFade*(.28+.38*pow(.5+.5*cos(sweep),2.0));
        `}
        gl_FragColor=vec4(color,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new T.Mesh(plane, draw);
}

function placeStreak(mesh: ReturnType<typeof streak>, from: { x: number; y: number }, to: { x: number; y: number },
  width: number, power: number, time: number, firing: boolean) {
  mesh.visible = power > 0;
  if (!mesh.visible) return;
  const dx = to.x - from.x, dy = to.y - from.y;
  mesh.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, -.06);
  mesh.rotation.z = Math.atan2(-dx, dy);
  mesh.scale.set(width, Math.hypot(dx, dy), 1);
  mesh.material.uniforms.power.value = power;
  mesh.material.uniforms.clock.value = time;
  mesh.material.uniforms.firing.value = firing;
}

export function createFonsEffects() {
  const root = new T.Group();
  root.name = 'fons-attacks';
  const plane = new T.PlaneGeometry(1, 1);
  const beams = [streak('beam', plane), streak('beam', plane)];
  const tethers = [streak('pull', plane), streak('pull', plane)];
  const rockMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .96 });
  const rocks = [3.2, 8.7].map(seed => new T.Mesh(asteroid(seed), rockMaterial));
  rocks.forEach((rock, index) => { rock.name = 'fons-wall-asteroid-' + index; });
  const impacts = rocks.map(() => new T.Mesh(plane, new T.ShaderMaterial({
    uniforms: { clock: { value: 0 } },
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: /* glsl */ `
      varying vec2 v;uniform float clock;
      void main(){
        vec2 p=(v-.5)*2.0;
        float sparks=pow(.5+.5*cos(p.x*53.0+p.y*24.0-clock*31.0),6.0);
        float crest=.23*sin(p.x*3.1+1.5)+.09*sin(p.x*22.0+clock*18.0);
        float spill=exp(-abs(p.y-crest)*7.5)*(.38+sparks);
        float fade=1.0-smoothstep(.59,1.0,max(abs(p.x),abs(p.y)));
        gl_FragColor=vec4(.65,.13,1.4,spill*fade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })));
  const bulletGeometry = new T.SphereGeometry(1, 12, 10);
  const bullets = new T.InstancedMesh(bulletGeometry, new T.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 n, eye;
      void main(){
        vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.0);
        n=normalMatrix*normal; eye=-p.xyz;gl_Position=projectionMatrix*p;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 n,eye;
      void main(){
        float facing=max(0.0,dot(normalize(n),normalize(eye)));
        float rim=pow(1.0-facing,2.1);
        vec3 color=vec3(.009,.002,.017)+vec3(.77,.08,1.48)*rim;
        gl_FragColor=vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), 80);
  bullets.name = 'fons-black-plasma';
  bullets.frustumCulled = false;
  bullets.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const matrix = new T.Matrix4();
  root.add(...rocks, ...tethers, ...beams, ...impacts, bullets);

  function update(time: number, distance: number, threats: readonly Flight['threats'][number][], active: boolean) {
    const pose = fonsPose(time), state = fonsPhase(time);
    const placed = fonsRocks(time, pose);
    for (const [index, rock] of rocks.entries()) {
      const p = placed[index];
      const projection = 1 - p.depth / distance;
      rock.visible = p.visible;
      rock.position.set(p.x * projection, p.y * projection, p.depth);
      rock.rotation.set(.16 + .33 * Math.sin(time * .63 + index), .34 * Math.sin(time * 1.05 + index), p.spin);
      rock.scale.set(p.rx * projection, p.ry * projection, p.ry * projection * 1.08);
      placeStreak(tethers[index], p, { x: pose.x, y: pose.y - .32 }, .35, p.pull, time, false);
      const impact = impacts[index];
      impact.visible = state.rain && p.falling;
      impact.position.set(p.x, p.y + .62 * p.ry, .62);
      impact.scale.set(p.rx * 2.1, p.ry * 1.24, 1);
      impact.material.uniforms.clock.value = time;
    }
    for (const [index, shot] of fonsBeams(time, pose).entries()) {
      placeStreak(beams[index], shot.from, shot.to, shot.width * 3.7,
        !active ? 0 : shot.active ? 1 : shot.warning, time, shot.active);
    }
    bullets.count = active ? Math.min(threats.length, bullets.instanceMatrix.count) : 0;
    for (let i = 0; i < bullets.count; i++) {
      const shot = threats[i];
      matrix.makeScale(.15, .15, .15).setPosition(shot.x, shot.y, .18);
      bullets.setMatrixAt(i, matrix);
    }
    bullets.instanceMatrix.needsUpdate = true;
    return placed;
  }
  return {
    root, rocks, update,
    prime() {
      update(12.3, 22, [{ x: 0, y: 0, z: 0, vx: 0, vy: -1, vz: 0 }], true);
      for (const mesh of [...beams, ...tethers, ...impacts, ...rocks]) mesh.visible = true;
    },
  };
}
