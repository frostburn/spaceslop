import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {BOULEVARD_DECK} from './boulevard';
export function createBoulevardRoad(map:T.Texture){
 const shader={name:'boulevard-wet-asphalt',uniforms:{color:{value:new T.Color(0x141020)},tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},asphalt:{value:map},travel:{value:0},clock:{value:0},grazing:{value:0}},
 vertexShader:`uniform mat4 textureMatrix;varying vec4 vReflect;varying vec2 vRoad;
 void main(){vReflect=textureMatrix*vec4(position,1.);vRoad=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`uniform sampler2D tDiffuse;uniform sampler2D asphalt;uniform vec3 color;uniform float clock;uniform float travel;uniform float grazing;varying vec4 vReflect;varying vec2 vRoad;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){vec2 road=vec2(vRoad.x,vRoad.y+travel);float grain=texture2D(asphalt,road*.18).r;
 vec2 uv=vReflect.xy/vReflect.w;vec2 ripple=vec2(sin(road.y*17.+clock*.7),cos(road.x*19.+road.y*11.-clock*.5))*.0007;
 vec3 reflection=texture2D(tDiffuse,uv+ripple).rgb;float wet=smoothstep(.27,.7,noise(road*vec2(1.5,.5)));
 float edge=smoothstep(1.0,3.4,abs(road.x));float reflectivity=.12+wet*.25+grazing*.23+edge*.1;
 vec3 base=color*(.5+grain*.7);vec3 lit=base+reflection*reflectivity;
 float cracks=smoothstep(.985,.999,noise(road*vec2(25.,7.)));lit*=1.-cracks*.15;
 gl_FragColor=vec4(lit,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`};
 const road=new Reflector(new T.PlaneGeometry(7.2,140),{textureWidth:384,textureHeight:768,multisample:0,color:0x141020,clipBias:.003,shader});
 road.name='boulevard-reflecting-asphalt';road.position.z=BOULEVARD_DECK;road.frustumCulled=false;
 const uniforms=(road.material as T.ShaderMaterial).uniforms;uniforms.asphalt.value=map;
 return{root:road,update(scroll:number,time:number,reveal:number){road.position.y=scroll+36;uniforms.travel.value=scroll+36;uniforms.clock.value=time;uniforms.grazing.value=reveal;},setMap(texture:T.Texture){texture.wrapS=texture.wrapT=T.RepeatWrapping;uniforms.asphalt.value=texture;},dispose(){road.dispose();}};
}
