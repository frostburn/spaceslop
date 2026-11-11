import * as T from 'three';
import { loadEncounterTexture } from '../encounter-texture';
import { HEIGHT, WIDTH } from '../playfield';
import { fallbackFleetPlanets, fallbackFleetSky, fallbackPleiadianHull } from './placeholder';
import { fleetViewY, flankShips, trenchShip } from './route';

export function createFleetScenery(signal: AbortSignal) {
  const root = new T.Group();
  root.name = 'fleet-scenery';
  const skyFallback = fallbackFleetSky(), pairFallback = fallbackFleetPlanets();
  const flankFallback = fallbackPleiadianHull(false), trenchFallback = fallbackPleiadianHull(true);
  const sky = new T.MeshBasicMaterial({ map: skyFallback, depthWrite: false, toneMapped: false });
  const pair = new T.MeshBasicMaterial({ map: pairFallback, alphaTest: .015, transparent: true, depthWrite: false, toneMapped: false });
  const flagship = new T.MeshBasicMaterial({ map: flankFallback, alphaTest: .38, toneMapped: false });
  const trench = new T.MeshBasicMaterial({ map: trenchFallback, alphaTest: .38, toneMapped: false });

  const starfield = new T.Mesh(new T.PlaneGeometry(WIDTH, HEIGHT), sky);
  starfield.name = 'fleet-starfield';
  starfield.renderOrder = -20;
  const planets = new T.Mesh(new T.PlaneGeometry(2.75, 2.75), pair);
  planets.name = 'fleet-drifting-planets';
  planets.renderOrder = -15;

  const ships = [...flankShips, trenchShip].map((site, index) => {
    const mesh = new T.Mesh(new T.PlaneGeometry(site.width, 2 * site.width), site === trenchShip ? trench : flagship);
    mesh.name = site === trenchShip ? 'fleet-trench-flagship' : `fleet-broadside-flagship-${index + 1}`;
    return { site, mesh };
  });
  root.add(starfield, planets, ...ships.map(({ mesh }) => mesh));
  function place(distance: number, depth: number, mesh: T.Mesh, x = 0, y = 0) {
    // Registration stays in flight-plane units although the card is below the ship.
    const factor = 1 - depth / distance;
    mesh.position.set(x * factor, y * factor, depth);
    mesh.scale.setScalar(factor);
  }
  const maps = Promise.all([
    loadEncounterTexture('fleetSky', replace(sky, skyFallback), undefined, signal),
    loadEncounterTexture('fleetPlanets', replace(pair, pairFallback), undefined, signal),
    loadEncounterTexture('fleetFlagship', replace(flagship, flankFallback), undefined, signal),
    loadEncounterTexture('fleetTrench', replace(trench, trenchFallback), undefined, signal),
  ]).then(() => [sky.map, pair.map, flagship.map, trench.map]);

  return {
    root, maps,
    update(time: number, clock: number, distance: number) {
      place(distance, -125, starfield);
      place(distance, -94, planets, -1.0 + 1.04 * Math.sin(clock * .026 - .4), -1.55 + .81 * Math.cos(clock * .020 + 1));
      planets.rotation.z = -.13 + .0056 * clock;
      for (const { site, mesh } of ships) {
        const y = fleetViewY(site.y, time);
        mesh.visible = Math.abs(y) < HEIGHT / 2 + site.width + 1;
        place(distance, site === trenchShip ? -2.3 : -3.1, mesh, site.x, y);
      }
    },
  };
}

function replace(material: T.MeshBasicMaterial, fallback: T.CanvasTexture) {
  return (texture: T.Texture) => {
    material.map = texture;
    material.needsUpdate = true;
    fallback.dispose();
  };
}
