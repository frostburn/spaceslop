import { titanCloudNoise } from '../titan-cloud-relief';

// A panoramic slice of the haze and exposed peaks from Titan's ascent. The
// caller unwraps a strip of the tunnel wall into this local panorama space.
export const titanEcho = /* glsl */ `${titanCloudNoise}
  vec3 titanVista(vec2 uv) {
    float y = uv.y;
    vec2 p = vec2(uv.x * 2.4, y * 5.4);
    float hills = cloudNoise(p * .82);
    float detail = cloudNoise(p * 2.12 + vec2(hills * 1.4, 17.0));
    float wisps = cloudNoise(p * vec2(4.2, 6.8) + 31.7);
    float clouds = smoothstep(.28, .77, hills * .64 + detail * .27 + wisps * .09);
    float light = smoothstep(.0, .34, clouds - cloudNoise(p * .82 - vec2(.19, .35)) + .17);
    vec3 sky = mix(vec3(.44, .19, .059), vec3(.027, .012, .036), smoothstep(.48, 1.04, y));
    vec3 haze = mix(vec3(.16, .050, .018), vec3(1.0, .57, .23), light);
    sky = mix(sky, haze, clouds * (.80 - .27 * y));

    float ridge = .26 + .24 * cloudNoise(vec2(uv.x * 1.9, 3.8));
    float crags = cloudNoise(vec2(uv.x * 5.9, 7.8));
    float peak = ridge + crags * .085;
    float mountain = 1.0 - smoothstep(peak - .011, peak + .011, y);
    vec3 rock = mix(vec3(.018, .009, .027), vec3(.13, .050, .035), crags);
    sky = mix(sky, rock, mountain * smoothstep(.09, .34, y) * .88);
    float foreground = smoothstep(.38, .69, cloudNoise(p * 1.2 + vec2(7.2, 3.6)));
    return mix(sky, haze * .74, foreground * (1.0 - smoothstep(.19, .52, y)) * .85);
  }
`;
