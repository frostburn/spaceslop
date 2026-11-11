// Coordinates use the same fraction of the viewport half-height in the sky
// pass and on rock fragments. An exposed face never outruns the wall opening.
export const wallRiftShape = /* glsl */ `
  vec2 fonsRiftLocal(vec2 p, float side) {
    return vec2(p.x + side * p.y * .31, p.y) / vec2(.112, .181);
  }

  float fonsRiftRadius(vec2 local, float time) {
    float turn = atan(local.y, local.x + .000001);
    float edge = .11 * sin(turn * 3.0 + time * 2.2) + .065 * cos(turn * 7.0 - time * 3.8);
    return length(local) - edge;
  }
`;
