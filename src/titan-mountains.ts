import * as T from 'three';
// Deterministic paired ridges leave the authored road corridor unobstructed.
export function createTitanMountains(){
 const root=new T.Group();root.name='titan-mountain-range';
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true});
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight=mix(outgoingLight,vec3(.43,.29,.16),smoothstep(25.0,150.0,length(vViewPosition))*.85);
 #include <opaque_fragment>`);};
 for(const side of [-1,1]){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[],nx=30,ny=180;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
   const x=6+i/nx*46,y=-40+j/ny*380;
   const ridge=Math.pow(Math.sin(Math.PI*i/nx),.8);
   const broad=.55+.45*Math.sin(y*.075+side*.9)*Math.sin(y*.043+1.2);
   const crags=Math.sin(x*.82+y*.31)*Math.cos(y*.49-x*.35)*.95;
   const height=Math.max(0,ridge*(5+broad*13+crags));
   positions.push(side*x,y,height);
   const shade=.5+height*.018+crags*.055;colors.push(shade*.55,shade*.43,shade*.31);
   if(i<nx&&j<ny){const a=j*(nx+1)+i;if(side>0)indices.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1);else indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  root.add(new T.Mesh(geometry,material));
 }
 return root;
}
