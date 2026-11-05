import * as T from 'three';
import { createTitanRobot } from './titan-robot';
import { TITAN_DURATION, TITAN_TRAVEL } from './titan-layout';

// Positions register physical vents and roadside work sites to the owner's plate.
// They remain scenery only: no collision shapes, hitboxes, drops or projectiles.
export const titanVents = [
  [560, 11560, .75], [613, 11360, .65], [606, 9410, .8],
  [142, 8190, .8], [636, 8610, .65], [125, 6625, 1], [55, 7310, .8],
  [635, 5610, .8], [95, 4150, 1.1], [88, 4760, .9],
  [250, 2850, 1.3], [570, 1780, .9], [625, 1100, 1.2], [550, 430, 1.3],
] as const;
const workSites = [[430,12180], [410,11000], [345,9630], [420,7800],
  [330,6450], [348,5170], [390,3300], [250,1430]] as const;
const PUFFS = 7;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function titanGroundPoint(x: number, y: number, progress: number) {
  return { x: (x - 360) / 80, y: 152 - y / 80 - clamp(progress) * TITAN_TRAVEL };
}

const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float cloud(vec2 p){return .62*noise(p)+.26*noise(p*2.03)+.12*noise(p*4.07);}`;

function cloudBatch(count: number, haze: boolean, clock: { value: number }) {
  const geometry = new T.PlaneGeometry(1,1);
  const alpha = new T.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(T.DynamicDrawUsage);
  const seed = new T.InstancedBufferAttribute(Float32Array.from({length:count}, (_,i)=>i*.731+2.3),1);
  geometry.setAttribute('puffAlpha', alpha); geometry.setAttribute('puffSeed', seed);
  const material = new T.ShaderMaterial({
    uniforms: { clock, haze: {value:haze?1:0} }, transparent:true, depthWrite:false,
    vertexShader:`attribute float puffAlpha,puffSeed;varying vec2 vUv;varying float vAlpha,vSeed;
      void main(){vUv=uv;vAlpha=puffAlpha;vSeed=puffSeed;
       gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1);}`,
    fragmentShader:`uniform float clock,haze;varying vec2 vUv;varying float vAlpha,vSeed;${noise}
      void main(){vec2 p=(vUv-.5)*2.0;float edge=max(0.0,1.0-dot(p,p));
       float n=cloud(vUv*4.0+vec2(vSeed-clock*.035,clock*.025));
       float a=edge*edge*smoothstep(.19,.72,n)*vAlpha;
       vec3 smoke=mix(vec3(.19,.18,.16),vec3(.53,.51,.45),n);
       vec3 amber=mix(vec3(.26,.17,.08),vec3(.50,.36,.19),n);
       gl_FragColor=vec4(mix(smoke,amber,haze),a);
       #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.InstancedMesh(geometry,material,count);
  mesh.name=haze?'titan-drifting-haze':'titan-vent-exhaust';mesh.frustumCulled=false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  return {mesh,alpha};
}

export function createTitanAmbient() {
  const root=new T.Group();root.name='titan-ambient';
  const clock={value:0},smoke=cloudBatch(titanVents.length*PUFFS,false,clock),haze=cloudBatch(4,true,clock);
  root.add(smoke.mesh,haze.mesh);
  // Shared geometry/materials let the first crawler prime every later work site.
  const robot=createTitanRobot(),template=robot.root;
  const crawlers=workSites.map((site,i)=>{
    const model=template.clone(true);model.name=`titan-maintenance-crawler-${i}`;root.add(model);
    return {model,site,scanner:model.getObjectByName('survey-scanner')!,arm:model.getObjectByName('work-arm')!,
      elbow:model.getObjectByName('work-elbow')!};
  });
  const dustGeometry=new T.BufferGeometry(),dustPositions=new Float32Array(48*3);
  dustGeometry.setAttribute('position',new T.BufferAttribute(dustPositions,3).setUsage(T.DynamicDrawUsage));
  const dust=new T.Points(dustGeometry,new T.PointsMaterial({color:0xb1a17b,size:1.2,sizeAttenuation:false,transparent:true,opacity:.18,depthWrite:false}));
  dust.name='titan-windblown-dust';dust.frustumCulled=false;root.add(dust);
  const matrix=new T.Matrix4(),position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion(),axis=new T.Vector3(0,0,1);
  function instance(mesh:T.InstancedMesh,i:number,x:number,y:number,z:number,w:number,h:number,angle:number){
    position.set(x,y,z);scale.set(w,h,1);rotation.setFromAxisAngle(axis,angle);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);
  }
  return {root,setRobotTexture:robot.setTexture,update(progress:number,time=clamp(progress)*TITAN_DURATION){
    clock.value=time;
    for(let v=0;v<titanVents.length;v++){
      const [px,py,strength]=titanVents[v],source=titanGroundPoint(px,py,progress);
      for(let p=0;p<PUFFS;p++){
        const i=v*PUFFS+p,life=((time/5.5+p/PUFFS+v*.137)%1+1)%1;
        const spread=(.18+life*1.65)*strength;
        // Constant wind carries cooling exhaust away from its registered root.
        const x=source.x+life*1.15+Math.sin(life*5+v)*life*.22,y=source.y+life*.65;
        const visible=Math.abs(source.y)<11;
        instance(smoke.mesh,i,x,y,-3.3+life*.6,visible?spread:0,spread*1.35,life*.65+v);
        smoke.alpha.setX(i,visible?Math.pow(Math.sin(life*Math.PI),1.3)*.32:0);
      }
    }
    for(let i=0;i<4;i++){
      const x=Math.sin(time*.025+i*2.1)*3.7,y=-7+i*4.8+Math.sin(time*.06+i)*1.5;
      instance(haze.mesh,i,x,y,-1.6,11,7,.18+i*.41);
      haze.alpha.setX(i,.44+clamp(progress)*.16);
    }
    for(let i=0;i<crawlers.length;i++){
      const {model,site,scanner,arm,elbow}=crawlers[i],point=titanGroundPoint(site[0],site[1],progress),t=time*.24+i*1.8;
      model.visible=robot.available&&Math.abs(point.y)<9;
      model.position.set(point.x+Math.sin(t)*.24,point.y+Math.cos(t)*.13,-3.65);
      model.rotation.z=-.35+Math.sin(t)*.2;
      scanner.rotation.z=Math.sin(time*.6+i)*1.1;arm.rotation.z=-1.4+Math.sin(time*.8+i)*.35;
      elbow.rotation.z=.7+Math.sin(time*.7+i)*.4;
    }
    for(let i=0;i<48;i++){
      dustPositions[i*3]=((i*2.371+time*.17)%11)-5.5;
      dustPositions[i*3+1]=((i*4.173+time*.08)%19)-9.5;
      dustPositions[i*3+2]=-2.2;
    }
    smoke.mesh.instanceMatrix.needsUpdate=haze.mesh.instanceMatrix.needsUpdate=true;
    smoke.alpha.needsUpdate=haze.alpha.needsUpdate=true;
    dustGeometry.attributes.position.needsUpdate=true;
  }};
}
