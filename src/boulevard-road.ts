import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {BOULEVARD_DECK} from './boulevard';
import {roadRelief,createBoulevardDrips,roadHeightGLSL,ROAD_WATER,type DrainSite} from './boulevard-weather';
export function createBoulevardRoad(map:T.Texture,sites:readonly DrainSite[]=[]){
 const root=new T.Group(),field=roadRelief(sites),rain=createBoulevardDrips(sites);root.name='boulevard-wet-road';root.position.z=BOULEVARD_DECK+ROAD_WATER;
 const vertexShader=`uniform mat4 textureMatrix;uniform float travel;varying vec4 vReflect;varying vec2 vRoad;
 void main(){vReflect=textureMatrix*vec4(position,1.);vRoad=vec2(position.x,position.y+travel);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const shader={name:'boulevard-standing-water',uniforms:{color:{value:new T.Color(0x141020)},tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},relief:{value:field.texture},asphalt:{value:map},travel:{value:0},grazing:{value:0},impacts:{value:rain.impacts}},vertexShader,
 fragmentShader:`uniform sampler2D tDiffuse,asphalt;uniform float grazing;uniform vec4 impacts[6];varying vec4 vReflect;varying vec2 vRoad;
 ${roadHeightGLSL}
 void main(){float depth=WATER_LEVEL-roadHeight(vRoad);if(depth<0.)discard;
 vec2 slope=vec2(0.);float glint=0.;
 for(int i=0;i<6;i++){float age=impacts[i].z;if(age<0.||age>1.15)continue;vec2 p=vRoad-impacts[i].xy;float d=length(p),front=d-age*1.30;
 float envelope=exp(-front*front/0.022)*exp(-age*2.8)*smoothstep(0.,.05,age);float wave=sin(d*34.-age*16.)*envelope;
 slope+=p/max(d,.03)*wave;glint+=max(0.,wave);}
 vec2 uv=vReflect.xy/vReflect.w;vec3 reflection=texture2D(tDiffuse,uv+slope*.0020).rgb;
 float interior=smoothstep(0.,.018,max(0.,depth)),grain=texture2D(asphalt,vRoad*.18).r;vec3 c=vec3(.010,.008,.018)*(.65+grain*.75)+reflection*(.05+interior*(.62+grazing*.12));
 c+=vec3(.09,.12,.15)*glint+roadPaint(vRoad)*.45;gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`};
 const water=new Reflector(new T.PlaneGeometry(7.2,140),{textureWidth:384,textureHeight:768,multisample:0,clipBias:.003,shader});water.name='boulevard-reflecting-asphalt';water.renderOrder=-2;water.frustumCulled=false;
 const uniforms=(water.material as T.ShaderMaterial).uniforms;uniforms.relief.value=field.texture;uniforms.asphalt.value=map;uniforms.impacts.value=rain.impacts;
 const groundUniforms={tDiffuse:uniforms.tDiffuse,textureMatrix:uniforms.textureMatrix,grazing:uniforms.grazing,relief:{value:field.texture},asphalt:{value:map},travel:uniforms.travel};
 const groundMaterial=new T.ShaderMaterial({uniforms:groundUniforms,
 vertexShader:`uniform float travel;uniform mat4 textureMatrix;varying vec4 vReflection;varying vec2 vRoad;${roadHeightGLSL}
 void main(){vReflection=textureMatrix*vec4(position,1.);vRoad=vec2(position.x,position.y+travel);vec3 p=position;p.z=roadHeight(vRoad)-WATER_LEVEL;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
 fragmentShader:`uniform sampler2D asphalt,tDiffuse;uniform float grazing;varying vec4 vReflection;varying vec2 vRoad;${roadHeightGLSL}
 void main(){float h=roadHeight(vRoad);
 vec2 delta=vec2(.05625,.1640625);vec3 n=normalize(vec3((roadHeight(vRoad-vec2(delta.x,0.))-roadHeight(vRoad+vec2(delta.x,0.)))/(2.*delta.x),(roadHeight(vRoad-vec2(0.,delta.y))-roadHeight(vRoad+vec2(0.,delta.y)))/(2.*delta.y),1.));
 float grain=texture2D(asphalt,vRoad*.18).r,wet=1.-smoothstep(WATER_LEVEL,WATER_LEVEL+.015,h);float light=.65+max(0.,dot(n,normalize(vec3(-.8,-.5,1.))))*.35;
 vec2 uv=vReflection.xy/vReflection.w;vec3 reflection=(texture2D(tDiffuse,uv).rgb+texture2D(tDiffuse,uv+vec2(.003,.002)).rgb+texture2D(tDiffuse,uv-vec2(.003,.002)).rgb)/3.;
 vec3 c=vec3(.034,.029,.040)*(.40+grain*.90)*light*(1.-wet*.22)+reflection*wet*.018+roadPaint(vRoad);gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`});
 const ground=new T.Mesh(new T.PlaneGeometry(7.2,140,32,280),groundMaterial);ground.name='boulevard-road-relief';ground.renderOrder=-1;ground.frustumCulled=false;root.add(ground,water,rain.root);
 // Capture objects above the puddles, keeping the bank mesh out of its own reflection.
 const capture=water.onBeforeRender;water.onBeforeRender=function(...args){const visible=ground.visible;ground.visible=false;try{capture.apply(this,args);}finally{ground.visible=visible;}};
 return{root,water,ground,field,rain,sites,prime:rain.prime,
  update(scroll:number,time:number,reveal:number){const center=scroll+36;root.position.y=center;uniforms.travel.value=center;uniforms.grazing.value=reveal;rain.update(time,scroll,center);},
  setMap(texture:T.Texture){texture.wrapS=texture.wrapT=T.RepeatWrapping;groundUniforms.asphalt.value=texture;uniforms.asphalt.value=texture;},dispose(){water.dispose();}
 };
}
