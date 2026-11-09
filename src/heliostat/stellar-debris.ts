import * as T from 'three';
import {HELIOSTAT_PITCH,HELIOSTAT_EMITTER_X} from './combat';

/** Tiny hot shards stay around the damaged lens, far behind the flight plane. */
export function createStellarDebris(){
  const count=40,root=new T.InstancedMesh(new T.TetrahedronGeometry(.06,0),new T.MeshBasicMaterial({
    color:0xffffff,transparent:true,depthWrite:false,blending:T.AdditiveBlending}),count);
  root.name='harmless-stellar-debris';root.frustumCulled=false;
  const dummy=new T.Object3D(),color=new T.Color();
  for(let i=0;i<count;i++){root.setColorAt(i,color.setRGB(0,0,0));dummy.scale.setScalar(.001);dummy.updateMatrix();root.setMatrixAt(i,dummy.matrix);}
  root.visible=false;
  return{root,update(age:number,active:boolean){
    root.visible=active;if(!active)return;
    for(let i=0;i<count;i++){
      const delay=i*.021,elapsed=age-delay,cycle=Math.floor(elapsed/1.7),t=((elapsed%1.7)+1.7)%1.7;
      const visible=elapsed>=0&&t<.78,fade=visible?(1-t/.78)**2:0,a=i*2.399963+cycle*1.71;
      dummy.position.set(HELIOSTAT_EMITTER_X+Math.cos(a)*t*.9,-.8*Math.sin(HELIOSTAT_PITCH)+Math.sin(a)*t*.7,
        .8*Math.cos(HELIOSTAT_PITCH)+.15+t*.6);
      dummy.rotation.set(i+t*3,t*4,a);dummy.scale.set(.4,1.5,.55);dummy.updateMatrix();root.setMatrixAt(i,dummy.matrix);
      root.setColorAt(i,color.setRGB(3.4*fade,1.1*fade,.1*fade));
    }
    root.instanceMatrix.needsUpdate=true;root.instanceColor!.needsUpdate=true;
  },prime(){const visible=root.visible;root.visible=true;return()=>{root.visible=visible;};}};
}
