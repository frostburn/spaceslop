import * as T from 'three';
import { part, pivot } from './rig-geometry';
import { groundskeeperPose, type GkPoint } from './groundskeeper';
import { gkFeatherGeometry, gkPlumage, gkSnout, gkTube, mergeGkFixed } from './groundskeeper-geometry';
import { createGroundskeeperMaterials } from './groundskeeper-materials';

const vec = (p: GkPoint) => new T.Vector3(p.x, p.y, p.z);

export function createGroundskeeper() {
  const root = new T.Group(); root.name = 'groundskeeper';
  const m = createGroundskeeperMaterials(), sphere = new T.SphereGeometry(1, 32, 20), feather = gkFeatherGeometry();
  const body = pivot(root, 'heavy-torso', 0, 0, 0);
  part(body, sphere, m.down, 0, 0, 7.05).scale.set(2.75, 2.4, 3.45);
  body.add(gkPlumage(feather, m.feathers, new T.Vector3(0, 0, 7.05), new T.Vector3(2.77, 2.42, 3.47), 1100, 80, .87));
  part(body, sphere, m.down, 0, 3.65, 6.6).scale.set(1.2, 3.5, .85);
  body.add(gkPlumage(feather, m.feathers, new T.Vector3(0, 3.7, 6.6), new T.Vector3(1.2, 3.5, .85), 150, 93, 1.1, true, new T.Vector3(0, 1, -.1)));

  function segment(name: string, radius: number, length: number, plumage: boolean) {
    const group = pivot(root, name, 0, 0, 0);
    part(group, sphere, plumage ? m.darkDown : m.skin, 0, length / 2, 0).scale.set(radius, length / 2 + radius * .28, radius * .9);
    if (plumage) group.add(gkPlumage(feather, m.feathers, new T.Vector3(0, length / 2, 0),
      new T.Vector3(radius * 1.03, length / 2, radius * .94), 145, radius * 1000, .9, true, new T.Vector3(0, 1, 0)));
    return group;
  }
  const arms = [-1, 1].map(side => {
    const upper = segment(`upper-arm-${side}`, .72, 4.05, true), lower = segment(`forearm-${side}`, .49, 4.25, true);
    const palm = part(root, sphere, m.skin, 0, 0, 0); palm.scale.set(.83, .62, .42);
    const claws = Array.from({ length: 3 }, (_, i) => {
      const tube = gkTube(22, 12), color = [], p = tube.geometry.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const t = Math.floor(j / 13) / 22, dark = T.MathUtils.smoothstep(t, .7, 1);
        color.push(1 - dark * .68, 1 - dark * .68, 1 - dark * .65);
      }
      tube.geometry.setAttribute('color', new T.Float32BufferAttribute(color, 3));
      const material = m.claw.clone(); material.vertexColors = true;
      const mesh = part(root, tube.geometry, material, 0, 0, 0); mesh.name = `claw-${side}-${i}`;
      return { ...tube, mesh };
    });
    return { upper, lower, palm, claws };
  });
  const legs = [-1, 1].map(side => {
    const thigh = segment(`haunch-${side}`, 1.05, 3.4, true), shin = segment(`shin-${side}`, .54, 2.9, false);
    const foot = pivot(root, `foot-${side}`, 0, 0, 0);
    part(foot, sphere, m.skin, 0, -.25, .4).scale.set(.65, .85, .4);
    for (let toe = -1; toe <= 2; toe++) {
      const tx = (toe - .5) * .31, y = toe === 2 ? -.55 : -1.0;
      part(foot, sphere, m.skin, tx, y, .2).scale.set(.2, .65, .21);
      const nail = part(foot, sphere, m.claw, tx, y - .57, .15); nail.scale.set(.16, .32, .13);
    }
    return { thigh, shin, foot };
  });

  const neck = gkTube(28, 24), neckMesh = part(root, neck.geometry, m.down, 0, 0, 0); neckMesh.name = 'continuous-neck';
  const neckFeathers = new T.InstancedMesh(feather, m.feathers, 360); root.add(neckFeathers);
  neckFeathers.name = 'raised-neck-hackles'; neckFeathers.instanceMatrix.setUsage(T.DynamicDrawUsage); neckFeathers.frustumCulled = false;
  const head = pivot(root, 'dinosaur-head', 0, 0, 14.1);
  const skull = gkSnout([[.7, .32, -.2, .42], [.38, .58, -.22, .66], [-.15, .64, -.2, .66],
    [-.7, .57, -.18, .54], [-1.3, .49, -.16, .43], [-1.9, .43, -.13, .35], [-2.02, .24, -.08, .28]]);
  part(head, skull, m.skin, 0, 0, 0).name = 'long-scaled-muzzle';
  const jaw = pivot(head, 'jaw-hinge', 0, .4, -.22);
  const mandible = gkSnout([[.3, .32, -.24, .04], [-.25, .53, -.27, .02], [-.9, .48, -.24, .01], [-1.7, .40, -.19, 0], [-2.33, .24, -.13, .01]]);
  part(jaw, mandible, m.skin, 0, 0, 0).name = 'continuous-lower-jaw';
  part(head, sphere, m.dark, 0, -.65, -.16).scale.set(.49, 1.1, .06);
  part(jaw, sphere, m.flesh, 0, -1.0, .012).scale.set(.42, 1.1, .07);
  part(jaw, sphere, m.tongue, 0, -1.05, .065).scale.set(.23, .86, .075);
  // Soft dark mouth corners overlap both sides of the hinge when the jaw opens.
  for (const side of [-1, 1]) {
    part(head, sphere, m.ochre, side * .54, -.12, .37).scale.set(.14, .38, .21);
    const eye = pivot(head, `eye-${side}`, side * .58, -.28, .37);
    eye.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(side * .82, -.55, .13).normalize());
    part(eye, sphere, m.dark, 0, 0, 0).scale.set(.205, .18, .08);
    part(eye, sphere, m.eye, 0, 0, .06).scale.set(.115, .108, .06);
    part(eye, sphere, m.pupil, 0, 0, .11).scale.set(.046, .06, .02);
    const nostril = part(head, sphere, m.dark, side * .46, -1.62, .22);
    nostril.scale.set(.035, .12, .06); nostril.rotation.z = side * .17;
    for (let i = 0; i < 10; i++) {
      const y = .1 - i * .135, tooth = new T.ConeGeometry(.045, .12, 6);
      part(head, tooth, m.claw, side * (.45 + (i < 4 ? .035 : 0)), y, -.21).rotation.x = -Math.PI / 2;
      part(jaw, tooth, m.claw, side * .43, y - .4, .045).rotation.x = Math.PI / 2;
    }
  }
  const crest = gkPlumage(feather, m.feathers, new T.Vector3(0, .4, .35), new T.Vector3(.54, .45, .46), 65, 201, .52, true, new T.Vector3(0, 1, .4));
  head.add(crest);
  const throat = gkTube(8, 14); part(root, throat.geometry, m.skin, 0, 0, 0).name = 'jaw-throat-connection';
  pivot(root, 'laser_contact_C', 0, -2.35, 7.1);
  pivot(root, 'laser_contact_L', 0, -2.35, 7.1); pivot(root, 'laser_contact_R', 0, -2.35, 7.1);

  const direction = new T.Vector3(), start = new T.Vector3(), finish = new T.Vector3(), basis = new T.Matrix4();
  const n = new T.Vector3(), across = new T.Vector3(), shaft = new T.Vector3(), transform = new T.Object3D();
  const axis = new T.Vector3(0, 1, 0), tint = new T.Color();
  function span(group: T.Group, a: GkPoint, b: GkPoint, nominal: number) {
    group.position.copy(vec(a)); direction.copy(vec(b)).sub(group.position);
    group.quaternion.setFromUnitVectors(axis, direction.clone().normalize()); group.scale.y = direction.length() / nominal;
  }
  function pose(time: number, aim = { x: 0, y: -5.3 }, cancelledAt = -100) {
    const p = groundskeeperPose(time, aim, cancelledAt);
    body.position.copy(vec(p.torso)); m.puff.value = p.feathers;
    head.position.copy(vec(p.head)); head.rotation.set(.025 * Math.sin(time * .7), 0, .2 + .12 * Math.sin(time * .55));
    jaw.rotation.x = p.jaw;
    for (const [i, a] of p.arms.entries()) {
      const rig = arms[i]; span(rig.upper, a.shoulder, a.elbow, 4.05); span(rig.lower, a.elbow, a.wrist, 4.25);
      rig.palm.position.copy(vec(a.wrist)).addScaledVector(vec(a.direction), .28);
      rig.palm.quaternion.setFromUnitVectors(axis, vec(a.direction)); rig.palm.scale.set(.72, .68, .36);
      for (const [j, claw] of rig.claws.entries()) claw.pose(new T.CatmullRomCurve3(a.claws[j].map(vec)), .24, .008);
    }
    for (const [i, f] of p.feet.entries()) {
      const hip = { x: i ? 1.85 : -1.85, y: .6 + p.torso.y, z: 5.65 + p.torso.z };
      const knee = { x: f.x * 1.1, y: f.y - 1.2, z: 2.8 };
      span(legs[i].thigh, hip, knee, 3.4); span(legs[i].shin, knee, { ...f, z: .6 }, 2.9); legs[i].foot.position.copy(vec(f));
    }
    start.copy(vec(p.neckBase)); finish.copy(vec(p.head)).add(new T.Vector3(0, .35, -.12));
    const curve = new T.CatmullRomCurve3([start.clone(), start.clone().lerp(finish, .37).add(new T.Vector3(0, .55, .25)), start.clone().lerp(finish, .72).add(new T.Vector3(0, -.5, 0)), finish.clone()]);
    neck.pose(curve, .93, .48);
    for (let i = 0; i < neckFeathers.count; i++) {
      const t = .06 + .86 * (i / neckFeathers.count), a = i * 2.399963;
      direction.copy(curve.getTangent(t)); const center = curve.getPoint(t), r = T.MathUtils.lerp(.95, .51, t);
      across.set(1, 0, 0).addScaledVector(direction, -direction.x).normalize(); n.crossVectors(direction, across).normalize();
      const outward = across.clone().multiplyScalar(Math.cos(a)).addScaledVector(n, Math.sin(a));
      shaft.copy(direction).negate(); across.crossVectors(shaft, outward).normalize();
      transform.position.copy(center).addScaledVector(outward, r);
      transform.quaternion.setFromRotationMatrix(basis.makeBasis(across, shaft, outward));
      transform.scale.set(.65, .72 + .15 * Math.sin(i * 3), .8); transform.updateMatrix(); neckFeathers.setMatrixAt(i, transform.matrix);
      if (time === 0) { tint.setHex(Math.sin(a) > .4 ? 0x85775a : 0xc7b996); neckFeathers.setColorAt(i, tint); }
    }
    neckFeathers.instanceMatrix.needsUpdate = true;
    head.updateMatrix();
    const chin = new T.Vector3(0, -.35, -.28).applyAxisAngle(new T.Vector3(1, 0, 0), p.jaw).add(new T.Vector3(0, .4, -.22)).applyMatrix4(head.matrix);
    throat.pose(new T.CatmullRomCurve3([finish.clone().add(new T.Vector3(0, 0, -.25)), chin.clone().lerp(finish, .5), chin]), .36, .30);
    for (const name of ['laser_contact_C','laser_contact_L','laser_contact_R']) root.getObjectByName(name)!.position.set(p.torso.x, -2.35+p.torso.y, 7.1+p.torso.z);
    return p;
  }
  for (const group of [head, body, ...legs.map(l => l.foot)]) mergeGkFixed(group);
  pose(0);
  neckFeathers.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 7), 18);
  root.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = o.receiveShadow = true; } });
  return { root, pose, materials: m, setFeatherTexture: m.setFeathers, setScaleTexture: m.setScales };
}
