export const TWO_PI = Math.PI * 2;

export function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Приводит угол к диапазону [-PI, PI].
 */
export function normalizeAngle(angle) {
  let result = angle % TWO_PI;

  if (result > Math.PI) {
    result -= TWO_PI;
  }

  if (result < -Math.PI) {
    result += TWO_PI;
  }

  return result;
}

/**
 * Плавная интерполяция угла по кратчайшей дуге.
 */
export function lerpAngle(from, to, t) {
  const delta = normalizeAngle(to - from);
  return normalizeAngle(from + delta * t);
}
