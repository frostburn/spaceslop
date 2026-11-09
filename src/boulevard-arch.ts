import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {wireGeometry,mergeBoulevard} from './boulevard-geometry';
import {BOULEVARD_DECK} from './boulevard';
import {part} from './rig-geometry';
import type {BoulevardMaterials} from './boulevard-materials';

const WIDTH=4.15,RISE=5.75,FOOT=BOULEVARD_DECK+.44;
const cross=[[-.5,-.32],[-.36,-.5],[.36,-.5],[.5,-.32],[.5,.32],[.36,.5],[-.36,.5],[-.5,.32]];
function frame(angle:number){
 const tangent=new T.Vector3(-WIDTH*Math.sin(angle),0,RISE*Math.cos(angle)).normalize();
 return{center:new T.Vector3(WIDTH*Math.cos(angle),0,FOOT+RISE*Math.sin(angle)),normal:new T.Vector3(tangent.z,0,-tangent.x)};
}
// A broad, bevelled closed ribbon: the lattice and polished shell share the same section.
function shell(start:number,end:number,segments:number,expand=0){
 const positions:number[]=[],uv:number[]=[],indices:number[]=[];
 for(let row=0;row<=segments;row++){
  const angle=T.MathUtils.lerp(start,end,row/segments),{center,normal}=frame(angle),girth=.64+.13*Math.sin(angle)+expand;
  for(const[r,depth]of cross){const p=center.clone().addScaledVector(normal,r*girth);p.y=depth*(.98+expand);positions.push(p.x,p.y,p.z);uv.push(angle*2,depth+.5);}
 }
 for(let row=0;row<segments;row++)for(let c=0;c<8;c++){const a=row*8+c,b=row*8+(c+1)%8;indices.push(a,b,a+8,b,b+8,a+8);}
 for(let c=1;c<7;c++){indices.push(0,c+1,c);const back=segments*8;indices.push(back,back+c,back+c+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function polishedChrome(){
 // Long bright studio bands make curvature readable without another scene capture.
 const data=new Uint16Array(128*64*4);
 for(let y=0;y<64;y++)for(let x=0;x<128;x++){
  const u=x/128,v=y/63,horizon=Math.exp(-(((v-.52)/.08)**2)),window=Math.exp(-(((v-.48)/.22)**4));
  const band=(at:number,width:number)=>Math.exp(-(((u-at)/width)**2))*window;
  const white=band(.15,.020)*9+band(.50,.012)*13+band(.86,.035)*6,pink=band(.32,.055)*2,blue=band(.70,.06)*2;
  const values=[.025+white+pink+horizon*.45,.018+white+blue*.6+horizon*.17,.045+white+pink*.65+blue+horizon*.24,1];
  values.forEach((value,c)=>data[(y*128+x)*4+c]=T.DataUtils.toHalfFloat(value));
 }
 const env=new T.DataTexture(data,128,64,T.RGBAFormat,T.HalfFloatType);env.mapping=T.EquirectangularReflectionMapping;env.needsUpdate=true;
 return new T.MeshStandardMaterial({color:0xe8e2f1,metalness:.96,roughness:.12,envMap:env,envMapIntensity:1.15});
}
class ArchEdge extends T.Curve<T.Vector3>{
 constructor(private start:number,private end:number,private radial:number,private depth:number){super();}
 getPoint(t:number,target=new T.Vector3()){
  const angle=T.MathUtils.lerp(this.start,this.end,t),{center,normal}=frame(angle);
  return target.copy(center).addScaledVector(normal,this.radial*(.64+.13*Math.sin(angle))).setY(this.depth);
 }
}
export function createBoulevardArch(m:BoulevardMaterials){
 const root=new T.Group();root.name='boulevard-chrome-lattice-arch';
 const chrome=polishedChrome(),wire=m.wire.clone();wire.uniforms.tint.value=new T.Color(0xff70eb);
 const left=part(root,shell(Math.PI/2,Math.PI,32),chrome,0,0,0);left.name='arch-polished-shell';
 const source=shell(0,Math.PI/2,7),lattice=wireGeometry(source);source.dispose();part(root,lattice,wire,0,0,0).name='arch-triangular-shell';
 const panels=[.61,.73,.85,.96].map(t=>shell(Math.PI*t-.003,Math.PI*t+.003,1,.008)),seams=mergeGeometries(panels);panels.forEach(g=>g.dispose());
 part(root,seams,m.shell,0,0,0);
 const halo=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:{tint:{value:new T.Color(0xfd38b6)}},
  vertexShader:'varying vec3 n,v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalMatrix*normal;v=-p.xyz;gl_Position=projectionMatrix*p;}',
  fragmentShader:'uniform vec3 tint;varying vec3 n,v;void main(){float a=pow(max(0.,dot(normalize(n),normalize(v))),2.);gl_FragColor=vec4(tint,a*.19);\n#include <colorspace_fragment>\n}'});
 for(const depth of[-.50,.50])for(const radial of[-.5,.5]){
  const path=new ArchEdge(0,Math.PI,radial,depth);
  part(root,new T.TubeGeometry(path,48,.026,5,false),radial<0?m.amber:m.pink,0,0,0);
  if(radial>0)part(root,new T.TubeGeometry(path,48,.11,6,false),halo,0,0,0);
 }
 // Broad pedestal collars ground the complete arch in the promenade.
 for(const side of[-1,1]){
  part(root,new RoundedBoxGeometry(.98,1.36,.40,2,.09),chrome,side*WIDTH,0,BOULEVARD_DECK+.20);
  part(root,new RoundedBoxGeometry(.78,1.14,.17,2,.05),m.shell,side*WIDTH,0,BOULEVARD_DECK+.47);
  part(root,new T.BoxGeometry(.83,1.18,.035),m.pink,side*WIDTH,0,BOULEVARD_DECK+.54);
 }
 mergeBoulevard(root);return{root};
}
