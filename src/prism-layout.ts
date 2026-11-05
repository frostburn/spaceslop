import { Vector3 } from 'three';

export const PRISM_DURATION = 24;
export const PRISM_TRAVEL = 32;
export const PRISM_CAMERA_DISTANCE = 32;
export const PRISM_PITCH = Math.atan2(12, 4.2 + 5.3);
export const prismScroll = (time: number) => Math.max(0,time) * PRISM_TRAVEL / PRISM_DURATION;
const hash=(i:number)=>{const n=Math.sin(i*127.1+31.7)*43758.5453;return n-Math.floor(n);};
export const prismSolids = [0,9,18,21].flatMap((y,i)=>[-1,1].map(side=>({x:side*3.95,y:y+(side<0?0:2),radius:.57+i%2*.08})));
export const prismCrystals = Array.from({length:144},(_,i)=>{
  const side=i%2?1:-1,solid=i<prismSolids.length?prismSolids[i]:undefined;
  const y=solid?solid.y:i/144*96-16;
  const root=new Vector3(side*(solid?4.65:4.0+hash(i)*.65),y,solid?-3.2:-3.85-hash(i+6)*.65);
  const direction=new Vector3(-side*(solid?.23:.12+hash(i+1)*.18),solid?0:(hash(i+2)-.5)*1.8,solid?.97:.4+hash(i+5)*.2).normalize();
  return {root,direction,length:solid?5.2:Math.min(3.2+hash(i+3)*3.0,(-.75-root.z)/direction.z),width:solid?1.5: .9+hash(i+4)*1.4,
    variant:i%4,tint:i%3,solid:Boolean(solid),id:(i+1)/255};
});
export function prismCrystalY(index:number,time:number) {
  const recipe=prismCrystals[index],y=recipe.root.y-prismScroll(time);
  return recipe.solid?y:((y+24)%96+96)%96-24;
}
