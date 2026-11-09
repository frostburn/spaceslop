import * as T from 'three';
export type VectorPoint=readonly[number,number,number];
export type VectorPath={points:readonly VectorPoint[];weight?:number};
// Each deliberately drawn stroke becomes a rounded screen-space ribbon. No mesh edges are inferred.
export function vectorGeometry(paths:readonly VectorPath[]){
 const positions:number[]=[],others:number[]=[],edges:number[]=[],weights:number[]=[],indices:number[]=[];
 for(const path of paths)for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i];if(Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])<1e-5)continue;
  const at=positions.length/3;positions.push(...a,...a,...b,...b);others.push(...b,...b,...a,...a);edges.push(-1,-1,1,-1,-1,1,1,1);weights.push(...Array(4).fill(path.weight??1));indices.push(at,at+1,at+2,at+2,at+1,at+3);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('otherPosition',new T.Float32BufferAttribute(others,3));g.setAttribute('strokeEdge',new T.Float32BufferAttribute(edges,2));g.setAttribute('strokeWeight',new T.Float32BufferAttribute(weights,1));g.setIndex(indices);g.computeBoundingSphere();return g;
}
export function vectorMaterial(){
 const viewport=new T.Vector4(),material=new T.ShaderMaterial({name:'boulevard-vector-strokes',transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,blending:T.AdditiveBlending,toneMapped:false,
  uniforms:{tint:{value:new T.Color(0x9be5ff)},resolution:{value:new T.Vector2(384,768)}},
  vertexShader:`attribute vec3 otherPosition;attribute vec2 strokeEdge;attribute float strokeWeight;
  uniform vec2 resolution;uniform vec3 tint;varying vec2 vStroke;varying float vHalf,vWeight;varying vec3 vTint;
  void main(){vec4 p=vec4(position,1.),q=vec4(otherPosition,1.);vTint=tint;
  #ifdef USE_INSTANCING
  p=instanceMatrix*p;q=instanceMatrix*q;
  #endif
  #ifdef USE_INSTANCING_COLOR
  vTint*=instanceColor;
  #endif
  vec4 a=projectionMatrix*modelViewMatrix*p,b=projectionMatrix*modelViewMatrix*q;
  vec2 delta=(b.xy/max(b.w,.01)-a.xy/max(a.w,.01))*resolution*.5;float len=max(length(delta),.001);
  vec2 direction=delta/len*(-strokeEdge.y),normal=vec2(-direction.y,direction.x);float radius=3.2;
  a.xy+=(normal*strokeEdge.x+direction*strokeEdge.y)*radius*2./resolution*a.w;
  vStroke=vec2(strokeEdge.x*radius,strokeEdge.y*(len*.5+radius));vHalf=len*.5;vWeight=strokeWeight;gl_Position=a;}`,
  fragmentShader:`varying vec2 vStroke;varying float vHalf,vWeight;varying vec3 vTint;
  void main(){float d=length(vec2(vStroke.x,max(abs(vStroke.y)-vHalf,0.)));float aa=max(fwidth(d),.5);
  float core=1.-smoothstep(.35,.35+aa,d),halo=exp(-d*d*.65)*.20;
  gl_FragColor=vec4(vTint*(core*1.28+halo),min(1.,(core+halo)*vWeight));
  #include <colorspace_fragment>
  }`});
 material.onBeforeRender=renderer=>{renderer.getCurrentViewport(viewport);material.uniforms.resolution.value.set(Math.max(1,viewport.z),Math.max(1,viewport.w));material.uniformsNeedUpdate=true;};
 return material;
}
export function buildingVectors(taper=1){
 const ring=(z:number,s:number):VectorPoint[]=>[[-s,-s,z],[s,-s,z],[s,s,z],[-s,s,z],[-s,-s,z]];
 const bottom=ring(-.5,.5),top=ring(.5,.5*taper),paths:VectorPath[]=[{points:bottom,weight:.5},{points:top}];
 for(let i=0;i<4;i++)paths.push({points:[bottom[i],top[i]]});
 // A low balcony and one sweeping facade chevron describe the architecture, not its triangles.
 const s=.5*(.6+.4*taper);paths.push({points:[[-s,-s,.1],[s,-s,.1],[s,s,.1]],weight:.45});
 paths.push({points:[[-.5,-.503,-.45],[0,-s-.005,-.12],[taper*.5,-taper*.5-.005,.45]],weight:.6});return vectorGeometry(paths);
}
export function palmVectors(){
 const paths:VectorPath[]=[];
 for(let n=0;n<7;n++){
  const angle=n*Math.PI*2/7+.08*Math.sin(n*9),point=(t:number,side=0):VectorPoint=>{
   const x=side*.30*Math.sin(Math.PI*t),y=t*1.9,z=Math.sin(t*Math.PI)*.34-t*t*.46;
   return[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),z];
  };
  const steps=[0,.2,.42,.66,.85,1];paths.push({points:steps.map(t=>point(t))});
  paths.push({points:[...steps.map(t=>point(t,-1)),...steps.slice().reverse().map(t=>point(t,1))],weight:.7});
  for(const t of[.34,.64])for(const side of[-1,1])paths.push({points:[point(t),point(t+.12,side)],weight:.4});
 }
 return vectorGeometry(paths);
}
export function trunkVectors(){
 const paths:VectorPath[]=[];
 for(const side of[-1,1])paths.push({points:[0,.25,.55,.8,1].map(z=>[side*(.72+.03*Math.sin(z*Math.PI)),-.75,z] as VectorPoint),weight:.6});
 for(const z of[.22,.48,.74])paths.push({points:[[-.72,-.75,z],[0,-1.05,z+.02],[.72,-.75,z]],weight:.35});
 return vectorGeometry(paths);
}
export function hovercarVectors(){
 const outline:readonly[number,number][]=[[-.42,.75],[.42,.75],[.64,-.25],[.42,-.8],[-.42,-.8],[-.64,-.25],[-.42,.75]],paths:VectorPath[]=[];
 for(const z of[-.075,.18])paths.push({points:outline.map(([x,y])=>[x,y,z]),weight:z<0?.55:1});
 for(const i of[0,1,2,4,5]){const[x,y]=outline[i];paths.push({points:[[x,y,-.075],[x,y,.18]],weight:.7});}
 paths.push({points:[[-.27,.36,.31],[.27,.36,.31],[.33,-.13,.29],[-.33,-.13,.29],[-.27,.36,.31]],weight:.65});
 paths.push({points:[[0,-.78,.18],[0,-.40,.22]],weight:.6});return vectorGeometry(paths);
}
export function cruiserWingVectors(side:number){
 const outline:readonly[number,number][]=[[0,-.8],[side*1.7,-1.5],[side*2.5,.7],[side*1.9,1.8],[0,1.0],[0,-.8]],paths:VectorPath[]=[];
 for(const z of[-.22,.39])paths.push({points:outline.map(([x,y])=>[x,y,z]),weight:z<0?.55:1});
 for(const[x,y]of outline.slice(0,5))paths.push({points:[[x,y,-.22],[x,y,.39]],weight:.5});
 paths.push({points:[[0,-.8,.40],[side*.85,-.28,.48],[side*1.9,1.8,.40]],weight:.85});
 paths.push({points:[[side*1.7,-1.5,.40],[side*1.2,.2,.48],[side*2.5,.7,.40]],weight:.85});return vectorGeometry(paths);
}
export function horizonVectors(surface:T.BufferGeometry){
 const p=surface.getAttribute('position'),paths:VectorPath[]=[],point=(i:number):VectorPoint=>[p.getX(i),p.getY(i),p.getZ(i)];
 for(const row of[0,2,4,7])paths.push({points:Array.from({length:21},(_,i)=>point(row*21+i)),weight:row===0?1:.45});
 for(const col of[0,4,8,12,16,20])paths.push({points:Array.from({length:8},(_,i)=>point(i*21+col)),weight:.55});
 return vectorGeometry(paths);
}
