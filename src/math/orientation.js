/**
 * Математика ориентации камеры.
 *
 * Мы используем простую модель:
 * - yaw   — поворот влево/вправо;
 * - pitch — наклон вверх/вниз;
 * - roll  — крен.
 *
 * Из этих углов строится базис камеры:
 * - forward — куда смотрим;
 * - right   — что справа;
 * - up      — что сверху.
 */

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length3(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function normalize3(v) {
  const len = length3(v);

  if (len === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len,
  };
}

function rotateAroundAxis(v, axis, angle) {
  const k = normalize3(axis);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const dotValue = dot(v, k);
  const crossValue = cross(k, v);

  return {
    x: v.x * cos + crossValue.x * sin + k.x * dotValue * (1 - cos),
    y: v.y * cos + crossValue.y * sin + k.y * dotValue * (1 - cos),
    z: v.z * cos + crossValue.z * sin + k.z * dotValue * (1 - cos),
  };
}

/**
 * Строит базис камеры из yaw/pitch/roll.
 *
 * Система координат:
 * - x — вправо;
 * - y — вверх;
 * - z — вперёд.
 */
export function basisFromYawPitchRoll(yaw, pitch, roll) {
  // Начальное направление: смотрим вперёд по +Z.
  let forward = {
    x: Math.sin(yaw),
    y: 0,
    z: Math.cos(yaw),
  };

  let right = {
    x: Math.cos(yaw),
    y: 0,
    z: -Math.sin(yaw),
  };

  let up = {
    x: 0,
    y: 1,
    z: 0,
  };

  // Тангаж: наклон взгляда вверх/вниз вокруг локальной правой оси.
  forward = rotateAroundAxis(forward, right, pitch);
  up = rotateAroundAxis(up, right, pitch);

  // Крен: наклон камеры влево/вправо вокруг направления взгляда.
  right = rotateAroundAxis(right, forward, roll);
  up = rotateAroundAxis(up, forward, roll);

  // Повторно нормализуем и восстанавливаем ортогональность.
  forward = normalize3(forward);

  right = normalize3(cross(up, forward));
  up = normalize3(cross(forward, right));

  return {
    forward,
    right,
    up,
  };
}
