import { GameEvent } from '../core/constants.js';

/**
 * Система обратной связи (feedback system).
 *
 * Отвечает за визуальные и звуковые эффекты, связанные с действиями игрока:
 * - изменение угла зрения (FOV) при тяге/торможении;
 * - звук мотора (в будущем);
 * - визуальные эффекты (в будущем).
 *
 * Архитектурно отделена от логики игры, работает через события.
 */

export function createFeedbackSystem(config = {}) {
  const {
    baseFov = Math.PI / 3, // 60 градусов по умолчанию
    fovNarrowing = 0.7, // 70% от базового FOV (сужение на 30%)
    smoothingSpeed = 8, // скорость плавного перехода
  } = config;

  let currentFov = baseFov;
  let targetFov = baseFov;
  
  let thrustActive = false;
  let brakeActive = false;

  function updateTargetFov() {
    if (thrustActive) {
      targetFov = baseFov * fovNarrowing;
    } else {
      targetFov = baseFov;
    }
  }

  return {
    /**
     * Вызывается при изменении состояния тяги.
     */
    onThrustChanged(isActive) {
      thrustActive = isActive;
      updateTargetFov();
    },

    /**
     * Вызывается при изменении состояния тормоза.
     */
    onBrakeChanged(isActive) {
      brakeActive = isActive;
      // Пока тормоз не влияет на FOV, но может влиять в будущем
    },

    /**
     * Обновление состояния системы (вызывается каждый кадр).
     */
    update(deltaTime) {
      // Плавная интерполяция FOV
      const smoothingFactor = 1 - Math.exp(-deltaTime * smoothingSpeed);
      currentFov = currentFov + (targetFov - currentFov) * smoothingFactor;
    },

    /**
     * Возвращает текущий FOV для рендера.
     */
    getCurrentFov() {
      return currentFov;
    },

    /**
     * Сброс системы в начальное состояние.
     */
    reset() {
      thrustActive = false;
      brakeActive = false;
      currentFov = baseFov;
      targetFov = baseFov;
    },

    /**
     * Отладочная информация.
     */
    getDebugInfo() {
      return {
        thrustActive,
        brakeActive,
        currentFov: (currentFov * 180 / Math.PI).toFixed(1) + '°',
        targetFov: (targetFov * 180 / Math.PI).toFixed(1) + '°',
      };
    },
  };
}
