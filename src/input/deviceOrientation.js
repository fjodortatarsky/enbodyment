import { degToRad, normalizeAngle } from '../math/angle.js';

/**
 * Источник данных об ориентации устройства.
 *
 * Режимы:
 * - "yaw"  — накопление изменения alpha / compass heading.
 *            Подходит для поворота телефона влево/вправо.
 * - "roll" — использует gamma/beta с учётом ориентации экрана.
 *            Подходит, если устройство лучше реагирует на "руль".
 *
 * Важно:
 * - на iOS нужно запрашивать разрешение по пользовательскому действию;
 * - датчики обычно работают только в secure context: https или localhost.
 */

export function createDeviceOrientationInput({
  onLook,
  onStatusChange,
  rotationDirection = -1,
  mode = 'yaw',
  maxDelta = 1.25,
} = {}) {
  let enabled = false;
  let eventName = 'deviceorientation';

  let currentMode = mode === 'roll' ? 'roll' : 'yaw';
  let direction = rotationDirection < 0 ? -1 : 1;

  let lastAlpha = null;
  let yaw = 0;
  let rollCalibration = null;

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

  function getRollRadians(event) {
    const beta = degToRad(event.beta ?? 0);
    const gamma = degToRad(event.gamma ?? 0);

    const screenAngle = getScreenAngleDegrees();

    /**
     * Очень практичный пересчёт под ориентацию экрана.
     * Если на конкретном устройстве знак окажется неправильным,
     * его можно поправить через rotationDirection.
     */
    if (screenAngle === 90) {
      return beta;
    }

    if (screenAngle === -90 || screenAngle === 270) {
      return -beta;
    }

    if (screenAngle === 180) {
      return -gamma;
    }

    return gamma;
  }

  function handleScreenChange() {
    calibrate();
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

  function calibrate() {
    yaw = 0;
    lastAlpha = null;
    rollCalibration = null;
  }

  function setMode(nextMode) {
    currentMode = nextMode === 'roll' ? 'roll' : 'yaw';
    calibrate();
  }

  function setRotationDirection(nextDirection) {
    direction = nextDirection < 0 ? -1 : 1;
  }

  function handleOrientation(event) {
    const alphaDeg = getAlphaDegrees(event);
    const betaDeg = Number.isFinite(event.beta) ? event.beta : null;
    const gammaDeg = Number.isFinite(event.gamma) ? event.gamma : null;

    if (alphaDeg === null && gammaDeg === null) {
      return;
    }

    let cameraRotation = yaw;

    if (currentMode === 'yaw' && alphaDeg !== null) {
      const alphaRad = degToRad(alphaDeg);

      if (lastAlpha === null) {
        lastAlpha = alphaRad;
      } else {
        const delta = normalizeAngle(alphaRad - lastAlpha);
        lastAlpha = alphaRad;

        /**
         * Защита от резких скачков компаса/сенсора.
         * Обычное вращение телефона не даёт огромный угол между двумя кадрами.
         */
        if (Math.abs(delta) <= maxDelta) {
          yaw = normalizeAngle(yaw + delta * direction);
        }
      }

      cameraRotation = yaw;
    } else if (gammaDeg !== null) {
      /**
       * Запасной режим, если нет качественного alpha
       * или явно используется режим ручного "руля".
       */
      const roll = getRollRadians(event);

      if (rollCalibration === null) {
        rollCalibration = roll;
      }

      cameraRotation = normalizeAngle((roll - rollCalibration) * direction);
      yaw = cameraRotation;
    }

    const headingAngle = normalizeAngle(-Math.PI / 2 - cameraRotation);

    const look = {
      x: Math.cos(headingAngle),
      y: Math.sin(headingAngle),
      z: 0,
    };

    onLook?.({
      cameraRotation,
      headingAngle,
      look,
      mode: currentMode,
      direction,
      raw: {
        alpha: alphaDeg,
        beta: betaDeg,
        gamma: gammaDeg,
        screenAngle: getScreenAngleDegrees(),
      },
    });
  }

  return Object.freeze({
    enable,
    disable,
    calibrate,
    setMode,
    setRotationDirection,
    isEnabled,
    isSupported,
    isPermissionRequired,
  });
}
