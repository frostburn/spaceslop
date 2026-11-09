import * as T from 'three';
import {vectorGeometry,type VectorPoint,type VectorPath} from './boulevard-vectors';
export function createBoulevardMountains(wire:T.ShaderMaterial){
 const columns=32,rows=6,height=(x:number)=>1.4+.8*Math.sin(x*.29)+.9*Math.sin(x*.73+2)+.4*Math.sin(x*1.43)+Math.max(0,Math.abs(x)-8)*.20;
 const crest:VectorPoint[]=Array.from({length:columns+1},(_,i)=>{const x=-35+i*70/columns;return[x,0,height(x)];});
 const p:number[]=[],indices:number[]=[];
 for(const[x,y,z]of crest)p.push(x,y+.04,z,x,y+.04,-100);
 for(let i=0;i<crest.length-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3);}
 // The visible relief is fully triangulated. Jittered interior vertices avoid
 // a rectangular grid; the hidden sky curtain never acquires giant diagonals.
 const paths:VectorPath[]=[{points:crest,weight:1.15}],offset=p.length/3,stride=columns+1,edges=new Set<string>();
 for(let row=0;row<=rows;row++){
  const t=row/rows;for(let col=0;col<=columns;col++){
   const edge=col===0||col===columns||row===0||row===rows,x=crest[col][0]+(edge?0:.48*Math.sin(col*17.3+row*23.7)),y=-14*(1-t)+Math.sin(col*2.1+row)*.25*Math.sin(t*Math.PI),z=height(x)*t*t-12*(1-t)+Math.sin(x*.41+row*.17)*Math.sin(t*Math.PI)*.6;p.push(x,y+.04,z);
  }
 }
 const point=(i:number):VectorPoint=>[p[i*3],p[i*3+1]-.04,p[i*3+2]],triangle=(a:number,b:number,c:number)=>{indices.push(a,b,c);for(const[i,j]of[[a,b],[b,c],[c,a]]){const key=Math.min(i,j)+':'+Math.max(i,j);if(edges.has(key))continue;edges.add(key);if(i>=offset+rows*stride&&j>=offset+rows*stride)continue;paths.push({points:[point(i),point(j)],weight:.46});}};
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const a=offset+row*stride+col;if((row+col)%2){triangle(a,a+1,a+stride+1);triangle(a,a+stride+1,a+stride);}else{triangle(a,a+1,a+stride);triangle(a+1,a+stride+1,a+stride);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();
 const material=new T.MeshBasicMaterial({color:0x10091d,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
 const body=new T.Mesh(g,material);body.name='boulevard-mountain-relief';
 // The line and the opaque curtain share every crest vertex: no exposed sky
 // beneath a ridge and no floating wire contour above the actual silhouette.
 const lattice=wire.clone(),viewport=new T.Vector4();lattice.name='boulevard-mountain-lattice';lattice.uniforms.tint.value.set(0xd081ff);lattice.onBeforeRender=renderer=>{renderer.getCurrentViewport(viewport);lattice.uniforms.resolution.value.set(Math.max(1,viewport.z),Math.max(1,viewport.w));lattice.uniformsNeedUpdate=true;};
 const root=new T.Mesh(vectorGeometry(paths),lattice);root.name='boulevard-distant-mountains';root.scale.setScalar(2.2);root.add(body);
 return{root,body,crest};
}
