import * as T from 'three';
import type { Flight } from '../game';
import { part, pivot, polygon } from '../rig-geometry';
import {
  DEN_MINE_BURST, DEN_MINE_TRIGGER, DEN_TURRET_REACH, DEN_TURRET_RECOIL,
  denDefensePoint, denMinePose, denMineSites, denTurretSignal, denTurretSites, type DenTurret,
} from './defense';

const ATLAS = 1254;
const gunScaleY = DEN_TURRET_REACH / (1204 - 805);

function sprite(rect: readonly [number, number, number, number], anchor: readonly [number, number],
  scaleX: number, scaleY = scaleX, rows = 1) {
  const [left, top, right, bottom] = rect;
  const geometry = new T.PlaneGeometry(1, 1, 1, rows);
  const { position, uv } = geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    const x = T.MathUtils.lerp(left, right, uv.getX(i));
    const y = T.MathUtils.lerp(bottom, top, uv.getY(i));
    position.setXYZ(i, (x - anchor[0]) * scaleX, (anchor[1] - y) * scaleY, 0);
    uv.setXY(i, x / ATLAS, 1 - y / ATLAS);
  }
  return geometry;
}

function glow(color: number) {
  return new T.MeshBasicMaterial({ color, transparent: true, blending: T.AdditiveBlending,
    depthWrite: false, toneMapped: false });
}

export function createDenDefenses() {
  const root = new T.Group();
  root.name = 'den-defenses';
  const atlas = new T.MeshBasicMaterial({ alphaTest: .27, alphaToCoverage: true, color: 0xe9dbce });
  const mountArt = sprite([124, 119, 485, 505], [306, 217], .0029);
  const gunnerArt = sprite([713, 7, 1129, 557], [921, 722], .00245, .00195);
  const mineArt = sprite([721, 708, 1108, 1086], [915, 901], .00223);
  const cards: T.Mesh[] = [], substitutes: T.Object3D[] = [];
  function addArt(parent: T.Object3D, geometry: T.BufferGeometry, z: number, fallback: T.Object3D) {
    const card = part(parent, geometry, atlas, 0, 0, z);
    card.visible = false;
    cards.push(card);
    substitutes.push(fallback);
    return card;
  }

  const iron = new T.MeshStandardMaterial({ color: 0x383137, metalness: .56, roughness: .55 });
  const bronze = new T.MeshStandardMaterial({ color: 0x79533b, metalness: .61, roughness: .48 });
  const leather = new T.MeshStandardMaterial({ color: 0x462f2c, roughness: .82 });
  const hide = new T.MeshStandardMaterial({ color: 0x9a7354, roughness: .76 });
  const feather = new T.MeshStandardMaterial({ color: 0x9c4231, roughness: .80 });
  const lamp = new T.MeshBasicMaterial({ color: 0xff4119, toneMapped: false });
  const ball = new T.SphereGeometry(1, 12, 8);
  const cone = new T.ConeGeometry(1, 1, 6);
  const foot = new T.CylinderGeometry(.46, .51, .12, 12).rotateX(Math.PI / 2);
  const bearing = new T.TorusGeometry(.28, .064, 6, 20);
  const box = new T.BoxGeometry(1, 1, 1);
  const barrel = new T.CylinderGeometry(.068, .076, .74, 10);
  const flare = polygon([[0, -.43], [.105, -.12], [.082, .02], [0, .10], [-.082, .02], [-.105, -.12]]);
  const dash = new T.PlaneGeometry(.032, .15);
  const lockRing = new T.RingGeometry(.135, .164, 24);

  const turrets = denTurretSites.map(() => {
    const base = pivot(root, 'den-turret-base', 0, 0, 0);
    const stand = pivot(base, 'den-turret-base-shape', 0, 0, 0);
    part(stand, foot, iron, 0, -.24, -.06);
    part(stand, bearing, bronze, 0, 0, .005);
    const hub = part(stand, ball, leather, 0, 0, -.016);
    hub.scale.set(.23, .23, .045);
    addArt(base, mountArt, -.04, stand);

    const aim = pivot(base, 'den-turret-aim', 0, 0, 0);
    const crew = pivot(aim, 'den-turret-crew-shape', 0, 0, .06);
    part(crew, ball, leather, 0, .78, 0).scale.set(.38, .41, .20);
    part(crew, ball, hide, 0, .68, .20).scale.set(.19, .32, .12);
    for (const side of [-1, 1]) {
      part(crew, ball, bronze, side * .31, .83, .12).scale.set(.13, .19, .10);
      part(crew, ball, hide, side * .31, .51, .11).scale.set(.085, .24, .08);
    }
    for (let i = -2; i <= 2; i++) {
      const quill = part(crew, cone, i % 2 ? feather : iron, i * .073, 1.09, .20);
      quill.scale.set(.085, .46 - .062 * Math.abs(i), .045);
      quill.rotation.z = -.23 * i;
    }
    addArt(aim, gunnerArt, .10, crew);

    const gun = pivot(aim, 'den-turret-gun-shape', 0, 0, .035);
    part(gun, box, iron, 0, -.035, .015).scale.set(.49, .48, .21);
    for (const side of [-1, 1]) part(gun, box, bronze, side * .30, .23, .045).scale.set(.11, .42, .11);
    const moving = pivot(gun, 'den-recoil-sleeve', 0, 0, 0);
    part(moving, barrel, bronze, 0, -.60, .04);
    part(moving, ball, iron, 0, -1.015, .04).scale.set(.095, .038, .07);
    const gunArt = sprite([180, 627, 443, 1210], [311, 805], .00455, gunScaleY, 24);
    const position = (gunArt.attributes.position as T.BufferAttribute).setUsage(T.DynamicDrawUsage);
    const rest = Array.from({ length: position.count }, (_, i) => position.getY(i));
    addArt(aim, gunArt, .07, gun);

    const windup = glow(0xffad4d);
    const sight = pivot(aim, 'den-turret-windup', 0, -DEN_TURRET_REACH, .19);
    part(sight, lockRing, windup, 0, 0, 0);
    for (let i = 0; i < 5; i++) part(sight, dash, windup, 0, -.28 - .27 * i, 0);
    const fire = glow(0xffa12f), flash = part(aim, flare, fire, 0, -DEN_TURRET_REACH, .20);
    flash.name = 'den-turret-flash';
    return {
      base, aim, sight, flash,
      pose(turret: DenTurret, time: number) {
        const { charge, recoil, flash: brightness } = denTurretSignal(turret, time);
        const kick = DEN_TURRET_RECOIL * recoil;
        aim.visible = true;
        aim.rotation.z = turret.heading;
        moving.position.y = kick;
        for (let i = 0; i < rest.length; i++) {
          position.setY(i, rest[i] + kick * T.MathUtils.smoothstep(-rest[i], .14, .86));
        }
        position.needsUpdate = true;
        sight.visible = charge > 0;
        windup.opacity = .13 + charge * .44;
        sight.position.y = flash.position.y = -DEN_TURRET_REACH + kick;
        flash.visible = brightness > 0;
        fire.opacity = .86 * brightness;
        flash.scale.setScalar(.54 + brightness * .64);
      },
    };
  });

  const triggerRing = new T.RingGeometry(DEN_MINE_TRIGGER - .026, DEN_MINE_TRIGGER, 64);
  const pressureWave = new T.RingGeometry(.90, 1, 40);
  const eyeShape = new T.CircleGeometry(.070, 16);
  const mineShell = new T.SphereGeometry(.32, 14, 9).scale(1, 1, .52);
  const spike = new T.ConeGeometry(.057, .20, 6);
  const mines = denMineSites.map(() => {
    const group = pivot(root, 'den-mine', 0, 0, 0);
    const body = pivot(group, 'den-mine-body', 0, 0, .09);
    const steel = pivot(body, 'den-mine-shape', 0, 0, 0);
    part(steel, mineShell, iron, 0, 0, 0);
    part(steel, bearing, bronze, 0, 0, .077).scale.setScalar(.65);
    part(steel, eyeShape, lamp, 0, 0, .165);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      part(steel, spike, bronze, -.32 * Math.sin(a), .32 * Math.cos(a), .04).rotation.z = a;
    }
    addArt(body, mineArt, .01, steel);
    const eye = glow(0xff3b1e);
    const led = part(body, eyeShape, eye, 0, 0, .17);
    const warning = glow(0xff772e);
    const trigger = part(group, triggerRing, warning, 0, 0, .015);
    trigger.name = 'den-mine-trigger';
    const shock = glow(0xff9546);
    const burst = part(group, pressureWave, shock, 0, 0, .22);
    burst.name = 'den-mine-burst';
    return {
      group, body, trigger, burst,
      pose(pose: ReturnType<typeof denMinePose>, time: number) {
        const { x, y, charge, burstAge } = pose;
        group.position.set(x, y, 0);
        body.visible = trigger.visible = !Number.isFinite(burstAge);
        burst.visible = burstAge < DEN_MINE_BURST;
        body.rotation.z = .08 * Math.sin(time * 2.35);
        const blink = .5 + .5 * Math.sin(time * (7 + 17 * charge));
        eye.opacity = .20 + .70 * charge * blink;
        led.scale.setScalar(.88 + charge * blink * .32);
        warning.opacity = .14 + charge * (.29 + .26 * blink);
        if (burst.visible) {
          burst.scale.setScalar(.31 + 4.4 * burstAge);
          shock.opacity = .8 * (1 - burstAge / DEN_MINE_BURST);
        }
      },
    };
  });

  return {
    root,
    setArt(texture: T.Texture) {
      const image = texture.image as { width: number; height: number } | undefined;
      if (!image?.width || image.width !== image.height) throw new Error('Unsupported Den defense atlas layout');
      atlas.map = texture;
      atlas.needsUpdate = true;
      cards.forEach(card => { card.visible = true; });
      substitutes.forEach(model => { model.visible = false; });
    },
    prime() {
      for (const { base, aim, sight, flash } of turrets) base.visible = aim.visible = sight.visible = flash.visible = true;
      for (const { group, body, trigger, burst } of mines) group.visible = body.visible = trigger.visible = burst.visible = true;
    },
    update(scroll: number, time: number, flight: Flight, models: (T.Object3D | undefined)[]) {
      for (const [index, turret] of turrets.entries()) {
        const point = denDefensePoint(denTurretSites[index], scroll);
        turret.base.position.set(point.x, point.y, 0);
        turret.base.visible = Math.abs(point.y) < 9.7;
        turret.aim.visible = false;
      }
      for (const [index, enemy] of flight.enemies.entries()) {
        if (!enemy.denTurret || enemy.hp <= 0) continue;
        const rig = turrets[enemy.denTurret.site];
        if (!rig.base.visible) continue;
        rig.pose(enemy.denTurret, time);
        models[index] = rig.aim;
      }
      for (const [index, mine] of mines.entries()) {
        const pose = denMinePose(index, flight.denMines[index], scroll, time);
        mine.group.visible = Math.abs(pose.y) < 9.45
          && (pose.burstAge < DEN_MINE_BURST || !Number.isFinite(pose.burstAge));
        if (mine.group.visible) mine.pose(pose, time + index * .13);
      }
    },
  };
}
