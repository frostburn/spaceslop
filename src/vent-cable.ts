import * as T from 'three';
import { ventFloor } from './vent-layout';

export function createVentCable() {
  const root = new T.Group();
  root.name = 'europa-survey-cable';
  function path(y: number) {
    const x = -1.65 + .72 * Math.sin(y * .092) + .31 * Math.sin(y * .183);
    return new T.Vector3(x, y, ventFloor(x, y) + .39);
  }
  const curve = new T.CatmullRomCurve3(Array.from({ length: 67 }, (_, i) => path(-18 + i * 2.5)));
  const insulation = new T.MeshStandardMaterial({
    color: 0x385052, roughness: .86, emissive: 0x193237, emissiveIntensity: .25,
  });
  root.add(new T.Mesh(new T.TubeGeometry(curve, 192, .13, 8), insulation));

  const stations = [-8, 9, 28, 46, 64, 83, 99, 117, 134, 147];
  const junctions = new T.InstancedMesh(new T.BoxGeometry(.72, 1.10, .44),
    new T.MeshStandardMaterial({ color: 0x9c7350, roughness: .81, metalness: .27 }), stations.length);
  const lamps = new T.InstancedMesh(new T.BoxGeometry(.22, .36, .06),
    new T.MeshBasicMaterial({ color: 0x84c8cb }), stations.length);
  const placement = new T.Object3D();
  for (const [index, y] of stations.entries()) {
    const direction = path(y + .5).sub(path(y - .5));
    const terminal = index === stations.length - 1;
    placement.position.copy(path(y));
    placement.rotation.z = -Math.atan2(direction.x, direction.y);
    placement.scale.set(terminal ? 1.65 : 1, terminal ? 1.4 : 1, 1);
    placement.updateMatrix();
    junctions.setMatrixAt(index, placement.matrix);
    placement.position.z += .25;
    placement.updateMatrix();
    lamps.setMatrixAt(index, placement.matrix);
  }
  root.add(junctions, lamps);
  return root;
}
