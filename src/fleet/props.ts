import * as T from 'three';
import { HEIGHT } from '../playfield';
import { BROADSIDE_BARREL, broadsideGuns, broadsideSignal } from './combat';
import { fleetViewY, tractorPose, tractorSites } from './route';

function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) {
  const part = new T.Mesh(geometry, material);
  part.position.set(x, y, z);
  parent.add(part);
  return part;
}

export function createBroadsideRigs() {
  const root = new T.Group();
  root.name = 'fleet-broadside-mounts';
  const bronze = new T.MeshStandardMaterial({ color: 0x97714d, metalness: .55, roughness: .41 });
  const iron = new T.MeshStandardMaterial({ color: 0x3b383b, metalness: .54, roughness: .53 });
  const bearing = new T.CylinderGeometry(.29, .32, .09, 24).rotateX(Math.PI / 2);
  const collar = new T.TorusGeometry(.246, .024, 8, 32);
  const hatch = new T.BoxGeometry(.20, .17, .045);
  const barrel = new T.CylinderGeometry(.043, .061, .39, 12).rotateZ(-Math.PI / 2);
  const bore = new T.CircleGeometry(.039, 12).rotateY(Math.PI / 2);
  const warning = new T.RingGeometry(.19, .226, 32);
  const flame = new T.SphereGeometry(1, 12, 8);
  const rigs = broadsideGuns.map(site => {
    const base = new T.Group();
    base.name = 'fleet-gun';
    base.rotation.z = site.side < 0 ? Math.PI : 0;
    root.add(base);
    mesh(base, bearing, iron);
    mesh(base, collar, bronze, 0, 0, .052);
    const lamp = new T.MeshBasicMaterial({ color: 0x71381d, toneMapped: false });
    mesh(base, warning, lamp, 0, 0, .056);
    const doors = [-1, 1].map(side => mesh(base, hatch, bronze, -.08, .085 * side, .09));
    const slide = new T.Group();
    base.add(slide);
    for (const y of [-.075, .075]) {
      mesh(slide, barrel, bronze, BROADSIDE_BARREL - .196, y, .10);
      mesh(slide, bore, iron, BROADSIDE_BARREL, y, .10);
    }
    const fire = new T.MeshBasicMaterial({
      color: 0xffbb63, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false,
    });
    const flash = mesh(base, flame, fire, BROADSIDE_BARREL, 0, .115);
    return { site, base, doors, slide, lamp, fire, flash };
  });
  return {
    root,
    update(time: number) {
      for (const { site, base, doors, slide, lamp, fire, flash } of rigs) {
        const y = fleetViewY(site.y, time);
        base.position.set(site.x, y, 0);
        base.visible = Math.abs(y) <= HEIGHT / 2 + .4;
        if (!base.visible) continue;
        const signal = broadsideSignal(site, time);
        const live = Math.max(signal.charge, signal.flash);
        lamp.color.setRGB(.17 + 1.45 * live, .045 + .55 * live, .01 + .09 * live);
        doors[0].position.y = -.085 - .093 * live;
        doors[1].position.y = .085 + .093 * live;
        slide.position.x = -.16 * (1 - live) - .12 * signal.flash;
        flash.visible = signal.flash > 0;
        flash.scale.set(.20 + .20 * signal.flash, .075 + .05 * signal.flash, .09);
        fire.opacity = signal.flash * .94;
      }
    },
  };
}

function tractorLight() {
  return new T.ShaderMaterial({
    uniforms: { age: { value: 0 }, power: { value: 0 } },
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `
      varying vec2 beamUV;
      void main() {
        beamUV = uv;
        vec3 p = position;
        p.x *= mix(.13, 1.0, uv.y);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying vec2 beamUV;
      uniform float age, power;
      void main() {
        float t = beamUV.y;
        float profile = 1.0 - smoothstep(.08, 1.0, abs(beamUV.x * 2.0 - 1.0));
        float taper = smoothstep(0.0, .055, t) * (1.0 - smoothstep(.88, 1.0, t));
        float wave = pow(max(0.0, .5 + .5 * cos(t * 33.0 + age * 7.5)), 7.0);
        float streak = .83 + .17 * cos(beamUV.x * 31.0 + age * .93);
        gl_FragColor = vec4(mix(vec3(.08,.57,.40), vec3(.38,.93,.69), wave),
          profile * taper * power * (.32 + .30 * wave) * streak);
        #include <colorspace_fragment>
      }`,
  });
}

export function createTractorTraffic() {
  const root = new T.Group();
  root.name = 'fleet-tractor-traffic';
  const housing = new T.MeshStandardMaterial({ color: 0x454851, roughness: .44, metalness: .6 });
  const cone = new T.PlaneGeometry(1, 1, 3, 18);
  const shape = new T.Shape();
  shape.moveTo(0, .67);
  shape.quadraticCurveTo(.16, .54, .20, .22);
  shape.lineTo(.46, -.21);
  shape.lineTo(.31, -.42);
  shape.lineTo(.15, -.36);
  shape.lineTo(.11, -.50);
  shape.lineTo(-.11, -.50);
  shape.lineTo(-.15, -.36);
  shape.lineTo(-.31, -.42);
  shape.lineTo(-.46, -.21);
  shape.lineTo(-.20, .22);
  shape.quadraticCurveTo(-.16, .54, 0, .67);
  const shell = new T.ExtrudeGeometry(shape, { depth: .11, bevelThickness: .04, bevelSize: .04, bevelSegments: 2, steps: 1 });
  const canopy = new T.SphereGeometry(1, 12, 8).scale(.105, .27, .09);
  const engine = new T.BoxGeometry(.078, .17, .058);
  const marker = new T.SphereGeometry(.036, 10, 8);
  const glass = new T.MeshStandardMaterial({ color: 0x263f57, roughness: .18, metalness: .4 });
  const silver = new T.MeshStandardMaterial({ color: 0xc9c6b7, roughness: .43, metalness: .43 });
  const wreck = new T.MeshStandardMaterial({ color: 0x554a48, roughness: .71, metalness: .27 });
  const red = new T.MeshBasicMaterial({ color: 0xf75c50 });
  const green = new T.MeshBasicMaterial({ color: 0x79f0b2 });
  const arc = new T.MeshBasicMaterial({ color: 0xffb65a });
  const rig = tractorSites.map(site => {
    const material = tractorLight();
    const beam = mesh(root, cone, material);
    beam.name = 'fleet-tractor-beam';
    beam.renderOrder = 3;
    const cargo = new T.Group();
    cargo.name = site.wreck ? 'fleet-towed-wreck' : 'fleet-exchange-shuttle';
    root.add(cargo);
    mesh(cargo, shell, site.wreck ? wreck : silver);
    mesh(cargo, canopy, glass, 0, .24, .14);
    mesh(cargo, engine, housing, -.18, -.31, .14);
    mesh(cargo, engine, housing, .18, -.31, .14);
    const lamps = [mesh(cargo, marker, red, -.34, -.26, .15),
      mesh(cargo, marker, site.wreck ? arc : green, .34, -.26, .15)];
    return { site, beam, material, cargo, lamps };
  });
  return {
    root,
    update(time: number, clock: number) {
      for (const { site, beam, material, cargo, lamps } of rig) {
        const pose = tractorPose(site, time);
        beam.visible = Boolean(pose && pose.charge > .015);
        cargo.visible = Boolean(pose && pose.visibility > .01);
        if (!pose) continue;
        const { source, x, y } = pose;
        const dx = x - source.x, dy = y - source.y;
        beam.position.set(source.x + dx / 2, source.y + dy / 2, -.035);
        beam.rotation.z = Math.atan2(-dx, dy);
        beam.scale.set(1.72, Math.hypot(dx, dy), 1);
        material.uniforms.age.value = clock;
        material.uniforms.power.value = pose.charge;
        cargo.position.set(x, y, .03);
        cargo.rotation.set(pose.tilt, 0, pose.angle);
        cargo.scale.setScalar(.74 + pose.visibility * .26);
        lamps[0].visible = clock % 1.04 < .30;
        lamps[1].visible = (clock + .21) % 1.04 < (site.wreck ? .17 : .40);
      }
    },
  };
}
