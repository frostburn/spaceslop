import {ventBankHeight,ventAnchors,ventRimHeight,VENT_CLIFF_Y,VENT_SHAFT_Y,VENT_SHAFT_RADIUS} from './vent-layout';
import {WIDTH} from './playfield';
export type VentTier='near'|'middle'|'deep'|'rim'|'back';
export type VentFormation={cell:number;x:number;y:number;z:number;w:number;h:number;front:boolean;angle:number;tier:VentTier};
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}

// Static world placements, shared by rendering and the depth regression checks.
// All scrolling comes from the camera transform, not independent sprite speeds.
export function createVentFormations(){
 const rng=random(52391),formations:VentFormation[]=[];
 const openingHalfWidth = WIDTH / 2 + 1;
 function card(cell:number,x:number,y:number,z:number,w:number,h:number,tier:VentTier,front=false,angle=0){formations.push({cell,x,y,z,w,h,tier,front,angle});}
 for(let y=-12,index=0;y<150;y+=5.2,index++)for(const side of [-1,1]){
  const variant=index+(side>0?1:0),vent=variant%3===1;
  // A V in cross-section: low near shelves stay outboard, middle terraces
  // step inward, and the distant seabed is visible down the central channel.
  const w=5.2+rng()*.9,x=side*(4+w/2+rng()*.35),bankZ=ventBankHeight(x,y)-.55;
  const section=y<36?0:y<76?1:y<112?2:3;
  const lowCell=variant%3===0?variant%2:section===0?(variant%2?8:9):section===1?9:11;
  card(lowCell,x,y,bankZ,w,6.2+rng()*.8,'near',false,(rng()-.5)*.15);
  if(vent){
   const offset = 4.55 + rng() * .3, width = 4.4 + rng() * .3, height = 5.8 + rng() * .6;
   const x = side * (y > VENT_CLIFF_Y - 10 ? Math.max(offset, openingHalfWidth + width / 2) : offset);
   card(section>=1&&variant%2?10:variant%2?2:3,x,y+.8,ventBankHeight(x,y)+.7,width,height,'near');
  }
  if(y<133){
   const midVent=variant%4>=2;
   card(midVent?variant%4:variant%2,side*(midVent?3.5+rng()*.35:4.5+rng()*.4),y+2,-6.7-rng()*.6,midVent?3.7:5.5,midVent?5.0:8.0,'middle',false,midVent?0:(rng()-.5)*.25);
   card(variant%3===0?variant%2:section===0?8:section===1?9:11,side*(3.6+rng()*.5),y-1.5,-12.5-rng()*.7,4.8+rng()*.6,9+rng()*1.5,'deep',false,(rng()-.5)*.35);
  }
 }
 for(const a of ventAnchors)card(1,a.x,a.y,1.0,2.3,3.3,'near');
 for(let index=0;index<32;index++){
  const angle = index / 32 * Math.PI * 2, r = VENT_SHAFT_RADIUS + .15;
  const x = Math.sin(angle) * r, y = VENT_SHAFT_Y + Math.cos(angle) * r;
  const rimWidth = 4.8 + rng() * 1.6, rimHeight = 7 + rng() * 3;
  // The near lip has a break as wide as the approach corridor. Measure the
  // tangent card's edge so an off-center formation cannot overhang it.
  const cos = Math.cos(angle);
  if (cos >= 0 || Math.abs(x) - rimWidth / 2 * Math.abs(cos) > openingHalfWidth)
   card(index%2?12+index%4:4+index%4,x,y,ventRimHeight(angle)+3.6,rimWidth,rimHeight,'rim',true,-angle);
  for(let row=0;row<3;row++){
   const a=angle+(row%2?.08:0),radius=VENT_SHAFT_RADIUS-.35;
   const depth = -7 - row * 17 - rng() * 9, width = 6 + rng() * 2, height = 14 + row * 3 + rng() * 8;
   const z = Math.min(depth, ventRimHeight(a) - .45 - height / 2);
   card(index%2?12+(index+row)%4:4+(index+row)%4,Math.sin(a)*radius,VENT_SHAFT_Y+Math.cos(a)*radius,z,width,height,'back',true,-a);
  }
 }

 return formations;
}
export const ventTierTint={near:[.76,.9,.95],middle:[.32,.49,.55],deep:[.11,.25,.31],rim:[.55,.7,.76],back:[.24,.42,.49]} as const;
