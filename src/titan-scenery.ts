import {createTitanMountains} from './titan-mountains';
import {titanFrame,titanWorld} from './titan-frame';
import * as T from 'three';
import { encounterTextureUrl, loadEncounterTexture } from './encounter-texture';
import {TITAN_DURATION,TITAN_SCREENS,titanTileY,titanGroundTile,TITAN_TRAVEL} from './titan-layout';
import {titanMask} from './titan-mask';
import {createTitanClouds} from './titan-clouds';
import {createTitanAmbient} from './titan-ambient';

export function createTitanScenery(){
 const root=new T.Group();root.name='titan-research-station';root.visible=false;
 const tiles:T.Mesh<T.PlaneGeometry,T.ShaderMaterial>[]=[],textures:T.Texture[]=[];
 const copies:{mesh:T.Mesh;index:number;column:number;repeat:number}[]=[];
 const clock={value:0};
 const geometry=new T.PlaneGeometry(9,16);
 const ambient=createTitanAmbient(),clouds=createTitanClouds(),terrain=new T.Group();root.add(terrain,clouds.root);terrain.add(ambient.root);ambient.root.position.z=4;
 const mountains=createTitanMountains();terrain.add(mountains);
 const floor=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshBasicMaterial({color:0x3a2d20}));floor.position.z=-.02;terrain.add(floor);
 for(let i=0;i<TITAN_SCREENS;i++){
  const material=new T.ShaderMaterial({uniforms:{map:{value:null},mask:{value:null},hasMap:{value:0},clock,tile:{value:i},crop:{value:new T.Vector2(2/1284,1280/1284)}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:`uniform sampler2D map,mask;uniform float hasMap,clock,tile;uniform vec2 crop;varying vec2 vUv;
    void main(){float y=(tile+1.0-vUv.y)/10.0;
     vec2 uv=vec2(vUv.x,crop.x+vUv.y*crop.y);vec3 m=texture2D(mask,uv).rgb;
     vec3 c=vec3(.052,.039,.027);
     if(hasMap>.5){
      c=texture2D(map,uv).rgb;
      float flow=pow(max(0.0,sin(y*1800.0+vUv.x*28.0-clock*3.6)),5.0);
      c+=vec3(.015,.13,.18)*m.g*(.12+flow*.88);
      float phase=fract(clock*.65+floor(y*12800.0/32.0)*.173+floor(vUv.x*720.0/32.0)*.31);
      float on=smoothstep(.02,.08,phase)*(1.0-smoothstep(.55,.62,phase));
      c*=1.0-m.b*(1.0-on)*.82;
     }else{
      float bank=(1.0-smoothstep(.16,.33,abs(vUv.x-.17-.04*sin(y*47.0))));
      c*=1.0-bank*.55;
      vec2 cell=fract(vec2(vUv.x*6.0,y*50.0));
      float block=step(.77,abs(vUv.x-.5)*2.0)*step(.18,cell.x)*step(.18,cell.y);
      c=mix(c,vec3(.13,.14,.14),block*.7);
      c+=vec3(.025,.11,.15)*block*pow(max(0.0,sin(y*1400.0-clock*3.0)),18.0)*.3;
     }
     gl_FragColor=vec4(max(c,vec3(0.0)),1.0);
     #include <colorspace_fragment>
    }`});
  const mesh=new T.Mesh(geometry,material);mesh.position.z=0;mesh.frustumCulled=false;terrain.add(mesh);tiles.push(mesh);
  for(let column=-8;column<=8;column++)for(let repeat=-1;repeat<=1;repeat++){
   if(column===0&&repeat===0)continue;
   const copy=new T.Mesh(geometry,material);copy.scale.set(Math.abs(column)%2?-1:1,Math.abs(repeat)%2?-1:1,1);terrain.add(copy);copies.push({mesh:copy,index:i,column,repeat});
  }
 }
 let hasArt=false;
 const backdropReady=new Promise<T.Texture[]>(resolve=>{
  const url=encounterTextureUrl('titan');if(!url){resolve(textures);return;}
  const image=new Image();let pending=true;
  const deadline=window.setTimeout(()=>{pending=false;image.onload=null;image.onerror=null;resolve(textures);},20000);
  image.onerror=()=>{if(!pending)return;pending=false;clearTimeout(deadline);resolve(textures);};
  image.onload=async()=>{
   if(!pending)return;clearTimeout(deadline);pending=false;
   try{
    const w=Math.min(720,image.naturalWidth),h=Math.round(w*16/9),fullHeight=h*10;
    // Decode/slice in small preflight batches. Two-row gutters keep filtering
    // continuous; no GPU texture is taller than one screen plus its gutters.
    for(let i=0;i<10;i++){
     await new Promise<void>(r=>requestAnimationFrame(()=>r()));
     const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h+4;
     const context=canvas.getContext('2d',{willReadFrequently:true})!;
     context.drawImage(image,0,0,image.naturalWidth,image.naturalHeight,0,2-i*h,w,fullHeight);
     const pixels=context.getImageData(0,0,w,h+4);
     const maskCanvas=document.createElement('canvas');maskCanvas.width=w;maskCanvas.height=h+4;
     const maskContext=maskCanvas.getContext('2d')!,maskPixels=maskContext.createImageData(w,h+4);
     maskPixels.data.set(titanMask(pixels.data,w,h+4,i*h-2,fullHeight));maskContext.putImageData(maskPixels,0,0);
     const map=new T.CanvasTexture(canvas),mask=new T.CanvasTexture(maskCanvas);map.colorSpace=T.SRGBColorSpace;
     for(const texture of [map,mask]){texture.minFilter=texture.magFilter=T.LinearFilter;texture.generateMipmaps=false;textures.push(texture);}
     const u=tiles[i].material.uniforms;u.map.value=map;u.mask.value=mask;u.crop.value.set(2/(h+4),h/(h+4));u.hasMap.value=1;
    }
    hasArt=true;
   }catch{for(const mesh of tiles)mesh.material.uniforms.hasMap.value=0;}
   image.onload=null;image.onerror=null;image.src='';resolve(textures);
  };
  image.src=url;
 });
 const ready=Promise.all([backdropReady,loadEncounterTexture('titanRobot',ambient.setRobotTexture).then(texture=>texture?[texture]:[])]).then(parts=>parts.flat());
 return{root,ready,get hasArt(){return hasArt;},update(progress:number,time=progress*TITAN_DURATION,ascent=0,distance=95){clock.value=time;ambient.update(progress,time);ambient.root.visible=true;clouds.update(time,ascent,distance);
  const frame=titanFrame(ascent),point=titanWorld(0,-4,ascent);terrain.rotation.x=-frame.pitch;terrain.position.set(0,point.y,point.z);
  mountains.position.y=-progress*TITAN_TRAVEL;
  copies.forEach(({mesh,index,column,repeat})=>{const tile=titanGroundTile(index,column,repeat,progress);mesh.position.set(tile.x,tile.y,0);mesh.visible=ascent>0&&ascent<.65;});
  tiles.forEach((mesh,i)=>{mesh.position.y=titanTileY(i,progress);mesh.visible=Math.abs(mesh.position.y)<(ascent>0?80:16.01);});
 }};
}
