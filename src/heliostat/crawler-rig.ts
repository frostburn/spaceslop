import * as T from 'three';
import {part,pivot} from '../rig-geometry';
import {heliostatBatch} from './geometry';
import type {HeliostatMaterials} from './materials';
import {CRAWLER_RAIL_X,CRAWLER_RAIL_Z,type crawlerPose} from './crawler';

const sleeveLength = 1.40, rollerRadius = 0.136;
const cutterSocket = 0.43;

function turned(profile: [number, number][], segments = 18) {
  return new T.LatheGeometry(profile.map(([radius, axis]) => new T.Vector2(radius, axis)), segments);
}

/** Shared buffers with per-crawler lift, clamp and cutter poses. */
export function createCrawlerAssets(m: HeliostatMaterials) {
  const root = new T.Group();
  const body = pivot(root, 'crawler-carriage', 0, 0, 0);
  const head = pivot(root, 'crawler-contact', 0, 0, 0);
  const mast = pivot(root, 'crawler-mast', 0, 0, 0);
  const b = heliostatBatch(body), h = heliostatBatch(head);
  b.plate([[-0.22, -0.65], [0.22, -0.65], [0.32, -0.47], [0.32, 0.45], [0.22, 0.67],
    [-0.22, 0.67], [-0.32, 0.45], [-0.32, -0.47]], 0.20, 0.039, [0, 0, 0.284], m.dark);
  b.ring(0.197, 0.033, [0, 0, 0.376], m.copper, [0, 0, 0], 18);

  const tread = turned([[0, -0.126], [0.148, -0.126], [0.175, -0.101], [0.177, -0.062], [0.150, -0.042],
    [rollerRadius, -0.024], [rollerRadius, 0.024], [0.150, 0.042], [0.177, 0.062],
    [0.175, 0.101], [0.148, 0.126], [0, 0.126]]).rotateZ(Math.PI / 2);
  for (const y of [-0.439, 0.439]) {
    const wheel = pivot(body, 'crawler-wheel', 0, y, 0.166);
    const w = heliostatBatch(wheel);
    w.add(tread.clone(), m.graphite);
    w.rod([-0.194, 0, 0], [0.194, 0, 0], 0.068, m.titanium, 8);
    for (const side of [-1, 1]) {
      w.box([0.02, 0.058, 0.025], [side * 0.151, -0.075, 0], m.copper, 0.005);
      b.box([0.127, 0.203, 0.174], [side * 0.229, y, 0.202], m.blue, 0.027);
    }
    w.finish();
  }
  tread.dispose();

  for (const side of [-1, 1]) {
    b.plate([[0.16, -0.49], [0.24, -0.54], [0.365, -0.31], [0.367, 0.36], [0.27, 0.57], [0.17, 0.43]]
      .map(([x, y]) => [side * x, y]), 0.082, 0.019, [0, 0, 0.419], m.ceramic);
    for (const y of [-0.22, 0, 0.22]) {
      b.box([0.088, 0.034, 0.025], [side * 0.279, y, 0.47], m.blue, 0.005, [0, 0, side * 0.32]);
    }
    b.pipe([[side * 0.138, -0.49, 0.31], [side * 0.108, -0.36, 0.414],
      [side * 0.124, -0.22, 0.424], [side * 0.16, -0.134, 0.373]], 0.028, m.copper);
    for (const y of [-0.58, 0.58]) {
      b.rod([side * 0.233, y - 0.065, 0.239], [side * 0.233, y + 0.065, 0.239], 0.068, m.titanium, 10);
      const clamp = pivot(body, 'crawler-clamp', side * 0.233, y, 0.239);
      const jaw = heliostatBatch(clamp);
      jaw.pipe([[0, 0, 0], [side * 0.017, 0, -0.125], [-side * 0.064, 0, -0.211],
        [-side * 0.148, 0, -0.246]], 0.043, m.copper);
      jaw.box([0.099, 0.145, 0.054], [-side * 0.147, 0, -0.248], m.graphite, 0.016);
      jaw.finish();
    }
  }
  b.finish();

  for (const [i, material] of [m.dark, m.blue, m.titanium, m.dark].entries()) {
    const sleeve = pivot(mast, 'crawler-mast-sleeve', 0, 0, 0), tube = heliostatBatch(sleeve);
    const r = 0.197 - i * 0.032, end = sleeveLength * 0.5, bore = r - 0.019;
    tube.add(turned([[bore, -end], [r - 0.009, -end], [r, -end + 0.054], [r, end - 0.11],
      [r + 0.009, end - 0.075], [r + 0.009, end - 0.026], [r, end], [bore, end], [bore, -end]], 12), material);
    tube.ring(r - 0.001, 0.013, [0, end - 0.08, 0], i % 2 ? m.titanium : m.copper, [Math.PI / 2, 0, 0], 14);
    tube.box([0.034, 0.53, 0.017], [0, 0.05, r * 0.996], m.graphite, 0.005);
    tube.finish();
  }

  h.plate([[-0.46, -0.16], [-0.25, -0.32], [0.04, -0.307], [0.21, -0.23], [0.267, -0.105],
    [0.267, 0.105], [0.21, 0.23], [0.04, 0.307], [-0.25, 0.32], [-0.46, 0.16]], 0.225, 0.032, [0, 0, 0], m.blue);
  h.rod([0, 0, -0.147], [0, 0, -0.074], 0.119, m.copper, 12);
  h.plate([[-0.37, -0.12], [-0.24, -0.179], [-0.077, -0.122], [-0.017, 0],
    [-0.077, 0.122], [-0.24, 0.179], [-0.37, 0.12]], 0.063, 0.015, [0, 0, 0.126], m.ceramic);
  h.box([0.091, 0.067, 0.017], [-0.236, 0, 0.171], m.cyan, 0.012);
  h.add(turned([[0.054, 0.14], [0.128, 0.14], [0.145, 0.192], [0.139, 0.321], [0.111, 0.412],
    [0.084, cutterSocket], [0.064, 0.405], [0.054, 0.329], [0.054, 0.14]]).rotateZ(-Math.PI / 2), m.graphite, [0, 0, 0.06]);
  h.ring(0.110, 0.017, [0.325, 0, 0.06], m.copper, [0, Math.PI / 2, 0], 20);
  h.ring(0.082, 0.012, [0.406, 0, 0.06], m.titanium, [0, Math.PI / 2, 0], 18);
  for (const side of [-1, 1]) {
    h.rod([0.077, side * 0.213, 0.009], [0.077, side * 0.213, 0.156], 0.062, m.titanium, 10);
    const shield = pivot(head, 'crawler-cutter-shield', 0.077, side * 0.213, 0.09);
    const panel = heliostatBatch(shield);
    panel.plate([[-0.15, 0.038], [-0.056, -0.074], [0.139, -0.105], [0.284, -0.065],
      [0.237, 0.033], [0.072, 0.1], [-0.10, 0.091]].map(([x, y]) => [x, side * y]), 0.084,
      0.017, [0, 0, 0], m.ceramic);
    panel.box([0.115, 0.034, 0.02], [0.125, side * 0.012, 0.061], m.copper, 0.005, [0, 0, -side * 0.31]);
    panel.finish();
  }
  h.finish();
  return { template: root, line: new T.CylinderGeometry(1, 1, 1, 8),
    emitter: new T.SphereGeometry(0.066, 12, 8).scale(0.24, 1, 1) };
}
export function createCrawlerRig(assets:ReturnType<typeof createCrawlerAssets>){
  const root=assets.template.clone(true);root.name='rail-maintenance-crawler';
  const body=root.getObjectByName('crawler-carriage')!,head=root.getObjectByName('crawler-contact')!,mast=root.getObjectByName('crawler-mast')!;
  const wheels=root.getObjectsByProperty('name','crawler-wheel'),clamps=root.getObjectsByProperty('name','crawler-clamp');
  const sleeves=root.getObjectsByProperty('name','crawler-mast-sleeve'),shields=root.getObjectsByProperty('name','crawler-cutter-shield');
  const emitter=part(head,assets.emitter,new T.MeshBasicMaterial({color:0xffaf37}),cutterSocket,0,0.06);
  emitter.name='crawler-emitter';
  const clock={value:0},warningMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    uniforms:{clock},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float clock;varying vec2 v;void main(){float dash=step(.45,fract(v.y*18.-clock*.55));
      gl_FragColor=vec4(1.8,.62,.08,dash*.65);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const warning=new T.Group();warning.name='crawler-sweep-warning';root.add(warning);
  const guides=Array.from({length:3},()=>{const line=new T.Mesh(assets.line,warningMaterial);line.frustumCulled=false;warning.add(line);return line;});
  const beam=new T.Group();beam.name='crawler-cutting-beam';root.add(beam);
  const beams=[[.14,new T.Color(1.7,.28,.015),.24],[.037,new T.Color(3.2,2.1,.75),1]].map(([radius,color,opacity])=>{
    const mesh=new T.Mesh(assets.line,new T.MeshBasicMaterial({color:color as T.Color,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:opacity as number}));mesh.frustumCulled=false;beam.add(mesh);return{mesh,radius:radius as number};
  });
  const a=new T.Vector3(),delta=new T.Vector3(),up=new T.Vector3(0,1,0);
  function line(mesh:T.Object3D,start:{x:number;y:number;z?:number},end:{x:number;y:number;z?:number},radius:number){
    a.set(start.x,start.y,start.z??.06);delta.set(end.x-a.x,end.y-a.y,(end.z??.06)-a.z);
    const length=Math.max(.001,delta.length());mesh.position.copy(a).addScaledVector(delta,.5);mesh.quaternion.setFromUnitVectors(up,delta.multiplyScalar(1/length));mesh.scale.set(radius,length,radius);
  }
  return{root,head,beam,warning,pose(p:ReturnType<typeof crawlerPose>,time:number){
    body.position.set(p.side*CRAWLER_RAIL_X,p.physicalY,CRAWLER_RAIL_Z);
    head.position.set(p.head.x,p.head.y,p.head.z);head.rotation.z=p.heading;
    mast.position.copy(body.position);mast.position.z+=.25;
    delta.copy(head.position).sub(mast.position);delta.z-=.08;
    const reach=delta.length();mast.quaternion.setFromUnitVectors(up,delta.divideScalar(reach));
    sleeves.forEach((s,i)=>s.position.y=reach*(i+1)/sleeves.length-sleeveLength*.5);
    wheels.forEach(w=>w.rotation.x=-p.travel/rollerRadius);
    clamps.forEach(c=>c.rotation.y=Math.sign(c.position.x)*(-.08+.29*p.brace));
    shields.forEach(s=>s.rotation.z=Math.sign(s.position.y)*(.042+.32*p.charge));
    emitter.material.color.setRGB(.7+p.charge*2.4,.17+p.charge*1.1,.025+p.charge*.2);
    clock.value=time;warning.visible=p.warning;beam.visible=p.hot;
    line(guides[0],p.muzzle,p.start,.014);line(guides[1],p.muzzle,p.end,.014);line(guides[2],p.start,p.end,.014);
    beams.forEach(b=>line(b.mesh,p.muzzle,p.target,b.radius));
  },prime(){const state=[warning.visible,beam.visible];warning.visible=beam.visible=true;return()=>{warning.visible=state[0];beam.visible=state[1];};}};
}
