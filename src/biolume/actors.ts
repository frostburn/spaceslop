import * as T from 'three';
import {createFighterRig} from '../ship-rigs';
import {batchAircraft} from '../summer/aircraft';
import {createRasterGlider} from './modules';

export function createStudyActors(emission:{value:number}){
  const player=batchAircraft(createFighterRig().root);player.name='biolume-player';
  const enemy=new T.Group();enemy.name='biolume-glider';
  const shape=new T.Group(),raster=createRasterGlider(emission);enemy.add(shape,raster.mesh);
  const hide=new T.MeshStandardMaterial({color:0x778279,roughness:.6,metalness:.02,side:T.DoubleSide});
  const body=new T.Mesh(new T.SphereGeometry(.36,20,12),hide);body.scale.set(.66,1.7,.7);shape.add(body);
  for(const side of[-1,1]){
    const wing=new T.Shape();wing.moveTo(0,.4);wing.quadraticCurveTo(.5,.85,1.5,.18);wing.quadraticCurveTo(1.,.2,.9,-.25);wing.quadraticCurveTo(.4,-.13,.14,-.5);wing.closePath();
    const geometry=new T.ShapeGeometry(wing,16),pos=geometry.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i);pos.setXYZ(i,x*side,pos.getY(i),.1+Math.sin(x*2)*.18);}geometry.computeVertexNormals();shape.add(new T.Mesh(geometry,hide));
    const vein=new T.Mesh(new T.CylinderGeometry(.018,.025,1.1,6),hide);vein.position.set(side*.6,.22,.26);vein.rotation.z=-side*1.1;shape.add(vein);
    const gland=new T.Mesh(new T.SphereGeometry(.10,12,8),new T.MeshBasicMaterial({color:0xff6b21}));gland.position.set(side*.15,-.25,.32);shape.add(gland);
  }
  const shots=new T.Group(),shotGeometry=new T.CapsuleGeometry(.025,.17,3,6),shotMaterial=new T.MeshBasicMaterial({color:0x9dffff});
  const bullets=Array.from({length:8},()=>{const m=new T.Mesh(shotGeometry,shotMaterial);shots.add(m);return m;});
  const basic=new Map<T.MeshBasicMaterial,T.Color>(),effects:T.Mesh[]=[];
  for(const root of[player,enemy,shots])root.traverse(node=>{
    if(node instanceof T.Mesh){if(node.material instanceof T.MeshBasicMaterial)basic.set(node.material,node.material.color.clone());if(node.material instanceof T.ShaderMaterial)effects.push(node);}
  });
  let artwork=true,warming=false;
  return{player,enemy,shots,bullets,raster,setArtwork(enabled:boolean){artwork=enabled;},pose(time:number){raster.pose(time);raster.mesh.visible=warming||artwork&&raster.available;shape.visible=warming||!raster.mesh.visible;},
    prime(){warming=true;return()=>{warming=false;};},release(){raster.release();},
    setEmission(enabled:boolean){for(const[m,color]of basic)m.color.copy(color).multiplyScalar(enabled?1:0);for(const m of effects)m.visible=enabled;}};
}
