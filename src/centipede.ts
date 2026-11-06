export const CENTIPEDE_SPACING=.72;
export const CENTIPEDE_POOL=32;
export type CentipedePart={x:number;y:number;hp:number;heading?:number;centipede?:CentipedeLink};
export type CentipedeChain={parts:CentipedePart[];age:number;lane:number;escape:number};
export type CentipedeLink={chain:CentipedeChain;slot:number;originalHead:boolean};

export function bindCentipede(parts:CentipedePart[],escape=0){
 const chain:CentipedeChain={parts,age:0,lane:parts[0]?.x??0,escape};
 parts.forEach((part,slot)=>{const originalHead=part.centipede?.originalHead??slot===0;part.centipede={chain,slot,originalHead};});
 return chain;
}

// Rebind the surviving objects in place: existing laser locks, pierced sets and
// damage feedback keep their identity, and nothing teleports when a link breaks.
export function severCentipede(part:CentipedePart){
 const chain=part.centipede?.chain;if(!chain)return;
 const index=chain.parts.indexOf(part);if(index<0)return;
 const front=chain.parts.slice(0,index).filter(p=>p.hp>0),rear=chain.parts.slice(index+1).filter(p=>p.hp>0);
 chain.parts=[];
 if(front.length)bindCentipede(front,-1);
 if(rear.length)bindCentipede(rear,1);
}

const turn=(angle:number,target:number,max:number)=>angle+Math.max(-max,Math.min(max,Math.atan2(Math.sin(target-angle),Math.cos(target-angle))));
export function stepCentipedes(parts:CentipedePart[],dt:number){
 const chains=new Set(parts.filter(p=>p.hp>0&&p.centipede).map(p=>p.centipede!.chain));
 for(const chain of chains){
  const head=chain.parts[0];if(!head||head.hp<=0)continue;
  chain.age+=dt;
  if(chain.escape){
   const target=Math.atan2(chain.escape*3.8,-.75);
   head.heading=turn(head.heading??Math.PI,target,5.5*dt);
   const speed=2.2+Math.min(1,chain.age/.35)*1.7;
   head.x+=Math.sin(head.heading)*speed*dt;head.y+=Math.cos(head.heading)*speed*dt;
  }else{
   const x=chain.lane+Math.sin(chain.age*1.6)*.55,dx=x-head.x;
   head.x=x;head.y-=2.15*dt;head.heading=Math.atan2(dx,-2.15*dt);
  }
  for(let i=1;i<chain.parts.length;i++){
   const leader=chain.parts[i-1],part=chain.parts[i],dx=leader.x-part.x,dy=leader.y-part.y,d=Math.hypot(dx,dy);
   if(d<1e-6)continue;
   const move=Math.max(-8*dt,Math.min(8*dt,d-CENTIPEDE_SPACING));
   part.x+=dx/d*move;part.y+=dy/d*move;part.heading=Math.atan2(dx,dy);
  }
 }
}
