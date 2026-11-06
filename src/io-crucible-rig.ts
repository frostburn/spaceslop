import * as T from 'three';
import {IoDetail} from './io-detail';
import {ioWeather,ioDark,ioRust,ioSteel,ioChrome,ioCeramic,ioBand,ioFurnace,ioHeatGlow} from './io-materials';
import {CRUCIBLE_MUZZLE_Y,slagHeat} from './io-crucible';

const blackened=ioDark.clone();blackened.color.setHex(0x3c3430);blackened.roughness=.88;blackened.map=ioRust.map;
let carrierTemplate:T.Group|undefined;
function carrierModel(){
  const root=new T.Group();root.name='io-crucible';
  const d=new IoDetail();
  // Soot-black spherical vessel with ceramic cheeks, lifting cage and plumbing.
  d.geometry(new T.SphereGeometry(.83,32,20).scale(1,1.02,.85),blackened);
  d.geometry(new T.TorusGeometry(.84,.055,8,40).translate(0,0,.05),ioRust);
  d.geometry(new T.TorusGeometry(.68,.045,7,32).rotateY(Math.PI/2),ioSteel);
  for(const side of [-1,1]){
    d.box(side*.59,.08,.49,.34,.76,.13,ioCeramic,side*.25);
    d.box(side*.59,-.08,.57,.35,.14,.04,ioBand,side*.25);
    d.box(side*.92,.15,.08,.23,.94,.39,ioSteel);
    for(let i=0;i<6;i++)d.box(side*.94,-.22+i*.14,.30,.32,.045,.08,ioDark);
    d.pipe([[side*.58,.5,.45],[side*.87,.65,.52],[side*.98,.38,.29]],.055,ioChrome);
    d.rod([side*.55,-.55,.25],[side*.29,-.88,.18],.06,ioRust);
    d.rod([side*.48,.55,.25],[side*.48,.94,.26],.07,ioSteel);
  }
  d.rod([-.48,.94,.26],[.48,.94,.26],.075,ioSteel);
  d.geometry(new T.TorusGeometry(.24,.055,7,24).translate(0,.04,.72),ioSteel);
  d.geometry(new T.CylinderGeometry(.20,.20,.09,20).rotateX(Math.PI/2).translate(0,.04,.72),ioDark);
  d.bolts(0,.04,.78,.3,.3,ioChrome);
  d.box(0,-.74,.12,.65,.33,.43,ioSteel);
  d.box(0,CRUCIBLE_MUZZLE_Y,.12,.39,.22,.22,ioFurnace);
  d.finish(root,'crucible-shell');
  for(const side of [-1,1]){
    const jaw=new T.Group();jaw.name=side<0?'crucible-valve-L':'crucible-valve-R';jaw.position.set(side*.13,-.91,.28);
    const plate=new T.Mesh(ioWeather(new T.BoxGeometry(.27,.33,.10),4),ioCeramic);jaw.add(plate);root.add(jaw);
  }
  const glow=new T.Sprite(ioHeatGlow);glow.name='crucible-pour-glow';glow.position.set(0,CRUCIBLE_MUZZLE_Y,.40);root.add(glow);
  root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;}});
  return root;
}
export function createCrucible(){
  const root=(carrierTemplate??=carrierModel()).clone();
  const left=root.getObjectByName('crucible-valve-L')!,right=root.getObjectByName('crucible-valve-R')!,glow=root.getObjectByName('crucible-pour-glow')!;
  return {root,pose(time:number,opening=0){
    for(const [jaw,side]of [[left,-1],[right,1]] as const){jaw.position.x=side*(.13+opening*.17);jaw.rotation.z=side*opening*.45;}
    glow.scale.setScalar(.32+opening*(.5+.06*Math.sin(time*28)));
  }};
}

// Shared geometry/programs, per-rig heat uniform: no model creation at emission.
const slagGeometry=new T.IcosahedronGeometry(1,2),p=slagGeometry.attributes.position;
for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+.075*Math.sin(x*11+y*17+z*13);
  p.setXYZ(i,x*r,y*r,z*r);
}
slagGeometry.computeVertexNormals();
export function createSlag(){
  const root=new T.Group();root.name='io-slag';
  const material=new T.ShaderMaterial({uniforms:{heat:{value:1}},
    vertexShader:`varying vec3 point,normalView;void main(){point=position;normalView=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 point,normalView;uniform float heat;
      void main(){
        float veins=abs(sin(point.x*8.+sin(point.y*9.))*sin(point.z*7.+point.y*6.));
        float cracks=1.-smoothstep(.025,.11,veins);
        float light=.32+.68*max(0.,dot(normalize(normalView),normalize(vec3(-.5,.6,1.))));
        vec3 crust=vec3(.14,.10,.075)*light+cracks*vec3(.85,.20,.016);
        vec3 molten=mix(vec3(1.8,.18,.008),vec3(3.,1.7,.40),max(0.,normalView.z));
        gl_FragColor=vec4(mix(crust,molten,heat),1.);
        #include <colorspace_fragment>
      }`});
  const body=new T.Mesh(slagGeometry,material);body.scale.setScalar(.24);root.add(body);
  const glow=new T.Sprite(ioHeatGlow);glow.position.z=.12;root.add(glow);
  return {root,pose(age:number,seed=0){
    const heat=slagHeat(age);material.uniforms.heat.value=heat;
    body.rotation.set(age*1.1+seed,age*.7,age*.9+seed*.3);
    body.scale.set(.24,.24+heat*.10,.24);
    glow.scale.setScalar(.52+heat*.42);
  }};
}
