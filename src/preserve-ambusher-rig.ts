import * as T from 'three';
import { part, pivot } from './rig-geometry';
import { gkSnout, gkTube, mergeGkFixed } from './groundskeeper-geometry';
import { preserveNoise, preserveRandom } from './preserve-layout';
import { AMBUSHER_WINDUP, AMBUSHER_LEAP, AMBUSHER_BITE, AMBUSHER_RETREAT, ambusherProjection, ambusherStudy, type AmbusherPose } from './preserve-ambusher';
import { ambusherSailGeometry, ambusherSnout, ambusherSnoutWidth, ambusherLoft, ambusherLimbGeometry, ambusherHandClaw } from './preserve-ambusher-geometry';

export function createAmbusherMaterials() {
  const size=128,pigment=new Uint8Array(size*size*4),height=new Uint8Array(pigment.length),random=preserveRandom(7103);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const px=(x+(Math.floor(y/9)%2)*5)%11,py=y%9;
    const rim=Math.min(px,11-px,py,9-py),scale=T.MathUtils.smoothstep(rim,.3,2.0);
    const n=preserveNoise(x/17,y/17),tone=174+scale*48+n*18+(random()-.5)*8;
    pigment.set([tone,tone,tone,255],(y*size+x)*4);const h=125+scale*110;height.set([h,h,h,255],(y*size+x)*4);
  }
  const texture=(data:Uint8Array,color:boolean)=>{const t=new T.DataTexture(data,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;if(color)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;};
  const map=texture(pigment,true),relief=texture(height,false);
  const skin=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,map,bumpMap:relief,bumpScale:.035,roughness:.81});
  skin.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    float grain=dot(texture2D(map,vMapUv).rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb*=clamp(.78+grain*.4,.65,1.12);
    #endif`);};skin.customProgramCacheKey=()=> 'preserve-ambusher-hide';
  const flesh=new T.MeshStandardMaterial({color:0x4e302a,roughness:.85,side:T.DoubleSide});
  const dark=new T.MeshStandardMaterial({color:0x161d17,roughness:.88});
  const horn=new T.MeshStandardMaterial({color:0xb7aa7d,roughness:.5});
  const eye=new T.MeshPhysicalMaterial({color:0xc99a42,roughness:.2,clearcoat:.8});
  const pupil=new T.MeshBasicMaterial({color:0x090e0b});
  const warning=new T.MeshBasicMaterial({color:0xffc879,transparent:true,opacity:.65,depthWrite:false,depthTest:false,side:T.DoubleSide});
  const foam=new T.MeshBasicMaterial({color:0xc6dfcf,transparent:true,opacity:.45,depthWrite:false});
  return{skin,flesh,dark,horn,eye,pupil,warning,foam,setScales(t:T.Texture){skin.map=t;skin.needsUpdate=true;}};
}
export type AmbusherMaterials=ReturnType<typeof createAmbusherMaterials>;

export function createPoolAmbusher(m:AmbusherMaterials) {
  const root=new T.Group();root.name='pool-ambusher';
  const animal=new T.Group();root.add(animal);animal.name='ambusher-animal';
  const sphere=new T.SphereGeometry(1,24,16),vec=(p:{x:number;y:number;z:number})=>new T.Vector3(p.x,p.y,p.z);
  function skin(g:T.BufferGeometry,belly=false) {
    const colors:number[]=[],p=g.attributes.position,c=new T.Color(),back=new T.Color(0x657052),light=new T.Color(0xb9ad88),stripe=new T.Color(0x2c4031);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=preserveNoise(x*3+7,y*3+z*2);
      c.copy(back).lerp(light,belly?.9:T.MathUtils.smoothstep(-z,-.2,.7)*.7);
      const bars=T.MathUtils.smoothstep(Math.sin(y*4.5+x*1.1+n*3),.1,.8)*(1-T.MathUtils.smoothstep(-z,.25,.9));
      const mottles=T.MathUtils.smoothstep(preserveNoise(x*11+13,y*9+z*6),.54,.74);
      c.lerp(stripe,Math.min(.8,bars*.58+mottles*.3)).multiplyScalar(.88+n*.2);colors.push(c.r,c.g,c.b);
    }
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
  }
  function snout(sections:Parameters<typeof gkSnout>[0],belly=false) {
    return skin(ambusherLoft(sections),belly);
  }
  const body=pivot(animal,'ambusher-torso',0,0,0);
  part(body,snout([[1.43,.12,-.10,.16],[1.1,.33,-.32,.40],[.7,.49,-.53,.59],[.18,.59,-.60,.65],[-.35,.55,-.57,.62],[-.8,.42,-.42,.52],[-1.1,.24,-.16,.43]]),m.skin,0,0,0);
  const joint=skin(sphere.clone());
  for(const s of[-1,1])part(body,joint,m.skin,s*.43,.64,-.22).scale.set(.25,.44,.35);
  part(animal,ambusherSailGeometry(),m.skin,0,0,0).name='ambusher-sail';
  const head=pivot(animal,'ambusher-head',0,-1.1,.9);
  const skull=snout(ambusherSnout);
  const muzzle=part(head,skull,m.skin,0,0,0);muzzle.name='ambusher-long-snout';
  const jaw=pivot(head,'ambusher-jaw',0,.28,-.17);
  part(jaw,snout([[.1,.25,-.17,.04],[-.45,.23,-.16,.035],[-.95,.13,-.13,.025],[-1.33,.13,-.10,.025],[-1.56,.195,-.08,.025],[-1.77,.12,-.045,.02],[-1.91,.025,-.02,.01]],true),m.skin,0,0,0);
  part(head,snout([[.17,.05,.23,.41],[-.2,.055,.22,.38],[-.64,.015,.14,.2]]),m.skin,0,0,0);
  part(jaw,sphere,m.flesh,0,-.62,.035).scale.set(.21,.79,.035);
  part(head,sphere,m.flesh,0,-.58,-.105).scale.set(.24,.88,.04);
  for(const side of[-1,1]){
    const socket=pivot(head,'ambusher-eye-socket',side*.28,.04,.24);
    socket.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(side*.7,-.4,.55).normalize());
    part(socket,sphere,m.dark,0,0,0).scale.set(.10,.083,.034);
    part(socket,sphere,m.eye,0,-.005,.025).scale.set(.077,.061,.032);
    part(socket,sphere,m.pupil,0,-.01,.054).scale.set(.023,.042,.009);
    part(socket,joint,m.skin,0,.067,.022).scale.set(.115,.043,.046);
    const lid=pivot(socket,'ambusher-closed-eye',0,0,0);part(lid,joint,m.skin,0,0,.038).scale.set(.09,.072,.025);
    const naris=part(head,sphere,m.dark,side*.236,-.32,.17);naris.scale.set(.022,.069,.014);naris.rotation.y=side*.5;
    // Teeth emerge from the gums and stay inside the closed snout.
    for(let i=0;i<10;i++){
      const y=-.25-i*.127,width=ambusherSnoutWidth(y)*.87,upper=new T.ConeGeometry(.025,.105,7);upper.rotateX(-Math.PI/2);
      part(head,upper,m.horn,side*width,y,-.09);
      part(jaw,new T.ConeGeometry(.023,.088,7).rotateX(Math.PI/2),m.horn,side*(width*.9),y-.28,.045);
    }
  }
  const mouthMarker=new T.Object3D();mouthMarker.name='ambusher-bite-tip';mouthMarker.position.set(0,-1.42,0);head.add(mouthMarker);
  const neck=gkTube(18,14),neckMesh=part(animal,neck.geometry,m.skin,0,0,0);neckMesh.name='ambusher-neck';skin(neck.geometry);
  const tail=gkTube(24,12),tailMesh=part(animal,tail.geometry,m.skin,0,0,0);tailMesh.name='ambusher-tail';skin(tail.geometry);
  const limbGeometry=skin(ambusherLimbGeometry());
  const limb=(name:string,radius:number)=>{const o=part(animal,limbGeometry,m.skin,0,0,0);o.name=name;o.scale.set(radius,1,radius);return o;};
  const legs=[-1,1].map(side=>{
    const thigh=limb('ambusher-thigh',.29),shin=limb('ambusher-shin',.14),ankle=limb('ambusher-hock',.085),foot=pivot(animal,'ambusher-foot',0,0,0);
    part(foot,skin(sphere.clone().scale(.22,.39,.12),true),m.skin,0,-.12,.06);
    for(let i=-1;i<=1;i++){
      part(foot,skin(sphere.clone().scale(.075,.34,.065),true),m.skin,i*.14,-.38,.04);
      part(foot,sphere,m.horn,i*.14,-.73,.025).scale.set(.065,.16,.035);
    }
    part(foot,skin(sphere.clone().scale(.06,.19,.06),true),m.skin,-side*.27,.09,.04);
    const knee=part(animal,joint,m.skin,0,0,0);knee.scale.set(.20,.22,.18);
    return{side,thigh,shin,ankle,foot,knee};
  });
  const arms=[-1,1].map(side=>{
    const upper=limb('ambusher-arm',.16),lower=limb('ambusher-forearm',.11),hand=pivot(animal,'ambusher-hand',0,0,0);
    part(hand,joint,m.skin,0,-.08,0).scale.set(.16,.22,.095);
    for(let i=-1;i<=1;i++){
      const length=i===-side?.40:.29;
      part(hand,ambusherHandClaw(i*.105,length,i===-side?.048:.034),m.horn,0,0,0);
    }
    const elbow=part(animal,joint,m.skin,0,0,0);elbow.scale.set(.14,.15,.13);
    return{side,upper,lower,hand,elbow};
  });
  const lineGeometry=new T.BufferGeometry();lineGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(24*2*3),3).setUsage(T.DynamicDrawUsage));
  const lines=new T.LineSegments(lineGeometry,new T.LineBasicMaterial({color:0xffc879,transparent:true,opacity:.7,depthTest:false,depthWrite:false}));lines.name='ambusher-warning-line';lines.renderOrder=10;lines.frustumCulled=false;root.add(lines);
  const ring=part(root,new T.RingGeometry(.45,.5,40),m.warning,0,0,.035);ring.renderOrder=10;ring.name='ambusher-locked-target';
  const splash=new T.InstancedMesh(new T.OctahedronGeometry(1),m.foam,32);splash.name='ambusher-splash';splash.instanceMatrix.setUsage(T.DynamicDrawUsage);splash.frustumCulled=false;root.add(splash);
  const transform=new T.Object3D(),axis=new T.Vector3(0,1,0),direction=new T.Vector3(),eyes:T.Mesh[]=[],lids:T.Object3D[]=[];
  function span(mesh:T.Mesh,a:T.Vector3,b:T.Vector3) {mesh.position.copy(a);direction.copy(b).sub(a);mesh.scale.y=direction.length();mesh.quaternion.setFromUnitVectors(axis,direction.normalize());}
  function pose(p:AmbusherPose) {
    animal.position.copy(vec(p.root));animal.rotation.set(0,p.roll,p.heading,'ZYX');
    body.scale.set(1+.01*Math.sin(p.age*1.8),1,1);
    head.position.copy(vec(p.localHead));head.rotation.x=p.pitch;jaw.rotation.x=p.jaw;
    for(const eye of eyes)eye.visible=!p.dead;
    for(const lid of lids)lid.visible=p.dead;
    neck.pose(new T.CatmullRomCurve3([new T.Vector3(0,-.42,.4),new T.Vector3(0,-.63,.79),new T.Vector3(0,-.88,p.localHead.z-.16),new T.Vector3(0,-.79,p.localHead.z)]),.39,.29);
    const tailPoints=[new T.Vector3(0,.78,-.1),new T.Vector3(.1*Math.sin(p.age*2),1.7,-.25),new T.Vector3(.35*Math.sin(p.age*2-.7),2.7,-.47),new T.Vector3(.45*Math.sin(p.age*2-1.3),3.4,-.5)];
    // Bend along the bank while grounded; release the curl during the leap.
    for(const point of tailPoints){const x=p.root.x+point.x*Math.cos(p.heading)-point.y*Math.sin(p.heading),delta=(T.MathUtils.clamp(x,-2.85,2.85)-x)*(1-p.out);point.x+=delta*Math.cos(p.heading);point.y-=delta*Math.sin(p.heading);}
    const tailCurve=new T.CatmullRomCurve3(tailPoints);tail.pose(tailCurve,.35,.025);
    const vertices=tail.geometry.attributes.position;
    for(let row=0;row<=24;row++){
      const t=row/24,center=tailCurve.getPoint(t),radius=T.MathUtils.lerp(.35,.025,t),height=(.32+.44*Math.sin(t*Math.PI)**.8)*(1-t)**.35+.025;
      for(let i=0;i<=12;i++){const n=row*13+i;vertices.setX(n,center.x+(vertices.getX(n)-center.x)*.56);vertices.setZ(n,center.z+(vertices.getZ(n)-center.z)*height/radius);}
    }
    vertices.needsUpdate=true;tail.geometry.computeVertexNormals();
    for(const tube of[neck,tail]){tube.geometry.computeBoundingBox();tube.geometry.computeBoundingSphere();}
    for(const leg of legs){const s=leg.side,foot=new T.Vector3(s*.54,-.18+p.out*.35,p.footZ),knee=new T.Vector3(s*.66,-.45+p.out*.6,-.9+p.out*.35),hock=new T.Vector3(s*.56,.55-p.out*.3,p.footZ+.5);
      span(leg.thigh,new T.Vector3(s*.43,.38,-.2),knee);span(leg.shin,knee,hock);span(leg.ankle,hock,foot);leg.foot.position.copy(foot);leg.foot.rotation.x=-p.out*.6;
      leg.knee.position.copy(knee);
    }
    for(const arm of arms){const s=arm.side,a=new T.Vector3(s*.48,-.62,.25),b=new T.Vector3(s*.72,-.93,-.15+p.out*.25),c=new T.Vector3(s*.51,-1.24,-.35+p.out*.4);span(arm.upper,a,b);span(arm.lower,b,c);arm.hand.position.copy(c);arm.elbow.position.copy(b);}
    lines.visible=ring.visible=p.warning;ring.position.set(p.aim.x,p.aim.y,.035);
    if(p.warning){const a=lineGeometry.attributes.position,from=ambusherProjection(p.mouth);for(let i=0;i<24;i++)for(let j=0;j<2;j++){const t=(i+j*.55)/24;a.setXYZ(i*2+j,T.MathUtils.lerp(from.x,p.aim.x,t),T.MathUtils.lerp(from.y,p.aim.y,t),.035);}a.needsUpdate=true;}
    const splashAt=p.phase==='leap'?AMBUSHER_WINDUP:AMBUSHER_WINDUP+AMBUSHER_LEAP+AMBUSHER_BITE+AMBUSHER_RETREAT*.65;
    splash.visible=!p.dead&&(p.phase==='leap'||p.phase==='retreat'&&p.age>=splashAt);
    for(let i=0;i<splash.count;i++){
      const life=Math.max(0,p.age-splashAt-i*.008),angle=i*2.39996;
      transform.position.set(p.water.x+Math.cos(angle)*life*1.3,p.water.y+Math.sin(angle)*life*.8,p.water.z+.08+life*2-life*life*3.8);
      transform.rotation.set(life*3,angle,life*2);transform.scale.setScalar(Math.max(.001,.045*(1-life/.65)));transform.updateMatrix();splash.setMatrixAt(i,transform.matrix);
    }
    splash.instanceMatrix.needsUpdate=true;return p;
  }
  for(const group of[body,head,...legs.map(l=>l.foot),...arms.map(a=>a.hand)])mergeGkFixed(group);
  animal.traverse(o=>{if(o.name==='ambusher-closed-eye')lids.push(o);if(o instanceof T.Mesh){o.castShadow=o.receiveShadow=true;if(o.material===m.eye||o.material===m.pupil)eyes.push(o);}});
  const initial=ambusherStudy(0);pose(initial);skin(neck.geometry);skin(tail.geometry);splash.computeBoundingSphere();
  return{root,animal,pose,prime(active:boolean){if(active)lines.visible=ring.visible=splash.visible=true;else pose(initial);}};
}
