import * as T from 'three';
import { part, pivot } from './rig-geometry';
import { groundskeeperPose, GROUNDSKEEPER_BELLY, GROUNDSKEEPER_UPPER_ARM, GROUNDSKEEPER_FOREARM, type GkPoint } from './groundskeeper';
import { gkFeatherGeometry, gkPlumage, gkTorsoSurface, gkTube, mergeGkFixed } from './groundskeeper-geometry';
import { createGroundskeeperMaterials } from './groundskeeper-materials';
import { createGroundskeeperFace } from './groundskeeper-face';
import { preserveRandom } from './preserve-layout';

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
  part(body, torso, m.down, 0, -.1, 6.9);
  body.add(gkPlumage(feather, m.feathers, new T.Vector3(0, -.1, 6.9), new T.Vector3(3.14, 2.67, 3.07), 4200, 80, .43, false, new T.Vector3(0, 0, -1), gkTorsoSurface));
  part(body, sphere, m.down, 0, 3.65, 6.6).scale.set(1.2, 3.5, .85);
  body.add(gkPlumage(feather, m.feathers, new T.Vector3(0, 3.7, 6.6), new T.Vector3(1.2, 3.5, .85), 300, 93, .48, true, new T.Vector3(0, 1, -.1)));
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
    const upper = segment(`upper-arm-${side}`, .78, GROUNDSKEEPER_UPPER_ARM, true), lower = segment(`forearm-${side}`, .49, GROUNDSKEEPER_FOREARM, true);
    const palm = part(root, sphere, m.hand, 0, 0, 0); palm.name = `palm-${side}`; palm.scale.set(.83, .62, .42);
    const claws = Array.from({ length: 3 }, (_, i) => {
      const tube = gkTube(22, 12), color = [], p = tube.geometry.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const t = Math.floor(j / 13) / 22, tip = T.MathUtils.smoothstep(t, .76, 1), base = 1 - T.MathUtils.smoothstep(t, .02, .23);
        const tone = 1 - base * .48 - tip * .68; color.push(tone, tone, tone);
      }
      tube.geometry.setAttribute('color', new T.Float32BufferAttribute(color, 3));
      const material = m.claw.clone(); material.vertexColors = true;
      const mesh = part(root, tube.geometry, material, 0, 0, 0); mesh.name = `claw-${side}-${i}`;
      return { ...tube, mesh };
    });
    const digits = Array.from({length:3},()=>{const mesh=part(root,sphere,m.hand,0,0,0);mesh.scale.set(.25,.37,.20);return mesh;});
    return { upper, lower, palm, claws, digits };
  });
  const legs = [-1, 1].map(side => {
    const thigh = segment(`haunch-${side}`, 1.1, 3.4, true), shin = segment(`shin-${side}`, .51, 2.6, false), tarsus = segment(`ankle-${side}`, .34, 1.7, false);
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
  const axis = new T.Vector3(0, 1, 0), tint = new T.Color(), neckLight = new T.Color(0xb9aa8e);
  function span(group: T.Group, a: GkPoint, b: GkPoint, nominal: number) {
    group.position.copy(vec(a)); direction.copy(vec(b)).sub(group.position);
    group.quaternion.setFromUnitVectors(axis, direction.clone().normalize()); group.scale.y = direction.length() / nominal;
  }
  function armSpan(group: T.Group, a: GkPoint, b: GkPoint, hinge: GkPoint, nominal: number) {
    group.position.copy(vec(a)); direction.copy(vec(b)).sub(group.position); const length = direction.length(); direction.divideScalar(length);
    across.copy(vec(hinge)); n.crossVectors(across, direction).normalize();
    group.quaternion.setFromRotationMatrix(basis.makeBasis(across, direction, n)); group.scale.y = length / nominal;
  }
  function pose(time: number, aim = { x: 0, y: -5.3 }, cancelledAt = -100) {
    const p = groundskeeperPose(time, aim, cancelledAt);
    body.position.copy(vec(p.torso)); m.puff.value = p.feathers;
    head.position.copy(vec(p.head)); head.rotation.set(p.headPitch,0,p.headYaw,'ZYX');
    face.pose(p.jaw);
    for (const [i, a] of p.arms.entries()) {
      const rig = arms[i]; armSpan(rig.upper, a.shoulder, a.elbow, a.hinge, GROUNDSKEEPER_UPPER_ARM); armSpan(rig.lower, a.elbow, a.wrist, a.hinge, GROUNDSKEEPER_FOREARM);
      rig.palm.position.copy(vec(a.wrist)).addScaledVector(vec(a.direction), .28);
      across.copy(vec(a.across)); direction.copy(vec(a.direction)); n.crossVectors(across, direction).normalize();
      rig.palm.quaternion.setFromRotationMatrix(basis.makeBasis(across, direction, n)); rig.palm.scale.set(.6, .62, .28);
      for (const [j, claw] of rig.claws.entries()) {
        claw.pose(new T.CatmullRomCurve3(a.claws[j].map(vec)), .34, .01, true, vec(a.across));
        rig.digits[j].position.copy(vec(a.claws[j][0])).addScaledVector(vec(a.direction),.12);
        rig.digits[j].quaternion.copy(rig.palm.quaternion);
      }
    }
    for (const [i, f] of p.feet.entries()) {
      const hip = { x: i ? 1.7 : -1.7, y: .75 + p.torso.y, z: 5.8 + p.torso.z };
      const knee = { x: f.x * 1.06, y: f.y - 1.0, z: 3.4 }, hock = { x: f.x, y: f.y + .55, z: 1.65 + f.z * .5 };
      span(legs[i].thigh, hip, knee, 3.4); span(legs[i].shin, knee, hock, 2.6); span(legs[i].tarsus, hock, { ...f, z: .6 + f.z }, 1.7);
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
      if (time === 0) { tint.setHex(0x66503e).lerp(neckLight, T.MathUtils.smoothstep(-outward.y,-.1,.7)).multiplyScalar(scatter.shade); neckFeathers.setColorAt(i, tint); }
    }
    neckFeathers.instanceMatrix.needsUpdate = true;
    head.updateMatrix();
    const chin = new T.Vector3(0, -.35, -.28).applyAxisAngle(new T.Vector3(1, 0, 0), p.jaw).add(new T.Vector3(0, .4, -.22)).applyMatrix4(head.matrix);
    throat.pose(new T.CatmullRomCurve3([finish.clone().add(new T.Vector3(0, 0, -.25)), chin.clone().lerp(finish, .5), chin]), .36, .30);
    for (const name of ['laser_contact_C','laser_contact_L','laser_contact_R']) root.getObjectByName(name)!.position.set(p.torso.x+GROUNDSKEEPER_BELLY.x, GROUNDSKEEPER_BELLY.y+p.torso.y, GROUNDSKEEPER_BELLY.z+p.torso.z);
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
