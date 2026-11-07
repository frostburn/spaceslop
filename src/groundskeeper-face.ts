import * as T from 'three';
import { part, pivot } from './rig-geometry';
import { gkPlumage, gkSnout } from './groundskeeper-geometry';
import type { createGroundskeeperMaterials } from './groundskeeper-materials';

export function createGroundskeeperFace(parent: T.Group, m: ReturnType<typeof createGroundskeeperMaterials>, feather: T.BufferGeometry) {
  const head = pivot(parent, 'dinosaur-head', 0, 0, 12.5), sphere = new T.SphereGeometry(1, 24, 16);
  const skull = gkSnout([[.75, .38, -.22, .51], [.5, .63, -.22, .76], [.25, .72, -.22, .78],
    [-.1, .73, -.2, .73], [-.35, .70, -.19, .61], [-.65, .64, -.18, .52],
    [-1.2, .57, -.17, .43], [-1.9, .53, -.15, .37], [-2.4, .43, -.12, .32]]);
  const pos = skull.attributes.position, colors: number[] = [], base = new T.Color(0x9b9179), patch = new T.Color(0x9d754c), c = new T.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const socket = Math.exp(-((y + .12) ** 2 / .07 + (z - .43) ** 2 / .018)) * T.MathUtils.smoothstep(Math.abs(x), .4, .65);
    pos.setX(i, x - Math.sign(x) * socket * .15);
    const eyePatch = Math.exp(-((Math.abs(x) - .62) ** 2 / .07 + (y + .03) ** 2 / .45 + (z - .43) ** 2 / .12));
    c.copy(base).lerp(patch, eyePatch * .8).multiplyScalar(.87 + T.MathUtils.smoothstep(z, -.1, .7) * .13);
    colors.push(c.r, c.g, c.b);
  }
  skull.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  skull.computeVertexNormals();
  part(head, skull, m.face, 0, 0, 0).name = 'long-scaled-muzzle';
  const hinge = new T.Vector3(0, .4, -.22), jaw = pivot(head, 'jaw-hinge', hinge.x, hinge.y, hinge.z);
  const mandible = gkSnout([[.35, .36, -.30, .035], [-.2, .59, -.38, .07], [-.85, .54, -.34, .09], [-1.65, .49, -.29, .11], [-2.75, .40, -.18, .12]]);
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
    const nostril = part(head, sphere, m.dark, side * .51, -1.92, .23);
    nostril.scale.set(.025, .095, .042); nostril.rotation.z = side * .19;
    for (let i = 0; i < 8; i++) {
      const y = .03 - i * .145;
      part(upperTeeth, tooth, m.claw, side * .44, y, -.03).rotation.x = -Math.PI / 2;
      part(lowerTeeth, tooth, m.claw, side * .41, y - .4, .11).rotation.x = Math.PI / 2;
    }
  }
  head.add(gkPlumage(feather, m.feathers, new T.Vector3(0, .43, .43), new T.Vector3(.64, .7, .52), 100, 201, .4, true, new T.Vector3(0, 1, -.2)));
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
