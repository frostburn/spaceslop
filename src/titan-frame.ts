// All scenery is expressed in one horizontal world, then transformed into the
// camera-aligned combat frame. End pose preserves the shared boss hit geometry.
export const TITAN_PITCH=1.44;
export function titanFrame(rise:number){const p=Math.max(0,Math.min(1,rise));return{pitch:p*TITAN_PITCH,height:p*12};}
export function titanWorld(y:number,z:number,rise:number){const f=titanFrame(rise),h=z-f.height;return{y:y*Math.cos(f.pitch)+h*Math.sin(f.pitch),z:-y*Math.sin(f.pitch)+h*Math.cos(f.pitch)};}
export function titanBossPoint(rise:number){
 const y=4.2*Math.cos(TITAN_PITCH)+12*Math.sin(TITAN_PITCH),endZ=12+4.2*Math.sin(TITAN_PITCH)-12*Math.cos(TITAN_PITCH);
 return titanWorld(y,7+(endZ-7)*Math.max(0,Math.min(1,rise)),rise);
}
