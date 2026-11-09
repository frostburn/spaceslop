import * as T from 'three';
// Chamfered cross sections form a closed, angular pressure hull. Native forward is -Y.
export function cruiserHull(){
 const sections=[[-1.75,1.28,-.19,.55],[-.80,2.40,-.43,.98],[.45,3.0,-.48,1.15],[1.35,2.62,-.32,.96]],positions:number[]=[],uv:number[]=[],indices:number[]=[];
 for(const[y,w,bottom,top]of sections)for(const[x,z]of[[-w*.82,bottom],[-w,bottom+.22],[-w*.90,top-.22],[-w*.52,top],[w*.52,top],[w*.90,top-.22],[w,bottom+.22],[w*.82,bottom]])positions.push(x,y,z);
 for(let row=0;row<sections.length;row++)for(let k=0;k<8;k++)uv.push(k/7,row/(sections.length-1));
 for(let row=0;row<sections.length-1;row++)for(let k=0;k<8;k++){
  const a=row*8+k,b=a+8,c=row*8+(k+1)%8,d=c+8;indices.push(a,c,b,b,c,d);
 }
 for(let k=1;k<7;k++){indices.push(0,k+1,k);const a=(sections.length-1)*8;indices.push(a,a+k,a+k+1);}
 const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(positions,3));source.setAttribute('uv',new T.Float32BufferAttribute(uv,2));source.setIndex(indices);const geometry=source.toNonIndexed();source.dispose();geometry.computeVertexNormals();return geometry;
}
export function cruiserCanopy(){
 const p=[-1.62,-.83,1.00,1.62,-.83,1.00,-1.40,.88,1.88,1.40,.88,1.88,-1.62,.88,1.14,1.62,.88,1.14];
 const source=new T.BufferGeometry();source.setAttribute('position',new T.Float32BufferAttribute(p,3));source.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,.07,1,.93,1,0,1,1,1],2));source.setIndex([0,1,2,1,3,2,0,2,4,1,5,3,2,3,4,3,5,4]);const geometry=source.toNonIndexed();source.dispose();geometry.computeVertexNormals();return geometry;
}
export function cruiserStrut(a:T.Vector3,b:T.Vector3,width=.055){
 const geometry=new T.CylinderGeometry(width,width,a.distanceTo(b),8);geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));geometry.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);return geometry;
}
