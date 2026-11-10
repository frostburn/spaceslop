export type SurfaceKind='backdrop'|'foreground';
export const LIGHT_COUNT=6;
export type StudyOptions={environment:boolean;actors:boolean;emission:boolean;relief:boolean;transmission:boolean;occlusion:boolean;artwork:boolean};
export const defaultOptions:StudyOptions={environment:true,actors:true,emission:true,relief:true,transmission:true,occlusion:true,artwork:true};
export function actorPose(time:number){return{
  player:{x:2.5*Math.sin(time*.45),y:-2+3.5*Math.sin(time*.3)},
  enemy:{x:-2.2*Math.cos(time*.4),y:2+.7*Math.sin(time*.6)},
};}
export function relief(kind:SurfaceKind,u:number,v:number){
  if(kind==='foreground')return .12*Math.sin(u*8.)*Math.sin(v*12.);
  const left=.9*Math.exp(-((u-(.08+.04*Math.sin(v*8)))**2)/.006);
  const right=.7*Math.exp(-((u-(.9+.04*Math.sin(v*9)))**2)/.009);
  const bottom=.5*Math.exp(-((v-(.08+.05*Math.sin(u*5)))**2)/.003);
  return left+right+bottom;
}
