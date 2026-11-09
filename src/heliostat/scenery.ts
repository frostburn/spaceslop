import * as T from 'three';
import { createHeliostatRoute } from './route';
import { createDistantPlant } from './distant';
import { createHeliostatCollector } from './collector';
import { createHeliostatRegulator,type RegulatorState } from './boss';
import { createElectricGates } from './gates';
import {createPlasmaResources} from './plasma';
import {createUnderworks} from './underworks';
import { createHeliostatMaterials } from './materials';
import { HELIOSTAT_END,heliostatScroll,heliostatBossPoint,HELIOSTAT_PITCH } from './combat';

export function createHeliostatScenery() {
  const root=new T.Group(),world=new T.Group();root.name='heliostat-power-plant';root.add(world);
  const materials=createHeliostatMaterials(),route=createHeliostatRoute(materials),distant=createDistantPlant(materials);
  const plasma=createPlasmaResources(),collector=createHeliostatCollector(materials),boss=createHeliostatRegulator(materials,plasma),gates=createElectricGates(materials),underworks=createUnderworks(materials);
  const home=heliostatBossPoint(0,0);boss.root.position.set(home.x,home.y,home.z);
  // The nine-unit playable frustum needs machinery below the flight deck, where
  // perspective can reveal its inspection openings without crowding the ships.
  route.root.scale.x=.82;route.root.position.z=-3;
  collector.root.position.y+=HELIOSTAT_END;distant.root.position.y=HELIOSTAT_END;
  world.add(underworks.root,route.root,distant.root,collector.root,boss.root,gates.root);
  const key=new T.DirectionalLight(0xffe6c4,2.6);key.position.set(-26,-14,28);key.target.position.set(0,4,-1);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=.025;key.shadow.bias=-.0001;
  Object.assign(key.shadow.camera,{left:-18,right:18,top:30,bottom:-30,near:.5,far:110});key.shadow.camera.updateProjectionMatrix();
  root.add(key,key.target);
  return {root,world,materials,route,distant,collector,boss,gates,plasma,underworks,update(time:number,reveal:number,animationTime:number,windup:number,recoil:number,alive:boolean,state?:RegulatorState) {
    materials.updateThermal(animationTime);
    root.rotation.x=-HELIOSTAT_PITCH*reveal;world.position.y=-heliostatScroll(time);
    route.update(time);underworks.update(time);gates.update(time);collector.update(animationTime);
    boss.root.visible=alive;boss.pose(animationTime,windup,recoil,state);
  }};
}
