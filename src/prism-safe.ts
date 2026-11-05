// Keep invalid/overflowing lighting out of half-float buffers before filtering:
// one NaN otherwise spreads through the reflection and bloom into black tiles.
export const prismSafe = `
 vec3 safeHDR(vec3 c){return vec3(!isnan(c.r)&&c.r>=0.0?min(c.r,64.0):0.0,!isnan(c.g)&&c.g>=0.0?min(c.g,64.0):0.0,!isnan(c.b)&&c.b>=0.0?min(c.b,64.0):0.0);}
 float positivePow(float x,float p){return pow(max(0.0,x),p);}
`;
export const prismView = `
 uniform vec3 caveEye;
 float prismSweep(vec3 source){vec3 v=caveEye-source;
   return clamp(atan(v.x,max(abs(v.z),.1))*.7+atan(v.y,max(abs(v.z),.1))*.55,-.9,.9);}
 mat2 prismTurn(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
`;
