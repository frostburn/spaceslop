import * as T from 'three';
import {part,pivot,plating} from './rig-geometry';
import {mergeBoulevard} from './boulevard-geometry';
import {vectorGeometry} from './boulevard-vectors';
import {MINE_TRIGGER,MINE_BURST_TIME,minePose,type BoulevardMine} from './boulevard-mines';
import type {BoulevardMaterials} from './boulevard-materials';
export function createBoulevardInterceptor(m:BoulevardMaterials){
 const root=new T.Group();root.name='boulevard-lane-interceptor';
 const outline:readonly[number,number][]=[[0,-1.02],[.31,-.48],[.72,.38],[.42,.66],[0,.40],[-.42,.66],[-.72,.38],[-.31,-.48],[0,-1.02]];
 part(root,plating(outline.slice(0,-1),.22,.04),m.chrome,0,0,0);
 part(root,plating([[0,-.55],[.25,.05],[.18,.37],[-.18,.37],[-.25,.05]],.16,.02),m.glass,0,0,.20);
 part(root,vectorGeometry([{points:outline.map(([x,y])=>[x,y,.15])},{points:[[-.68,.38,.15],[0,.13,.15],[.68,.38,.15]],weight:.7}]),m.wire,0,0,0);
 const exhaust=pivot(root,'interceptor-exhaust',0,.60,.06);
 for(const side of[-1,1]){part(root,new T.BoxGeometry(.08,.70,.07),m.pink,side*.42,.15,.20);part(exhaust,new T.ConeGeometry(.09,.37,7).translate(0,.185,0),m.cyan,side*.31,0,0);}
 const bearing=pivot(root,'interceptor-turret-bearing',0,-.28,.25);
 part(bearing,new T.CylinderGeometry(.30,.34,.12,16).rotateX(Math.PI/2),m.shell,0,0,0);
 part(bearing,new T.TorusGeometry(.28,.025,5,20),m.chrome,0,0,.065);
 const guns=pivot(root,'interceptor-aiming-turret',0,-.28,.32),mount=pivot(guns,'interceptor-rotating-mount',0,0,0);
 part(mount,new T.CylinderGeometry(.27,.27,.13,16).rotateX(Math.PI/2),m.chrome,0,.02,.045);
 part(mount,plating([[-.33,.12],[.33,.12],[.31,-.22],[-.31,-.22]],.14,.025),m.shell,0,0,0);
 for(const side of[-1,1]){part(guns,new T.CylinderGeometry(.065,.08,.55,8),m.shell,side*.25,-.28,.10);part(guns,new T.TorusGeometry(.062,.018,4,8).rotateX(Math.PI/2),m.amber,side*.25,-.56,.10);}
 const lamp=new T.MeshBasicMaterial({color:0xff5d25,toneMapped:false}),charge=part(guns,new T.BoxGeometry(.35,.06,.04),lamp,0,-.10,.17);mergeBoulevard(root);
 return{root,guns,mount,bearing,exhaust,pose(amount:number,aim:number,time=0){guns.rotation.z=aim;exhaust.scale.y=.85+.13*Math.sin(time*17);lamp.color.setRGB(.55+amount*2.1,.06+amount*.32,.015);charge.scale.x=.65+amount*.5;}};
}
export function createBoulevardMine(m:BoulevardMaterials){
 const root=new T.Group();root.name='boulevard-jumping-mine';const body=pivot(root,'mine-physical-body',0,0,0);
 part(body,new T.SphereGeometry(.34,12,7).scale(1,1,.65),m.shell,0,0,0);
 part(body,new T.TorusGeometry(.31,.035,5,20),m.chrome,0,0,.08);part(body,new T.CylinderGeometry(.13,.20,.16,8).rotateX(Math.PI/2),m.amber,0,0,.24);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;part(body,new T.ConeGeometry(.065,.18,5),m.chrome,Math.cos(a)*.30,Math.sin(a)*.30,.15).rotation.x=Math.PI/2;}
 mergeBoulevard(body);
 const warningMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{charge:{value:0},clock:{value:0}},vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float charge,clock;varying vec2 p;void main(){float dash=step(.25,fract(atan(p.y,p.x)*24./6.2831853));vec3 color=mix(vec3(1.,.48,.055),vec3(1.,.035,.015),charge);gl_FragColor=vec4(color,dash*(.13+charge*.5*(.75+.25*sin(clock*12.))));\n#include <colorspace_fragment>\n}'});
 const warning=new T.Mesh(new T.RingGeometry(MINE_TRIGGER-.023,MINE_TRIGGER,96),warningMaterial);warning.name='mine-trigger-radius';root.add(warning);
 const flashMaterial=new T.MeshBasicMaterial({color:0xff763d,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),flash=new T.Mesh(new T.SphereGeometry(1,12,8),flashMaterial);flash.name='mine-burst';root.add(flash);
 return{root,body,warning,flash,prime(active:boolean){if(active)body.visible=warning.visible=flash.visible=true;},pose(state:BoulevardMine,time:number,alive:boolean){const p=minePose(state,time);body.visible=warning.visible=alive;body.position.set(p.physicalX,p.physicalY,p.z);body.rotation.z=time*.45;body.scale.z=p.elapsed<0?1:1-.22*(1-p.jump)*p.charge;warning.position.set(p.x,p.y,.015);warningMaterial.uniforms.charge.value=p.charge;warningMaterial.uniforms.clock.value=time;const burst=state.burstAt===undefined?-1:time-state.burstAt;flash.visible=burst>=0&&burst<MINE_BURST_TIME;flash.position.set(p.x,p.y,0);flash.scale.setScalar(.35+Math.max(0,burst)*3.2);flashMaterial.opacity=burst<0?0:Math.max(0,1-burst/MINE_BURST_TIME)*.5;}};
}
