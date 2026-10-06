/**
 * Фиксированный временной шаг.
 *
 * Это важно для стабильной физики.
 * А для сетевой игры это будет особенно важно:
 * логика должна жить тиками, а не кадрами браузера.
 */

export function createClock({ fixedDeltaTime, maxSubSteps }) {
  let accumulator = 0;

  function update(frameDelta, timeScale, onTick) {
    const safeFrameDelta = Math.max(0, frameDelta);
    const scaledDelta = safeFrameDelta * timeScale;

    accumulator += scaledDelta;

    let steps = 0;

    while (accumulator >= fixedDeltaTime && steps < maxSubSteps) {
      onTick(fixedDeltaTime);
      accumulator -= fixedDeltaTime;
      steps += 1;
    }

    // Защита от спирали смерти, если вкладка лагает,
    // а времени накопилось слишком много.
    if (steps === maxSubSteps) {
      accumulator = 0;
    }

    return steps;
  }

  function reset() {
    accumulator = 0;
  }

  return Object.freeze({
    update,
    reset,
  });
}
