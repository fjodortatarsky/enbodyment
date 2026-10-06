import { GameEvent } from '../core/constants.js';

/**
 * Система очков.
 *
 * Пока она минимальная:
 * - добавление очков;
 * - событие изменения счёта.
 *
 * Позже сюда можно добавить:
 * - множители;
 * - серии;
 * - рекорды;
 * - сетевую синхронизацию очков.
 */

export function addScore(world, amount, eventBus) {
  if (!Number.isFinite(amount)) {
    return;
  }

  if (amount === 0) {
    return;
  }

  world.score += amount;

  eventBus?.emit(GameEvent.SCORE_CHANGED, {
    score: world.score,
    amount,
  });
}

export function resetScore(world, eventBus) {
  if (world.score === 0) {
    return;
  }

  world.score = 0;

  eventBus?.emit(GameEvent.SCORE_CHANGED, {
    score: world.score,
    amount: 0,
  });
}
