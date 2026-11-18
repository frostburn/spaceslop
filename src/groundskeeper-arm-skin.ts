import * as T from 'three';
import { GROUNDSKEEPER_FOREARM, GROUNDSKEEPER_UPPER_ARM, type GroundskeeperPose } from './groundskeeper';
import { gkTube } from './groundskeeper-geometry';
import { gkCamouflage } from './groundskeeper-plumage';
import { preserveRandom } from './preserve-layout';

const upperLength = GROUNDSKEEPER_UPPER_ARM;
const wristAt = upperLength + GROUNDSKEEPER_FOREARM;
const elbowBlend = .98;
const wristBlend = .44;
const rows = 40;
const sides = 16;

// Distance from the shoulder, width, depth. The sleeve tapers at the elbow
// and carpus, then spreads into the palm under the three knuckles.
const profile = [
  [-.54, .24, .22], [0, .66, .57], [.73, .76, .64], [1.57, .62, .55],
  [2.34, .47, .40], [upperLength, .36, .31], [3.94, .48, .42],
  [4.65, .45, .37], [5.70, .32, .27], [wristAt, .28, .22],
  [wristAt + .32, .50, .25], [wristAt + .64, .61, .26], [wristAt + .97, .26, .13],
] as const;

export function createGroundskeeperArmSkin(
  side: number, feather: T.BufferGeometry, skin: T.Material, plumage: T.Material,
) {
  const { geometry } = gkTube(rows, sides);
  const mesh = new T.Mesh(geometry, skin);
  mesh.name = `arm-skin-${side}`;
  const coat = new T.InstancedMesh(feather, plumage, 420);
  coat.name = `arm-feathers-${side}`;
  coat.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const start = profile[0][0], end = profile[profile.length - 1][0];
  const rings = Array.from({ length: rows + 1 }, (_, row) => {
    const distance = T.MathUtils.lerp(start, end, row / rows);
    const next = profile.findIndex(section => section[0] >= distance);
    const a = profile[Math.max(0, next - 1)], b = profile[Math.max(1, next)];
    const blend = T.MathUtils.smoothstep(distance, a[0], b[0]);
    return {
      distance, width: T.MathUtils.lerp(a[1], b[1], blend), depth: T.MathUtils.lerp(a[2], b[2], blend),
      center: new T.Vector3(), tangent: new T.Vector3(), across: new T.Vector3(), up: new T.Vector3(),
    };
  });
  const rim = Array.from({ length: sides + 1 }, (_, i) => {
    const angle = i % sides * Math.PI * 2 / sides;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  const random = preserveRandom(381 + side);
  const tint = new T.Color();
  const scatter = Array.from({ length: coat.count }, (_, i) => {
    const distance = T.MathUtils.lerp(-.16, wristAt - .69, (i + random()) / coat.count);
    const row = (distance - start) / (end - start) * rows;
    const angle = i * 2.399963 + (random() - .5) * .55;
    const length = (.63 - .23 * T.MathUtils.smoothstep(distance, 2.1, wristAt)) * (.81 + random() * .6);
    const x = Math.cos(angle), y = Math.sin(angle);
    gkCamouflage(tint, x * .64, distance, y * .51, .14).multiplyScalar(.89 + random() * .21);
    coat.setColorAt(i, tint);
    const cant = (random() - .5) * .48;
    return { row: Math.floor(row), blend: row % 1, x, y, length, cos: Math.cos(cant), sin: Math.sin(cant) };
  });
  coat.instanceColor!.needsUpdate = true;

  const vertices = geometry.attributes.position;
  const normals = new T.BufferAttribute(new Float32Array(vertices.count * 3), 3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('normal', normals);
  geometry.boundingSphere = new T.Sphere();
  coat.boundingSphere = new T.Sphere();
  const limbDirection = new T.Vector3(), forearmDirection = new T.Vector3();
  const offset = new T.Vector3(), point = new T.Vector3(), tangent = new T.Vector3(), outward = new T.Vector3();
  const featherRoot = new T.Vector3(), across = new T.Vector3(), basis = new T.Matrix4();

  function pose(arm: GroundskeeperPose['arms'][number]) {
    const { shoulder, elbow, wrist, hinge, direction, roll } = arm;
    limbDirection.subVectors(elbow, shoulder).normalize();
    forearmDirection.subVectors(wrist, elbow).normalize();
    for (const [row, ring] of rings.entries()) {
      const { distance, center, tangent, across, up } = ring;
      if (distance < upperLength - elbowBlend) {
        center.copy(shoulder).addScaledVector(limbDirection, distance);
        tangent.copy(limbDirection);
      } else if (distance < upperLength + elbowBlend) {
        roundJoint(center, tangent, elbow, limbDirection, forearmDirection, elbowBlend, distance - upperLength);
      } else if (distance < wristAt - wristBlend) {
        center.copy(elbow).addScaledVector(forearmDirection, distance - upperLength);
        tangent.copy(forearmDirection);
      } else if (distance < wristAt + wristBlend) {
        roundJoint(center, tangent, wrist, forearmDirection, direction, wristBlend, distance - wristAt);
      } else {
        center.copy(wrist).addScaledVector(direction, distance - wristAt);
        tangent.copy(direction);
      }
      // The rotation increases between the elbow and wrist. The carpal joint
      // then bends in the frame that has already turned with the forearm.
      const twist = roll * T.MathUtils.smoothstep(distance, upperLength + .45, wristAt - wristBlend);
      across.copy(hinge).multiplyScalar(Math.cos(twist)).addScaledVector(offset.crossVectors(tangent, hinge), Math.sin(twist));
      up.crossVectors(tangent, across);
      for (const [column, radial] of rim.entries()) {
        point.copy(center).addScaledVector(across, radial.x * ring.width).addScaledVector(up, radial.y * ring.depth);
        vertices.setXYZ(row * (sides + 1) + column, point.x, point.y, point.z);
      }
    }
    vertices.needsUpdate = true;
    geometry.computeVertexNormals();
    for (let row = 0; row <= rows; row++) {
      // Both sides of the UV seam share a normal on the continuous skin.
      const first = row * (sides + 1), last = first + sides;
      point.fromBufferAttribute(normals, first).add(offset.fromBufferAttribute(normals, last)).normalize();
      normals.setXYZ(first, point.x, point.y, point.z);
      normals.setXYZ(last, point.x, point.y, point.z);
    }
    geometry.computeBoundingBox();
    geometry.boundingBox!.getBoundingSphere(geometry.boundingSphere!);

    for (const [i, strand] of scatter.entries()) {
      const a = rings[strand.row], b = rings[strand.row + 1], t = strand.blend;
      featherRoot.copy(a.center).addScaledVector(a.across, strand.x * a.width).addScaledVector(a.up, strand.y * a.depth);
      point.copy(b.center).addScaledVector(b.across, strand.x * b.width).addScaledVector(b.up, strand.y * b.depth);
      featherRoot.lerp(point, t);
      tangent.lerpVectors(a.tangent, b.tangent, t).normalize();
      outward.lerpVectors(a.across, b.across, t).multiplyScalar(strand.x / T.MathUtils.lerp(a.width, b.width, t));
      offset.lerpVectors(a.up, b.up, t).multiplyScalar(strand.y / T.MathUtils.lerp(a.depth, b.depth, t));
      outward.add(offset);
      outward.addScaledVector(tangent, -outward.dot(tangent)).normalize();
      across.crossVectors(tangent, outward);
      // The two tangent axes cant together around the feather's surface normal.
      offset.copy(tangent).multiplyScalar(strand.cos).addScaledVector(across, -strand.sin);
      across.multiplyScalar(strand.cos).addScaledVector(tangent, strand.sin);
      across.multiplyScalar(strand.length * .9);
      offset.multiplyScalar(strand.length);
      outward.multiplyScalar(.66);
      coat.setMatrixAt(i, basis.makeBasis(across, offset, outward).setPosition(featherRoot));
    }
    coat.instanceMatrix.needsUpdate = true;
    coat.boundingSphere!.copy(geometry.boundingSphere!).radius += 1;
  }

  return { mesh, coat, pose };
}

// Replace a short interval on either side of the joint with a tangent-matched
// quadratic arc. The middle of the sleeve stays inside the bend of the bones.
function roundJoint(
  center: T.Vector3, tangent: T.Vector3, joint: T.Vector3Like,
  incoming: T.Vector3Like, outgoing: T.Vector3Like, radius: number, distance: number,
) {
  const t = .5 + distance / (2 * radius);
  center.copy(joint).addScaledVector(incoming, -radius * (1 - t) ** 2).addScaledVector(outgoing, radius * t ** 2);
  tangent.copy(incoming).lerp(outgoing, t).normalize();
}
