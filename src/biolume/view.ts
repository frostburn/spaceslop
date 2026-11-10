import * as T from 'three';
import {actorPose,defaultOptions,type StudyOptions} from './layout';
import {createSurface,lightUniforms} from './surface';
import {createStudyActors} from './actors';
import {shipBurners,poseBurners} from '../burners';
import {disposeScene} from '../rendering/dispose';

export function createBiolumeView(canvas:HTMLCanvasElement){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new T.Scene();scene.background=new T.Color(0);scene.environment=null;
  const camera=new T.PerspectiveCamera(39,9/16,.05,80);camera.position.z=22;
  const uniforms=lightUniforms(),options={...defaultOptions};
  const ground=createSurface('ground',13,23,uniforms);ground.mesh.position.z=-4.5;
  const root=createSurface('root',2.8,16,uniforms);root.mesh.position.set(-3.1,0,-3.6);
  const other=createSurface('root',2.6,13,uniforms);other.mesh.position.set(3.8,4,-3.6);other.mesh.rotation.z=-.15;
  const leaf=createSurface('leaf',4.2,6.1,uniforms);leaf.mesh.position.set(2.8,-.5,2.2);leaf.mesh.rotation.z=-.35;
  const pod=createSurface('pod',1.2,2.4,uniforms);pod.mesh.position.set(-2.5,4.5,.2);
  const surfaces=[ground,root,other,leaf,pod];scene.add(...surfaces.map(s=>s.mesh));
  for(const s of surfaces)renderer.initTexture(s.fallback);
  const actors=createStudyActors(),burners=shipBurners(actors.player);scene.add(actors.player,actors.enemy,actors.shots);
  const lights=Array.from({length:6},(_,i)=>{const light=new T.PointLight(i===0?0xffad47:i===1?0x43ffe0:i===4?0xff5319:0x6eefff,0,uniforms.lightRange.value[i],2);scene.add(light);return light;});
  const basePower=[12,6,1.5,4,4.5,2];
  const haloGeometry=new T.PlaneGeometry(1,1);
  const halos=[0,1,2,3,4,5].map(i=>{
    const material=new T.ShaderMaterial({uniforms:{emissionGain:uniforms.emissionGain,color:{value:lights[i].color},strength:{value:i<2?.15:.08}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 p;uniform vec3 color;uniform float strength,emissionGain;void main(){float a=pow(max(0.,1.-length(p)),4.)*strength*emissionGain;gl_FragColor=vec4(color,a);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
    const mesh=new T.Mesh(haloGeometry,material);mesh.scale.setScalar(i<2?4:1.3);scene.add(mesh);return mesh;
  });
  let art:T.Texture|undefined,disposed=false,manual:T.Vector2|undefined;
  const positions=Array.from({length:6},()=>new T.Vector3()),size=new T.Vector2();
  function setOptions(next:Partial<StudyOptions>){Object.assign(options,next);for(const s of surfaces)s.setArt(options.artwork?art:undefined);}
  function setArt(texture:T.Texture){if(disposed){texture.dispose();return;}if(art===texture)return;art?.dispose();art=texture;art.wrapS=art.wrapT=T.ClampToEdgeWrapping;art.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());renderer.initTexture(art);setOptions({});}
  function draw(time:number){
    if(disposed)return;
    const rect=canvas.getBoundingClientRect(),width=Math.max(1,Math.round(rect.width)),height=Math.max(1,Math.round(rect.height));
    renderer.getSize(size);if(size.x!==width||size.y!==height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
    const pose=actorPose(time),p=manual??pose.player;actors.player.position.set(p.x,p.y,0);actors.player.rotation.z=.06*Math.sin(time*.5);
    actors.enemy.position.set(pose.enemy.x,pose.enemy.y,.1);actors.enemy.rotation.z=.15*Math.sin(time*.4);actors.enemy.rotation.y=.15*Math.sin(time*1.3);
    actors.setEmission(options.emission);poseBurners(burners,time,.7);
    for(const[i,bullet]of actors.bullets.entries()){const phase=(time*2+i*1.3)%12;bullet.position.set(p.x+.055*Math.sin(i),p.y+1+phase,.1);}
    positions[0].set(-2.5,3.95,.9);positions[1].set(2.5,-.5,1.8);
    positions[2].set(p.x,p.y+.25,.8);positions[3].set(p.x,p.y-.8,-.3);
    positions[4].copy(actors.enemy.position);positions[4].y-=.2;positions[4].z+=.7;positions[5].set(p.x,p.y+3,.4);
    for(let i=0;i<6;i++){
      lights[i].position.copy(positions[i]);const on=i<2?options.environment:options.actors;
      lights[i].intensity=on?basePower[i]*(i===0?1+.12*Math.sin(time*1.1):i===4?1+.18*Math.sin(time*1.7):1):0;
      uniforms.lightPosition.value[i].copy(positions[i]);uniforms.lightColor.value[i].set(lights[i].color.r,lights[i].color.g,lights[i].color.b).multiplyScalar(lights[i].intensity);
      halos[i].position.copy(positions[i]);halos[i].position.z+=.05;halos[i].visible=options.emission;
    }
    uniforms.reliefGain.value=options.relief?1:0;uniforms.transmissionGain.value=options.transmission?1:0;uniforms.occlusionGain.value=options.occlusion?1:0;uniforms.emissionGain.value=options.emission?1:0;
    renderer.render(scene,camera);
  }
  function movePlayer(x:number,y:number){manual=new T.Vector2(T.MathUtils.clamp(x,-3.2,3.2),T.MathUtils.clamp(y,-5.5,5.5));}
  function pointer(clientX:number,clientY:number){const r=canvas.getBoundingClientRect(),v=new T.Vector3((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2,.5).unproject(camera);v.sub(camera.position);const t=-camera.position.z/v.z;movePlayer(camera.position.x+v.x*t,camera.position.y+v.y*t);}
  function dispose(){if(disposed)return;disposed=true;for(const s of surfaces)s.mesh.material.uniforms.map.value=null;disposeScene(scene);for(const s of surfaces)s.fallback.dispose();art?.dispose();renderer.dispose();renderer.forceContextLoss();}
  return{scene,camera,renderer,options,uniforms,actors,surfaces,lights,draw,setOptions,setArt,movePlayer,pointer,follow(){manual=undefined;},
    stats(){return{draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs?.length??0,lights:6,ambient:0,artwork:!!art};},dispose};
}
