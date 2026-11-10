import * as T from 'three';
import {smooth} from './layout';
import {summerNoise} from './noise';

export const lowWispSites=Array.from({length:14},(_,i)=>({x:[-2.8,3.1,-1.2,2.2,.4][i%5],y:16+i*16,z:3.4+(i%3)*.8,width:6.4+(i%4)*.7,height:2.2+(i%3)*.5,angle:(i%2?1:-1)*(.18+(i%3)*.12)}));
export function createLowWisps(){
  const root=new T.Group();root.name='summer-low-cloud-wisps';const clock={value:0},fade={value:1},geometry=new T.PlaneGeometry(1,1);
  const veils=lowWispSites.map((site,i)=>{
    const material=new T.ShaderMaterial({uniforms:{clock,fade,seed:{value:i*3.71}},transparent:true,depthWrite:false,side:T.DoubleSide,
      vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform float clock;uniform float fade;uniform float seed;varying vec2 p;${summerNoise}
       void main(){vec2 q=p;float curl=n(vec2(q.x*2.1+seed,clock*.025+seed))-.5;
         float edge=1.-smoothstep(.28,1.,length(vec2(q.x*.93,q.y*1.2+curl*.35)));
         float folds=n(vec2(q.x*3.1-clock*.06+seed,q.y*3.7+seed));
         float silk=n(vec2(q.x*5.3+seed,q.y*9.1+curl+clock*.025));
         float alpha=edge*smoothstep(.15,.6,folds*.72+silk*.28)*.26*fade;
         gl_FragColor=vec4(vec3(.95,.97,.98),alpha);
         #include <tonemapping_fragment>
         #include <colorspace_fragment>
       }`});
    const mesh=new T.Mesh(geometry,material);mesh.name='low-wisp-'+i;mesh.position.set(site.x,site.y,site.z);mesh.rotation.z=site.angle;mesh.scale.set(site.width,site.height,1);root.add(mesh);return mesh;
  });
  return{root,veils,clock,fade,update(scroll:number,time:number){clock.value=time;fade.value=1-smooth((scroll-220)/38);veils.forEach((mesh,i)=>{const site=lowWispSites[i];mesh.visible=Math.abs(site.y-scroll)<22&&fade.value>.001;mesh.position.x=site.x+.45*Math.sin(time*.07+i*2.3);mesh.rotation.z=site.angle+.018*Math.sin(time*.13+i);});},
    prime(){const states=veils.map(m=>[m.visible,m.position.y] as const),old=fade.value;fade.value=1;veils.forEach(m=>{m.visible=true;m.position.y=0;});return()=>{fade.value=old;veils.forEach((m,i)=>{m.visible=states[i][0];m.position.y=states[i][1];});};}};
}
