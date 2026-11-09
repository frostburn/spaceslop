import * as T from 'three';
export type Crop=readonly [number,number,number,number];
export function atlasGeometries(columns:number,rows:number,crops:readonly Crop[]){
  return crops.map(([l,t,r,b],i)=>{const g=new T.PlaneGeometry(1,1),uv=g.attributes.uv;for(let n=0;n<uv.count;n++)uv.setXY(n,(i%columns+l+uv.getX(n)*(r-l))/columns,1-(Math.floor(i/columns)+b-uv.getY(n)*(b-t))/rows);return g;});
}
export function createRasterMaterial(){return new T.MeshBasicMaterial({alphaTest:.25,side:T.DoubleSide});}
// Whole-sheet UV bounds also support sheets whose painted rows have unequal margins.
export function atlasRectangles(rectangles:readonly Crop[]){
  return rectangles.map(([l,t,r,b])=>{const g=new T.PlaneGeometry(1,1),uv=g.attributes.uv;for(let n=0;n<uv.count;n++)uv.setXY(n,l+uv.getX(n)*(r-l),1-b+uv.getY(n)*(b-t));return g;});
}
export function rasterPart(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,w:number,h:number,x=0,y=0,z=0){const part=new T.Mesh(g,m);part.scale.set(w,h,1);part.position.set(x,y,z);parent.add(part);return part;}
