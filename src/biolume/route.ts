import {levels} from '../levels';

export const GROVE_DURATION=levels.biolume.duration,GROVE_APPROACH=6,GROVE_SCREENS=10;
export const GROVE_DISTANCE=22,GROVE_GROUND_Z=-3.6,GROVE_LEAF_Z=2.2;
export const GROVE_POD_POOL=8;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));

// Nine screen-heights of travel show ten complete screens. The final four
// seconds coast to rest without moving or tilting the flight camera.
export function groveScroll(time:number){
  const t=Math.max(0,Math.min(GROVE_DURATION,time)),coast=4,start=GROVE_DURATION-coast;
  const u=Math.max(0,t-start);
  return (GROVE_SCREENS-1)/(GROVE_DURATION-coast/2)*(Math.min(t,start)+u/2+coast/(2*Math.PI)*Math.sin(Math.PI*u/coast));
}
export function groveForegroundScroll(time:number){const p=clamp(groveScroll(time)/9);return 9*p+.14*Math.sin(Math.PI*p);}
export function groveSection(time:number){return ['Lantern Grove','Root Bridges','Blackwater Basin','Lantern Nursery','Dark Crown'][Math.min(4,Math.floor(Math.max(0,time)/20))];}
export function grovePlateHeight(z:number){return 16*(GROVE_DISTANCE-z)/GROVE_DISTANCE;}
export function groveTileY(index:number,time:number,foreground=false){return(index-(foreground?groveForegroundScroll(time):groveScroll(time)))*grovePlateHeight(foreground?GROVE_LEAF_Z:GROVE_GROUND_Z);}
export type GroveSite={at:number;u:number;size:number};
export const grovePods:readonly GroveSite[]=[
  [.28,.13,.78],[.88,.88,.9],[1.48,.11,.85],[1.95,.87,.7],
  [2.35,.14,.8],[2.96,.86,.8],[3.64,.12,.8],[4.28,.9,.65],
  [4.95,.12,.7],[5.72,.88,.75],[6.12,.14,.9],[6.35,.88,.85],
  [6.64,.12,.8],[6.93,.86,1],[7.2,.15,.8],[7.46,.87,.9],
  [7.74,.13,.75],[8.03,.89,.7],[8.7,.12,.65],[9.58,.9,.75],
].map(([at,u,size])=>({at,u,size}));
export const groveLeafLights:readonly GroveSite[]=[
  [0.4,.8],[1.12,.14],[1.7,.82],[2.4,.17],[3.2,.82],[3.7,.14],
  [4.55,.85],[5.5,.14],[6.35,.84],[6.95,.15],[7.65,.84],[8.45,.84],[9.45,.94],
].map(([at,u])=>({at,u,size:1}));
export function groveSitePoint(site:GroveSite,time:number,z=.3){
  const k=(GROVE_DISTANCE-z)/GROVE_DISTANCE;
  return{x:(site.u-.5)*9*k,y:(site.at-.5-groveScroll(time))*16*k,z};
}

// A camera-centered uniform dilation brings the prototype boss above the
// painted floor while preserving every projected point of its canonical rig.
export const GROVE_BOSS_SCALE=22/34;
export function groveBossPoint(reveal:number){return{x:0,y:(4.2+20*(1-clamp(reveal)))*GROVE_BOSS_SCALE,z:0};}
