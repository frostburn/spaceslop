import * as T from 'three';
import {block,type BoulevardPart} from './boulevard-geometry';
export type VenueBatches={solid:BoulevardPart[];metal:BoulevardPart[];pink:BoulevardPart[];cyan:BoulevardPart[];warm:BoulevardPart[];round:BoulevardPart[];marquee:BoulevardPart[];water:BoulevardPart[];windows:BoulevardPart[];rooms:BoulevardPart[];columns:BoulevardPart[]};
export function addBoulevardVenue(b:VenueBatches,index:number,lot:number,side:number,x:number,y:number,w:number,depth:number,h:number,deck:number){
 const kind=(index+lot+(side>0?1:0))%3,front=y-depth/2,street=x-side*w/2;
 const floors=Math.max(2,Math.round(h/.95)),rise=h/floors,stone=kind===0?0x8e7486:kind===1?0x514365:0x69808a;
 // Open L-shaped room shells. Slabs, columns, glass and furniture occupy different depths.
 b.solid.push(block(x,y+depth/2-.13,deck+h/2,w,.26,h,stone));
 b.solid.push(block(x+side*(w/2-.13),y,deck+h/2,.26,depth,h,stone));
 b.solid.push(block(x+side*w*.18,y+depth*.16,deck+h/2,w*.28,depth*.32,h,0x3e354e));
 for(let floor=0;floor<=floors;floor++){
  const z=deck+floor*rise,inset=kind===0&&floor===floors?.22:0;
  b.solid.push(block(x+side*inset/2,y+inset/2,z,w-inset,depth-inset,.12,stone));
  if(floor===floors)continue;
  const mid=z+rise*.5;
  for(let bay=0;bay<3;bay++){
   const bx=x-w/2+(bay+.5)*w/3,by=front+(bay+.5)*depth/3;
   b.solid.push(block(bx-w/6+.045,front+.05,mid,.09,.24,rise,stone));
   b.solid.push(block(street+side*.07,by-depth/6+.045,mid,.24,.09,rise,stone));
   b.windows.push(block(bx,front+.18,mid,w/3-.13,.035,rise-.18));
   b.windows.push(block(street+side*.22,by,mid,.035,depth/3-.13,rise-.18));
   b.rooms.push(block(bx,front+.77,mid,w/3-.17,.10,rise-.17,0x8f796c));
   b.rooms.push(block(street+side*.79,by,mid,.10,depth/3-.16,rise-.17,0x5c7284));
   if((bay+floor+index)%3!==0){
    b.warm.push(block(bx,front+.48,z+rise*.72,.13,.13,.08));
    b.metal.push(block(bx,front+.51,z+.23,.32,.25,.08));
    b.warm.push(block(street+side*.48,by,z+rise*.69,.11,.11,.07));
   }
  }
  if(kind===0&&floor>0){
   b.solid.push(block(street-side*.22,y,z,.56,depth+.18,.10,stone));
   b.metal.push(block(street-side*.48,y,z+.33,.035,depth+.10,.035));
   b.pink.push(block(street-side*.50,y,z+.02,.025,depth+.18,.025));
   for(let rail=0;rail<5;rail++)b.metal.push(block(street-side*.48,front+rail*depth/4,z+.19,.025,.025,.29));
  }
 }
 if(kind===0){
  b.round.push(block(street+side*.30,front+.42,deck+h*.40,.47,.47,h*.80,0x52667d));
  b.solid.push(block(x+side*.22,y+.20,deck+h+.15,w*.68,depth*.65,.24,stone));
  b.pink.push(block(x+side*.22,y+.20-depth*.325,deck+h+.28,w*.68,.035,.025));
 }else if(kind===1){
  b.marquee.push({...block(x,front-.22,deck+h*.67,w*.31,1,h*.31),rx:Math.PI/2});
  b.solid.push(block(x,front-.38,deck+.80,w*.92,.88,.12,stone));
  b.pink.push(block(x,front-.82,deck+.85,w*.94,.05,.035));
  for(const end of[-1,1])b.columns.push(block(x+end*w*.38,front-.62,deck+.4,.075,.075,.8));
  for(let slat=0;slat<5;slat++)b.metal.push(block(x-w*.32+slat*w*.16,y+.25,deck+h+.13,w*.055,depth*.64,.18));
 }else{
  b.round.push(block(street+side*.44,y,deck+h*.42,.59,.59,h*.84,0x52798a));
  b.metal.push(block(street-side*.12,y,deck+h*.83,.8,depth*.72,.09));
  b.cyan.push(block(street-side*.51,y,deck+h*.85,.035,depth*.74,.035));
  for(const end of[-1,1])b.windows.push({...block(x+end*w*.16,y-depth*.22,deck+h+.27,w*.36,depth*.35,.045),ry:end*.40});
  b.solid.push(block(x,y+depth*.23,deck+h+.07,w*.67,depth*.40,.12,0x123b48));
  b.water.push(block(x,y+depth*.23,deck+h+.135,w*.63,depth*.36,1));
  for(const end of[-1,1])b.cyan.push(block(x,y+depth*.23+end*depth*.20,deck+h+.14,w*.68,.025,.02));
 }
 for(let seat=0;seat<2;seat++){
  const sx=x-w*.2+seat*w*.34,sy=y+(kind===2?-depth*.10:.12);
  b.metal.push(block(sx,sy,deck+h+.26,.25,.36,.08));
  b.warm.push(block(sx,sy-.28,deck+h+.20,.12,.12,.06));
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
