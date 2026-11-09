import * as T from 'three';
import {BOULEVARD_DECK} from './boulevard';
export const ROAD_PERIOD=84,ROAD_WATER=.003,ROAD_LOW=-.04,ROAD_RANGE=.10;
const W=128,H=512,SPAN=7.2,GRAVITY=10;
export type DrainSite={x:number;y:number;z:number;bay:number;period:number;phase:number};
export function drainSite(x:number,y:number,z:number,bay:number,seed:number):DrainSite{return{x,y,z,bay,period:5.2+(seed%7)*.39,phase:(seed*.873)%5.1};}
export function drainOffset(site:DrainSite,scroll:number){return site.bay>=16?Math.max(0,Math.floor((scroll-(site.bay*14-14)+25)/84))*84:0;}
export function dripState(time:number,site:DrainSite){
 const fall=Math.sqrt(Math.max(0,2*(site.z-BOULEVARD_DECK-ROAD_WATER)/GRAVITY)),age=((time+site.phase)%site.period+site.period)%site.period;
 return{fall,age,z:site.z-GRAVITY*age*age/2,impact:age-fall};
}
// Centimetre-scale variation is static in world space. Depressions share the drain anchors.
export function roadRelief(sites:readonly DrainSite[]){
 const heights=new Float32Array(W*H),data=new Uint8Array(W*H*4);
 for(let row=0;row<H;row++)for(let col=0;col<W;col++){
  const x=-SPAN/2+(col+.5)*SPAN/W,y=(row+.5)*ROAD_PERIOD/H,angle=y/ROAD_PERIOD*Math.PI*2;
  heights[row*W+col]=.011+.012*Math.sin(x*2.4+angle*5)*Math.sin(angle*11)+.009*Math.cos(x*.9-angle*17);
 }
 function basin(x:number,y:number,rx:number,ry:number){
  const minX=Math.max(0,Math.floor((x-rx*1.25+SPAN/2)/SPAN*W)),maxX=Math.min(W-1,Math.ceil((x+rx*1.25+SPAN/2)/SPAN*W));
  const minY=Math.floor((y-ry*1.25)/ROAD_PERIOD*H),maxY=Math.ceil((y+ry*1.25)/ROAD_PERIOD*H);
  for(let iy=minY;iy<=maxY;iy++)for(let ix=minX;ix<=maxX;ix++){
   const px=-SPAN/2+(ix+.5)*SPAN/W,py=(iy+.5)*ROAD_PERIOD/H;
   const irregular=1+.20*Math.sin(px*8+py*Math.PI*58/ROAD_PERIOD)+.13*Math.cos(px*17-py*Math.PI*38/ROAD_PERIOD),q=(((px-x)/rx)**2+((py-y)/ry)**2)*irregular;if(q>=1)continue;
   const index=((iy%H+H)%H)*W+ix;heights[index]=Math.min(heights[index],-.025+.075*q);
  }
 }
 for(let i=0;i<12;i++){const x=Math.sin(i*71.3)*2.5,y=i*ROAD_PERIOD/12+2;basin(x,y,.8+(i%3)*.35,1.7+(i%4)*.55);}
 for(const site of sites)basin(site.x,((site.y%ROAD_PERIOD)+ROAD_PERIOD)%ROAD_PERIOD,.72,1.10);
 heights.forEach((height,i)=>{const encoded=Math.round(T.MathUtils.clamp((height-ROAD_LOW)/ROAD_RANGE,0,1)*255);data.set([encoded,0,0,255],i*4);});
 const texture=new T.DataTexture(data,W,H);texture.wrapS=T.ClampToEdgeWrapping;texture.wrapT=T.RepeatWrapping;texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
 function sample(x:number,y:number){
  const sx=T.MathUtils.clamp((x/SPAN+.5)*W-.5,0,W-1),sy=y/ROAD_PERIOD*H-.5,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
  const at=(a:number,b:number)=>ROAD_LOW+data[(((b%H+H)%H)*W+Math.min(W-1,a))*4]/255*ROAD_RANGE;
  return T.MathUtils.lerp(T.MathUtils.lerp(at(ix,iy),at(ix+1,iy),fx),T.MathUtils.lerp(at(ix,iy+1),at(ix+1,iy+1),fx),fy);
 }
 return{texture,sample};
}
export function createBoulevardDrips(sites:readonly DrainSite[]){
 const root=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshBasicMaterial({color:0xbaddef,transparent:true,opacity:.58,depthWrite:false}),sites.length);root.name='boulevard-residual-drips';root.frustumCulled=false;root.instanceMatrix.setUsage(T.DynamicDrawUsage);
 let savedCount=0;const dummy=new T.Object3D(),impacts=Array.from({length:6},()=>new T.Vector4(0,0,-10,0));
 return{root,impacts,prime(active:boolean){if(active){savedCount=root.count;root.count=sites.length;}else root.count=savedCount;},update(time:number,scroll:number,center:number){
  let count=0,ripples=0;for(const impact of impacts)impact.set(0,0,-10,0);
  for(const site of sites){const y=site.y+drainOffset(site,scroll);if(y-scroll < -24||y-scroll>95)continue;const state=dripState(time,site);
   if(state.age<state.fall){dummy.position.set(site.x,y-center,state.z-BOULEVARD_DECK-ROAD_WATER);dummy.scale.set(.016,.016,.025+state.age*.05);dummy.updateMatrix();root.setMatrixAt(count++,dummy.matrix);}
   if(state.impact>=0&&state.impact<1.15&&ripples<impacts.length)impacts[ripples++].set(site.x,y,state.impact,1);
  }
  root.count=count;root.instanceMatrix.needsUpdate=true;
 }};
}
export const roadHeightGLSL=`uniform sampler2D relief;const float WATER_LEVEL=${ROAD_WATER.toFixed(4)};
 float roadHeight(vec2 p){return ${ROAD_LOW.toFixed(3)}+texture2D(relief,vec2(p.x/7.2+.5,p.y/${ROAD_PERIOD.toFixed(1)})).r*${ROAD_RANGE.toFixed(3)};}
 vec3 roadPaint(vec2 p){float tick=1.-step(.24,mod(p.y,3.));float center=(1.-smoothstep(.012,.028,abs(p.x)))*tick;float edge=(1.-smoothstep(.025,.045,abs(abs(p.x)-3.35)))*tick;return vec3(.45,.015,.24)*center+vec3(.015,.33,.45)*edge;}`;
