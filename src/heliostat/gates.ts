import * as T from 'three';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';
import { electricSites,electricPose,ELECTRIC_GAP,HELIOSTAT_SPEED } from './combat';

export function createElectricGates(m:HeliostatMaterials) {
  const root=new T.Group(); root.name='capacitor-discharge-gates';
  const clock={value:0};
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
    uniforms:{clock,hot:{value:0},charge:{value:0}},
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float clock,hot,charge;varying vec2 v;
      void main(){float ridge=.5+.13*sin(v.x*61.+clock*42.)+.08*sin(v.x*139.-clock*31.);
      float core=exp(-abs(v.y-ridge)*(hot>.5?28.:18.));
      float dash=hot>.5?1.:step(.5,fract(v.x*13.-clock*.7));
      gl_FragColor=vec4(mix(vec3(1.,.35,.06),vec3(.55,.8,1.),hot)*(1.+2.*hot),core*dash*(.25+.75*charge));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const gates=electricSites.map((site,i)=>{
    const node=new T.Group(),b=heliostatBatch(node);node.position.y=site.at*HELIOSTAT_SPEED;root.add(node);
    for(const side of[-1,1]) {
      b.rod([side*4.35,0,-6.5],[side*4.35,0,.18],.12,m.titanium,10);
      b.box([.55,.8,.65],[side*4.35,0,-.2],m.dark,.08);
      for(let j=0;j<4;j++) b.ring(.18,.035,[side*4.35,0,-.9+j*.23],m.copper,[0,0,0]);
      b.add(new T.SphereGeometry(.18,12,8),m.amber,[side*4.15,0,.03]);
    }
    b.finish();const shader=material.clone();shader.uniforms.clock=clock;
    const beams=new T.Group();node.add(beams);
    for(const side of[-1,1]) {
      const edge=side*4.15, gap=site.gap+side*ELECTRIC_GAP/2, length=Math.abs(edge-gap);
      const beam=new T.Mesh(new T.PlaneGeometry(length,.48),shader);beam.position.set((edge+gap)/2,0,.06);beam.frustumCulled=false;beams.add(beam);
      const tip=new T.Mesh(new T.TorusGeometry(.13,.025,6,20),m.cyan);tip.position.set(gap,0,.06);beams.add(tip);
    }
    return {root:node,beams,material:shader,site:i};
  });
  material.dispose();
  return {root,gates,update(time:number) {
    clock.value=time;
    for(const gate of gates) {
      const p=electricPose(gate.site,time);gate.root.visible=p.visible;
      gate.beams.visible=p.warning||p.hot;gate.material.uniforms.hot.value=+p.hot;gate.material.uniforms.charge.value=p.charge;
    }
  },prime(){for(const g of gates){g.root.visible=true;g.beams.visible=true;}}};
}
