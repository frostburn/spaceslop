import {ventBankHeight,ventFarEdge,ventAnchors} from './vent-layout';
export type VentTier='near'|'middle'|'deep'|'rim'|'back';
export type VentFormation={cell:number;x:number;y:number;z:number;w:number;h:number;front:boolean;angle:number;tier:VentTier};
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}

// Static world placements, shared by rendering and the depth regression checks.
// All scrolling comes from the camera transform, not independent sprite speeds.
export function createVentFormations(){
 const rng=random(52391),formations:VentFormation[]=[];
 function card(cell:number,x:number,y:number,z:number,w:number,h:number,tier:VentTier,front=false,angle=0){formations.push({cell,x,y,z,w,h,tier,front,angle});}
 for(let y=-12,index=0;y<150;y+=5.2,index++)for(const side of [-1,1]){
  const variant=index+(side>0?1:0),vent=variant%3===1;
  // A V in cross-section: low near shelves stay outboard, middle terraces
  // step inward, and the distant seabed is visible down the central channel.
  const w=5.2+rng()*.9,x=side*(4+w/2+rng()*.35),bankZ=ventBankHeight(x,y)-.55;
  card(variant%2,x,y,bankZ,w,6.2+rng()*.8,'near',false,(rng()-.5)*.15);
  if(vent){const vx=side*(4.55+rng()*.3);card(variant%2?2:3,vx,y+.8,ventBankHeight(vx,y)+.7,4.4+rng()*.3,5.8+rng()*.6,'near');}
  if(y<133){
   const midVent=variant%4>=2;
   card(midVent?variant%4:variant%2,side*(midVent?3.5+rng()*.35:4.5+rng()*.4),y+2,-6.7-rng()*.6,midVent?3.7:5.5,midVent?5.0:8.0,'middle',false,midVent?0:(rng()-.5)*.25);
   card(variant%2,side*(3.6+rng()*.5),y-1.5,-12.5-rng()*.7,4.8+rng()*.6,9+rng()*1.5,'deep',false,(rng()-.5)*.35);
  }
 }
 for(const a of ventAnchors)card(1,a.x,a.y,1.0,2.3,3.3,'near');
 for(let x=-21,index=0;x<=21;x+=4.3,index++){
  const y=ventFarEdge(x)+2.5,z=3.5+rng()*2,cell=4+index%3,w=4.5+rng()*2.7,h=6+rng()*3.8;
  card(cell,x+(rng()-.5)*.8,y,z,w,h,'rim',true);
  card(index%3===0?5:7,x+(rng()-.5)*2,y+6+rng()*3,6+rng()*2,6+rng()*3,10+rng()*6,'back',true);
 }
 return formations;
}
export const ventTierTint={near:[.76,.9,.95],middle:[.32,.49,.55],deep:[.11,.25,.31],rim:[.55,.7,.76],back:[.24,.42,.49]} as const;
