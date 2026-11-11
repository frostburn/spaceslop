// Flight-plane attack math shared by simulation, rendering and the workshop.
export type FrogPoint={x:number;y:number};
export type FrogState={nextAt:number;attackAt?:number;turnFrom?:number;angle:number;reach:number};
export const FROG_HP=12,FROG_POOL=2,FROG_RADIUS=.68;
const FROG_TURN_TIME = .6;
export const FROG_WINDUP=.8,FROG_EXTEND=.55,FROG_HOLD=.16,FROG_RETRACT=.9;
export const FROG_ATTACK=FROG_WINDUP+FROG_EXTEND+FROG_HOLD+FROG_RETRACT;
export const FROG_BEADS=24,FROG_MOUTH_OFFSET=.58;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export function createFrogState(lane:number):FrogState{return{nextAt:1.1,angle:lane<0?.5:-.5,reach:0};}
export function frogSignal(state:FrogState,age:number){
 const t=state.attackAt===undefined?-1:age-state.attackAt;
 const extension=t<FROG_WINDUP?0:t<FROG_WINDUP+FROG_EXTEND?smooth((t-FROG_WINDUP)/FROG_EXTEND):t<FROG_WINDUP+FROG_EXTEND+FROG_HOLD?1:t<FROG_ATTACK?1-smooth((t-FROG_WINDUP-FROG_EXTEND-FROG_HOLD)/FROG_RETRACT):0;
 return{extension,warning:t>=0&&t<FROG_WINDUP?smooth(t/FROG_WINDUP):0,retracting:t>=FROG_WINDUP+FROG_EXTEND+FROG_HOLD&&t<FROG_ATTACK,active:extension>0};
}
export function frogHeading(state: FrogState, age: number) {
 if (state.attackAt === undefined || state.turnFrom === undefined) return state.angle;
 const progress = smooth((age - state.attackAt) / FROG_TURN_TIME);
 return state.turnFrom + (state.angle - state.turnFrom) * progress;
}
export function stepFrog(state:FrogState,origin:FrogPoint,target:FrogPoint,age:number,visible:boolean){
 if(state.attackAt!==undefined&&age-state.attackAt>=FROG_ATTACK){state.attackAt=undefined;state.turnFrom=undefined;state.nextAt=age+1.35;}
 if(state.attackAt===undefined&&visible&&age>=state.nextAt){
  state.turnFrom = state.angle;
  const targetAngle = Math.atan2(target.x - origin.x, origin.y - target.y);
  const delta = targetAngle - state.angle;
  state.angle += Math.atan2(Math.sin(delta), Math.cos(delta));
  state.reach=Math.max(2,Math.min(6.5,Math.hypot(target.x-origin.x,target.y-origin.y)+.15));
  state.attackAt=age;
 }
}
export function frogMouth(state:FrogState,origin:FrogPoint,age:number,out={x:0,y:0}){
 const heading = frogHeading(state, age);
 out.x=origin.x+FROG_MOUTH_OFFSET*Math.sin(heading);out.y=origin.y-FROG_MOUTH_OFFSET*Math.cos(heading);return out;
}
/** Connected orange bullets trace the same curving tongue during launch and return. */
export function frogTonguePoint(state:FrogState,origin:FrogPoint,age:number,t:number,out={x:0,y:0}){
 const s=frogSignal(state,age),length=state.reach*s.extension,bend=.13*Math.sin(Math.PI*t)*s.extension;
 const heading = frogHeading(state, age);
 const dx=Math.sin(heading),dy=-Math.cos(heading);
 out.x=origin.x+dx*(FROG_MOUTH_OFFSET+length*t)-dy*bend;out.y=origin.y+dy*(FROG_MOUTH_OFFSET+length*t)+dx*bend;return out;
}
const a={x:0,y:0},b={x:0,y:0};
export function frogTongueHits(state:FrogState,origin:FrogPoint,age:number,player:FrogPoint){
 if(!frogSignal(state,age).active)return false;
 frogMouth(state,origin,age,a);
 for(let i=1;i<=FROG_BEADS;i++){
  frogTonguePoint(state,origin,age,i/FROG_BEADS,b);
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d>1e-10?clamp(((player.x-a.x)*dx+(player.y-a.y)*dy)/d):0;
  if(Math.hypot(player.x-a.x-dx*t,player.y-a.y-dy*t)<.32)return true;
  a.x=b.x;a.y=b.y;
 }return false;
}
