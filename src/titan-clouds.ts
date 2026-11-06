import {titanCloudField,TITAN_CLOUD_RELIEF} from './titan-cloud-relief';
import * as T from 'three';
import { titanFrame,titanWorld } from './titan-frame';
export function createTitanClouds(){
 const root=new T.Group(),geometry=new T.PlaneGeometry(400,400,180,180);
 // Concentrate vertices near the flight corridor instead of wasting the same
 // spacing on the distant horizon; the banks stay rounded at low altitude.
 const vertices=geometry.attributes.position;
 for(let i=0;i<vertices.count;i++){const warp=(v:number)=>Math.sign(v)*200*(Math.abs(v)/200)**2;vertices.setXY(i,warp(vertices.getX(i)),warp(vertices.getY(i)));}
 const deck=new T.Mesh(geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{time:{value:0},density:{value:0},heightScale:{value:2.6},sun:{value:new T.Vector3(3,5,6).normalize()}},
 vertexShader:`varying vec2 field;varying vec3 cloudNormal;varying float crest,cloudDistance;uniform float time,heightScale,density;${titanCloudField}
 void main(){field=position.xy+vec2(time*.12,time*.43);cloudDistance=length(position.xy);float amount=1.0-smoothstep(100.0,180.0,cloudDistance),h=0.0;cloudNormal=vec3(0,0,1);
 if(density>.001&&amount>.01){h=cloudHeight(field);float dx=(cloudHeight(field+vec2(.4,0))-h)/.4,dy=(cloudHeight(field+vec2(0,.4))-h)/.4;cloudNormal=normalize(vec3(-dx*heightScale*amount,-dy*heightScale*amount,1));h*=amount;}
 crest=h;
 vec3 puff=position;puff.z+=h*heightScale;gl_Position=projectionMatrix*modelViewMatrix*vec4(puff,1);}`,
 fragmentShader:`varying vec2 field;varying vec3 cloudNormal;varying float crest,cloudDistance;uniform float density;uniform vec3 sun;${titanCloudField}
 void main(){if(density<.001)discard;float diffuse=max(0.0,dot(normalize(cloudNormal),sun));float detail=cloudNoise(field*.6)*.7+cloudNoise(field*1.4)*.3;
 float light=clamp(diffuse*diffuse*.8+crest*.2+(detail-.5)*.12,0.0,1.0);
 vec3 cloud=mix(vec3(.18,.085,.028),vec3(.97,.62,.28),light);cloud*=.83+crest*.17;
 float farFog=smoothstep(70.0,190.0,cloudDistance);cloud=mix(cloud,vec3(.50,.30,.15),farFog);
 gl_FragColor=vec4(cloud,density);
 #include <colorspace_fragment>
 }`}));deck.name='titan-cloud-surface';root.add(deck);
 const sky=new T.Mesh(new T.PlaneGeometry(9,16),new T.ShaderMaterial({depthWrite:false,vertexShader:'varying vec2 uvSky;void main(){uvSky=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}',fragmentShader:`varying vec2 uvSky;void main(){gl_FragColor=vec4(mix(vec3(.5,.30,.15),vec3(.07,.035,.02),uvSky.y),1);
 #include <colorspace_fragment>
 }`}));sky.position.z=-120;sky.frustumCulled=false;root.add(sky);
 const upper=[1,2].map(i=>{const sheet=new T.Mesh(geometry,deck.material.clone());sheet.name='titan-cloud-wisp-'+i;root.add(sheet);return sheet;});
 return{root,update(time:number,rise:number,distance:number){
  const frame=titanFrame(rise),density=T.MathUtils.smoothstep(rise,0,.5);
  [deck,...upper].forEach((sheet,i)=>{const point=titanWorld(0,1+i*1.2,rise);sheet.rotation.x=-frame.pitch;sheet.position.set(0,point.y,point.z);sheet.material.uniforms.time.value=time+i*1.3;sheet.material.uniforms.density.value=density*(i===0?1:.18);});
  [deck,...upper].forEach((sheet,i)=>{sheet.material.uniforms.heightScale.value=TITAN_CLOUD_RELIEF[i];sheet.material.uniforms.sun.value.set(3,5*Math.cos(frame.pitch)-6*Math.sin(frame.pitch),5*Math.sin(frame.pitch)+6*Math.cos(frame.pitch)).normalize();});
  sky.scale.setScalar((distance+120)/distance);
 }};
}
