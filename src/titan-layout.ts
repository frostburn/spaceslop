import {levels} from './levels';
export const TITAN_ROUTE_DURATION=90;
export const TITAN_DURATION=levels.titan.duration;
export const TITAN_ROUTE_END=TITAN_DURATION/TITAN_ROUTE_DURATION;
export const TITAN_SCREENS=10;
export const TITAN_FRAME_HEIGHT=16;
export const TITAN_TRAVEL=(TITAN_SCREENS-1)*TITAN_FRAME_HEIGHT;
export function titanTileY(index:number,progress:number){return (TITAN_SCREENS-1-index)*TITAN_FRAME_HEIGHT-Math.max(0,Math.min(1,progress))*TITAN_TRAVEL;}
export function titanSection(progress:number){return progress<.22?'Outer sampling grounds':progress<.43?'Intake and station approach':progress<.64?'Research compound':progress<.83?'Heat-exchanger breach':'Disrupted research core';}
// Whole-strip reflection continues the edge pixels in both ground directions.
export function titanGroundTile(index:number,column:number,repeat:number,progress:number){
 const flipX=Math.abs(column)%2?-1:1,flipY=Math.abs(repeat)%2?-1:1;
 return{x:column*9,y:72+repeat*160+flipY*((9-index)*16-72)-Math.max(0,Math.min(1,progress))*TITAN_TRAVEL,flipX,flipY};
}
