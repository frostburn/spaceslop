import * as T from 'three';
import {heliostatPlasmaControls,heliostatPlasmaPhase,type PlasmaPoint} from './combat';

/** One preallocated parametric tube is shared by every feed, core and halo. */
export function createPlasmaResources(){
  const p:number[]=[],uv:number[]=[],indices:number[]=[],length=72,sides=12;
  for(let i=0;i<=length;i++)for(let j=0;j<=sides;j++){p.push(i/length,Math.cos(j/sides*Math.PI*2),Math.sin(j/sides*Math.PI*2));uv.push(i/length,j/sides);}
  for(let i=0;i<length;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  function tube(points:readonly PlasmaPoint[],extend=false,size=1){
    const root=new T.Group(),uniforms={a:{value:new T.Vector3()},b:{value:new T.Vector3()},c:{value:new T.Vector3()},d:{value:new T.Vector3()},clock:{value:0},growth:{value:1},strength:{value:1},extend:{value:extend}};
    for(const [radius,opacity,core]of[[.45,.18,0],[.18,.65,0],[.055,1,1]]){
      const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
        uniforms:{...uniforms,radius:{value:radius*size},opacity:{value:opacity},core:{value:core}},
        vertexShader:`uniform vec3 a,b,c,d;uniform float radius,clock,growth;uniform bool extend;varying vec2 v;varying float facing;
          void main(){float q=uv.x*growth,t=extend?min(1.,q/.84):q,s=1.-t;
          vec3 centre=s*s*s*a+3.*s*s*t*b+3.*s*t*t*c+t*t*t*d;
          vec3 tangent=normalize(3.*s*s*(b-a)+6.*s*t*(c-b)+3.*t*t*(d-c));
          if(extend&&q>.84)centre+=normalize(d-c)*(q-.84)/.16*3.;
          vec3 n=normalize(cross(tangent,abs(tangent.z)<.9?vec3(0.,0.,1.):vec3(0.,1.,0.)));
          vec3 radial=n*cos(uv.y*6.283185)+cross(tangent,n)*sin(uv.y*6.283185);
          centre+=(n*sin(q*84.-clock*14.)+cross(tangent,n)*sin(q*59.+clock*11.))*.055*sin(t*3.141593);
          float flutter=1.+.17*sin(q*73.-clock*21.+uv.y*9.)+.09*sin(q*131.+clock*17.);
          vec4 world=modelMatrix*vec4(centre+radial*radius*flutter,1.);
          facing=abs(dot(normalize(mat3(modelMatrix)*radial),normalize(cameraPosition-world.xyz)));
          v=vec2(q,uv.y);gl_Position=projectionMatrix*viewMatrix*world;
          }`,
        fragmentShader:`uniform float clock,strength,opacity,core;varying vec2 v;varying float facing;
          void main(){float flow=.55+.25*sin(v.x*87.-clock*19.+v.y*13.)+.2*sin(v.x*147.-clock*31.-v.y*23.);
          vec3 col=mix(vec3(2.1,.14,.008),vec3(2.8,.55,.03),clamp(flow,0.,1.));
          col=mix(col,vec3(3.8,2.4,.9),core);
          float edge=mix(pow(clamp(facing,0.,1.),1.3),1.,core),tip=1.-smoothstep(.94,1.,v.x);
          gl_FragColor=vec4(col,strength*opacity*edge*tip*(.55+.45*flow));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          }`});
      const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;root.add(mesh);
    }
    function setPath(next:readonly PlasmaPoint[]){for(const[i,key]of(['a','b','c','d'] as const).entries())uniforms[key].value.set(next[i].x,next[i].y,next[i].z);}
    setPath(points);
    return{root,uniforms,setPath,pose(time:number,strength:number,growth=1){uniforms.clock.value=time;uniforms.strength.value=strength;uniforms.growth.value=growth;}};
  }
  return{geometry,tube};
}
export type PlasmaResources=ReturnType<typeof createPlasmaResources>;

export function createAttackPlasma(resources:PlasmaResources){
  const root=new T.Group();root.name='regulator-channeled-plasma';
  const streams=[-1,1].map(side=>resources.tube(heliostatPlasmaControls(side,{x:side*.75,y:-5.3}),true,1.4));
  streams.forEach(s=>root.add(s.root));root.visible=false;
  return{root,streams,update(time:number,clock:number,targets:readonly {x:number;y:number}[],visible:boolean){
    const p=heliostatPlasmaPhase(time);root.visible=visible&&targets.length===2&&p.strength>0;
    if(!root.visible)return;
    streams.forEach((s,i)=>{s.setPath(heliostatPlasmaControls(i?1:-1,targets[i]));s.pose(clock,p.strength,p.growth);});
  },prime(){root.visible=true;streams.forEach(s=>s.pose(0,1));}};
}
