import * as T from 'three';
import { prismLight } from './prism-light';
import type { prismOptics } from './prism-optics';

// Only the river's reflected camera sees this group. The same procedural
// apertures are used by the analytic offscreen crystal environment.
export function createPrismRoof(uniforms:ReturnType<typeof prismOptics>['uniforms']) {
  const root=new T.Group();root.name='prism-reflection-roof';root.visible=false;
  const vertexShader=`varying vec2 vRoof;uniform float caveScroll;
    void main(){vRoof=position.xy+vec2(0,38.0+caveScroll);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const roof=new T.Mesh(new T.PlaneGeometry(24,124),new T.ShaderMaterial({uniforms,side:T.DoubleSide,vertexShader,
    fragmentShader:`${prismLight}varying vec2 vRoof;
      void main(){if(roofOpening(vRoof)>.5)discard;gl_FragColor=vec4(safeHDR(basaltRoof(vRoof)),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}));
  roof.position.set(0,38,5);root.add(roof);
  const sky=new T.Mesh(new T.PlaneGeometry(24,124),new T.ShaderMaterial({uniforms,side:T.DoubleSide,vertexShader,
    fragmentShader:`${prismLight}varying vec2 vRoof;
      void main(){gl_FragColor=vec4(safeHDR(roofStarlight(vRoof)),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}));
  sky.position.set(0,38,5.1);root.add(sky);
  for(const node of [roof,sky])node.frustumCulled=false;
  return root;
}
