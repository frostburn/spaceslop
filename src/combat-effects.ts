import * as T from 'three';

type Kind = 'hit' | 'kill' | 'pickup';
const specs = { hit: { life: 0.22, size: 0.1, spread: 1.5, sparks: 4 },
  kill: { life: 0.42, size: 0.22, spread: 2.2, sparks: 8 },
  pickup: { life: 0.55, size: 0.28, spread: 1.65, sparks: 8 } };
const material = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true,
  blending: T.AdditiveBlending, opacity: 0.85, depthTest: false, depthWrite: false });
const hot = new T.Color(0xfff5dc);

export function createCombatEffects() {
  const root = new T.Group(); root.name = 'combat-bursts'; root.renderOrder = 20;
  const sparks = new T.InstancedMesh(new T.OctahedronGeometry(1), material, 192);
  const rings = new T.InstancedMesh(new T.RingGeometry(0.86, 1, 28), material, 24);
  const identity = new T.Matrix4();
  for (const mesh of [sparks, rings]) {
    mesh.count = 0; mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.setColorAt(0, new T.Color());
    root.add(mesh);
  }
  const bursts = Array.from({ length: 24 }, () => ({ active: false, kind: 'hit' as Kind,
    position: new T.Vector3(), color: new T.Color(), age: 0, seed: 0 }));
  let cursor = 0;
  const position = new T.Vector3(), rotation = new T.Quaternion(), axis = new T.Vector3(0, 0, 1);
  const scale = new T.Vector3(), color = new T.Color();
  return {
    root,
    emit(kind: Kind, point: { x: number; y: number; z?: number }, tint: number) {
      const burst = bursts[cursor++ % bursts.length];
      burst.active = true; burst.kind = kind; burst.age = 0; burst.seed = cursor * 1.7;
      burst.position.set(point.x, point.y, (point.z ?? 0) + 0.22);
      burst.color.setHex(tint);
    },
    clear() { for (const burst of bursts) burst.active = false; sparks.count = rings.count = 0; },
    update(elapsed: number) {
      let s = 0, r = 0;
      for (const burst of bursts) {
        if (!burst.active) continue;
        burst.age += elapsed;
        const spec = specs[burst.kind], t = burst.age / spec.life;
        if (t >= 1) { burst.active = false; continue; }
        color.copy(burst.color).lerp(hot, 0.3).multiplyScalar((1 - t) ** 2);
        for (let i = 0; i < spec.sparks; i++) {
          const angle = burst.seed + i * Math.PI * 2 / spec.sparks;
          const travel = burst.age * spec.spread;
          position.copy(burst.position); position.x += Math.cos(angle) * travel; position.y += Math.sin(angle) * travel;
          rotation.setFromAxisAngle(axis, angle - Math.PI / 2);
          scale.set(0.036 * (1 - t), (0.11 + burst.age * 0.22) * (1 - t), 0.025);
          identity.compose(position, rotation, scale); sparks.setMatrixAt(s, identity); sparks.setColorAt(s++, color);
        }
        identity.compose(burst.position, rotation.identity(), scale.setScalar(spec.size + burst.age * spec.spread));
        rings.setMatrixAt(r, identity); rings.setColorAt(r++, color);
      }
      sparks.count = s; rings.count = r;
      for (const mesh of [sparks, rings]) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
    prime() {
      for (const mesh of [sparks, rings]) {
        mesh.count = 1; mesh.setMatrixAt(0, identity.identity()); mesh.setColorAt(0, color.setHex(0xffffff));
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}
