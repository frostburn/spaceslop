import * as T from 'three';
import { loadEncounterTexture } from '../encounter-texture';
import { HEIGHT } from '../playfield';
import { createFlagshipEngines } from './engines';
import { fallbackPleiadianHull } from './placeholder';
import { createFleetSky, placeFleetPlate } from './sky';
import { fleetViewY, flankShips, trenchShip } from './route';

export function createFleetScenery(signal: AbortSignal) {
  const root = new T.Group();
  root.name = 'fleet-scenery';
  const sky = createFleetSky(signal);
  root.add(sky.root);
  const flankFallback = fallbackPleiadianHull(false), trenchFallback = fallbackPleiadianHull(true);
  const flagship = new T.MeshBasicMaterial({ map: flankFallback, alphaTest: .38, toneMapped: false });
  const trench = new T.MeshBasicMaterial({ map: trenchFallback, alphaTest: .38, toneMapped: false });

  const clock = { value: 0 };
  const engines = createFlagshipEngines(clock);
  const ships = [...flankShips, trenchShip].map((site, index) => {
    const isTrench = site === trenchShip;
    const mesh = new T.Mesh(new T.PlaneGeometry(site.width, 2 * site.width), isTrench ? trench : flagship);
    mesh.name = isTrench ? 'fleet-trench-flagship' : `fleet-broadside-flagship-${index + 1}`;
    mesh.add(...engines(site, isTrench, index));
    return { site, mesh };
  });
  root.add(...ships.map(({ mesh }) => mesh));
  const maps = Promise.all([
    sky.maps,
    loadEncounterTexture('fleetFlagship', replace(flagship, flankFallback), undefined, signal),
    loadEncounterTexture('fleetTrench', replace(trench, trenchFallback), undefined, signal),
  ]).then(([skyMaps]) => [...skyMaps, flagship.map, trench.map]);

  return {
    root, maps,
    update(time: number, animationTime: number, distance: number) {
      clock.value = animationTime;
      sky.update(time);
      for (const { site, mesh } of ships) {
        const y = fleetViewY(site.y, time);
        mesh.visible = Math.abs(y) < HEIGHT / 2 + site.width + 6;
        placeFleetPlate(distance, site === trenchShip ? -2.3 : -3.1, mesh, site.x, y);
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
