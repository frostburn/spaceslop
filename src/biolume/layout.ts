export type SurfaceKind='root'|'leaf'|'pod'|'ground';
// Full-canvas crops, not assumed equal cells. Keep the 1254-square canvas intact.
export const atlasCrops:Record<SurfaceKind,readonly[number,number,number,number]>={
  root:[241/1254,10/1254,405/1254,637/1254],leaf:[691/1254,15/1254,1120/1254,634/1254],
  pod:[159/1254,658/1254,456/1254,1238/1254],ground:[670/1254,700/1254,1170/1254,1180/1254],
};
export const LIGHT_COUNT=6;
export type StudyOptions={environment:boolean;actors:boolean;emission:boolean;relief:boolean;transmission:boolean;occlusion:boolean;artwork:boolean};
export const defaultOptions:StudyOptions={environment:true,actors:true,emission:true,relief:true,transmission:true,occlusion:true,artwork:true};
export function actorPose(time:number){return{
  player:{x:2.5*Math.sin(time*.45),y:-2+3.5*Math.sin(time*.3)},
  enemy:{x:-2.2*Math.cos(time*.4),y:2+.7*Math.sin(time*.6)},
};}
export function relief(kind:SurfaceKind,u:number,v:number){
  if(kind==='root'){
    const center=.5+.13*Math.sin((v-.1)*Math.PI*2),q=(u-center)/.45;
    return .95*Math.sqrt(Math.max(0,1-q*q))+.025*Math.sin(u*76+Math.sin(v*19))*Math.sin(v*43);
  }
  if(kind==='leaf')return .22*Math.sin(v*Math.PI)*(1-(u-.5)**2*4)+.035*Math.sin((u-.5)*Math.PI*2);
  if(kind==='pod')return .28*Math.sin(v*Math.PI)*Math.sqrt(Math.max(0,1-(u-.5)**2*4));
  return .018*Math.sin(u*38)*Math.sin(v*45);
}
