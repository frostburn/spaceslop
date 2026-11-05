import * as T from 'three';

// Four equal atlas cells: chassis / sensor / upper arm / forearm and gripper.
// Pivot coordinates are fractions of a cell, so owner resizing is safe.
export function createTitanRobot() {
  const root=new T.Group(),material=new T.MeshBasicMaterial({transparent:true,alphaTest:.08,depthWrite:false,toneMapped:false});
  let available=false;
  function setTexture(texture:T.Texture){material.map=texture;material.needsUpdate=true;available=true;}
  function part(parent:T.Group,column:number,row:number,pivotX=.5,pivotY=.5){
    const geometry=new T.PlaneGeometry(.832,.832),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+column)/2,(uv.getY(i)+1-row)/2);
    geometry.translate((.5-pivotX)*.832,(pivotY-.5)*.832,0);
    const mesh=new T.Mesh(geometry,material);parent.add(mesh);return mesh;
  }
  part(root,0,0);
  const scanner=new T.Group();scanner.name='survey-scanner';scanner.position.set(.026,.026,.025);root.add(scanner);part(scanner,1,0,.46,.52);
  const arm=new T.Group();arm.name='work-arm';arm.position.set(-.19,-.08,.04);root.add(arm);part(arm,0,1,.516,.76);
  const elbow=new T.Group();elbow.name='work-elbow';elbow.position.set(.026,.559,.02);arm.add(elbow);part(elbow,1,1,.46,.766);
  const shadow=new T.Mesh(new T.CircleGeometry(.35,20),new T.MeshBasicMaterial({color:0x090806,transparent:true,opacity:.2,depthWrite:false}));
  shadow.scale.y=1.2;shadow.position.z=-.01;root.add(shadow);
  return {root,setTexture,get available(){return available;}};
}
