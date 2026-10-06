/**
 * Базовые векторные операции.
 *
 * Важный принцип:
 * - чистые функции возвращают новый вектор;
 * - мутирующие функции явно принимают target.
 *
 * Позже это понадобится для физики, камеры, рендера и сети.
 */

export function vec(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function clone(v) {
  return { x: v.x, y: v.y, z: v.z };
}

export function copy(target, source) {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
  return target;
}

export function set(target, x = 0, y = 0, z = 0) {
  target.x = x;
  target.y = y;
  target.z = z;
  return target;
}

export function zero(target) {
  return set(target, 0, 0, 0);
}

export function add(a, b) {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}

export function sub(a, b) {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function scale(v, s) {
  return vec(v.x * s, v.y * s, v.z * s);
}

export function addTo(target, v) {
  target.x += v.x;
  target.y += v.y;
  target.z += v.z;
  return target;
}

export function subFrom(target, v) {
  target.x -= v.x;
  target.y -= v.y;
  target.z -= v.z;
  return target;
}

export function multiplyScalar(target, s) {
  target.x *= s;
  target.y *= s;
  target.z *= s;
  return target;
}

export function addScaledTo(target, v, s) {
  target.x += v.x * s;
  target.y += v.y * s;
  target.z += v.z * s;
  return target;
}

export function lengthSq(v) {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function length(v) {
  return Math.sqrt(lengthSq(v));
}

export function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

export function distance(a, b) {
  return Math.sqrt(distanceSq(a, b));
}

export function normalize(v) {
  const len = length(v);

  if (len === 0) {
    return vec(0, 0, 0);
  }

  return scale(v, 1 / len);
}
