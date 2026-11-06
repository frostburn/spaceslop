import * as T from 'three';

// Keep the shadow raster locked to Io's terrain, including during camera pitch.
// Rounding world Y alone still slides diagonally through the light's texels.
export function createIoShadowAnchor(sun:T.DirectionalLight,world:T.Object3D){
  const offset=new T.Vector3(-26,-28,41),forward=offset.clone().normalize().negate();
  const right=forward.clone().cross(new T.Vector3(0,1,0)).normalize();
  const up=right.clone().cross(forward).normalize(),center=new T.Vector3();
  const camera=sun.shadow.camera,texel=(camera.right-camera.left)/sun.shadow.mapSize.x;
  camera.updateProjectionMatrix();
  return(scroll:number)=>{
    center.set(0,scroll+7,-3);
    const x=Math.round(center.dot(right)/texel)*texel,y=Math.round(center.dot(up)/texel)*texel;
    const z=Math.round(center.dot(forward)/texel)*texel;
    center.copy(right).multiplyScalar(x).addScaledVector(up,y).addScaledVector(forward,z);
    sun.target.position.copy(center);sun.position.copy(center).add(offset);
    // Three's shadow camera is outside the light hierarchy. Its default global
    // up axis otherwise rolls the raster relative to the rotating terrain.
    world.updateWorldMatrix(true,false);
    camera.up.set(0,1,0).transformDirection(world.matrixWorld);
  };
}
