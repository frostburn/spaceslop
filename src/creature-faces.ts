import * as T from 'three';
import { applyRelief, hide } from './encounter-surfaces';
import { part, pivot } from './rig-geometry';

type Section = [z: number, width: number, floor: number, crown: number, centerX?: number];
type Palette = [crown: number, flank: number, chin: number];

interface FaceShape {
  skull: Section[];
  jaw: Section[];
  brow: Section[];
  cheek: Section[];
  skullColors: Palette;
  browColors: Palette;
  jawColors: Palette;
  eye: [x: number, y: number, z: number, size: number];
  nostril: [x: number, y: number, z: number, size: number];
  hinge: [y: number, z: number];
  teeth: [z: number, x: number, y: number, height: number][];
}

const raptor: FaceShape = {
  skull: [
    [-0.21, 0.059, 0.04, 0.23], [-0.16, 0.145, 0.018, 0.31], [-0.09, 0.201, 0.019, 0.354],
    [-0.023, 0.224, 0.023, 0.367], [0.05, 0.217, 0.034, 0.348], [0.085, 0.199, 0.043, 0.333],
    [0.116, 0.181, 0.055, 0.315], [0.18, 0.154, 0.069, 0.27], [0.213, 0.141, 0.073, 0.246],
    [0.245, 0.126, 0.07, 0.225], [0.322, 0.102, 0.067, 0.186], [0.36, 0.091, 0.064, 0.173],
    [0.392, 0.082, 0.059, 0.158], [0.453, 0.061, 0.049, 0.131], [0.486, 0.032, 0.045, 0.109],
  ],
  jaw: [
    [-0.104, 0.135, -0.074, 0.01], [-0.023, 0.13, -0.103, 0.003], [0.09, 0.108, -0.092, 0],
    [0.188, 0.088, -0.073, -0.005], [0.29, 0.061, -0.06, -0.011], [0.365, 0.024, -0.04, -0.015],
  ],
  brow: [
    [-0.12, 0.024, 0.273, 0.311, 0.158], [-0.038, 0.043, 0.265, 0.341, 0.173],
    [0.052, 0.052, 0.251, 0.328, 0.171], [0.114, 0.035, 0.242, 0.295, 0.152],
    [0.18, 0.014, 0.212, 0.24, 0.135],
  ],
  cheek: [
    [-0.132, 0.021, 0.112, 0.2, 0.154], [-0.054, 0.047, 0.093, 0.207, 0.182],
    [0.028, 0.039, 0.106, 0.189, 0.182], [0.121, 0.026, 0.113, 0.158, 0.153],
    [0.186, 0.009, 0.105, 0.132, 0.125],
  ],
  skullColors: [0x203564, 0x9c5834, 0xe2ac71],
  browColors: [0x4069ae, 0xe5a14b, 0x492433],
  jawColors: [0x873d3a, 0xae683e, 0xd09b65],
  eye: [0.183, 0.242, 0.093, 0.051],
  nostril: [0.074, 0.137, 0.406, 0.022],
  hinge: [0.06, 0.107],
  teeth: [[0.185, 0.099, 0.09, 0.043], [0.231, 0.088, 0.087, 0.057],
    [0.279, 0.078, 0.083, 0.047], [0.326, 0.069, 0.076, 0.038],
    [0.373, 0.055, 0.073, 0.031], [0.421, 0.042, 0.063, 0.025]],
};

const draconian: FaceShape = {
  skull: [
    [-0.25, 0.09, 0.094, 0.456], [-0.195, 0.182, 0.082, 0.544], [-0.135, 0.242, 0.084, 0.589],
    [-0.051, 0.28, 0.104, 0.619], [0.047, 0.278, 0.128, 0.603], [0.086, 0.264, 0.137, 0.583],
    [0.128, 0.247, 0.146, 0.551], [0.207, 0.214, 0.155, 0.488], [0.252, 0.195, 0.157, 0.456],
    [0.29, 0.184, 0.158, 0.432], [0.379, 0.15, 0.158, 0.377], [0.465, 0.123, 0.154, 0.326],
    [0.512, 0.109, 0.15, 0.304], [0.548, 0.099, 0.145, 0.277], [0.613, 0.072, 0.136, 0.225],
    [0.652, 0.036, 0.134, 0.178],
  ],
  jaw: [
    [-0.143, 0.162, -0.118, 0.018], [-0.064, 0.176, -0.147, 0.006], [0.042, 0.147, -0.13, 0.001],
    [0.148, 0.123, -0.106, -0.005], [0.268, 0.093, -0.082, -0.012], [0.384, 0.062, -0.065, -0.025],
    [0.464, 0.024, -0.051, -0.029],
  ],
  brow: [
    [-0.135, 0.03, 0.447, 0.509, 0.197], [-0.054, 0.043, 0.46, 0.559, 0.216],
    [0.041, 0.053, 0.455, 0.548, 0.216], [0.12, 0.043, 0.429, 0.509, 0.2],
    [0.211, 0.028, 0.394, 0.448, 0.164], [0.296, 0.013, 0.367, 0.393, 0.127],
  ],
  cheek: [
    [-0.149, 0.028, 0.226, 0.382, 0.213], [-0.073, 0.051, 0.17, 0.366, 0.231],
    [0.037, 0.045, 0.185, 0.332, 0.239], [0.135, 0.035, 0.214, 0.311, 0.199],
    [0.226, 0.025, 0.206, 0.264, 0.166], [0.319, 0.011, 0.194, 0.228, 0.129],
  ],
  skullColors: [0x403344, 0x96735d, 0xe6b781],
  browColors: [0x6f4f42, 0xc59b69, 0x38252b],
  jawColors: [0x793a3e, 0xa67858, 0xe5b782],
  eye: [0.227, 0.421, 0.148, 0.065],
  nostril: [0.092, 0.24, 0.543, 0.027],
  hinge: [0.147, 0.17],
  teeth: [[0.248, 0.135, 0.176, 0.066], [0.304, 0.117, 0.172, 0.084],
    [0.361, 0.104, 0.17, 0.069], [0.42, 0.088, 0.167, 0.057],
    [0.476, 0.075, 0.157, 0.05], [0.533, 0.06, 0.153, 0.042], [0.585, 0.048, 0.145, 0.035]],
};

function loft(sections: Section[], palette: Palette) {
  const slices = 32;
  const stride = slices + 1;
  const positions: number[] = [];
  const colors: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const [crownColor, flankColor, chinColor] = palette.map((color) => new T.Color(color));
  const tint = new T.Color();
  const start = sections[0][0];
  const span = sections[sections.length - 1][0] - start;

  for (const [z, width, floor, crown, centerX = 0] of sections) {
    for (let i = 0; i <= slices; i++) {
      // Place the UV seam under the chin and keep the mouth side broad and flat.
      const angle = i / slices * Math.PI * 2 - Math.PI;
      const across = Math.sin(angle);
      const height = (Math.cos(angle) + 1) / 2;
      positions.push(centerX + width * Math.sign(across) * Math.abs(across) ** 0.82,
        T.MathUtils.lerp(floor, crown, height ** 1.17), z);
      uv.push(i / slices, (z - start) / span);
      tint.copy(flankColor);
      tint.lerp(crownColor, T.MathUtils.smoothstep(height, 0.52, 0.92));
      tint.lerp(chinColor, 1 - T.MathUtils.smoothstep(height, 0.08, 0.47));
      colors.push(tint.r, tint.g, tint.b);
    }
  }

  for (let ring = 0; ring < sections.length - 1; ring++) {
    for (let i = 0; i < slices; i++) {
      const a = ring * stride + i;
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
  const end = (sections.length - 1) * stride;
  for (let i = 1; i < slices - 1; i++) indices.push(0, i, i + 1, end, end + i + 1, end + i);

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  const seam = new T.Vector3();
  for (let i = 0; i < positions.length / 3; i += stride) {
    seam.set(normals.getX(i) + normals.getX(i + slices), normals.getY(i) + normals.getY(i + slices),
      normals.getZ(i) + normals.getZ(i + slices)).normalize();
    normals.setXYZ(i, seam.x, seam.y, seam.z);
    normals.setXYZ(i + slices, seam.x, seam.y, seam.z);
  }
  return geometry;
}

const skin = hide(0xffffff, true);
const orb = new T.SphereGeometry(1, 16, 12);
const dark = new T.MeshStandardMaterial({ color: 0x29151e, roughness: 0.78 });
const tongue = new T.MeshStandardMaterial({ color: 0xa84a49, roughness: 0.5 });
const iris = new T.MeshStandardMaterial({ color: 0xffc857, emissive: 0xbb640a, emissiveIntensity: 0.46, roughness: 0.38 });
const pupil = new T.MeshBasicMaterial({ color: 0x100d17 });
const glint = new T.MeshBasicMaterial({ color: 0xfff0bf });
const ivory = new T.MeshStandardMaterial({ color: 0xf6d49e, roughness: 0.43 });

export function setFaceTexture(texture: T.Texture) {
  applyRelief(texture, [skin]);
}

export function addCreatureFace(head: T.Group, species: 'raptor' | 'draconian') {
  const shape = species === 'raptor' ? raptor : draconian;
  const skull = part(head, loft(shape.skull, shape.skullColors), skin, 0, 0, 0);
  skull.name = 'skull';
  const [hingeY, hingeZ] = shape.hinge;
  const jaw = pivot(head, 'jaw', 0, hingeY, hingeZ);
  part(jaw, loft(shape.jaw, shape.jawColors), skin, 0, 0, 0);
  const length = shape.jaw[shape.jaw.length - 1][0];
  part(jaw, orb, dark, 0, -0.015, length * 0.42).scale.set(shape.jaw[1][1] * 0.92, 0.018, length * 0.57);
  part(jaw, orb, tongue, 0, 0.001, length * 0.48).scale.set(shape.jaw[1][1] * 0.39, 0.013, length * 0.38);

  const brow = loft(shape.brow, shape.browColors);
  const cheek = loft(shape.cheek, shape.jawColors);
  const axis = new T.Vector3(0, 0, 1);
  for (const side of [-1, 1]) {
    part(head, brow, skin, 0, 0, 0).scale.x = side;
    part(head, cheek, skin, 0, 0, 0).scale.x = side;
    const [x, y, z, size] = shape.eye;
    const eye = pivot(head, side < 0 ? 'eye_L' : 'eye_R', side * x, y, z);
    eye.quaternion.setFromUnitVectors(axis, new T.Vector3(side * 0.77, 0.48, 0.47).normalize());
    eye.scale.setScalar(size);
    part(eye, orb, dark, 0, 0, 0).scale.set(1.3, 0.88, 0.39);
    part(eye, orb, iris, 0.04 * side, 0.012, 0.24).scale.set(0.86, 0.59, 0.24);
    part(eye, orb, pupil, 0, 0.008, 0.45).scale.set(0.25, 0.51, 0.065);
    part(eye, orb, glint, -0.18, 0.24, 0.48).scale.set(0.13, 0.1, 0.035);

    const [nx, ny, nz, radius] = shape.nostril;
    const nostril = part(head, orb, dark, side * nx, ny, nz);
    nostril.quaternion.setFromUnitVectors(axis, new T.Vector3(side * 0.74, 0.59, 0.31).normalize());
    nostril.scale.set(radius * 0.56, radius, radius * 0.21);
  }

  const fang = new T.ConeGeometry(1, 1, 7);
  const upperTeeth = new T.InstancedMesh(fang, ivory, shape.teeth.length * 2);
  const lowerTeeth = new T.InstancedMesh(fang, ivory, (shape.teeth.length - 1) * 2);
  const transform = new T.Object3D();
  let upper = 0;
  let lower = 0;
  for (const side of [-1, 1]) {
    for (const [index, [z, x, y, height]] of shape.teeth.entries()) {
      transform.position.set(side * x, y - height * 0.36, z);
      transform.rotation.set(-0.19, 0, Math.PI + side * 0.09);
      transform.scale.set(height * 0.29, height, height * 0.26);
      transform.updateMatrix();
      upperTeeth.setMatrixAt(upper++, transform.matrix);
      if (index === shape.teeth.length - 1) continue;
      transform.position.set(side * x * 0.92, height * 0.19 - 0.009, z - hingeZ + 0.022);
      transform.rotation.set(-0.2, 0, -side * 0.11);
      transform.scale.multiplyScalar(0.68);
      transform.updateMatrix();
      lowerTeeth.setMatrixAt(lower++, transform.matrix);
    }
  }
  head.add(upperTeeth);
  jaw.add(lowerTeeth);
  return jaw;
}
