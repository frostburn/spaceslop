import * as T from 'three';
import { groundskeeperAttack, GROUNDSKEEPER_CYCLE, type GkAim } from './groundskeeper';

// Camera-plane warnings show the locked danger lane, with a fixed geometry pool.
// Dust/debris is emitted only after contact and cannot become hostile projectiles.
export function createGroundskeeperEffects() {
  const root = new T.Group(); root.name = 'groundskeeper-warnings-and-debris';
  const points = new Float32Array(3 * 28 * 2 * 3);
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(points, 3).setUsage(T.DynamicDrawUsage));
  const material = new T.LineBasicMaterial({ color: 0xffba69, transparent: true, depthTest: false, depthWrite: false });
  const lines = new T.LineSegments(geometry, material); lines.frustumCulled = false; lines.renderOrder = 10; root.add(lines);
  const ringGeometry = new T.RingGeometry(.57, .62, 48), ringMaterial = new T.MeshBasicMaterial({ color: 0xffba69, transparent: true, depthTest: false, depthWrite: false, side: T.DoubleSide });
  const rings = Array.from({ length: 2 }, () => {
    const r = new T.Mesh(ringGeometry, ringMaterial); r.renderOrder = 10; root.add(r); return r;
  });
  const chips = new T.InstancedMesh(new T.OctahedronGeometry(.065), new T.MeshStandardMaterial({ color: 0x8c8264, roughness: .9 }), 36);
  chips.frustumCulled = false; chips.instanceMatrix.setUsage(T.DynamicDrawUsage); root.add(chips);
  const transform = new T.Object3D();
  return { root,
    update(time: number, aim: GkAim, cancelledAt: number, active: boolean) {
      const a = groundskeeperAttack(time), cancelled = Math.floor(cancelledAt / GROUNDSKEEPER_CYCLE) === a.cycle;
      const warning = active && a.warning && !cancelled;
      lines.visible = warning && a.kind.includes('rake'); rings.forEach(r => r.visible = warning && !a.kind.includes('rake'));
      const side = a.kind === 'left rake' ? -1 : 1;
      material.opacity = .35 + .35 * Math.sin(a.age * 10) ** 2; ringMaterial.opacity = material.opacity;
      if (lines.visible) {
        let n = 0;
        for (let claw = -1; claw <= 1; claw++) for (let dash = 0; dash < 28; dash++) for (const edge of [0, .6]) {
          const t = (dash + edge) / 28, split = .62;
          const x = t < split ? T.MathUtils.lerp(side * 3.8, aim.x, t / split) : T.MathUtils.lerp(aim.x, -side * 3.8, (t - split) / (1 - split));
          const y = t < split ? T.MathUtils.lerp(3.3, aim.y, t / split) : T.MathUtils.lerp(aim.y, aim.y - 1, (t - split) / (1 - split));
          points[n++] = x + claw * .32; points[n++] = y; points[n++] = .1;
        }
        geometry.attributes.position.needsUpdate = true;
      }
      rings.forEach((r, i) => {
        r.position.set(aim.x + (a.kind === 'double slam' ? (i ? 1.35 : -1.35) : 0), aim.y, .1);
        r.scale.setScalar(a.kind === 'lunge' ? 1.8 : 1.15); if (a.kind === 'lunge' && i) r.visible = false;
      });
      const age = a.age - 3.1;
      chips.visible = active && !cancelled && age >= 0 && age < .8;
      if (chips.visible) for (let i = 0; i < chips.count; i++) {
        const seed = i * 2.39996, life = Math.max(0, age - (i % 4) * .025), spread = life * (1 + i % 3);
        transform.position.set(aim.x + Math.cos(seed) * spread, aim.y + Math.sin(seed) * spread * .5, -.1 + life * 1.5 - life * life * 4);
        transform.rotation.set(life * (3 + i % 5), seed, life * 7); transform.scale.setScalar(Math.max(.05, 1 - life / .8));
        transform.updateMatrix(); chips.setMatrixAt(i, transform.matrix);
        chips.instanceMatrix.needsUpdate = true;
      }
    },
    prime() { lines.visible = chips.visible = true; rings.forEach(r => r.visible = true); },
  };
}
