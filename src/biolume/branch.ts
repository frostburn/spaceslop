import * as T from 'three';
import {preserveCycadFrond} from '../preserve-botany';
import {groveForegroundScroll} from './route';
export const BRANCH_CROP=[118/627,2/627,207/627,323/627]as const;
export const FERN_SITES=[[.3764,.2],[.6124,.48],[.3427,.78]]as const;
export function createGroveBranch(){
 const root=new T.Group();root.name='grove-overhead-branch';root.rotation.z=-1.17;
 const height=7.7,width=height*89/321,g=new T.PlaneGeometry(width,height);
 const material=new T.MeshStandardMaterial({roughness:1,side:T.DoubleSide,alphaTest:.4});
 const card=new T.Mesh(g,material);card.visible=false;root.add(card);
 const fallback=new T.Mesh(new T.CylinderGeometry(.10,.18,height,7),new T.MeshStandardMaterial({color:0x494635,roughness:1}));root.add(fallback);
 const frond=preserveCycadFrond(),green=new T.MeshStandardMaterial({color:0x427c46,emissive:0x102912,roughness:1,side:T.DoubleSide,vertexColors:true});
 const crowns=FERN_SITES.map(([u,v],i)=>{const crown=new T.Group();crown.position.set((u-.5)*width,(.5-v)*height,.08);root.add(crown);
  for(let j=0;j<8;j++){const m=new T.Mesh(frond,green);m.rotation.z=j*Math.PI/4+.14*i;m.scale.setScalar(.8+.25*Math.sin(j*7+i));crown.add(m);}return crown;});
 return{root,crowns,setArt(t:T.Texture){material.map=t;material.needsUpdate=true;card.visible=true;fallback.visible=false;const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,BRANCH_CROP[0]+uv.getX(i)*(BRANCH_CROP[2]-BRANCH_CROP[0]),1-BRANCH_CROP[3]+uv.getY(i)*(BRANCH_CROP[3]-BRANCH_CROP[1]));uv.needsUpdate=true;},
 update(stage:number,time:number){root.position.set(0,(1.65-.5-groveForegroundScroll(stage))*16*(22-2.55)/22,2.55);root.visible=Math.abs(root.position.y)<13;crowns.forEach((c,i)=>c.rotation.z=.025*Math.sin(time*.65+i));},
 release(){material.map=null;}};
}
