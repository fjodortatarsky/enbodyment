/**
 * Детерминированный генератор случайных чисел для игрового мира.
 *
 * Он намеренно хранит своё состояние внутри world.meta,
 * чтобы случайность была частью игрового состояния.
 *
 * Это важно для:
 * - повторных запусков;
 * - отладки;
 * - будущей сетевой синхронизации;
 * - детерминированного спавна станций.
 */

export function nextRandom(world) {
  if (!Number.isFinite(world.meta.rngState)) {
    world.meta.rngState = (world.seed >>> 0) || 1;
  }

  // Mulberry32 — простой детерминированный 32-битный генератор.
  world.meta.rngState = (world.meta.rngState + 0x6D2B79F5) | 0;

  let t = world.meta.rngState;

  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomRange(world, min, max) {
  return min + (max - min) * nextRandom(world);
}

export function randomAngle(world) {
  return nextRandom(world) * Math.PI * 2;
}
