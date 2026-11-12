import * as T from 'three';
import {createVentFormations,ventTierTint,type VentFormation} from './vent-formations';
import {createVentGeology} from './vent-geology';
import {createVentCable} from './vent-cable';
import {createVentAtlas,ventCardGeometry,ventCardRelief,ventTallCell} from './vent-atlas';
import {loadEncounterTexture} from './encounter-texture';
import {type createMortarAssets} from './vent-mortar-rig';
import {createVentColonies} from './vent-colonies';
import {createVentHeat} from './vent-effects';
import {ioNoise} from './io-layout';
import {VENT_SHAFT_Y,VENT_STAGE_PITCH,ventFrame,ventWorld,ventBossPose} from './vent-layout';

function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
export function createVentScenery(molluskAssets:ReturnType<typeof createMortarAssets>,signal?:AbortSignal){
 const root=new T.Group();root.name='hydrothermal-vents';root.visible=false;
 const world=new T.Group();root.add(world);world.add(createVentGeology(),createVentCable());
 const colonies=createVentColonies(molluskAssets);world.add(colonies.root);
 const atlas=createVentAtlas(),material=new T.MeshBasicMaterial({map:atlas,alphaTest:.15,side:T.DoubleSide});
 const extraMaterial=material.clone();extraMaterial.map=createVentAtlas(true);
 const ready=Promise.all([loadEncounterTexture('ventAtlas',texture=>{texture.anisotropy=4;material.map=texture;material.needsUpdate=true;}, undefined, signal),loadEncounterTexture('ventExtras',texture=>{texture.anisotropy=4;extraMaterial.map=texture;extraMaterial.needsUpdate=true;}, undefined, signal)]);
 const rng=random(52391),formations=createVentFormations(),batches=Array.from({length:16},()=>[] as VentFormation[]),emitters:{x:number;y:number;z:number;pale:boolean}[]=[];
 const matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();
 for(const f of formations){
  batches[f.cell].push(f);
  if(ventTallCell(f.cell))for(const offset of f.cell===10?[-.19,0,.19]:[0])emitters.push({x:f.x+offset*f.w,y:f.y+f.h*.27-ventCardRelief(f.cell,.77)*f.h/7.5*Math.tan(VENT_STAGE_PITCH),z:f.z+ventCardRelief(f.cell,.77)*f.h/7.5+.1,pale:f.cell===3});
  if(f.front&&(f.cell===5||f.cell===7||f.cell===14))emitters.push({x:f.x-(f.cell===7?f.w*.07:0),y:f.y-.1,z:f.z+f.h*.375,pale:f.x>0});
 }
 for(let cell=0;cell<16;cell++){
  const mesh=new T.InstancedMesh(ventCardGeometry(cell),cell<8?material:extraMaterial,batches[cell].length);mesh.name=`vent-raster-layer-${cell}`;mesh.frustumCulled=false;
  batches[cell].forEach((f,i)=>{
   p.set(f.x,f.y,f.z);q.setFromEuler(new T.Euler(f.front?Math.PI/2:0,0,f.angle,f.front?'ZXY':'XYZ'));scale.set(f.w,f.h,ventTallCell(f.cell)?f.h/7.5:1);matrix.compose(p,q,scale);mesh.setMatrixAt(i,matrix);
   const tint=ventTierTint[f.tier],depth=f.front?Math.max(.2,1+Math.min(0,f.z)*.015):1;mesh.setColorAt(i,new T.Color().setRGB(tint[0]*depth,tint[1]*depth,tint[2]*depth));
  });world.add(mesh);
 }
 const heat=createVentHeat(emitters);world.add(heat.root);
 const n=64,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const radius=Math.hypot((x+.5)/n*2-1,(y+.5)/n*2-1),a=Math.max(0,1-radius)**1.2*(.55+ioNoise(x/7+10,y/7+20)*.45);data.set([255,255,255,a*255],(y*n+x)*4);}
 const mask=new T.DataTexture(data,n,n);mask.generateMipmaps=true;mask.minFilter=T.LinearMipmapLinearFilter;mask.magFilter=T.LinearFilter;mask.needsUpdate=true;
 const cloudGeometry=new T.PlaneGeometry(1,1),count=emitters.length*10;
 const alpha=new T.InstancedBufferAttribute(new Float32Array(count),1),tint=new T.InstancedBufferAttribute(new Float32Array(count*3),3);cloudGeometry.setAttribute('opacity',alpha);cloudGeometry.setAttribute('tint',tint);
 const cloudMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:mask}},
  vertexShader:`attribute float opacity;attribute vec3 tint;varying vec2 vUv;varying vec4 shade;void main(){vUv=uv;shade=vec4(tint,opacity);vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*p;}`,
  fragmentShader:`uniform sampler2D map;varying vec2 vUv;varying vec4 shade;void main(){gl_FragColor=vec4(shade.rgb,texture2D(map,vUv).a*shade.a);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 const clouds=new T.InstancedMesh(cloudGeometry,cloudMaterial,count);clouds.name='vent-mineral-plumes';clouds.frustumCulled=false;world.add(clouds);
 const motesGeometry=new T.BufferGeometry(),motes:number[]=[];
 for(let i=0;i<600;i++)motes.push((rng()-.5)*23,-15+rng()*202,-1+rng()*11);
 for(let i=0;i<500;i++){const a=rng()*Math.PI*2,r=Math.sqrt(rng())*22;motes.push(Math.sin(a)*r,VENT_SHAFT_Y+Math.cos(a)*r,-5-rng()*65);}
 motesGeometry.setAttribute('position',new T.Float32BufferAttribute(motes,3));
 const moteMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{clock:{value:0}},vertexShader:`uniform float clock;void main(){vec3 p=position;p.x+=sin(clock*.18+position.y)*.12;p.z+=sin(clock*.1+position.x)*.12;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=1.6;}`,fragmentShader:`void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(.45,.67,.69,(1.-smoothstep(.2,1.,r))*.18);}`});
 const particles=new T.Points(motesGeometry,moteMaterial);particles.name='suspended-vent-particles';world.add(particles);
 function update(time:number,rise:number,_alive=true){
  const frame=ventFrame(time,rise),origin=ventWorld(0,0,0,time,rise);world.rotation.set(-frame.pitch,0,frame.yaw,'XYZ');world.position.set(origin.x,origin.y,origin.z);moteMaterial.uniforms.clock.value=time;heat.update(time);colonies.update(time);
  for(let i=0;i<count;i++){
   const e=emitters[Math.floor(i/10)],t=(time*.10+(i%10)/10+Math.floor(i/10)*.37)%1;
   p.set(e.x+Math.sin(i*2.4+t*3)*t*.65,e.y+t*.45,e.z+t*5.5);q.identity();scale.set(1+t*2.4,1.2+t*2.7,1);matrix.compose(p,q,scale);clouds.setMatrixAt(i,matrix);alpha.setX(i,Math.sin(t*Math.PI)*(e.pale?.19:.4));tint.setXYZ(i,e.pale?.38:.035,e.pale?.50:.065,e.pale?.51:.08);
  }
  clouds.instanceMatrix.needsUpdate=true;alpha.needsUpdate=true;

 }
 update(0,0);
 return{root,world,ready,update,dispose:heat.dispose,capture(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera){if(root.visible)heat.capture(renderer,scene,camera);},frame:ventFrame,bossPose:ventBossPose};
}
