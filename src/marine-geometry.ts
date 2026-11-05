import * as T from 'three';

// Close both ends of a UV-seamed loft, preserving its skin and material attributes.
// Small end rings still need faces: otherwise the animal is a tube from nose to tail.
export function sealMarineTube(geometry: T.BufferGeometry, rows: number, columns: number, reverse = false) {
  const count = geometry.getAttribute('position').count;
  geometry.deleteAttribute('normal');
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (name === 'normal') continue;
    const values = Array.from(attribute.array);
    for (const row of [0, rows]) for (let component = 0; component < attribute.itemSize; component++) {
      let sum = 0;
      for (let column = 0; column < columns; column++) sum += attribute.getComponent(row * (columns + 1) + column, component);
      values.push(sum / columns);
    }
    geometry.setAttribute(name, new T.BufferAttribute(attribute.array instanceof Uint16Array ? new Uint16Array(values) : new Float32Array(values), attribute.itemSize));
  }
  const indices = Array.from(geometry.index!.array);
  for (let column = 0; column < columns; column++) {
    const last = rows * (columns + 1) + column;
    indices.push(count, column + (reverse ? 1 : 0), column + (reverse ? 0 : 1));
    indices.push(count + 1, last + (reverse ? 0 : 1), last + (reverse ? 1 : 0));
  }
  geometry.setIndex(indices);
  return geometry;
}
