import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHeliostatRoute } from '../heliostat/route';
import {createUnderworks} from '../heliostat/underworks';
import { createDistantPlant } from '../heliostat/distant';
import { createHeliostatBackdrop } from '../heliostat/backdrop';
import { createHeliostatCollector } from '../heliostat/collector';
import { createHeliostatMaterials, createHeliostatEnvironment } from '../heliostat/materials';
import { bayTravel, cameraPose, CAMERA_FOV, ROUTE_END } from '../heliostat/layout';
import type { StudyArt } from './heliostat-assets';
import { createFighterRig } from '../ship-rigs';
import { shipBurners, poseBurners } from '../burners';
import { disposeScene } from '../rendering/dispose';

export type StudyOptions = { artwork: boolean; sky: boolean; distant: boolean; corridor: boolean; wireframe: boolean; orbit: boolean };

export function createHeliostatView(canvas: HTMLCanvasElement) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.autoClear = false;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(CAMERA_FOV, 9 / 16, .1, 600);
  camera.up.set(0, 0, 1);
  const environment = createHeliostatEnvironment(); scene.environment = environment;
  const fill = new T.HemisphereLight(0xb3d5e5, 0x2c2219, 1.5); fill.position.set(0,0,1); scene.add(fill);
  const key = new T.DirectionalLight(0xffe6c4, 3.2); key.position.set(-34, 20, 28);
  key.target.position.set(0,4,-1); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024); key.shadow.normalBias = .025; key.shadow.bias = -.0001;
  Object.assign(key.shadow.camera, { left: -17, right: 17, top: 25, bottom: -25, near: .5, far: 110 });
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key, key.target);
  const rim = new T.DirectionalLight(0x7fc8e9, .8); rim.position.set(18, 20, 10); scene.add(rim);
  const materials = createHeliostatMaterials(), world = new T.Group(); scene.add(world);
  const route = createHeliostatRoute(materials), distant = createDistantPlant(materials),underworks=createUnderworks(materials);
  const collector = createHeliostatCollector(materials), backdrop = createHeliostatBackdrop();
  collector.root.position.y += ROUTE_END; distant.root.position.y = ROUTE_END;
  world.add(underworks.root,route.root, distant.root, collector.root);
  const ship = createFighterRig().root; ship.scale.setScalar(1.05); scene.add(ship);
  const burners = shipBurners(ship);
  const shots = new T.InstancedMesh(new T.SphereGeometry(1, 6, 8),
    new T.MeshBasicMaterial({ color: new T.Color(.4, 1.6, 1.8) }), 12);
  shots.frustumCulled = false; scene.add(shots);
  const dummy = new T.Object3D(), muzzle = new T.Vector3(), aim = new T.Vector3();
  const forward = new T.Vector3(0,1,0), bank = new T.Quaternion();
  const controls = new OrbitControls(camera, canvas); controls.enabled = false;
  controls.enableDamping = false; controls.minDistance = 7; controls.maxDistance = 130;
  let art: StudyArt = {}, options: StudyOptions = { artwork: true, sky: true, distant: true, corridor: true, wireframe: false, orbit: false };
  let width = 0, height = 0, disposed = false, lastScroll = Infinity, backdropInspection = false;
  renderer.shadowMap.autoUpdate = false;
  const frame = { time: 0, progress: 0 };

  function setOptions(next: StudyOptions) {
    const enterOrbit = next.orbit && !options.orbit; options = { ...next };
    materials.setArt(art, options.artwork);
    backdrop.setTexture(art.heliostatBackdrop,options.artwork);backdrop.root.visible=options.sky;
    distant.root.visible = options.distant;underworks.root.visible=options.distant; route.root.visible = options.corridor;
    controls.enabled = options.orbit;
    canvas.style.touchAction = options.orbit ? 'none' : 'pan-y';
    if (enterOrbit) {
      controls.target.copy(cameraPose(frame.progress).target);
      controls.minDistance = 7; controls.maxDistance = 130;
      controls.update();
    }
    for (const root of [world]) root.traverse(node => {
      if (node instanceof T.Mesh) for (const material of [node.material].flat())
        if ('wireframe' in material) material.wireframe = options.wireframe;
    });
    lastScroll = Infinity;
  }

  function draw(time: number, progress: number) {
    if (disposed) return;
    frame.time = time; frame.progress = progress;
    materials.updateThermal(time);
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w !== width || h !== height) {
      width = w; height = h; renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    if (!options.orbit) {
      const pose = cameraPose(progress); camera.position.copy(pose.position); camera.lookAt(pose.target);
      camera.updateMatrixWorld();
    }
    world.position.y = bayTravel(time);route.update(time);underworks.update(time);world.updateMatrixWorld(true);
    const updateShadows = world.position.y !== lastScroll;
    ship.position.set(Math.sin(time * .36) * .8, -4.5, .4);
    // Hull and shots share a real heading towards the physical collector.
    collector.root.getWorldPosition(aim).sub(ship.position).normalize();
    ship.quaternion.setFromUnitVectors(forward, aim);
    bank.setFromAxisAngle(forward, Math.sin(time * .36) * .035); ship.quaternion.multiply(bank);
    ship.updateMatrixWorld(true); poseBurners(burners, time, .55);
    for (let i = 0; i < shots.count; i++) {
      const age = (time * .65 + Math.floor(i / 2) / 6) % 1;
      muzzle.set(i % 2 ? .42 : -.42, .62 + age * 25, .06).applyMatrix4(ship.matrixWorld);
      dummy.position.copy(muzzle); dummy.quaternion.copy(ship.quaternion); dummy.scale.set(.035,.18,.035);
      dummy.updateMatrix(); shots.setMatrixAt(i, dummy.matrix);
    }
    shots.instanceMatrix.needsUpdate = true;
    collector.update(time);backdrop.update(w,h,progress,backdropInspection);
    renderer.clear(); renderer.render(backdrop.scene, camera);
    if (!backdropInspection) {
      renderer.clearDepth(); renderer.shadowMap.needsUpdate = updateShadows; renderer.render(scene, camera);
      lastScroll = world.position.y;
    }
  }
  controls.addEventListener('change', () => { if (options.orbit) draw(frame.time,frame.progress); });

  return {
    renderer, scene, camera, world, backdrop, route, distant, collector,
    setOptions, draw,
    inspectBackdrop(enabled: boolean) { backdropInspection = enabled; },
    setArt(next: StudyArt) {
      if (disposed) { for (const texture of Object.values(next)) texture.dispose(); return; }
      art = next; setOptions(options);
    },
    async warmup() {
      if (disposed) return;
      for (const layer of [backdrop.scene,scene]) {
        if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(layer,camera);
        else renderer.compile(layer,camera);
      }
      const restore=route.prepare(-world.position.y);
      const restoreUnderworks=underworks.prepare(-world.position.y);
      const flags=new Map<T.Mesh,boolean>(),visibility=[distant.root,collector.root].map(root=>({root,visible:root.visible}));
      for(const item of [...visibility,{root:underworks.root,visible:true}]){
        item.root.visible=true;item.root.traverse(node=>{if(node instanceof T.Mesh){flags.set(node,node.frustumCulled);node.frustumCulled=false;}});
      }
      try{
        renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);
      }finally{
        restore();restoreUnderworks();for(const[node,flag]of flags)node.frustumCulled=flag;
        for(const item of visibility)item.root.visible=item.visible;
        lastScroll=Infinity;draw(frame.time,frame.progress);
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      controls.dispose(); materials.releaseTextures(); scene.environment = null; environment.dispose();
      backdrop.releaseTextures();disposeScene(scene); disposeScene(backdrop.scene); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
