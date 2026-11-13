import * as T from 'three';
import type { RegulatorState } from '../heliostat/boss';
import { heliostatPlasmaPhase } from '../heliostat/combat';
import type { PlasmaResources } from '../heliostat/plasma';
import { HEIGHT } from '../playfield';

const wallDepth = -134;
const halfHeight = HEIGHT / 2;

// Independent drifts across the upper wall, in half-height screen coordinates.
export function regulatorPortal(side: -1 | 1, time: number) {
  const phase = side < 0 ? .55 : 2.46;
  return {
    x: side * (.303 + .111 * Math.sin(time * .81 + phase) + .042 * Math.cos(time * 1.57 - phase)),
    y: .681 + .100 * Math.sin(time * .57 - phase) + .046 * Math.cos(time * 1.23 + phase),
    roll: -side * .38 + .33 * Math.sin(time * .76 + phase),
  };
}

export const regulatorPortalShader = /* glsl */ `
  uniform vec4 regulatorPortals[2];

  vec2 bendAtRegulatorPortal(vec2 ray, vec4 portal, vec2 screen) {
    if (portal.z < .002) return ray;
    vec2 offset = screen - portal.xy;
    float pull = portal.z * .43 * exp(-dot(offset, offset) * 122.0);
    return ray + vec2(-offset.y, offset.x) * pull;
  }

  vec3 drawRegulatorPortal(vec3 sky, vec4 portal, vec2 screen, float travel) {
    if (portal.z < .002) return sky;
    vec2 p = rotateRay(screen - portal.xy, portal.w);
    if (abs(p.x) > .13 || abs(p.y) > .15) return sky;
    vec2 local = p / (vec2(.060, .079) * max(.08, sqrt(portal.z)));
    float angle = atan(local.y, local.x + .000001);
    float ribs = angle * 7.0 - travel * 3.6;
    float radius = length(local) + .045 * sin(ribs) + .025 * sin(angle * 13.0 + travel * 4.2);
    float edge = radius - 1.0;
    float inside = 1.0 - smoothstep(-.034, .002, edge);

    // A boiling photosphere is visible through the tear in the wall.
    vec2 churn = local * 5.0 + vec2(travel * .27, -travel * .21);
    float cells = cloudNoise(churn);
    float granules = cloudNoise(churn * 2.8 + cells * 2.9);
    float heat = smoothstep(.31, .85, cells * .57 + granules * .43);
    float funnel = lobe(angle * 5.0 + radius * 14.0 - travel * 5.1, 3.2);
    vec3 star = mix(vec3(.31, .025, .008), vec3(2.1, .91, .17), heat);
    star *= .17 + .83 * smoothstep(.18, .93, radius);
    star += vec3(1.27, .37, .048) * funnel * .36 * smoothstep(.08, .67, radius);

    float ring = exp(-abs(edge) * 46.0) * (.68 + .32 * lobe(ribs, 2.1));
    float corona = exp(-abs(edge) * 9.0) * (.28 + .72 * lobe(angle * 4.0 + travel * 1.7, 1.4));
    float seam = exp(-abs(radius - 1.14) * 50.0) * lobe(angle * 11.0 - travel * 1.8, 4.0);
    sky = mix(sky, star, inside * smoothstep(.08, .55, portal.z));
    return sky + portal.z * (vec3(2.6, 1.35, .46) * ring * .86
      + vec3(1.07, .22, .065) * corona * .27 + vec3(.80, .34, .10) * seam * .67);
  }
`;

export function createRegulatorPortalFeeds(resources: PlasmaResources, intakes: readonly T.Object3D[]) {
  const root = new T.Group();
  root.name = 'wormhole-regulator-portal-feeds';
  const feeds = ([-1, 1] as const).map((side, index) => {
    const path = [new T.Vector3(0, 0, wallDepth), new T.Vector3(), new T.Vector3(), new T.Vector3()];
    const tube = resources.tube(path, false, 1.55);
    tube.root.name = side < 0 ? 'left-portal-feed' : 'right-portal-feed';
    root.add(tube.root);
    return { side, path, tube, intake: intakes[index] };
  });
  root.visible = false;
  return {
    root,
    update(clock: number, distance: number, opening: number, windup: number, state: RegulatorState) {
      root.visible = opening > .002;
      if (!root.visible) return;
      root.updateWorldMatrix(true, false);
      const scale = (1 - wallDepth / distance) * halfHeight;
      for (const { side, path, tube, intake } of feeds) {
        const [source, bend, approach, destination] = path;
        const portal = regulatorPortal(side, clock);
        // Unproject the opening so the stream stays attached as it moves.
        source.set(portal.x * scale, portal.y * scale, wallDepth);
        root.worldToLocal(intake.getWorldPosition(destination));
        bend.set(source.x + side * .9, source.y - 6.2, T.MathUtils.lerp(source.z, destination.z, .28));
        approach.set(destination.x + side * 3.1, destination.y + 4.3, T.MathUtils.lerp(source.z, destination.z, .79));
        tube.setPath(path);
        const channel = state.active ? heliostatPlasmaPhase(state.attackTime, side, state.pattern).strength : 0;
        const fault = side > 0 ? Math.min(1, state.unstable / .9) * (.14 + .10 * Math.sin(clock * 6.7)) : 0;
        tube.pose(clock, opening * (.56 + .32 * Math.max(channel, windup)) * (1 - fault));
      }
    },
  };
}
