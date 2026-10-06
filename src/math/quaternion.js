/**
 * Кватернионы для 3D-ориентации корабля.
 *
 * Кватернионы лучше углов Эйлера для корабля в космосе:
 * - нет гимнастического замка;
 * - плавная интерполяция;
 * - корректное накопление вращений;
 * - простое применение к векторам.
 */

export function quaternion(x = 0, y = 0, z = 0, w = 1) {
  return { x, y, z, w };
}

export function identity() {
  return quaternion(0, 0, 0, 1);
}

export function fromAxisAngle(axis, angle) {
  const halfAngle = angle / 2;
  const s = Math.sin(halfAngle);

  return {
    x: axis.x * s,
    y: axis.y * s,
    z: axis.z * s,
    w: Math.cos(halfAngle),
  };
}

export function fromYawPitchRoll(yaw, pitch, roll) {
  const cy = Math.cos(yaw * 0.5);
  const sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(pitch * 0.5);
  const sp = Math.sin(pitch * 0.5);
  const cr = Math.cos(roll * 0.5);
  const sr = Math.sin(roll * 0.5);

  return {
    // Правильный маппинг: yaw -> Y, pitch -> X, roll -> Z
    w: cy * cp * cr + sy * sp * sr,
    x: cy * sp * cr + sy * cp * sr,
    y: sy * cp * cr - cy * sp * sr,
    z: cy * cp * sr - sy * sp * cr,
  };
}

export function multiply(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function normalize(q) {
  const len = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);

  if (len === 0) {
    return identity();
  }

  const invLen = 1 / len;

  return {
    x: q.x * invLen,
    y: q.y * invLen,
    z: q.z * invLen,
    w: q.w * invLen,
  };
}

export function conjugate(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}


export function rotateVector(q, v) {
  const qv = { x: v.x, y: v.y, z: v.z, w: 0 };
  const qConjugate = { x: -q.x, y: -q.y, z: -q.z, w: q.w };

  const temp = multiply(q, qv);
  const result = multiply(temp, qConjugate);

  return {
    x: result.x,
    y: result.y,
    z: result.z,
  };
}

export function getForward(q) {
  return rotateVector(q, { x: 0, y: 0, z: 1 });
}

export function getRight(q) {
  return rotateVector(q, { x: 1, y: 0, z: 0 });
}

export function getUp(q) {
  return rotateVector(q, { x: 0, y: 1, z: 0 });
}

export function slerp(a, b, t) {
  let cosHalfTheta = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;

  if (cosHalfTheta < 0) {
    b = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
    cosHalfTheta = -cosHalfTheta;
  }

  if (Math.abs(cosHalfTheta) >= 1.0) {
    return { x: a.x, y: a.y, z: a.z, w: a.w };
  }

  const halfTheta = Math.acos(cosHalfTheta);
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);

  if (Math.abs(sinHalfTheta) < 0.001) {
    return {
      x: (a.x + b.x) * 0.5,
      y: (a.y + b.y) * 0.5,
      z: (a.z + b.z) * 0.5,
      w: (a.w + b.w) * 0.5,
    };
  }

  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

  return {
    x: a.x * ratioA + b.x * ratioB,
    y: a.y * ratioA + b.y * ratioB,
    z: a.z * ratioA + b.z * ratioB,
    w: a.w * ratioA + b.w * ratioB,
  };
}
