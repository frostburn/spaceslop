import * as T from 'three';
import type { heliostatBatch, Point3 } from './geometry';

/** One presentation clock drives all windings and contained stellar material. */
export function createThermalMaterials() {
  const clock = { value: 0 };
  const hotCoil = new T.MeshStandardMaterial({ color: 0x97381d, emissive: 0xff5b09,
    emissiveIntensity: 3.1, metalness: .52, roughness: .45 });
  hotCoil.onBeforeCompile = shader => {
    shader.uniforms.thermalClock = clock;
    shader.vertexShader = 'varying vec3 thermalPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nthermalPosition=position;');
    shader.fragmentShader = 'uniform float thermalClock;varying vec3 thermalPosition;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       float heat=.78+.12*sin(dot(thermalPosition,vec3(1.3,.4,.7))-thermalClock*.7)
                     +.1*sin(dot(thermalPosition,vec3(.6,1.9,.3))+thermalClock*.43);
       totalEmissiveRadiance*=heat;`);
  };
  hotCoil.customProgramCacheKey = () => 'heliostat-hot-winding-v1';
  hotCoil.name = 'heliostat-hot-winding';
  function flowing(halo: boolean) {
    return new T.ShaderMaterial({
      transparent: halo, depthWrite: !halo, side: T.DoubleSide, forceSinglePass: true,
      blending: halo ? T.AdditiveBlending : T.NormalBlending,
      uniforms: { clock, halo: { value: halo } },
      vertexShader: `varying vec2 flowUV;varying vec3 outward,sight;
        void main(){flowUV=uv;vec4 world=modelMatrix*vec4(position,1.);
          outward=normalize(normalMatrix*normal);sight=normalize(-(viewMatrix*world).xyz);
          gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `uniform float clock;uniform bool halo;varying vec2 flowUV;varying vec3 outward,sight;
        void main(){float a=flowUV.y*6.283185,travel=(flowUV.x-clock*1.7)*1.570796327;
          float surge=.5+.24*sin(travel*2.+sin(a)*1.3)+.17*sin(travel*5.-a+clock*.6);
          float filament=pow(max(0.,cos(a+travel+sin(travel))),10.);
          vec3 col=mix(vec3(1.8,.13,.006),vec3(3.2,1.5,.24),clamp(surge*.82+filament*.35,0.,1.));
          float facing=abs(dot(normalize(outward),normalize(sight)));
          float alpha=halo ? .15*pow(facing,1.5) : 1.;
          gl_FragColor=vec4(col,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
  }
  const starstuff = flowing(false), plasmaHalo = flowing(true);
  starstuff.name = 'heliostat-contained-plasma'; plasmaHalo.name = 'heliostat-conduit-halo';
  const containmentGlass = new T.MeshStandardMaterial({ color: 0x9cb7c1, transparent: true,
    opacity: .17, metalness: .38, roughness: .23, depthWrite: false, side: T.DoubleSide, envMapIntensity: 1.2 });
  containmentGlass.name = 'heliostat-containment-sleeve';
  return { hotCoil, starstuff, plasmaHalo, containmentGlass, updateThermal(time: number) { clock.value = time; } };
}

type ConduitMaterials = ReturnType<typeof createThermalMaterials> & { titanium: T.Material };

/** A solid flowing core, clear containment sleeve, soft halo and real collars.
 * Metric UVs keep transport speed equal in long mains and short branch pipes.
 * The four-unit flow cycle divides the 28-unit bays, preserving the seam phase.
 */
export function starConduit(b: ReturnType<typeof heliostatBatch>, m: ConduitMaterials, points: Point3[], radius = .22, endCollar = true) {
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), length = curve.getLength();
  const start=curve.points[0],axis=curve.points.at(-1)!.clone().sub(start).normalize();
  const straight=curve.points.every(p=>p.clone().sub(start).cross(axis).lengthSq()<1e-8);
  const segments = straight ? 4 : Math.max(10, Math.min(56, Math.ceil(length * 1.4)));
  for (const [scale, material] of [[.63, m.starstuff], [1, m.containmentGlass], [1.65, m.plasmaHalo]] as const) {
    const g = new T.TubeGeometry(curve, segments, radius * scale, 8, false), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length);
    b.add(g, material);
  }
  const collars = Math.max(1, Math.ceil(length / 2.4));
  for (let i = 0; i < collars + Number(endCollar); i++) {
    const t = i / collars, p = curve.getPointAt(t), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), curve.getTangentAt(t));
    const g = new T.TorusGeometry(radius * 1.08, .035, 4, 10).applyQuaternion(q);
    b.add(g, m.titanium, p.toArray() as Point3);
  }
}
