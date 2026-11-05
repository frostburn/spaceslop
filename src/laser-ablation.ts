import * as T from 'three';

type Point = { x: number; y: number };

export function createLaserShield() {
  const root = new T.Group(); root.name = 'laser-shield'; root.renderOrder = 21; root.visible = false;
  const geometry = new T.RingGeometry(0.88, 1, 6);
  const ripples = Array.from({ length: 3 }, () => {
    const ring = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: 0x71caff,
      transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false }));
    ring.renderOrder = 21; root.add(ring); return ring;
  });
  const glint = new T.Mesh(new T.OctahedronGeometry(0.065), new T.MeshBasicMaterial({ color: 0xc2eeff,
    transparent: true, depthTest: false, depthWrite: false, blending: T.AdditiveBlending }));
  glint.renderOrder = 21; root.add(glint);
  return {
    root,
    draw(end: Point, time: number, blocked: boolean) {
      root.visible = blocked;
      if (!blocked) return;
      root.position.set(end.x, end.y, 0);
      ripples.forEach((ring, i) => {
        const phase = (time * 2.3 + i / 3) % 1, radius = 0.1 + phase * 0.52;
        ring.scale.set(radius, radius * 0.48, 1);
        ring.material.opacity = (1 - phase) ** 2 * 0.8;
      });
      glint.rotation.z = time * 5;
      glint.scale.setScalar(0.85 + Math.sin(time * 31) * 0.15);
    },
  };
}

export function createLaserAblation() {
  const root = new T.Group(); root.name = 'laser-contact'; root.renderOrder = 21;
  const material = new T.ShaderMaterial({
    uniforms: { clock: { value: 0 } }, transparent: true, blending: T.AdditiveBlending,
    depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float clock;
      void main() {
        float y = vUv.y, x = (vUv.x - 0.5) * 2.0;
        float sway = y * (sin(y * 17.0 - clock * 32.0) * 0.13 + sin(y * 29.0 + clock * 23.0) * 0.06);
        float width = (0.64 * (1.0 - y) + 0.035) * (0.9 + sin(y * 21.0 - clock * 36.0) * 0.1);
        float body = 1.0 - smoothstep(width * 0.25, width, abs(x - sway));
        float hot = pow(max(0.0, 1.0 - abs(x - sway) / width), 2.0) * (1.0 - y);
        vec3 color = mix(vec3(1.0, 0.18, 0.025), vec3(1.0, 0.8, 0.2), smoothstep(0.0, 0.55, hot));
        color = mix(color, vec3(1.0, 0.98, 0.85), smoothstep(0.45, 0.8, hot));
        gl_FragColor = vec4(color, body * smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.65, 1.0, y)));
        #include <colorspace_fragment>
      }`,
  });
  const flame = new T.Mesh(new T.PlaneGeometry(0.46, 0.58).translate(0, 0.19, 0), material);
  flame.name = 'ablation-flame'; flame.renderOrder = 21;
  const sparks = new T.InstancedMesh(new T.OctahedronGeometry(1), new T.MeshBasicMaterial({
    color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthTest: false, depthWrite: false }), 18);
  sparks.name = 'ablation-sparks'; sparks.renderOrder = 21; sparks.frustumCulled = false;
  sparks.instanceMatrix.setUsage(T.DynamicDrawUsage); sparks.setColorAt(0, new T.Color());
  root.add(flame, sparks);
  const matrix = new T.Matrix4(), position = new T.Vector3(), rotation = new T.Quaternion();
  const scale = new T.Vector3(), axis = new T.Vector3(0, 0, 1), color = new T.Color();
  return {
    root,
    draw(origin: Point, end: Point, hold: number, time: number, contact: boolean) {
      root.visible = contact;
      if (!contact) return;
      root.position.set(end.x, end.y, 0);
      root.rotation.z = Math.atan2(end.x - origin.x, origin.y - end.y);
      root.scale.setScalar(0.85 + Math.min(hold, 0.85) * 0.4);
      material.uniforms.clock.value = time;
      flame.scale.x = 0.9 + Math.sin(time * 47) * 0.1;
      flame.scale.y = 0.9 + Math.sin(time * 39 + 1) * 0.12;
      for (let i = 0; i < 18; i++) {
        const seed = (Math.sin(i * 127.1 + 4.7) * 43758.5453) % 1;
        const random = seed - Math.floor(seed), phase = (time * 2.8 + i / 18) % 1, age = phase * 0.38;
        const sideways = (random - 0.5) * 3.2, outward = 1.3 + random * 1.8;
        position.set(sideways * age, outward * age - age * age * 1.4, 0.01);
        rotation.setFromAxisAngle(axis, Math.atan2(-sideways, outward - age * 2.8));
        scale.set(0.012 * (1 - phase), (0.04 + age * 0.1) * (1 - phase), 0.012);
        matrix.compose(position, rotation, scale); sparks.setMatrixAt(i, matrix);
        color.setRGB(1, 0.38 + 0.6 * (1 - phase), 0.06 + 0.85 * (1 - phase) ** 4).multiplyScalar((1 - phase) ** 0.7);
        sparks.setColorAt(i, color);
      }
      sparks.instanceMatrix.needsUpdate = true; sparks.instanceColor!.needsUpdate = true;
    },
  };
}
