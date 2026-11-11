import * as T from 'three';
import { addBurner, burnerMaterial } from '../burners';
import { part } from '../rig-geometry';
import { pleiadianPaint } from './pleiadian-paint';

function paintedShell(outline: T.Shape) {
  const shell = new T.ExtrudeGeometry(outline, {
    depth: .11, bevelThickness: .04, bevelSize: .04, bevelSegments: 2, steps: 1,
  });
  const uv = shell.getAttribute('uv');
  const cap = shell.groups[0];
  for (let i = cap.start; i < cap.start + cap.count; i++) {
    uv.setXY(i, .5 + uv.getX(i) / 1.04, (uv.getY(i) + .55) / 1.32);
  }
  return shell;
}

export function createPleiadianCraft(environment: T.Texture) {
  const shuttleOutline = new T.Shape();
  shuttleOutline.moveTo(0, .67);
  shuttleOutline.quadraticCurveTo(.16, .54, .20, .22);
  for (const [x, y] of [[.46, -.21], [.31, -.42], [.15, -.36], [.11, -.50],
    [-.11, -.50], [-.15, -.36], [-.31, -.42], [-.46, -.21], [-.20, .22]]) shuttleOutline.lineTo(x, y);
  shuttleOutline.quadraticCurveTo(-.16, .54, 0, .67);

  const fighterOutline = new T.Shape();
  fighterOutline.moveTo(0, .74);
  fighterOutline.quadraticCurveTo(.12, .61, .15, .26);
  for (const [x, y] of [[.48, -.23], [.44, -.43], [.21, -.36], [.15, -.44],
    [.09, -.51], [-.09, -.51], [-.15, -.44], [-.21, -.36], [-.44, -.43], [-.48, -.23], [-.15, .26]]) fighterOutline.lineTo(x, y);
  fighterOutline.quadraticCurveTo(-.12, .61, 0, .74);

  const shuttleShell = paintedShell(shuttleOutline), fighterShell = paintedShell(fighterOutline);
  const canopy = new T.SphereGeometry(1, 16, 10).scale(.104, .256, .087);
  const nacelle = new T.CylinderGeometry(.052, .074, .19, 16);
  const nozzle = new T.TorusGeometry(.061, .012, 7, 20).rotateX(Math.PI / 2);
  const glass = new T.MeshStandardMaterial({
    color: 0x263f57, roughness: .21, metalness: .4, envMap: environment, envMapIntensity: 1.55,
  });
  const engine = new T.MeshStandardMaterial({ color: 0x484855, roughness: .49, metalness: .55 });
  const exhaust = burnerMaterial(0x77baff);
  const trim = new T.MeshStandardMaterial({
    color: 0xd3a563, roughness: .25, metalness: .86, envMap: environment, envMapIntensity: 2.45,
  });
  const burntTrim = new T.MeshStandardMaterial({
    color: 0x665245, roughness: .8, metalness: .2, envMap: environment, envMapIntensity: .8,
  });
  const clean = pleiadianPaint(false), damaged = pleiadianPaint(true);
  const cleanCap = new T.MeshStandardMaterial({
    map: clean.albedo, roughnessMap: clean.finish, metalnessMap: clean.finish,
    roughness: 1, metalness: 1, bumpScale: .015, envMap: environment, envMapIntensity: 2.15,
  });
  const damagedCap = new T.MeshStandardMaterial({
    map: damaged.albedo, roughnessMap: damaged.finish, metalnessMap: damaged.finish,
    roughness: 1, metalness: 1, bumpScale: .022, envMap: environment, envMapIntensity: .95,
  });
  const cleanHull = [cleanCap, trim], damagedHull = [damagedCap, burntTrim];

  return {
    maps: [clean.albedo, clean.finish, damaged.albedo, damaged.finish],
    create(kind: 'shuttle' | 'fighter' | 'wreck') {
      const root = new T.Group();
      const shuttle = kind === 'shuttle', wreck = kind === 'wreck';
      const hull = new T.Mesh(shuttle ? shuttleShell : fighterShell, wreck ? damagedHull : cleanHull);
      hull.name = 'fleet-painted-hull';
      root.add(hull);
      const cockpit = part(root, canopy, glass, 0, .23, .145);
      if (!shuttle) cockpit.scale.set(.79, .83, .83);
      for (const x of [-.18, .18]) {
        part(root, nacelle, engine, x, -.325, .145);
        part(root, nozzle, wreck ? burntTrim : trim, x, -.422, .145);
        if (kind === 'fighter') addBurner(root, exhaust, x, -.43, .145, .065, .52);
      }
      return root;
    },
    setAlloy(texture: T.Texture) {
      for (const material of [cleanCap, damagedCap]) {
        material.bumpMap = texture;
        material.needsUpdate = true;
      }
    },
  };
}
