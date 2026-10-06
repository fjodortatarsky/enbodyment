import { degToRad, normalizeAngle } from '../math/angle.js';
import { basisFromYawPitchRoll } from '../math/orientation.js';

/**
 * 3D-ориентация устройства.
 *
 * Этот модуль превращает телефон в "окно" в 3D-мир:
 * - поворот телефона влево/вправо меняет yaw;
 * - наклон вверх/вниз меняет pitch;
 * - крен телефона меняет roll.
 *
 * Важные моменты:
 * - при включении датчиков текущее положение телефона становится нулевой точкой;
 * - знак направлений можно настраивать через setSigns;
 * - на разных устройствах оси могут быть инвертированы.
 */

export function createDeviceOrientation3DInput({
  onLook,
  onStatusChange,
  signs = {
    yaw: 1,
    pitch: 1,
    roll: 1,
  },
} = {}) {
  let enabled = false;
  let eventName = 'deviceorientation';

  let currentSigns = {
    yaw: signs.yaw ?? 1,
    pitch: signs.pitch ?? 1,
    roll: signs.roll ?? 1,
  };

  let yaw = 0;
  let lastAlpha = null;
  let base = null;

  function isSupported() {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  function isPermissionRequired() {
    return (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    );
  }

  function isEnabled() {
    return enabled;
  }

  function getScreenAngleDegrees() {
    if (typeof screen !== 'undefined' && screen.orientation) {
      return screen.orientation.angle ?? 0;
    }

    return window.orientation ?? 0;
  }

  function getAlphaDegrees(event) {
    if (Number.isFinite(event.webkitCompassHeading)) {
      return event.webkitCompassHeading;
    }

    if (Number.isFinite(event.alpha)) {
      return event.alpha;
    }

    return null;
  }

  function getPitchRollRaw(event) {
    const beta = degToRad(event.beta ?? 90);
    const gamma = degToRad(event.gamma ?? 0);

    const screenAngle = getScreenAngleDegrees();

    /**
     * Это практичный пересчёт под ориентацию экрана.
     * Если на конкретном телефоне оси ведут себя странно,
     * дальше можно будет ввести пресеты под конкретное устройство.
     */

    if (screenAngle === 90) {
      return {
        pitchRaw: gamma,
        rollRaw: -(beta - Math.PI / 2),
      };
    }

    if (screenAngle === -90 || screenAngle === 270) {
      return {
        pitchRaw: -gamma,
        rollRaw: beta - Math.PI / 2,
      };
    }

    if (screenAngle === 180) {
      return {
        pitchRaw: -(beta - Math.PI / 2),
        rollRaw: -gamma,
      };
    }

    return {
      pitchRaw: beta - Math.PI / 2,
      rollRaw: gamma,
    };
  }

  function handleScreenChange() {
    calibrate();
  }

  function calibrate() {
    yaw = 0;
    lastAlpha = null;
    base = null;
  }

  function setSigns(nextSigns) {
    currentSigns = {
      ...currentSigns,
      ...nextSigns,
    };
  }

  async function enable() {
    if (enabled) {
      return { enabled: true };
    }

    if (!isSupported()) {
      onStatusChange?.({ status: 'unsupported' });
      return { enabled: false, reason: 'unsupported' };
    }

    if (isPermissionRequired()) {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();

        if (permission !== 'granted') {
          onStatusChange?.({ status: 'denied' });
          return { enabled: false, reason: 'denied' };
        }
      } catch (error) {
        console.warn('Device orientation permission error', error);
        onStatusChange?.({ status: 'error', error });
        return { enabled: false, reason: 'error' };
      }
    }

    eventName =
      'ondeviceorientationabsolute' in window
        ? 'deviceorientationabsolute'
        : 'deviceorientation';

    calibrate();

    window.addEventListener(eventName, handleOrientation, {
      passive: true,
    });

    window.addEventListener('orientationchange', handleScreenChange);

    if (typeof screen !== 'undefined' && screen.orientation?.addEventListener) {
      screen.orientation.addEventListener('change', handleScreenChange);
    }

    enabled = true;
    onStatusChange?.({ status: 'enabled' });

    return { enabled: true };
  }

  function disable() {
    if (!enabled) {
      return;
    }

    window.removeEventListener(eventName, handleOrientation);
    window.removeEventListener('orientationchange', handleScreenChange);

    if (typeof screen !== 'undefined' && screen.orientation?.removeEventListener) {
      screen.orientation.removeEventListener('change', handleScreenChange);
    }

    enabled = false;
    calibrate();

    onStatusChange?.({ status: 'disabled' });
  }

  function handleOrientation(event) {
    const alphaDegrees = getAlphaDegrees(event);

    const alphaRadians = Number.isFinite(alphaDegrees)
      ? degToRad(alphaDegrees)
      : lastAlpha;

    const {
      pitchRaw,
      rollRaw,
    } = getPitchRollRaw(event);

    if (!base) {
      base = {
        pitchRaw,
        rollRaw,
      };
    }

    if (Number.isFinite(alphaRadians)) {
      if (lastAlpha === null) {
        lastAlpha = alphaRadians;
      } else {
        const delta = normalizeAngle(alphaRadians - lastAlpha);
        lastAlpha = alphaRadians;

        // Защита от резких скачков сенсора.
        if (Math.abs(delta) <= 1.25) {
          yaw = normalizeAngle(yaw + delta * currentSigns.yaw);
        }
      }
    }

    let pitch = (pitchRaw - base.pitchRaw) * currentSigns.pitch;
    let roll = normalizeAngle((rollRaw - base.rollRaw) * currentSigns.roll);

    // Ограничиваем тангаж, чтобы камера не переворачивалась через зенит.
    const pitchLimit = 1.45;

    pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));

    const basis = basisFromYawPitchRoll(yaw, pitch, roll);

    onLook?.({
      yaw,
      pitch,
      roll,
      forward: basis.forward,
      right: basis.right,
      up: basis.up,
      raw: {
        alpha: alphaDegrees,
        beta: event.beta ?? null,
        gamma: event.gamma ?? null,
        screenAngle: getScreenAngleDegrees(),
      },
    });
  }

  return Object.freeze({
    enable,
    disable,
    calibrate,
    setSigns,
    isEnabled,
    isSupported,
    isPermissionRequired,
  });
}
