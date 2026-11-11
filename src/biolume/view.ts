import * as T from 'three';
import {actorPose,defaultOptions,LIGHT_COUNT,type StudyOptions} from './layout';
import {createSurface,lightUniforms} from './surface';
import {createStudyActors} from './actors';
import {createSeedPods} from './modules';
import {shipBurners,poseBurners} from '../burners';
import {disposeScene} from '../rendering/dispose';

export function createBiolumeView(canvas:HTMLCanvasElement){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new T.Scene();scene.background=new T.Color(0);scene.environment=null;
  const camera=new T.PerspectiveCamera(39,9/16,.05,80);camera.position.z=22;
  const uniforms=lightUniforms(),options={...defaultOptions};
  const heightAt=(z:number)=>2*Math.tan(39*Math.PI/360)*(22-z);
  const ground=createSurface('backdrop',heightAt(-3.6)*9/16,heightAt(-3.6),uniforms);ground.mesh.position.z=-3.6;
  const leaf=createSurface('foreground',heightAt(2.2)*9/16,heightAt(2.2),uniforms);leaf.mesh.position.z=2.2;leaf.mesh.renderOrder=10;
  const surfaces=[ground,leaf];scene.add(...surfaces.map(s=>s.mesh));
  for(const s of surfaces)renderer.initTexture(s.fallback);
  const actors=createStudyActors(uniforms.emissionGain),pods=createSeedPods(uniforms.emissionGain),burners=shipBurners(actors.player);scene.add(actors.player,actors.enemy,actors.shots,...pods.meshes);
  for(const map of[actors.raster.mesh.material.map,pods.meshes[0].material.map])if(map)renderer.initTexture(map);
  const lights=Array.from({length:LIGHT_COUNT},(_,i)=>{const light=new T.PointLight(i===0||i>5?0xffad47:i===1?0x43ffe0:i===4?0xff8c42:0x6eefff,0,uniforms.lightRange.value[i],2);scene.add(light);return light;});
  const basePower=[12,6,1.5,4,4.5,2,8,8];
  const haloGeometry=new T.PlaneGeometry(1,1);
  const halos=lights.map((_,i)=>{
    const material=new T.ShaderMaterial({uniforms:{emissionGain:uniforms.emissionGain,color:{value:lights[i].color},strength:{value:i<2?.15:.08}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 p;uniform vec3 color;uniform float strength,emissionGain;void main(){float a=pow(max(0.,1.-length(p)),4.)*strength*emissionGain;gl_FragColor=vec4(color,a);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
    const mesh=new T.Mesh(haloGeometry,material);mesh.scale.setScalar(i<2?4:1.3);scene.add(mesh);return mesh;
  });
  let art:Partial<Record<'backdrop'|'foreground'|'enemy'|'pods',T.Texture>>={},disposed=false,manual:T.Vector2|undefined;
  const positions=Array.from({length:LIGHT_COUNT},()=>new T.Vector3()),size=new T.Vector2();
  function setOptions(next:Partial<StudyOptions>){Object.assign(options,next);surfaces[0].setArt(options.artwork?art.backdrop:undefined);surfaces[1].setArt(options.artwork?art.foreground:undefined);actors.raster.setArt(art.enemy);actors.setArtwork(options.artwork);pods.setArt(options.artwork?art.pods:undefined);}
  function setArt(next:typeof art){
    if(disposed){for(const t of Object.values(next))t.dispose();return;}
    for(const key of ['backdrop','foreground','enemy','pods']as const){const t=next[key];if(t&&t!==art[key]){art[key]?.dispose();art[key]=t;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());renderer.initTexture(t);}}
    setOptions({});
  }
  function draw(time:number){
    if(disposed)return;
    const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
    renderer.getSize(size);if(size.x!==width||size.y!==height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();pods.fit(camera.aspect);for(const s of surfaces)s.mesh.scale.x=camera.aspect/(9/16);}
    const pose=actorPose(time),p=manual??pose.player;actors.player.position.set(p.x,p.y,0);actors.player.rotation.z=.06*Math.sin(time*.5);
    actors.enemy.position.set(pose.enemy.x,pose.enemy.y,.1);actors.enemy.rotation.z=.15*Math.sin(time*.4);actors.enemy.rotation.y=.15*Math.sin(time*1.3);
    actors.pose(time);actors.setEmission(options.emission);poseBurners(burners,time,.7);
    for(const[i,bullet]of actors.bullets.entries()){const phase=(time*2+i*1.3)%12;bullet.position.set(p.x+.055*Math.sin(i),p.y+1+phase,.1);}
    positions[0].copy(pods.anchors[0]);positions[6].copy(pods.anchors[1]);positions[7].copy(pods.anchors[2]);positions[1].set(2.6,.1,1.8);
    positions[2].set(p.x,p.y+.25,.8);positions[3].set(p.x,p.y-.8,-.3);
    positions[4].copy(actors.enemy.position);positions[4].y-=.2;positions[4].z+=.7;positions[5].set(p.x,p.y+3,.4);
    for(let i=0;i<LIGHT_COUNT;i++){
      lights[i].position.copy(positions[i]);const on=i<2||i>5?options.environment:options.actors;
      lights[i].intensity=on?basePower[i]*(i===0?1+.12*Math.sin(time*1.1):i===4?1+.18*Math.sin(time*1.7):1):0;
      uniforms.lightPosition.value[i].copy(positions[i]);uniforms.lightColor.value[i].set(lights[i].color.r,lights[i].color.g,lights[i].color.b).multiplyScalar(lights[i].intensity);
      halos[i].position.copy(positions[i]);halos[i].position.z+=.05;halos[i].visible=options.emission;
    }
    uniforms.reliefGain.value=options.relief?1:0;uniforms.transmissionGain.value=options.transmission?1:0;uniforms.occlusionGain.value=options.occlusion?1:0;uniforms.emissionGain.value=options.emission?1:0;
    renderer.render(scene,camera);
  }
  function movePlayer(x:number,y:number){manual=new T.Vector2(T.MathUtils.clamp(x,-3.2,3.2),T.MathUtils.clamp(y,-5.5,5.5));}
  function pointer(clientX:number,clientY:number){const r=canvas.getBoundingClientRect(),v=new T.Vector3((clientX-r.left-canvas.clientLeft)/canvas.clientWidth*2-1,1-(clientY-r.top-canvas.clientTop)/canvas.clientHeight*2,.5).unproject(camera);v.sub(camera.position);const t=-camera.position.z/v.z;movePlayer(camera.position.x+v.x*t,camera.position.y+v.y*t);}
  function dispose(){if(disposed)return;disposed=true;actors.release();pods.release();for(const s of surfaces)s.mesh.material.uniforms.map.value=null;disposeScene(scene);for(const s of surfaces)s.fallback.dispose();for(const t of Object.values(art))t.dispose();art={};renderer.dispose();renderer.forceContextLoss();}
  return{scene,camera,renderer,options,uniforms,actors,pods,surfaces,lights,draw,prime(){return actors.prime();},setOptions,setArt,movePlayer,pointer,follow(){manual=undefined;},
    stats(){return{draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length??0,lights:LIGHT_COUNT,ambient:0,artwork:!!(art.backdrop||art.foreground)};},dispose};
}
