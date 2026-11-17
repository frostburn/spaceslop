import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FOUNTAIN_Y,CROSSING_WIDTH,CROSSING_REACH} from './boulevard-layout';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {BOULEVARD_DECK, boulevardCruiserLead} from './boulevard';
import {roadRelief,createBoulevardDrips,roadHeightGLSL,ROAD_WATER,type DrainSite} from './boulevard-weather';
export function createBoulevardRoad(map:T.Texture,sites:readonly DrainSite[]=[]){
 const root=new T.Group(),field=roadRelief(sites),rain=createBoulevardDrips(sites);root.name='boulevard-wet-road';root.position.z=BOULEVARD_DECK+ROAD_WATER;
 const vertexShader=`uniform mat4 textureMatrix;uniform float travel;varying vec4 vReflect;varying vec2 vRoad;
 void main(){vReflect=textureMatrix*vec4(position,1.);vRoad=vec2(position.x,position.y+travel);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const shader={name:'boulevard-standing-water',uniforms:{color:{value:new T.Color(0x141020)},tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},relief:{value:field.texture},asphalt:{value:map},travel:{value:0},grazing:{value:0},clock:{value:0},wake:{value:new T.Vector2()},impacts:{value:rain.impacts}},vertexShader,
 fragmentShader:`uniform sampler2D tDiffuse,asphalt;uniform float grazing,clock;uniform vec2 wake;uniform vec4 impacts[6];varying vec4 vReflect;varying vec2 vRoad;
 ${roadHeightGLSL}
 void main(){if(roadFootprint(vRoad)<.5)discard;float depth=WATER_LEVEL-roadHeight(vRoad);if(depth<0.)discard;
 // Shallow swells bend the long neon reflections in the flooded avenue.
 vec2 slope=vec2(0.);
 float flood=roadFlood(vRoad.y);
 if(flood>0.) slope=flood*vec2(.29*cos(vRoad.y*1.35+vRoad.x*.63-clock*1.2),
                              .17*sin(vRoad.y*.93-vRoad.x*1.29-clock*.76));
 // The hull pushes two low crests out toward the curbs as it retreats up the avenue.
 float crest=0.;
 if(wake.y>0.){
   float behind=wake.x-vRoad.y;
   float envelope=wake.y*smoothstep(0.,2.,behind)*(1.-smoothstep(8.,18.,behind));
   float ridge=abs(vRoad.x)-(.78+.15*behind);
   crest=envelope*exp(-ridge*ridge*13.);
   slope+=vec2(sign(vRoad.x),.3)*crest*2.4;
 }
 float glint=0.;
 for(int i=0;i<6;i++){float age=impacts[i].z;if(age<0.||age>1.15)continue;vec2 p=vRoad-impacts[i].xy;float d=length(p),front=d-age*1.30;
 float envelope=exp(-front*front/0.022)*exp(-age*2.8)*smoothstep(0.,.05,age);float wave=sin(d*34.-age*16.)*envelope;
 slope+=p/max(d,.03)*wave;glint+=max(0.,wave);}
 vec2 uv=vReflect.xy/vReflect.w;vec3 reflection=texture2D(tDiffuse,uv+slope*.0020).rgb;
 float interior=smoothstep(0.,.018,max(0.,depth)),grain=texture2D(asphalt,vRoad*.18).r;vec3 c=vec3(.010,.008,.018)*(.65+grain*.75)+reflection*(.05+interior*(.62+grazing*.12));
 c+=vec3(.008,.012,.018)*crest+vec3(.09,.12,.15)*glint+roadPaint(vRoad)*.45;gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`};
 const water=new Reflector(new T.PlaneGeometry(CROSSING_REACH*2,140),{textureWidth:384,textureHeight:768,multisample:0,clipBias:.003,shader});water.name='boulevard-reflecting-asphalt';water.renderOrder=-2;water.frustumCulled=false;
 const uniforms=(water.material as T.ShaderMaterial).uniforms;uniforms.relief.value=field.texture;uniforms.asphalt.value=map;uniforms.impacts.value=rain.impacts;
 const groundUniforms={tDiffuse:uniforms.tDiffuse,textureMatrix:uniforms.textureMatrix,grazing:uniforms.grazing,relief:{value:field.texture},asphalt:{value:map},travel:uniforms.travel};
 const groundMaterial=new T.ShaderMaterial({uniforms:groundUniforms,
 vertexShader:`uniform float travel;uniform mat4 textureMatrix;varying vec4 vReflection;varying vec2 vRoad;${roadHeightGLSL}
 void main(){vReflection=textureMatrix*vec4(position,1.);vRoad=vec2(position.x,position.y+travel);vec3 p=position;p.z=roadHeight(vRoad)-WATER_LEVEL;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
 fragmentShader:`uniform sampler2D asphalt,tDiffuse;uniform float grazing;varying vec4 vReflection;varying vec2 vRoad;${roadHeightGLSL}
 void main(){if(roadFootprint(vRoad)<.5)discard;float h=roadHeight(vRoad);
 vec2 delta=vec2(.05625,.1640625);vec3 n=normalize(vec3((roadHeight(vRoad-vec2(delta.x,0.))-roadHeight(vRoad+vec2(delta.x,0.)))/(2.*delta.x),(roadHeight(vRoad-vec2(0.,delta.y))-roadHeight(vRoad+vec2(0.,delta.y)))/(2.*delta.y),1.));
 float grain=texture2D(asphalt,vRoad*.18).r,wet=1.-smoothstep(WATER_LEVEL,WATER_LEVEL+.015,h);float light=.65+max(0.,dot(n,normalize(vec3(-.8,-.5,1.))))*.35;
 // A thin water film follows the rough asphalt, including above the puddle line.
 // Register distortion to the world: the road does not swim when the clock advances.
 vec2 micro=vec2(texture2D(asphalt,vRoad*.61).r,texture2D(asphalt,vRoad.yx*.47+vec2(.31,.17)).r)-.5;
 vec2 uv=vReflection.xy/vReflection.w+n.xy*.018+micro*.003;
 vec2 blur=vec2(.004,.012)*(1.15-grain*.45);
 vec3 reflection=texture2D(tDiffuse,uv).rgb*.36;
 reflection+=(texture2D(tDiffuse,uv+blur).rgb+texture2D(tDiffuse,uv-blur).rgb)*.22;
 reflection+=(texture2D(tDiffuse,uv+blur*vec2(-1.,1.)*1.8).rgb+texture2D(tDiffuse,uv-blur*vec2(-1.,1.)*1.8).rgb)*.10;
 // A rough film catches the color of a lamp without mirroring its bright core.
 float peak=max(reflection.r,max(reflection.g,reflection.b));
 vec3 sheen=reflection/(1.+peak);
 float film=.028+.026*wet+.012*grain+.012*grazing;
 vec3 c=vec3(.027,.024,.034)*(.40+grain*.90)*light*(1.-wet*.22)+sheen*film+roadPaint(vRoad);gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`});
 const ground=new T.Mesh(new T.PlaneGeometry(7.2,140,32,280),groundMaterial);ground.name='boulevard-road-relief';ground.renderOrder=-1;ground.frustumCulled=false;
 // Side streets use the same relief and capture as the main road, with no overlap.
 const armWidth=CROSSING_REACH-3.6,arms=[-1,1].map(side=>new T.PlaneGeometry(armWidth,CROSSING_WIDTH,64,20).translate(side*(CROSSING_REACH+3.6)/2,0,0)),crossGeometry=mergeGeometries(arms);arms.forEach(g=>g.dispose());
 const crossMaterial=new T.ShaderMaterial({vertexShader:groundMaterial.vertexShader,fragmentShader:groundMaterial.fragmentShader,uniforms:{...groundUniforms,travel:{value:FOUNTAIN_Y},textureMatrix:{value:new T.Matrix4()}}});
 const crossGround=new T.Mesh(crossGeometry,crossMaterial),offset=new T.Matrix4();crossGround.name='boulevard-cross-street-asphalt';crossGround.renderOrder=-1;
 crossGround.onBeforeRender=()=>{offset.makeTranslation(0,crossGround.position.y,0);crossMaterial.uniforms.textureMatrix.value.copy(uniforms.textureMatrix.value).multiply(offset);};
 root.add(ground,crossGround,water,rain.root);
 // Capture objects above the puddles, keeping the bank mesh out of its own reflection.
 const capture=water.onBeforeRender;water.onBeforeRender=function(...args){const visible=ground.visible,crossVisible=crossGround.visible;ground.visible=crossGround.visible=false;try{capture.apply(this,args);}finally{ground.visible=visible;crossGround.visible=crossVisible;}};
 return{root,water,ground,crossGround,field,rain,sites,prime:rain.prime,
  update(scroll:number,time:number,reveal:number,defeatTime=0){
   const center=scroll+36;
   root.position.y=center;crossGround.position.y=FOUNTAIN_Y-center;
   uniforms.travel.value=center;uniforms.grazing.value=reveal;uniforms.clock.value=time;
   uniforms.wake.value.set(scroll+boulevardCruiserLead(scroll),reveal*(1-T.MathUtils.smoothstep(defeatTime,0,1.2)));
   rain.update(time,scroll,center);
  },
  setMap(texture:T.Texture){texture.wrapS=texture.wrapT=T.RepeatWrapping;groundUniforms.asphalt.value=texture;uniforms.asphalt.value=texture;},dispose(){water.dispose();}
 };
}
