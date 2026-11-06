import * as T from 'three';
import {BOSS_MUZZLE_Z} from './encounters';

// Deliberately simple collision-faithful proxy until the raster crab is rigged.
export function createVentBoss(){
 const root=new T.Group();root.name='prototype-rim-guardian';
 const shell=new T.MeshStandardMaterial({color:0x607f85,roughness:.72,metalness:.25});
 const dark=new T.MeshStandardMaterial({color:0x16333e,roughness:.9});
 const body=new T.Mesh(new T.SphereGeometry(1,20,12),shell);body.scale.set(2.1,1.3,.75);root.add(body);
 const stripe=new T.Mesh(new T.BoxGeometry(2.8,.22,.2),dark);stripe.position.set(0,.3,.72);root.add(stripe);
 const cannons=[-1,1].map(side=>{
  const arm=new T.Mesh(new T.BoxGeometry(1.65,.62,.55),shell);arm.position.set(side*1.7,-.15,.15);root.add(arm);
  const barrel=new T.Mesh(new T.CylinderGeometry(.43,.49,.65,12).rotateX(Math.PI/2),dark);barrel.position.set(side*2.4,0,BOSS_MUZZLE_Z-.32);root.add(barrel);
  const glow=new T.Mesh(new T.CircleGeometry(.28,14),new T.MeshBasicMaterial({color:0x61ffbd}));glow.position.set(side*2.4,0,BOSS_MUZZLE_Z+.015);root.add(glow);
  const anchor=new T.Object3D();anchor.name=side<0?'laser_contact_L':'laser_contact_R';glow.add(anchor);
  return{side,glow,barrel};
 });
 return{root,pose(_reveal:number,windup:number,cannonX:number,firedX:number,recoil:number){
  for(const c of cannons){const active=Math.sign(cannonX)===c.side;(c.glow.material as T.MeshBasicMaterial).color.setHex(active?0x61ffbd:0x1b544d);c.glow.scale.setScalar(active?1+windup*.2:1);c.barrel.position.z=BOSS_MUZZLE_Z-.32-(Math.sign(firedX)===c.side?recoil*.08:0);}
 }};
}
