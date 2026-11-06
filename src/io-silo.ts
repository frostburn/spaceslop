import * as T from 'three';

// The paint band occupies its own part of one tapered shell. No nested cylinder,
// end caps or near-coplanar overlay can compete with the wall at grazing angles.
export function ioSiloWall(radius:number,height:number,base:number,phase:number,arc:number){
  const bottom=height*.53-.115,top=bottom+.23;
  const radiusAt=(z:number)=>radius*(1+.03*(1-z/height));
  return [[0,bottom,false],[bottom,top,true],[top,height,false]].map(([a,b,band])=>{
    const low=a as number,high=b as number;
    return{band:!!band,geometry:new T.CylinderGeometry(radiusAt(high),radiusAt(low),high-low,24,1,true,phase,arc)
      .rotateX(Math.PI/2).rotateZ(-Math.PI/2).translate(0,0,base+(low+high)/2)};
  });
}
