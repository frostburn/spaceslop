// Distances are in units of GM/c². Each light ray stays in its own orbital plane.
export const SHADOW_IMPACT = Math.sqrt(27);
export const DISK_INNER = 6;
export const DISK_OUTER = 19;
export const ORBIT_MAX_IMPACT = 26;
export const ORBIT_MAX_ANGLE = 3 * Math.PI;
export const ORBIT_COLUMNS = 1025;
export const ORBIT_ROWS = 769;
export const ORBIT_FINE_START = SHADOW_IMPACT - .55;
export const ORBIT_FINE_END = SHADOW_IMPACT + .55;
export const ORBIT_FINE_FIRST = 128;
export const ORBIT_FINE_LAST = 640;

function impactAt(column: number) {
  if (column < ORBIT_FINE_FIRST) return ORBIT_FINE_START * column / ORBIT_FINE_FIRST;
  if (column < ORBIT_FINE_LAST) {
    return ORBIT_FINE_START + (ORBIT_FINE_END - ORBIT_FINE_START) * (column - ORBIT_FINE_FIRST) / (ORBIT_FINE_LAST - ORBIT_FINE_FIRST);
  }
  return ORBIT_FINE_END + (ORBIT_MAX_IMPACT - ORBIT_FINE_END) * (column - ORBIT_FINE_LAST) / (ORBIT_COLUMNS - 1 - ORBIT_FINE_LAST);
}

// Schwarzschild null orbit: u = 1/r, d²u/dφ² = 3u² - u. Start at infinity
// with u = 0 and du/dφ = 1/b, where b is the screen-space impact parameter.
const acceleration = (u: number) => 3 * u * u - u;

export function bakeLightOrbits() {
  const data = new Uint8Array(ORBIT_COLUMNS * ORBIT_ROWS * 4);
  const step = ORBIT_MAX_ANGLE / (ORBIT_ROWS - 1);
  for (let column = 1; column < ORBIT_COLUMNS; column++) {
    let u = 0;
    let velocity = 1 / impactAt(column);
    for (let row = 0; row < ORBIT_ROWS; row++) {
      if (u < 0 || u >= .5) break;
      const offset = (row * ORBIT_COLUMNS + column) * 4;
      const packed = Math.round(u * 2 * 65535);
      data[offset] = packed >> 8;
      data[offset + 1] = packed & 255;
      data[offset + 2] = 255;
      data[offset + 3] = 255;

      // Fourth-order Runge–Kutta integration in orbital angle.
      const a = acceleration(u);
      const middleU = u + velocity * step / 2;
      const middleV = velocity + a * step / 2;
      const middleA = acceleration(middleU);
      const laterU = u + middleV * step / 2;
      const laterV = velocity + middleA * step / 2;
      const laterA = acceleration(laterU);
      const finalA = acceleration(u + laterV * step);
      u += step * (velocity + 2 * middleV + 2 * laterV + velocity + laterA * step) / 6;
      velocity += step * (a + 2 * middleA + 2 * laterA + finalA) / 6;
    }
  }
  return data;
}
