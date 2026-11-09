import * as T from 'three';
import {block,type BoulevardPart} from './boulevard-geometry';
import type {FacadePart} from './boulevard-facades';
export type VenueBatches={solid:BoulevardPart[];metal:BoulevardPart[];pink:BoulevardPart[];cyan:BoulevardPart[];warm:BoulevardPart[];round:BoulevardPart[];marquee:BoulevardPart[];water:BoulevardPart[];facades:FacadePart[]};
export function addBoulevardVenue(b:VenueBatches,index:number,lot:number,side:number,x:number,y:number,w:number,depth:number,h:number,deck:number){
 const kind=(index+lot+(side>0?1:0))%3,z=deck+h/2,front=y-depth/2,street=x-side*w/2;
 b.solid.push(block(x,y,z,w,depth,h,kind===0?0x6b536c:kind===1?0x3b2e49:0x44475c));
 b.facades.push({...block(x,front-.045,z,w*.94,h*.88,1),cell:kind===0?0:kind===1?1:2});
 b.facades.push({...block(street-side*.045,y,z,depth*.94,h*.88,1),cell:kind===0?3:kind,side});
 // Recessed entrance and load-bearing jambs, set inside the ground-level frontage.
 const doorX=x-side*w*.17;
 b.metal.push(block(doorX-w*.17,front-.12,deck+.52,.07,.22,1.0));b.metal.push(block(doorX+w*.17,front-.12,deck+.52,.07,.22,1.0));
 b.warm.push(block(doorX,front-.19,deck+.91,w*.33,.16,.035));
 if(kind===0){
  // A stepped hotel with setback roof terraces and continuous neon balcony lips.
  for(let tier=0;tier<2;tier++){
   const tw=w*(.78-tier*.13),td=depth*(.72-tier*.14),tz=deck+h+.08+tier*.20;
   b.solid.push(block(x+side*.12,y+.16,tz,tw,td,.14,0x75556c));b.pink.push(block(x+side*.12,y+.16-td/2,tz+.08,tw,.03,.025));
  }
  b.round.push(block(street+side*.3,y-depth*.3,deck+h*.43,.38,.38,h*.86,0x66516f));
 }else if(kind===1){
  // Fan-shaped club marquee faces the camera, with nested chrome/neon arches.
  b.marquee.push({...block(x,front-.16,deck+h*.63,w*.30,1,h*.30,0xffffff),rx:Math.PI/2});
  b.pink.push(block(x,front-.25,deck+h*.27,w*.84,.40,.08));
  b.cyan.push(block(x,front-.32,deck+h*.30,w*.81,.045,.035));
  for(let k=-2;k<=2;k++)b.metal.push(block(x+k*w*.12,front-.09,deck+h*.76,.055,.10,h*.63));
 }else{
  // Glass atrium with a rounded street corner, a shade canopy and rooftop pool.
  b.round.push(block(street+side*.43,y,deck+h*.48,.58,.58,h*.96,0x536e7b));
  b.metal.push(block(street-side*.12,y,deck+h*.83,.8,depth*.72,.09));
  b.cyan.push(block(street-side*.51,y,deck+h*.85,.035,depth*.74,.035));
  b.solid.push(block(x,y+.25,deck+h+.05,w*.67,depth*.55,.11,0x092e46));
  b.water.push(block(x,y+.25,deck+h+.115,w*.64,depth*.52,1));
  for(const end of[-1,1]){
   b.cyan.push(block(x,y+.25+end*depth*.275,deck+h+.13,w*.68,.025,.02));
   b.metal.push(block(x+end*w*.34,y+.25,deck+h+.13,.035,depth*.56,.04));
  }
 }
 // Hotel roof rails keep the terraces legible from overhead.
 if(kind===0)for(const end of[-1,1]){
  b.metal.push(block(x+side*.12,y+.16+end*depth*.29,deck+h+.56,w*.65,.025,.025));
  for(const edge of[-1,1])b.metal.push(block(x+side*.12+edge*w*.31,y+.16+end*depth*.29,deck+h+.46,.025,.025,.2));
 }
 if(kind===1)for(let slat=0;slat<7;slat++)b.metal.push(block(x-w*.33+slat*w*.11,y+.3,deck+h+.055,w*.045,depth*.65,.10));
 // Roof lounge furniture varies between lots rather than forming a grid.
 for(let seat=0;seat<(kind===1?2:3);seat++){
  const sx=x-w*.23+seat*w*.22,sy=y+(kind===2?-depth*.36:seat%2?.25:-.12),raise=kind===0?.28:0;
  b.metal.push(block(sx,sy,deck+h+.24+raise,.24,.34,.07));b.warm.push(block(sx,sy-.25,deck+h+.16+raise,.13,.13,.07));
 }
}
export function venueMarqueeGeometry(){
 const shapes:T.Shape[]=[];
 for(let i=0;i<4;i++){
  const r=1-i*.16,shape=new T.Shape();
  shape.absarc(0,0,r,0,Math.PI,false);shape.lineTo(-r+.045,0);shape.absarc(0,0,r-.045,Math.PI,0,true);shape.closePath();shapes.push(shape);
 }
 return new T.ExtrudeGeometry(shapes,{depth:.06,bevelEnabled:true,bevelSegments:1,bevelSize:.012,bevelThickness:.01,curveSegments:20});
}
