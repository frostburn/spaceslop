import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ioWeather } from './io-materials';

// Static small construction details collapse to one draw per material, per assembly.
export class IoDetail {
  private batches=new Map<T.Material,T.BufferGeometry[]>();
  private add(g:T.BufferGeometry,m:T.Material){
    if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}
    if(m instanceof T.MeshStandardMaterial&&m.vertexColors)ioWeather(g,31);
    const list=this.batches.get(m)||[];list.push(g);this.batches.set(m,list);
  }
  box(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material,angle=0){
    this.add(new RoundedBoxGeometry(w,h,d,1,Math.min(w,h,d)*.12).rotateZ(angle).translate(x,y,z),m);
  }
  rod(a:number[],b:number[],radius:number,m:T.Material){
    const p=new T.Vector3(...a),q=new T.Vector3(...b),g=new T.CylinderGeometry(radius,radius,p.distanceTo(q),8);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),q.clone().sub(p).normalize()));
    g.translate((p.x+q.x)/2,(p.y+q.y)/2,(p.z+q.z)/2);this.add(g,m);
  }
  pipe(points:number[][],radius:number,m:T.Material){this.add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),32,radius,7),m);}
  bolts(x:number,y:number,z:number,w:number,h:number,m:T.Material){
    for(const sx of [-1,1])for(const sy of [-1,1])this.add(new T.CylinderGeometry(.047,.047,.04,6).rotateX(Math.PI/2).translate(x+sx*w/2,y+sy*h/2,z),m);
  }
  finish(parent:T.Object3D,name:string){
    for(const[m,list]of this.batches){const mesh=new T.Mesh(mergeGeometries(list),m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);list.forEach(g=>g.dispose());}
  }
}
