import * as T from 'three';
import { applyAtlasUV } from './heliostat-layout';
import { createHeliostatBay } from './heliostat-bay';

export function createDistantPlant() {
  const root = new T.Group(), cards = new T.Group(), proxy = new T.Group();
  root.name = 'distant-plant'; root.add(cards, proxy);
  const artMaterial = new T.MeshBasicMaterial({ color: 0x849a9b, alphaTest: .48, side: T.DoubleSide });
  const layouts = [
    [-13, 20, -24, 18, 34, 0], [17, 30, -22, 20, 40, 1],
    [1, 125, 10, 50, 83, 2], [-40, 105, 1, 20, 41, 0],
  ];
  for (const [x, y, z, w, h, tile] of layouts) {
    const card = new T.Mesh(applyAtlasUV(new T.PlaneGeometry(w, h), tile, 3, 1), artMaterial);
    // Mid-angle fixed cards remain readable through both extremes of the swing.
    card.rotation.x = 1.03; card.position.set(x, y, z); cards.add(card);
  }
  // Small code-built stations give the no-art study the same layer/depth cues.
  for (const [x, y, z, w] of layouts) {
    const bay = createHeliostatBay(); bay.root.position.set(x, y, z);
    bay.root.scale.setScalar(w / 12); bay.root.rotation.x = .18; proxy.add(bay.root);
  }
  cards.visible = false;
  return {
    root, material: artMaterial,
    setArt(texture: T.Texture | undefined, enabled: boolean) {
      artMaterial.map = texture ?? null; artMaterial.needsUpdate = true;
      cards.visible = !!texture && enabled; proxy.visible = !cards.visible;
    },
  };
}
