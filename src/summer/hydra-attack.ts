import {BOSS_VOLLEY_INTERVAL,BOSS_WINDUP_AT,BOSS_FIRE_AT,BOSS_MUZZLE_Z} from '../encounters';
import {HYDRA_SIDES,HYDRA_BOSS_SIZE,hydraAlive,hydraBossHead,type HydraSide,type HydraState} from './hydra-targets';
type Point={x:number;y:number};
export function createHydraAttack(){return{volley:0,heads:[] as HydraSide[],markers:[] as Point[],shots:[] as (Point&{z:number;vx:number;vy:number;vz:number})[],fired:false};}
export function stepHydraAttack(attack:ReturnType<typeof createHydraAttack>,time:number,player:Point,state:HydraState,depth:number,travel:number){
  attack.shots.length=0;attack.fired=false;
  const elapsed=time%BOSS_VOLLEY_INTERVAL,volley=Math.floor(time/BOSS_VOLLEY_INTERVAL),clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
  if(elapsed>=BOSS_WINDUP_AT&&elapsed<BOSS_FIRE_AT&&attack.volley===volley&&!attack.markers.length){
    attack.heads=HYDRA_SIDES.filter(side=>hydraAlive(state,side));
    attack.markers=attack.heads.map((side,i)=>{
      const offset=attack.heads.length===3?side*1.35:i===volley%attack.heads.length?0:(i%2?1.35:-1.35);
      return{x:clamp(player.x,-2.6,2.6)+(volley%2===0?offset:0),y:clamp(player.y,-5.9,5.25)+(volley%2?offset:0)};
    });
  }
  if(elapsed>=BOSS_FIRE_AT&&attack.volley===volley){
    const z=depth+BOSS_MUZZLE_Z;attack.fired=true;
    attack.heads.forEach((side,i)=>{if(!hydraAlive(state,side))return;const target=attack.markers[i],head=hydraBossHead(time,side),y=head.y-.6*HYDRA_BOSS_SIZE;
      if(target)attack.shots.push({x:head.x,y,z,vx:(target.x-head.x)/travel,vy:(target.y-y)/travel,vz:-z/travel});});
    attack.volley++;
  }
  if(elapsed>=BOSS_FIRE_AT+travel+.02){attack.markers=[];attack.heads=[];}
}
