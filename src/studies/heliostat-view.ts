import * as T from 'three';
import { createHeliostatBay } from './heliostat-bay';
import { createDistantPlant } from './heliostat-distant';
import { createHeliostatSky } from './heliostat-sky';
import { bayTravel, cameraPose, CAMERA_FOV } from './heliostat-layout';
import type { StudyArt } from './heliostat-assets';
import { createFighterRig } from '../ship-rigs';
import { shipBurners, poseBurners } from '../burners';
import { disposeScene } from '../rendering/dispose';

function createStar() {
  const root = new T.Group(); root.position.set(0, 72, 10);
  const material = new T.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 p;varying vec3 n;
      void main(){p=position;n=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float time;varying vec3 p;varying vec3 n;
      void main(){
        float granules=sin(p.x*17.+sin(p.y*22.))*sin(p.z*19.+p.x*8.);
        float cells=sin(p.y*2.8+sin(p.x*2.1+time*.09))*sin(p.z*3.-time*.05);
        float spot=smoothstep(.72,.97,cells);
        vec3 col=mix(vec3(3.2,1.25,.28),vec3(.32,.04,.008),spot);
        col*=.93+.14*granules;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  root.add(new T.Mesh(new T.SphereGeometry(5.1, 40, 28), material));
  const metal = new T.MeshStandardMaterial({ color: 0x726e61, roughness: .66, metalness: .5 });
  const copper = new T.MeshStandardMaterial({ color: 0xa16b37, roughness: .44, metalness: .64 });
  const light = new T.MeshBasicMaterial({ color: new T.Color(1.6, .65, .1) });
  for (const r of [6.1, 7.9]) {
    const ring = new T.Mesh(new T.TorusGeometry(r, .23, 8, 72), metal);
    ring.rotation.x = Math.PI / 2; root.add(ring);
  }
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, mount = new T.Group();
    mount.position.set(Math.sin(angle) * 7.1, 0, Math.cos(angle) * 7.1);
    mount.rotation.y = angle; root.add(mount);
    mount.add(new T.Mesh(new T.BoxGeometry(.9, 1.1, 1.1), metal));
    const coil = new T.Mesh(new T.CylinderGeometry(.4, .4, .8, 12), copper);
    coil.rotation.z = Math.PI / 2; mount.add(coil);
    const lamp = new T.Mesh(new T.BoxGeometry(.1, 1.12, .7), light); mount.add(lamp);
  }
  return { root, material };
}

export type StudyOptions = { artwork: boolean; sky: boolean; distant: boolean; corridor: boolean; wireframe: boolean };

export function createHeliostatView(canvas: HTMLCanvasElement) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(CAMERA_FOV, 9 / 16, .1, 600);
  camera.up.set(0, 0, 1);
  scene.add(new T.HemisphereLight(0x87b8cb, 0x38302b, 2.1));
  const key = new T.DirectionalLight(0xffd6a4, 3.2); key.position.set(-12, 24, 28); scene.add(key);
  const rim = new T.DirectionalLight(0x75d6ed, 2); rim.position.set(15, -5, 12); scene.add(rim);
  const bay = createHeliostatBay(), sky = createHeliostatSky(), distant = createDistantPlant(), star = createStar();
  scene.add(bay.root, sky.root, distant.root, star.root);
  const ship = createFighterRig().root; ship.scale.setScalar(1.05); scene.add(ship);
  const burners = shipBurners(ship);
  const shots = new T.InstancedMesh(new T.SphereGeometry(1, 6, 8),
    new T.MeshBasicMaterial({ color: new T.Color(.4, 1.6, 1.8) }), 12);
  shots.frustumCulled = false; scene.add(shots);
  const dummy = new T.Object3D(), muzzle = new T.Vector3();
  const arcMaterial = new T.MeshBasicMaterial({ color: new T.Color(.35, 1.45, 2.1) });
  const arcs = new T.Group(); arcs.name = 'recessed-electric-bus';
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 25 }, (_, i) => new T.Vector3(
      side * 4.35 + Math.sin(i * 5.3) * .07, -2.8 + i * .43, -1.75 + Math.sin(i * 9) * .065));
    arcs.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 48, .023, 4, false), arcMaterial));
  }
  bay.root.add(arcs);
  let art: StudyArt = {}, options: StudyOptions = { artwork: true, sky: true, distant: true, corridor: true, wireframe: false };
  let width = 0, height = 0, disposed = false;

  function setOptions(next: StudyOptions) {
    options = { ...next };
    bay.setArt(art.heliostatPanels, options.artwork);
    distant.setArt(art.heliostatDistant, options.artwork);
    sky.material.uniforms.artwork.value = art.heliostatSky ?? null;
    sky.material.uniforms.useArt.value = !!art.heliostatSky && options.artwork;
    sky.root.visible = options.sky; distant.root.visible = options.distant; bay.root.visible = options.corridor;
    for (const root of [bay.root, distant.root]) root.traverse(node => {
      if (node instanceof T.Mesh) for (const material of [node.material].flat())
        if ('wireframe' in material) material.wireframe = options.wireframe;
    });
  }

  return {
    renderer, scene, camera,
    setOptions,
    setArt(next: StudyArt) {
      if (disposed) { for (const texture of Object.values(next)) texture.dispose(); return; }
      art = next; setOptions(options);
    },
    draw(time: number, progress: number) {
      if (disposed) return;
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
      if (w !== width || h !== height) {
        width = w; height = h; renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      const pose = cameraPose(progress);
      camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld();
      sky.update(w, h, progress);
      bay.root.position.y = bayTravel(time);
      ship.position.set(Math.sin(time * .36) * .8, -4.5, .4);
      ship.rotation.set(pose.shipPitch, Math.sin(time * .36) * .035, 0);
      ship.updateMatrixWorld(true); poseBurners(burners, time, .55);
      for (let i = 0; i < shots.count; i++) {
        const age = (time * .65 + Math.floor(i / 2) / 6) % 1;
        muzzle.set(i % 2 ? .42 : -.42, .62 + age * 21, .06).applyMatrix4(ship.matrixWorld);
        dummy.position.copy(muzzle); dummy.rotation.copy(ship.rotation); dummy.scale.set(.035, .18, .035);
        dummy.updateMatrix(); shots.setMatrixAt(i, dummy.matrix);
      }
      shots.instanceMatrix.needsUpdate = true;
      star.material.uniforms.time.value = time;
      arcs.visible = Math.sin(time * 2.8) > -.7;
      renderer.render(scene, camera);
    },
    async warmup() {
      if (disposed) return;
      if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
    },
    dispose() {
      if (disposed) return; disposed = true;
      disposeScene(scene); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
