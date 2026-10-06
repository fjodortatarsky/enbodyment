/**
 * Минимальная событийная шина.
 *
 * Она нужна, чтобы позже не связывать модули напрямую:
 * - физика может сказать "столкновение";
 * - счёт может подписаться на "станция собрана";
 * - HUD может подписаться на изменение очков;
 * - сетевой слой позже сможет транслировать часть событий.
 */

export function createEventBus() {
  const listeners = new Map();

  function on(type, handler) {
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }

    listeners.get(type).add(handler);

    return () => off(type, handler);
  }

  function off(type, handler) {
    const handlers = listeners.get(type);

    if (!handlers) {
      return;
    }

    handlers.delete(handler);
  }

  function emit(type, payload) {
    const handlers = listeners.get(type);

    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of Array.from(handlers)) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`Event handler failed for "${type}"`, error);
      }
    }
  }

  function clear() {
    listeners.clear();
  }

  return Object.freeze({
    on,
    off,
    emit,
    clear,
  });
}
