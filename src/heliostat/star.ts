import * as T from 'three';

/** Seam-free 3D granulation: hot upwelling cells and cooler, narrow downflows. */
export function createHeliostatStar(){
  const clock={value:0};
  const material=new T.ShaderMaterial({uniforms:{clock},
    vertexShader:`varying vec3 surface,outward,sight;
      void main(){surface=position/4.65;vec4 view=modelViewMatrix*vec4(position,1.);
        outward=normalMatrix*normal;sight=-view.xyz;gl_Position=projectionMatrix*view;}`,
    fragmentShader:`uniform float clock;varying vec3 surface,outward,sight;
      vec3 cellHash(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);
        return fract((p.xxy+p.yxx)*p.zyx);}
      void main(){vec3 p=normalize(surface)*10.5;
        p+=.24*vec3(sin(p.y*1.6+clock*.12),sin(p.z*1.4-clock*.10),sin(p.x*1.7+clock*.09));
        vec3 base=floor(p),f=fract(p);float nearest=10.,second=10.,temperature=0.;
        for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          vec3 offset=vec3(float(x),float(y),float(z)),seed=cellHash(base+offset);
          vec3 delta=offset+.16+seed*.68-f;float d=dot(delta,delta);
          if(d<nearest){second=nearest;nearest=d;temperature=seed.x;}else second=min(second,d);
        }
        float edge=sqrt(second)-sqrt(nearest),aa=max(.012,fwidth(edge));
        float cell=smoothstep(.02-aa,.28+aa,edge);
        float hot=cell*(.64+.36*exp(-nearest*2.));
        vec3 col=mix(vec3(.85,.20,.025),vec3(5.,3.,1.3),hot)*(.83+.28*temperature);
        float mu=clamp(dot(normalize(outward),normalize(sight)),0.,1.);
        col*=.58+.42*sqrt(mu);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const sphere=new T.Mesh(new T.SphereGeometry(4.65,48,32),material);sphere.name='artificial-star';
  // The halo lies at the sphere's centre depth: the photosphere and foreground
  // machinery naturally hide it. It uses the same physical centre at every angle.
  const halo=new T.Mesh(new T.PlaneGeometry(14,14),new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,forceSinglePass:true,
    vertexShader:`varying vec2 q;void main(){q=uv*2.-1.;vec4 centre=modelViewMatrix*vec4(0.,0.,0.,1.);
      centre.xy+=position.xy;gl_Position=projectionMatrix*centre;}`,
    fragmentShader:`varying vec2 q;void main(){float r=length(q);
      float glow=exp(-max(0.,r-.65)*15.)*(1.-smoothstep(.85,1.,r));
      gl_FragColor=vec4(vec3(1.6,.65,.14),glow*.27);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));
  halo.name='photosphere-halo';halo.frustumCulled=false;
  return{sphere,halo,update(time:number){clock.value=time;sphere.rotation.y=time*.023;}};
}
