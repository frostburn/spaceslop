export const TITAN_DURATION=90;
export const TITAN_SCREENS=10;
export const TITAN_FRAME_HEIGHT=16;
export const TITAN_TRAVEL=(TITAN_SCREENS-1)*TITAN_FRAME_HEIGHT;
export function titanTileY(index:number,progress:number){return (TITAN_SCREENS-1-index)*TITAN_FRAME_HEIGHT-Math.max(0,Math.min(1,progress))*TITAN_TRAVEL;}
export function titanSection(progress:number){return progress<.22?'Outer sampling grounds':progress<.43?'Intake and station approach':progress<.64?'Research compound':progress<.83?'Heat-exchanger breach':'Disrupted research core';}
