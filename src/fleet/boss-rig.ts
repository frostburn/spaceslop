import * as T from 'three';
import { FLEET_BOSS_MOUNTS, fleetBossPose, fleetBossSignal } from './boss';
import type { createSaucerFactory } from './saucers';

export function createFleetBossRig(factory: ReturnType<typeof createSaucerFactory>) {
  const rig = factory.create('fleet-command-saucer', 'command');
  const root = rig.root;
  const gunmetal = new T.MeshStandardMaterial({
    color: 0x4b505c, roughness: .47, metalness: .65, envMap: factory.environment, envMapIntensity: 1.6,
  });
  const alloy = new T.MeshStandardMaterial({
    color: 0x9ca3ad, roughness: .36, metalness: .61, envMap: factory.environment, envMapIntensity: 1.65,
  });
  const rings = [
    new T.Mesh(new T.TorusGeometry(.748, .022, 8, 64), alloy),
    new T.Mesh(new T.TorusGeometry(.534, .021, 8, 64), gunmetal),
  ];
  rings[0].position.z = -.178;
  rings[1].position.z = -.219;
  root.add(...rings);

  const banks = ([0, 1, 2] as const).map(port => {
    const radius = port === 2 ? .195 : .098;
    const group = new T.Group();
    const [x, y, z] = FLEET_BOSS_MOUNTS[port];
    group.position.set(x, y, z);
    group.name = `fleet-boss-emitter-${port}`;
    root.add(group);
    const cup = new T.Mesh(new T.CylinderGeometry(radius * 1.34, radius * 1.14, .056, 28).rotateX(Math.PI / 2), gunmetal);
    cup.position.z = .048;
    const collar = new T.Mesh(new T.TorusGeometry(radius * 1.08, radius * .16, 8, 32), alloy);
    collar.position.z = .013;
    const lens = new T.MeshBasicMaterial({ color: 0x622923, toneMapped: false });
    const aperture = new T.Mesh(new T.SphereGeometry(1, 28, 10).scale(radius, radius, radius * .17), lens);
    const glow = new T.MeshBasicMaterial({
      color: port === 2 ? 0xff9b54 : 0xff3f2f, side: T.DoubleSide,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0,
    });
    const halo = new T.Mesh(new T.RingGeometry(radius * 1.2, radius * 1.52, 40), glow);
    halo.position.z = -.021;
    group.add(cup, collar, aperture, halo);
    return { port, lens, glow, halo };
  });

  return {
    root,
    pose(time: number, rapid: boolean, distance: number, alive = true) {
      const pose = fleetBossPose(time);
      const factor = 1 - pose.depth / distance;
      root.position.set(pose.x * factor, pose.y * factor, pose.depth);
      root.scale.setScalar(pose.radius * factor);
      rig.attitude(pose, 0, 0);
      for (const { port, lens, glow, halo } of banks) {
        const { charge, flash } = alive ? fleetBossSignal(time, port, rapid) : { charge: 0, flash: 0 };
        const ember = .35 + .91 * charge + 1.28 * flash;
        lens.color.setRGB(ember, .029 + charge * (port === 2 ? .46 : .13) + flash * .96, .018 + .04 * charge + .54 * flash);
        halo.visible = charge > .05 || flash > 0;
        halo.scale.setScalar(.91 + .31 * charge + .7 * flash);
        glow.opacity = charge * .46 + flash * .52;
      }
    },
    prime() {
      rig.prime();
      for (const { halo } of banks) halo.visible = true;
    },
  };
}
