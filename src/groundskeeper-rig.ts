import * as T from 'three';
import { part, pivot } from './rig-geometry';
import { groundskeeperClaw, groundskeeperPose, GROUNDSKEEPER_THIGH, GROUNDSKEEPER_SHIN, GROUNDSKEEPER_TARSUS, type GkPoint } from './groundskeeper';
import { gkFeatherGeometry, gkPlumage, gkTorsoSurface, gkTube, mergeGkFixed } from './groundskeeper-geometry';
import { createGroundskeeperMaterials } from './groundskeeper-materials';
import { createGroundskeeperFace } from './groundskeeper-face';
import { createGroundskeeperArmSkin } from './groundskeeper-arm-skin';
import { preserveRandom } from './preserve-layout';
import { gkCamouflage } from './groundskeeper-plumage';

const vec = (p: GkPoint) => new T.Vector3(p.x, p.y, p.z);

export function createGroundskeeper() {
  const root = new T.Group(); root.name = 'groundskeeper';
  const m = createGroundskeeperMaterials(), sphere = new T.SphereGeometry(1, 32, 20), feather = gkFeatherGeometry(3);
  const body = pivot(root, 'heavy-torso', 0, 0, 0);
  const torso = sphere.clone().scale(3.12, 2.65, 3.05), tp = torso.attributes.position, tn = torso.attributes.normal;
  const sample = new T.Vector3(), normal = new T.Vector3();
  for (let i = 0; i < tp.count; i++) {
    sample.fromBufferAttribute(tp, i); normal.fromBufferAttribute(tn, i); gkTorsoSurface(sample, normal); tp.setXYZ(i, sample.x, sample.y, sample.z);
  }
  torso.computeVertexNormals();
  part(body, torso, m.down, 0, -.1, 6.9).name = 'breast';
  body.add(gkPlumage(feather, m.feathers, new T.Vector3(0, -.1, 6.9), new T.Vector3(3.14, 2.67, 3.07), 4200, 80, .43, false, new T.Vector3(0, 0, -1), gkTorsoSurface));
  const tail = pivot(body, 'tail-base', 0, 1.55, 6.6);
  part(tail, sphere, m.down, 0, 2.1, 0).scale.set(1.2, 3.5, .85);
  tail.add(gkPlumage(feather, m.feathers, new T.Vector3(0, 2.15, 0), new T.Vector3(1.2, 3.5, .85), 300, 93, .48, true, new T.Vector3(0, 1, -.1)));
  for (const side of [-1, 1]) {
    part(body, sphere, m.darkDown, side * 2.2, -1.5, 8.5).scale.set(.8, 1.0, .9);
    body.add(gkPlumage(feather, m.feathers, new T.Vector3(side * 2.2, -1.5, 8.5), new T.Vector3(.82, 1.02, .92), 240, 110 + side, .48, true));
  }

  function segment(name: string, radius: number, length: number, plumage: boolean) {
    const group = pivot(root, name, 0, 0, 0);
    const surface = (p: T.Vector3, n: T.Vector3) => {
      const taper = 1.14 - .42 * (.5 + p.y / (length + radius * .56)), derivative = -.42 / (length + radius * .56);
      n.x /= taper; n.z /= taper; n.y -= (p.x * n.x + p.z * n.z) * derivative; n.normalize();
      p.x *= taper; p.z *= taper;
    };
    const muscle = sphere.clone().scale(radius, length / 2 + radius * .28, radius * .9);
    const positions = muscle.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      sample.fromBufferAttribute(positions, i); normal.fromBufferAttribute(muscle.attributes.normal, i); surface(sample, normal); positions.setXYZ(i, sample.x, sample.y, sample.z);
    }
    muscle.computeVertexNormals();
    part(group, muscle, plumage ? m.darkDown : m.skin, 0, length / 2, 0);
    if (plumage) group.add(gkPlumage(feather, m.feathers, new T.Vector3(0, length / 2, 0),
      new T.Vector3(radius * 1.03, length / 2, radius * .94), 260, radius * 1000, .4, true, new T.Vector3(0, 1, 0), surface));
    if (plumage) group.add(gkPlumage(feather, m.feathers, new T.Vector3(0, length / 2, 0),
      new T.Vector3(radius * 1.04, length / 2, radius * .97), 80, 70 + radius * 1000, .78, true, new T.Vector3(0, 1, 0), surface));
    return group;
  }
  const arms = [-1, 1].map(side => {
    const skin = createGroundskeeperArmSkin(side, feather, m.hand, m.feathers);
    root.add(skin.mesh, skin.coat);
    // The wrist, knuckles and keratin move as one hand. Build the blades in
    // hand space so a turn cannot roll a claw independently of its socket.
    const palm = pivot(root, `palm-${side}`, 0, 0, 0);
    const pads = pivot(palm, 'knuckles', 0, 0, 0);
    for (const finger of [-1, 0, 1]) {
      const curve = groundskeeperClaw(side, finger).map(vec), socket = curve[0];
      const base = new T.Vector3(finger * .37, .39, .01);
      const bone = part(pads, sphere, m.hand, 0, 0, 0);
      bone.position.lerpVectors(base, socket, .5);
      bone.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), socket.clone().sub(base).normalize());
      bone.scale.set(.245, base.distanceTo(socket) * .5 + .21, .25);
      part(pads, sphere, m.ochre, socket.x, socket.y - .08, socket.z).scale.set(.235, .29, .20);
      const tube = gkTube(22, 12), color = [], p = tube.geometry.attributes.position;
      tube.pose(new T.CatmullRomCurve3(curve), .31, .01, true, new T.Vector3(1, 0, 0));
      for (let j = 0; j < p.count; j++) {
        const t = Math.floor(j / 13) / 22, tip = T.MathUtils.smoothstep(t, .76, 1), base = 1 - T.MathUtils.smoothstep(t, .02, .23);
        const tone = 1 - base * .48 - tip * .68; color.push(tone, tone, tone);
      }
      tube.geometry.setAttribute('color', new T.Float32BufferAttribute(color, 3));
      part(palm, tube.geometry, m.talon, 0, 0, 0).name = `claw-${side}-${finger + 1}`;
    }
    mergeGkFixed(pads);
    return { skin, palm };
  });
  const legs = [-1, 1].map(side => {
    const thigh = segment(`haunch-${side}`, 1.1, GROUNDSKEEPER_THIGH, true), shin = segment(`shin-${side}`, .51, GROUNDSKEEPER_SHIN, false), tarsus = segment(`ankle-${side}`, .34, GROUNDSKEEPER_TARSUS, false);
    part(shin, sphere, m.skin, 0, .09, 0).scale.set(.46, .56, .42);
    part(tarsus, sphere, m.skin, 0, .06, 0).scale.set(.31, .37, .28);
    mergeGkFixed(shin); mergeGkFixed(tarsus);
    const foot = pivot(root, `foot-${side}`, 0, 0, 0);
    part(foot, sphere, m.skin, 0, -.1, .38).scale.set(.58, .73, .43);
    part(foot, sphere, m.skin, 0, .18, .78).scale.set(.37, .44, .66);
    for (let toe = -1; toe <= 2; toe++) {
      const small = toe === 2, tx = small ? -side * .25 : toe * .28;
      const endX = small ? -side * .93 : toe * .68, endY = small ? -.7 : -1.6 + Math.abs(toe) * .15;
      const flesh = gkTube(12, 10);
      flesh.pose(new T.CatmullRomCurve3([new T.Vector3(tx, -.28, .30),new T.Vector3((tx+endX)*.5,-.9,.25),new T.Vector3(endX,endY,.20)]),small?.2:.23,.13);
      part(foot,flesh.geometry,m.skin,0,0,0);
      const nail = gkTube(12, 10);
      nail.pose(new T.CatmullRomCurve3([new T.Vector3(endX,endY,.22),new T.Vector3(endX*1.06,endY-.31,.19),new T.Vector3(endX*1.1,endY-.48,.045)]),.15,.01,true);
      part(foot,nail.geometry,m.toeClaw,0,0,0);
    }
    const shadow = part(foot,new T.PlaneGeometry(2.6,3.1),m.contactShadow.clone(),0,-.55,.01);
    shadow.name='foot-contact-shadow'; shadow.castShadow=false; shadow.renderOrder=1;
    return { thigh, shin, tarsus, foot, shadow };
  });

  const neck = gkTube(28, 24), neckMesh = part(root, neck.geometry, m.down, 0, 0, 0); neckMesh.name = 'continuous-neck';
  const neckFeathers = new T.InstancedMesh(feather, m.feathers, 1600); root.add(neckFeathers);
  neckFeathers.name = 'raised-neck-hackles'; neckFeathers.instanceMatrix.setUsage(T.DynamicDrawUsage); neckFeathers.frustumCulled = false;
  const random = preserveRandom(2719);
  const neckScatter = Array.from({ length: neckFeathers.count }, (_, i) => ({
    t: T.MathUtils.clamp(.02 + .975 * ((i + .5) / neckFeathers.count) + (random() - .5) * .012, .015, .995),
    angle: i * 2.399963 + (random() - .5) * .65,
    width: .51 * (.75 + random() * .5), length: .44 * (.76 + random() * .48),
    cant: (random() - .5) * .32, lift: (random() - .5) * .016, shade: .91 + random() * .18,
  }));
  const face = createGroundskeeperFace(root,m,feather), head = face.head;
  const throat = gkTube(8, 14); part(root, throat.geometry, m.skin, 0, 0, 0).name = 'jaw-throat-connection';
  pivot(root, 'laser_contact_C', 0, -2.35, 7.1);
  pivot(root, 'laser_contact_L', 0, -2.35, 7.1); pivot(root, 'laser_contact_R', 0, -2.35, 7.1);

  const direction = new T.Vector3(), start = new T.Vector3(), finish = new T.Vector3(), basis = new T.Matrix4();
  const n = new T.Vector3(), across = new T.Vector3(), shaft = new T.Vector3(), transform = new T.Object3D();
  const center = new T.Vector3(), before = new T.Vector3(), after = new T.Vector3(), outward = new T.Vector3();
  const axis = new T.Vector3(0, 1, 0), tint = new T.Color();
  function span(group: T.Group, a: GkPoint, b: GkPoint) {
    group.position.copy(a); direction.copy(b).sub(a).normalize();
    group.quaternion.setFromUnitVectors(axis, direction);
  }
  function pose(time: number, aim = { x: 0, y: -5.3 }, cancelledAt = -100) {
    const p = groundskeeperPose(time, aim, cancelledAt);
    body.scale.copy(vec(p.torsoScale));
    body.rotation.set(p.torsoPitch, 0, p.torsoYaw, 'ZYX');
    const chestCenter = center.set(0, -.1, 6.9);
    body.position.copy(p.torso).add(chestCenter);
    body.position.sub(chestCenter.multiply(body.scale).applyQuaternion(body.quaternion));
    tail.rotation.set(-p.torsoPitch * .78, 0, -p.torsoYaw * .55, 'ZYX');
    m.puff.value = p.feathers;
    head.position.copy(vec(p.head)); head.rotation.set(p.headPitch,0,p.headYaw,'ZYX');
    face.pose(p.jaw);
    for (const [i, a] of p.arms.entries()) {
      const rig = arms[i];
      rig.skin.pose(a);
      rig.palm.position.copy(a.wrist);
      across.copy(a.across); direction.copy(a.direction); n.crossVectors(across, direction);
      rig.palm.quaternion.setFromRotationMatrix(basis.makeBasis(across, direction, n));
    }
    for (const [i, f] of p.feet.entries()) {
      const { hip, knee, hock, ankle } = p.legs[i];
      span(legs[i].thigh, hip, knee); span(legs[i].shin, knee, hock); span(legs[i].tarsus, hock, ankle);
      legs[i].foot.position.copy(vec(f)); legs[i].shadow.position.z=.01-f.z; legs[i].shadow.material.opacity=1-f.z*.6;
    }
    start.copy(vec(p.neckBase)); finish.copy(vec(p.head)).add(new T.Vector3(0, .35, -.12));
    const curve = new T.CatmullRomCurve3([start.clone(), start.clone().lerp(finish, .37).add(new T.Vector3(0, .55, .25)), start.clone().lerp(finish, .72).add(new T.Vector3(0, -.5, 0)), finish.clone()]);
    neck.pose(curve, 1.05, .60);
    for (let i = 0; i < neckFeathers.count; i++) {
      const scatter = neckScatter[i], t = scatter.t, a = scatter.angle + .16 * Math.sin(t * 11);
      curve.getPoint(t,center); curve.getPoint(Math.max(0,t-.001),before); curve.getPoint(Math.min(1,t+.001),after);
      direction.subVectors(after,before).normalize(); const r=T.MathUtils.lerp(1.07,.62,t);
      across.set(1, 0, 0).addScaledVector(direction, -direction.x).normalize(); n.crossVectors(direction, across).normalize();
      outward.copy(across).multiplyScalar(Math.cos(a)).addScaledVector(n, Math.sin(a));
      shaft.copy(direction).negate(); across.crossVectors(shaft, outward).normalize();
      shaft.applyAxisAngle(outward, scatter.cant); across.crossVectors(shaft, outward).normalize();
      transform.position.copy(center).addScaledVector(outward, r + scatter.lift);
      transform.quaternion.setFromRotationMatrix(basis.makeBasis(across, shaft, outward));
      transform.scale.set(scatter.width, scatter.length, .65); transform.updateMatrix(); neckFeathers.setMatrixAt(i, transform.matrix);
      if (time === 0) { gkCamouflage(tint,Math.cos(a)*r,Math.sin(a)*r,t*4,T.MathUtils.smoothstep(-outward.y,-.1,.7)).multiplyScalar(scatter.shade); neckFeathers.setColorAt(i, tint); }
    }
    neckFeathers.instanceMatrix.needsUpdate = true;
    head.updateMatrix();
    const chin = new T.Vector3(0, -.35, -.28).applyAxisAngle(new T.Vector3(1, 0, 0), p.jaw).add(new T.Vector3(0, .4, -.22)).applyMatrix4(head.matrix);
    throat.pose(new T.CatmullRomCurve3([finish.clone().add(new T.Vector3(0, 0, -.25)), chin.clone().lerp(finish, .5), chin]), .36, .30);
    for (const name of ['laser_contact_C','laser_contact_L','laser_contact_R']) root.getObjectByName(name)!.position.copy(vec(p.belly));
    return p;
  }
  for (const group of [head, body, ...legs.map(l => l.foot)]) mergeGkFixed(group);
  pose(0);
  neckFeathers.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 7), 18);
  root.traverse(o => {
    if (!(o instanceof T.Mesh) || o.name === 'foot-contact-shadow') return;
    // The skull and jaw cast the facial silhouette. Internal mouth surfaces and
    // tiny eyes need no shadow draws or late depth variants as the head turns.
    o.castShadow = ![m.dark, m.eye, m.pupil, m.tongue].includes(o.material as T.MeshStandardMaterial) && o.name !== 'continuous-mouth-corners';
    o.receiveShadow = true;
  });
  neckFeathers.castShadow=false;
  return { root, pose, materials: m, setFeatherTexture: m.setFeathers, setScaleTexture: m.setScales };
}
