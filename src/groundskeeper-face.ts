import * as T from 'three';
import { part, pivot } from './rig-geometry';
import { gkPlumage, gkSnout } from './groundskeeper-geometry';
import { gkScalpPlumage, gkSkullGeometry } from './groundskeeper-skull';
import type { createGroundskeeperMaterials } from './groundskeeper-materials';

export function createGroundskeeperFace(parent: T.Group, m: ReturnType<typeof createGroundskeeperMaterials>, feather: T.BufferGeometry) {
  const head = pivot(parent, 'dinosaur-head', 0, 0, 12.5), sphere = new T.SphereGeometry(1, 24, 16);
  const skull = gkSkullGeometry();
  part(head, skull, m.face, 0, 0, 0).name = 'long-scaled-muzzle';
  const hinge = new T.Vector3(0, .4, -.22), jaw = pivot(head, 'jaw-hinge', hinge.x, hinge.y, hinge.z);
  const mandible = gkSnout([[.35, .36, -.30, .035], [-.2, .59, -.38, .07], [-.85, .54, -.34, .09], [-1.65, .49, -.29, .11],
    [-2.75, .34, -.12, .10], [-2.88, .18, -.08, .06], [-2.92, .03, -.03, .02]]);
  part(jaw, mandible, m.skin, 0, 0, 0).name = 'continuous-lower-jaw';
  part(head, sphere, m.dark, 0, -.82, -.17).scale.set(.49, 1.43, .075);
  part(jaw, sphere, m.dark, 0, -1.12, .13).scale.set(.45, 1.42, .05);
  part(jaw, sphere, m.tongue, 0, -.73, .17).scale.set(.18, .56, .045);
  const upperTeeth = pivot(head, 'upper-rear-teeth', 0, 0, 0), lowerTeeth = pivot(jaw, 'lower-rear-teeth', 0, 0, 0);
  const tooth = new T.ConeGeometry(.043, .095, 6);
  for (const side of [-1, 1]) {
    // Orbital bone grows into the cranium. Small eyes sit behind the rim.
    const socket = pivot(head, `eye-${side}`, side * .60, -.12, .43);
    socket.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(side * .87, -.43, .14).normalize());
    part(socket, sphere, m.dark, 0, 0, 0).scale.set(.135, .10, .045);
    part(socket, sphere, m.eye, 0, -.014, .025).scale.set(.08, .061, .028);
    part(socket, sphere, m.pupil, 0, -.014, .05).scale.set(.031, .035, .009);
    part(socket, sphere, m.ochre, 0, .055, .015).scale.set(.13, .035, .038);
    for (let i = 0; i < 8; i++) {
      const y = .03 - i * .145;
      part(upperTeeth, tooth, m.claw, side * .44, y, -.03).rotation.x = -Math.PI / 2;
      part(lowerTeeth, tooth, m.claw, side * .41, y - .4, .11).rotation.x = Math.PI / 2;
    }
  }
  head.add(gkScalpPlumage(feather, m.feathers));
  head.add(gkPlumage(feather, m.feathers, new T.Vector3(0, .42, -.16), new T.Vector3(.64, .73, .70), 240, 202, .43, true, new T.Vector3(0, .6, -.8)));
  const web = new T.BufferGeometry(), webPositions = new T.Float32BufferAttribute(new Float32Array(36), 3);
  webPositions.setUsage(T.DynamicDrawUsage); web.setAttribute('position', webPositions);
  const lining = m.flesh.clone(); lining.color.setHex(0x30251f);
  const corners = new T.Mesh(web, lining); corners.name = 'continuous-mouth-corners'; head.add(corners);
  const xAxis = new T.Vector3(1, 0, 0);
  return { head, jaw, pose(angle: number) {
    jaw.rotation.x = angle;
    // Collapse inside the jaw when the lips meet; keep the draw resources live
    // so the first threat gape never allocates geometry or shader programs.
    upperTeeth.scale.setScalar(angle > .07 ? 1 : .001); lowerTeeth.scale.copy(upperTeeth.scale);
    let i = 0;
    for (const side of [-1, 1]) {
      const a = new T.Vector3(side * .43, .30, -.12), b = new T.Vector3(side * .49, -.65, -.16);
      const c = new T.Vector3(side * .46, -.98, .02).applyAxisAngle(xAxis, angle).add(hinge);
      const d = new T.Vector3(side * .4, -.12, .02).applyAxisAngle(xAxis, angle).add(hinge);
      for (const p of [a, b, c, a, c, d]) webPositions.setXYZ(i++, p.x, p.y, p.z);
    }
    webPositions.needsUpdate = true; web.computeVertexNormals(); web.computeBoundingSphere();
  } };
}
