import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TRACTOR_MOUNT } from './route';

function lathe(profile: readonly (readonly [number, number])[]) {
  return new T.LatheGeometry(profile.map(([radius, z]) => new T.Vector2(radius, z)), 64).rotateX(Math.PI / 2);
}

function radialDetails(count: number, radius: number, z: number, detail: T.BufferGeometry) {
  const copies = Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    return detail.clone().translate(radius, 0, z).rotateZ(angle);
  });
  const result = mergeGeometries(copies);
  for (const copy of copies) copy.dispose();
  detail.dispose();
  return result;
}

function brushedSteel() {
  const w = 128, h = 64, pixels = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const grain = Math.sin(y * 2.39 + Math.sin(x * .056) * 1.5) + .4 * Math.cos(y * 4.03 + x * .1);
    const scuff = Math.sin(y * .42 + x * .25) * Math.cos(y * .36 - x * .19);
    const value = 174 + 11 * grain + 5 * scuff;
    pixels.set([value, value + 2, value + 5, 255], (y * w + x) * 4);
  }
  const map = new T.DataTexture(pixels, w, h);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

function reflectionMap() {
  const w = 96, h = 48, pixels = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const key = Math.exp(-(((u - .31) / .28) ** 2 + ((v - .38) / .16) ** 2));
    const bounce = Math.exp(-(((u - .77) / .17) ** 2 + ((v - .58) / .22) ** 2));
    pixels.set([40 + 190 * key + 61 * bounce, 44 + 190 * key + 73 * bounce, 56 + 179 * key + 96 * bounce, 255],
      (y * w + x) * 4);
  }
  const map = new T.DataTexture(pixels, w, h);
  map.mapping = T.EquirectangularReflectionMapping;
  map.colorSpace = T.SRGBColorSpace;
  map.needsUpdate = true;
  return map;
}

type Attitude = { pitch: number; bank: number; yaw: number };

export function createSaucerFactory() {
  const fallback = brushedSteel(), environment = reflectionMap();
  const silver = new T.MeshStandardMaterial({
    color: 0xe3e6e8, metalness: .58, roughness: .31, map: fallback,
    envMap: environment, envMapIntensity: 2.15, bumpMap: fallback, bumpScale: .004,
  });
  const distantSilver = silver.clone();
  distantSilver.color.setHex(0x677080);
  distantSilver.envMapIntensity = .76;
  const commandAlloy = silver.clone();
  commandAlloy.color.setHex(0x737b89);
  commandAlloy.roughness = .43;
  commandAlloy.envMapIntensity = 1.6;
  const dark = new T.MeshStandardMaterial({
    color: 0x303745, metalness: .58, roughness: .41, envMap: environment, envMapIntensity: 1.35,
  });
  const alloy = new T.MeshStandardMaterial({
    color: 0x999faa, metalness: .78, roughness: .24, envMap: environment, envMapIntensity: 1.7,
  });
  const glass = new T.MeshStandardMaterial({
    color: 0x263b55, metalness: .42, roughness: .14, envMap: environment, envMapIntensity: 2.1,
  });
  const lenses = new T.MeshBasicMaterial({ color: 0xff4f3f, toneMapped: false });
  const distantLenses = new T.MeshBasicMaterial({ color: 0x7c3c3b, toneMapped: false });
  const hull = lathe([[.91, -.085], [.973, -.066], [.997, -.04], [1, .014], [.976, .053],
    [.885, .088], [.77, .13], [.63, .173], [.49, .224], [.36, .268], [.30, .282], [.25, .282]]);
  const underbody = lathe([[0, -.294], [.18, -.294], [.235, -.278], [.27, -.245], [.35, -.245],
    [.42, -.216], [.56, -.203], [.68, -.181], [.82, -.129], [.92, -.086], [.97, -.064]]);
  const crown = lathe([[.363, .251], [.36, .289], [.325, .313], [.312, .343], [.287, .384],
    [.248, .426], [.194, .452], [.12, .472], [0, .478]]);
  const crownCollar = new T.TorusGeometry(.331, .024, 8, 64).translate(0, 0, .312);
  const rimCasing = new T.TorusGeometry(.988, .028, 8, 64).translate(0, 0, -.024);
  const shoulderTrim = new T.TorusGeometry(.944, .013, 8, 64).translate(0, 0, .069);
  const carrierBelt = new T.TorusGeometry(.748, .018, 8, 64).translate(0, 0, .143);
  const carrierPorts = radialDetails(18, .79, .129, new T.BoxGeometry(.045, .078, .018).rotateY(.32));
  const upperSeams = radialDetails(16, .71, .152, new T.BoxGeometry(.44, .009, .007).rotateY(.365));
  const vents = radialDetails(20, .70, -.175, new T.BoxGeometry(.25, .029, .019).rotateY(-.29));
  const lampHousings = radialDetails(18, .985, .025, new T.SphereGeometry(1, 9, 7).scale(.041, .057, .036));
  const lamps = radialDetails(18, 1.012, .031, new T.SphereGeometry(1, 10, 7).scale(.016, .039, .024));
  const bellyRing = new T.TorusGeometry(.267, .035, 8, 48).translate(0, 0, -.269);
  const bellyCore = new T.SphereGeometry(1, 24, 10).scale(.185, .185, .061).translate(0, 0, -.28);
  const chargeRing = new T.TorusGeometry(.365, .022, 8, 40).translate(0, 0, .305);
  const flareRing = new T.RingGeometry(.40, .55, 48).translate(0, 0, .325);
  const tractorCase = new T.CylinderGeometry(.054, .065, .031, 24).rotateX(Math.PI / 2);
  const tractorLens = new T.TorusGeometry(.043, .009, 8, 28).translate(0, 0, .018);

  function create(name: string, kind: 'patrol' | 'capital' | 'tractor' | 'command' = 'patrol') {
    const root = new T.Group();
    root.name = name;
    const mesh = (geometry: T.BufferGeometry, material: T.Material) => new T.Mesh(geometry, material);
    const charge = new T.MeshBasicMaterial({ color: 0x902d2c, toneMapped: false });
    const flare = new T.MeshBasicMaterial({
      color: 0xff3e28, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0,
    });
    const warning = mesh(flareRing, flare);
    warning.name = 'saucer-windup';
    root.add(mesh(hull, silver), mesh(underbody, kind === 'command' ? commandAlloy : dark), mesh(crown, glass), mesh(crownCollar, alloy),
      mesh(rimCasing, dark), mesh(shoulderTrim, alloy), mesh(upperSeams, dark), mesh(vents, alloy),
      mesh(lampHousings, dark), mesh(lamps, lenses),
      mesh(bellyRing, alloy), mesh(bellyCore, charge), mesh(chargeRing, charge), warning);
    if (kind !== 'patrol') root.add(mesh(carrierBelt, alloy), mesh(carrierPorts, dark));
    const projector = kind === 'tractor' ? new T.MeshBasicMaterial({ color: 0x376b57, toneMapped: false }) : undefined;
    if (projector) {
      const mount = new T.Group();
      mount.position.set(...TRACTOR_MOUNT);
      mount.add(mesh(tractorCase, dark), mesh(tractorLens, projector));
      root.add(mount);
    }

    return {
      root,
      attitude({ pitch, bank, yaw }: Attitude, power: number, flash: number, tractor = 0) {
        root.rotation.set(pitch, bank, yaw, 'ZXY');
        charge.color.setRGB(.21 + 1.4 * power + 1.5 * flash, .015 + .17 * power + .9 * flash, .019 + .08 * power + .39 * flash);
        warning.visible = power > .08 || flash > 0;
        warning.scale.setScalar(.87 + .20 * power + .22 * flash);
        flare.opacity = .20 * power + .56 * flash;
        projector?.color.setRGB(.032 + .34 * tractor, .14 + .94 * tractor, .09 + .54 * tractor);
      },
      prime() { warning.visible = true; },
    };
  }

  return {
    create,
    createDistant() {
      const root = new T.Group();
      root.name = 'fleet-distant-saucer';
      root.add(new T.Mesh(hull, distantSilver), new T.Mesh(underbody, dark),
        new T.Mesh(crown, distantSilver), new T.Mesh(lamps, distantLenses));
      return root;
    },
    environment,
    get metal() { return silver.map; },
    setAlloy(texture: T.Texture) {
      for (const material of [silver, distantSilver, commandAlloy]) {
        material.map = material.bumpMap = texture;
        material.needsUpdate = true;
      }
      fallback.dispose();
    },
  };
}
