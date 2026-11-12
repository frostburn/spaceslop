import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Surroundings = { value: T.Texture | null };

function polishedMetal(sky: Surroundings, color: number, tint: T.Vector3) {
  const material = new T.MeshPhysicalMaterial({ color, metalness: .95, roughness: .19, clearcoat: .64 });
  material.onBeforeCompile = shader => {
    shader.uniforms.metalSky = sky;
    shader.uniforms.metalTint = { value: tint };
    shader.fragmentShader = 'uniform sampler2D metalSky; uniform vec3 metalTint;\n' +
      shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 metalRay = reflect(-normalize(vViewPosition), normal);
        vec2 metalUV = clamp(vec2(.50,.56) + metalRay.xy * vec2(-.44,.38), .002, .998);
        vec3 reflectedSky = texture2D(metalSky,metalUV).rgb;
        float strip = exp(-abs(dot(metalRay,vec3(.73,.57,-.37))-.34)*18.0);
        float fill = exp(-abs(dot(metalRay,vec3(-.42,.74,.52))+.31)*7.0);
        outgoingLight += metalTint * (vec3(.08,.10,.13) + reflectedSky*.63 + vec3(.99,1.02,1.08)*(strip*1.47 + fill*.24));
        #include <opaque_fragment>
      `);
  };
  return material;
}

function brilliantCut() {
  const sides = 8;
  function ring(radius: number, z: number, twist: number) {
    return Array.from({ length: sides }, (_, i) => {
      const angle = 2 * Math.PI * (i + twist) / sides;
      return new T.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), z);
    });
  }
  const table = ring(.55, .42, .5), girdle = ring(1, .04, 0), base = ring(.97, -.06, 0);
  const top = new T.Vector3(0, 0, .42), point = new T.Vector3(0, 0, -.65);
  const positions: number[] = [];
  function triangle(a: T.Vector3, b: T.Vector3, c: T.Vector3) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    triangle(top, table[i], table[j]);
    triangle(table[i], girdle[i], girdle[j]);
    triangle(table[i], girdle[j], table[j]);
    triangle(girdle[i], base[i], base[j]);
    triangle(girdle[i], base[j], girdle[j]);
    triangle(base[i], point, base[j]);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function gemMaterial(sky: Surroundings, tint: T.Vector3) {
  const material = new T.MeshStandardMaterial({ color: 0xf2f9ff, metalness: .29, roughness: .10 });
  material.onBeforeCompile = shader => {
    shader.uniforms.gemSky = sky;
    shader.uniforms.gemTint = { value: tint };
    shader.fragmentShader = 'uniform sampler2D gemSky; uniform vec3 gemTint;\n' +
      shader.fragmentShader.replace('#include <opaque_fragment>', `
        vec3 eye = normalize(vViewPosition);
        vec3 ray = refract(-eye,normal,1.0/2.42);
        vec3 reflected = reflect(-eye,normal);
        vec2 uv = clamp(vec2(.50,.56) - ray.xy * vec2(.65,-.48), .03, .97);
        vec2 split = reflected.xy * .023;
        vec3 tunnel = vec3(texture2D(gemSky,uv+split).r,texture2D(gemSky,uv).g,texture2D(gemSky,uv-split).b);
        float flash = pow(max(0.0,dot(reflected,normalize(vec3(-.41,.68,.73)))),24.0);
        float facet = pow(max(0.0,dot(reflected,normalize(vec3(.59,-.31,.74)))),5.0);
        outgoingLight = outgoingLight*.29 + gemTint*(vec3(.064,.10,.145) + tunnel*1.22 + facet*.63)
          + vec3(.87,.97,1.35)*flash*1.67;
        #include <opaque_fragment>
      `);
  };
  return material;
}

function crestPoint(angle: number, y: number, radius: number, depth: number) {
  return new T.Vector3(radius * Math.sin(angle), y, .14 + depth * Math.cos(angle));
}

function wire(points: T.Vector3[], radius: number) {
  return new T.TubeGeometry(new T.CatmullRomCurve3(points), (points.length - 1) * 4, radius, 8, false);
}

function addMetalwork(group: T.Group, pieces: T.BufferGeometry[], metal: T.Material) {
  const geometry = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  group.add(new T.Mesh(geometry, metal));
}

function tiara(rose: T.Material, gem: T.BufferGeometry, garnet: T.Material) {
  const group = new T.Group();
  group.name = 'fons-rex-tiara';
  group.position.y = -.42;
  function point(angle: number, lift: number) {
    return crestPoint(angle, 1.63 + .14 * Math.cos(angle) + lift, 1.24, .86);
  }
  const angles = Array.from({ length: 29 }, (_, i) => -1.48 + 2.96 * i / 28);
  const pieces = [
    wire(angles.map(a => point(a, 0)), .064),
    wire(angles.map(a => point(a, .12 + .035 * Math.cos(a * 6))), .035),
  ];
  for (const [angle, rise, halfWidth] of [[-.92, .24, .21], [-.50, .36, .26], [0, .62, .36], [.50, .36, .26], [.92, .24, .21]]) {
    pieces.push(wire([
      point(angle - halfWidth, .06), point(angle - halfWidth * .75, rise * .63), point(angle, rise),
      point(angle + halfWidth * .75, rise * .63), point(angle + halfWidth, .06),
    ], .035));
  }
  addMetalwork(group, pieces, rose);
  for (const [angle, size, lift] of [[-.5, .095, .19], [0, .153, .30], [.5, .095, .19]]) {
    const stone = new T.Mesh(gem, garnet);
    stone.position.copy(point(angle, lift));
    stone.position.z += .058;
    stone.rotation.y = angle;
    stone.scale.set(size, size * 1.28, size);
    group.add(stone);
  }
  return group;
}

function circlet(profile: number[][]) {
  return new T.LatheGeometry(profile.map(([r, y]) => new T.Vector2(r, y)), 64)
    .scale(1, 1, .69).translate(0, 1.58, .14);
}

function finial(width: number, height: number) {
  const outline = new T.Shape().moveTo(-width, 0)
    .lineTo(-width * .44, height * .23)
    .quadraticCurveTo(-width * .92, height * .45, -width * .61, height * .64)
    .quadraticCurveTo(-width * .44, height * .75, 0, height)
    .quadraticCurveTo(width * .44, height * .75, width * .61, height * .64)
    .quadraticCurveTo(width * .92, height * .45, width * .44, height * .23)
    .lineTo(width, 0).closePath();
  return new T.ExtrudeGeometry(outline, { depth: .092, bevelSize: .033, bevelThickness: .026, bevelSegments: 2, curveSegments: 7 });
}

function crown(gold: T.Material, gem: T.BufferGeometry, sapphire: T.Material, diamond: T.Material) {
  const group = new T.Group();
  group.name = 'fons-invictus-crown';
  group.position.y = -.26;
  const lining = new T.Mesh(new T.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI * .70),
    new T.MeshStandardMaterial({ color: 0x111736, roughness: .86, emissive: 0x0a1229, emissiveIntensity: .24 }));
  lining.position.set(0, 1.74, .14);
  lining.scale.set(1.20, .46, .81);
  group.add(lining);
  group.add(new T.Mesh(circlet([
    [1.12, .04], [1.24, 0], [1.34, .055], [1.35, .115], [1.30, .149],
    [1.32, .34], [1.39, .368], [1.40, .42], [1.32, .46], [1.23, .43],
    [1.16, .15], [1.12, .04],
  ]), gold));
  const enamel = new T.MeshStandardMaterial({
    color: 0x11265f, roughness: .24, metalness: .42, emissive: 0x122963, emissiveIntensity: .30,
  });
  group.add(new T.Mesh(circlet([[1.31, .17], [1.33, .19], [1.35, .30], [1.34, .32]]), enamel));
  const peaks: T.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const front = Math.cos(angle);
    const height = .49 + .37 * Math.max(0, front);
    const base = crestPoint(angle, 1.97, 1.30, .89);
    peaks.push(finial(.34 + .09 * Math.max(0, front), height)
      .rotateX(.14).rotateY(angle).translate(base.x, base.y, base.z));
  }
  addMetalwork(group, peaks, gold);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const stone = new T.Mesh(gem, i % 2 === 0 ? sapphire : diamond);
    const height = i === 0 ? 2.32 : 1.82;
    const size = i === 0 ? .235 : .108;
    stone.position.copy(crestPoint(angle, height, 1.38, i === 0 ? 1.08 : .94));
    stone.rotation.y = angle;
    stone.scale.set(size, size * (i === 0 ? 1.32 : .82), size);
    group.add(stone);
  }
  return group;
}

export function createFonsRegalia(sky: Surroundings) {
  const goldColor = 0xffbc45, platinumColor = 0xe4e6ec;
  const goldTint = new T.Vector3(1.34, .91, .31);
  const socketTint = new T.Vector3(1, 1, 1);
  const rose = polishedMetal(sky, 0xf2b29e, new T.Vector3(1.24, .67, .58));
  const gold = polishedMetal(sky, goldColor, goldTint);
  const socket = polishedMetal(sky, platinumColor, socketTint);
  const gem = brilliantCut();
  const diamond = gemMaterial(sky, new T.Vector3(.83, .98, 1.2));
  const garnet = gemMaterial(sky, new T.Vector3(.76, .10, .19));
  const sapphire = gemMaterial(sky, new T.Vector3(.10, .36, 1.04));
  const bezel = new T.CylinderGeometry(1.06, .89, .31, 8).rotateX(Math.PI / 2).translate(0, 0, -.11);
  const forward = new T.Vector3(0, 0, 1);
  return {
    tiara: tiara(rose, gem, garnet),
    crown: crown(gold, gem, sapphire, diamond),
    socket,
    gildSockets(gilded: boolean) {
      socket.color.setHex(gilded ? goldColor : platinumColor);
      if (gilded) socketTint.copy(goldTint);
      else socketTint.setScalar(1);
    },
    tuskDiamond(position: T.Vector3, facing: T.Vector3, size: number) {
      const setting = new T.Group();
      setting.position.copy(position);
      setting.quaternion.setFromUnitVectors(forward, facing);
      setting.scale.setScalar(size);
      setting.add(new T.Mesh(bezel, gold), new T.Mesh(gem, diamond));
      return setting;
    },
  };
}
