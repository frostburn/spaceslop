import * as T from 'three';

// One bounded scene capture for all hot-water jets. Depth rejection prevents a
// displaced background sample from pulling foreground actors into a vent.
export function createVentHeat(emitters:readonly {x:number;y:number;z:number}[]){
 const target=new T.WebGLRenderTarget(1,1,{depthTexture:new T.DepthTexture(1,1,T.UnsignedIntType),stencilBuffer:false});
 const size=new T.Vector2(),viewport=new T.Vector4(),scissorBox=new T.Vector4();
 const uniforms={sceneColor:{value:target.texture},sceneDepth:{value:target.depthTexture},resolution:{value:new T.Vector2(1,1)},clock:{value:0}};
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms,
  vertexShader:`varying vec2 vUv;varying float seed;void main(){vUv=uv;seed=instanceMatrix[3].x*3.7+instanceMatrix[3].y;vec4 p=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*p;}`,
  fragmentShader:`uniform sampler2D sceneColor,sceneDepth;uniform vec2 resolution;uniform float clock;varying vec2 vUv;varying float seed;
   void main(){vec2 p=vUv*2.-1.;float mask=(1.-smoothstep(.35,1.,abs(p.x)))*sin(vUv.y*3.14159);if(mask<.01)discard;
    vec2 uv=gl_FragCoord.xy/resolution;vec2 ripple=vec2(sin(p.y*14.-clock*4.+seed)+sin(p.y*29.+clock*2.+seed)*.4,cos(p.x*9.+p.y*11.-clock*3.+seed)*.45);
    vec2 warped=clamp(uv+ripple*mask*2.6/resolution,vec2(.002),vec2(.998));
    if(texture2D(sceneDepth,uv).r<gl_FragCoord.z-.000002)discard;
    if(texture2D(sceneDepth,warped).r<gl_FragCoord.z-.000002)warped=uv;
    gl_FragColor=vec4(texture2D(sceneColor,warped).rgb,mask*.85);
    #include <colorspace_fragment>
   }`});
 const root=new T.InstancedMesh(new T.PlaneGeometry(1,1),material,emitters.length*2);root.name='vent-heat-refraction';root.frustumCulled=false;
 const pose=new T.Object3D();for(let i=0;i<emitters.length;i++)for(let j=0;j<2;j++){const e=emitters[i];pose.position.set(e.x,e.y,e.z+.45+j*1.3);pose.scale.set(1.05+j*.6,1.9+j*.8,1);pose.updateMatrix();root.setMatrixAt(i*2+j,pose.matrix);}
 function capture(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera){
  renderer.getDrawingBufferSize(size);uniforms.resolution.value.copy(size);
  const k=Math.min(.65,640/size.y),w=Math.max(1,Math.round(size.x*k)),h=Math.max(1,Math.round(size.y*k));if(target.width!==w||target.height!==h)target.setSize(w,h);
  const previous=renderer.getRenderTarget(),scissor=renderer.getScissorTest(),visible=root.visible;renderer.getViewport(viewport);renderer.getScissor(scissorBox);
  root.visible=false;
  try{renderer.setScissorTest(false);renderer.setRenderTarget(target);renderer.render(scene,camera);}
  finally{root.visible=visible;renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissorBox);renderer.setScissorTest(scissor);}
 }
 return{root,capture,update(time:number){uniforms.clock.value=time;}};
}

// Pooled trails live in the flight plane, so emitted bubbles stay behind when a
// ship changes direction. Neither the particles nor their geometry grow in play.
export function createBurnerBubbles(capacity=640){
 const positions=new Float32Array(capacity*3),radii=new Float32Array(capacity),opacity=new Float32Array(capacity),velocity=new Float32Array(capacity*3),lifetimes=new Float32Array(capacity),ages=new Float32Array(capacity).fill(10);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));g.setAttribute('radius',new T.BufferAttribute(radii,1).setUsage(T.DynamicDrawUsage));g.setAttribute('opacity',new T.BufferAttribute(opacity,1).setUsage(T.DynamicDrawUsage));
 const uniforms={height:{value:1}};
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms,
  vertexShader:`attribute float radius,opacity;uniform float height;varying float alpha;void main(){alpha=opacity;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(radius*height*projectionMatrix[1][1]/max(1.,-p.z),1.,22.);}`,
  fragmentShader:`varying float alpha;void main(){vec2 p=gl_PointCoord*2.-1.;float r=length(p);if(r>1.)discard;float rim=smoothstep(.55,.82,r)*(1.-smoothstep(.86,1.,r));float glint=exp(-length(p-vec2(-.35,-.4))*12.);gl_FragColor=vec4(mix(vec3(.28,.57,.65),vec3(.88,.99,1.),glint),alpha*(rim*.65+glint*.9));
   #include <colorspace_fragment>
  }`});
 const root=new T.Points(g,material);root.name='underwater-exhaust-bubbles';root.frustumCulled=false;root.visible=false;
 const inverse=new T.Matrix4(),matrix=new T.Matrix4(),p=new T.Vector3(),direction=new T.Vector3(),size=new T.Vector2();let cursor=0,carry=0;
 function reset(){ages.fill(10);opacity.fill(0);g.attributes.opacity.needsUpdate=true;carry=0;cursor=0;}
 function update(plane:T.Group,sources:readonly T.Mesh[],dt:number,time:number,renderer:T.WebGLRenderer){
  renderer.getDrawingBufferSize(size);uniforms.height.value=size.y;if(dt<=0)return;
  dt=Math.min(dt,.1);plane.updateWorldMatrix(true,false);inverse.copy(plane.matrixWorld).invert();
  for(let i=0;i<capacity;i++){
   ages[i]+=dt;const age=ages[i];if(age>lifetimes[i]){opacity[i]=0;continue;}const a=i*3;
   positions[a]+=velocity[a]*dt+Math.sin(time*11+i*2.3)*dt*.45;positions[a+1]+=(velocity[a+1]+Math.cos(time*9+i)*.35)*dt;positions[a+2]+=(velocity[a+2]+age*.3)*dt;
   radii[i]=(.024+(i%11)*.0028)*(1+age*.35);opacity[i]=Math.sin(Math.PI*Math.min(1,age/lifetimes[i]))*.55;
  }
  carry+=dt;while(carry>=.028){carry-=.028;for(const flame of sources){
   let visible=true;for(let o:T.Object3D|null=flame;o&&o!==plane;o=o.parent)if(!o.visible){visible=false;break;}if(!visible||!flame.parent)continue;
   flame.parent.updateWorldMatrix(true,false);matrix.multiplyMatrices(inverse,flame.parent.matrixWorld);p.set(0,-.12,0).applyMatrix4(matrix);direction.set(0,-1,0).transformDirection(matrix).multiplyScalar(2.2+flame.scale.y);
   const i=cursor++%capacity,a=i*3;positions[a]=p.x+Math.sin(i*78.23)*.1;positions[a+1]=p.y;positions[a+2]=p.z+.08;velocity[a]=direction.x+Math.sin(i*12.7)*.7;velocity[a+1]=direction.y*(.55+(i%13)/16);velocity[a+2]=direction.z+.3+Math.cos(i*9.3)*.3;lifetimes[i]=.3+(i%17)/50;ages[i]=carry;radii[i]=.03;opacity[i]=.15;
  }}
  for(const name of ['position','radius','opacity'])g.attributes[name].needsUpdate=true;
 }
 return{root,reset,update};
}
