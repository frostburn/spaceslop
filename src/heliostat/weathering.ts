import type { MeshStandardMaterial } from 'three';

/** Surface-local dirt survives scrolling, turning, cloned bays and map changes. */
export function weatherHeliostatMaterial(material:MeshStandardMaterial,corrosion:number,copper=false){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 patinaPosition,patinaNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\npatinaPosition=position;patinaNormal=normal;');
    shader.fragmentShader=`varying vec3 patinaPosition,patinaNormal;
      float patinaHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
      float patinaNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(patinaHash(i),patinaHash(i+vec2(1.,0.)),f.x),mix(patinaHash(i+vec2(0.,1.)),patinaHash(i+1.),f.x),f.y);}
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 pn=abs(patinaNormal);vec2 pp=pn.z>max(pn.x,pn.y)?patinaPosition.xy:pn.x>pn.y?patinaPosition.yz:patinaPosition.xz;
      float broad=patinaNoise(pp*1.1+vec2(8.4,2.8));
      float streak=patinaNoise(pp*vec2(5.8,.32)+vec2(3.2,9.7));
      float grit=patinaNoise(pp*17.7);
      float detail=1.-smoothstep(.12,.6,length(fwidth(pp))*17.7);
      float grime=smoothstep(.36,.76,broad)*(.3+.7*streak);
      float dust=smoothstep(.35,.85,patinaNoise(pp*.45+12.7))*(.13+.2*max(0.,patinaNormal.z));
      float corrosion=smoothstep(.62,.83,broad*.63+streak*.37)*mix(.65,grit,detail)*${corrosion.toFixed(3)};
      diffuseColor.rgb*=1.-grime*.58;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.105,.079,.047),dust);
      diffuseColor.rgb=mix(diffuseColor.rgb,${copper?'vec3(.055,.12,.095)':'vec3(.20,.061,.018)'},corrosion);
      diffuseColor.rgb*=1.-detail*smoothstep(.68,.86,grit)*grime*.24;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+grime*.2+dust*.18+corrosion*.25,0.,1.);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>',
      '#include <metalnessmap_fragment>\nmetalnessFactor*=1.-min(.85,corrosion*.85+dust*.3+grime*.15);');
  };
  material.customProgramCacheKey=()=>`heliostat-patina-v1-${corrosion}-${copper}`;
}
