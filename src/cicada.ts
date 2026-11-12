// Combat timing shared by the simulation, animation and inspection tools.
export const CICADA_HP=80;
export const TITAN_ASCENT=7;
export const CICADA_INTERVAL=3.6;
export const CICADA_WINDUP=.65;
export const CICADA_FIRE=1.55;
export const CICADA_TRAVEL=.9;
export const CICADA_VENT_X = 2.4;
export const CICADA_VENT_Z = .88;

// Unmatched lateral, lift and depth rhythms keep the arcs from repeating on
// the volley clock. The bank follows sideways velocity into each turn.
export function cicadaFlight(time: number) {
  const u = Math.max(0, Math.min(1, (time + 2.7) / 2.7));
  const gain = u * u * (3 - 2 * u);
  const swing = .79 * time;
  const correction = 1.41 * time + .6;
  const lateralSpeed = 1.32 * .79 * Math.cos(swing) + .43 * 1.41 * Math.cos(correction);
  return {
    x: gain * (1.32 * Math.sin(swing) + .43 * Math.sin(correction)),
    y: gain * (.39 * Math.sin(1.13 * time + .4) + .22 * Math.sin(.61 * time - .9)),
    z: gain * (.68 * Math.sin(.54 * time - .7) + .24 * Math.sin(1.19 * time)),
    yaw: gain * (.19 * Math.sin(swing + .72) + .05 * Math.sin(correction)),
    bank: gain * -.15 * lateralSpeed,
  };
}

export function cicadaVent(time: number, side: -1 | 1) {
  const pose = cicadaFlight(time);
  // Rotate the local vent by yaw, then bank, matching the rig's ZYX order.
  const x = side * CICADA_VENT_X * Math.cos(pose.yaw) + CICADA_VENT_Z * Math.sin(pose.yaw);
  return {
    x: pose.x + x * Math.cos(pose.bank),
    y: pose.y + x * Math.sin(pose.bank),
    z: pose.z + CICADA_VENT_Z * Math.cos(pose.yaw) - side * CICADA_VENT_X * Math.sin(pose.yaw),
  };
}
