import { Vector3 } from 'three';

export const PRISM_DURATION = 24;
export const PRISM_TRAVEL = 32;
export const PRISM_CAMERA_DISTANCE = 32;
export const PRISM_PITCH = Math.atan2(12, 4.2 + 5.3);
export const prismScroll = (time: number) => Math.max(0,time) * PRISM_TRAVEL / PRISM_DURATION;
const hash=(i:number)=>{const n=Math.sin(i*127.1+31.7)*43758.5453;return n-Math.floor(n);};
export const prismSolids = [0,9,18,21].flatMap((y,i)=>[-1,1].map(side=>({x:side*3.95,y:y+(side<0?0:2),radius:.57+i%2*.08})));
export const prismCrystals = Array.from({length:72},(_,i)=>{
  const side=i%2?1:-1,solid=i<prismSolids.length?prismSolids[i]:undefined;
  const y=solid?solid.y:i/72*96-16;
  const root=new Vector3(side*((solid?5.1:4.5)+hash(i)*.65),y,solid?-2.1:-4.1-hash(i+6)*1.7);
  const direction=new Vector3(-side*(solid?.40:.35+hash(i+1)*.25),solid?0:.16+hash(i+2)*.35,.7).normalize();
  return {root,direction,length:solid?3.05:Math.min(3.2+hash(i+3)*2.5,(-.75-root.z)/direction.z),width:1.2+hash(i+4)*1.25,
    variant:i%4,tint:i%3,solid:Boolean(solid),id:(i+1)/255};
});
export function prismCrystalY(index:number,time:number) {
  const recipe=prismCrystals[index],y=recipe.root.y-prismScroll(time);
  return recipe.solid?y:((y+24)%96+96)%96-24;
}
