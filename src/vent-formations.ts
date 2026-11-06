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
  const variant=index+(side>0?1:0),x=side*(4.8+rng()*1.1),vent=variant%3===1,cell=vent?(variant%2?2:3):variant%2;
  card(cell,x,y,ventBankHeight(x,y)+.09,4.5+rng()*1.5,6.5+rng()*2.2,'near',false,(rng()-.5)*.25);
  // Terraces extend inward behind openings in the near bank. The recessed bed
  // stays below them; depth tint and perspective make the tiers distinguishable.
  if(y<133){
   card(variant%4,side*(5.0+rng()*.8),y+1.8+rng()*2,-6.1-rng()*1.5,5.7+rng()*.8,8+rng()*2,'middle',false,(rng()-.5)*.45);
   card(variant%2,side*(5.6+rng()*.9),y-1.5,-12-rng()*1.4,6.6+rng()*1.0,10+rng()*2,'deep',false,(rng()-.5)*.6);
   if(variant%5===0)card(0,side*(2.4+rng()*.7),y+4,-12.8,2.7,4,'deep',false,rng()*.6);
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
