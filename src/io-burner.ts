import * as T from 'three';
import {createIoBurnerFlames} from './io-flames';
import {ioRust,ioSteel,ioDark} from './io-materials';

// The workshop uses the actual stage flame renderer and a matching stack mouth.
export function createIoBurnerStudy(){
  const root=new T.Group();root.name='io-burner-study';
  const stack=new T.Mesh(new T.CylinderGeometry(.17,.17,1.2,20).rotateX(Math.PI/2).translate(0,0,.6),ioRust);root.add(stack);
  for(const z of [.15,.75,1.15])root.add(new T.Mesh(new T.TorusGeometry(.21,.035,6,24).translate(0,0,z),ioSteel));
  root.add(new T.Mesh(new T.CylinderGeometry(.23,.24,.15,20).rotateX(Math.PI/2).translate(0,0,1.2),ioDark));
  const flames=createIoBurnerFlames([new T.Vector3(0,0,1.28)]);root.add(flames.root);
  return{root,pose(time:number){flames.update(time);return 'rounded base / jet-to-cap crossfade';}};
}
