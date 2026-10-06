import { degToRad } from '../math/angle.js';
import { fromAxisAngle, multiply, conjugate, normalize } from '../math/quaternion.js';

export function createDeviceOrientationQuatInput({
  onLook,
  onStatusChange,
} = {}) {
  let enabled = false;
  let eventName = 'deviceorientation';
  let callCount = 0;
  let lastEvent = null;

  let calQ = null;

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

  function getCallCount() {
    return callCount;
  }

  function getLastEvent() {
    return lastEvent;
  }

  function getAlphaDegrees(event) {
    if (Number.isFinite(event.webkitCompassHeading)) {
      return event.webkitCompassHeading;
    }
    if (Number.isFinite(event.alpha)) {
      return event.alpha;
    }
    return 0;
  }

  function quaternionFromEvent(event) {
    const alpha = degToRad(getAlphaDegrees(event));
    const beta = degToRad(event.beta ?? 0);
    const gamma = degToRad(event.gamma ?? 0);

    const qz = fromAxisAngle({ x: 0, y: 0, z: 1 }, alpha);
    const qx = fromAxisAngle({ x: 1, y: 0, z: 0 }, -beta);
    const qy = fromAxisAngle({ x: 0, y: 1, z: 0 }, -gamma);

    return normalize(multiply(multiply(qz, qx), qy));
  }

  function calibrate() {
    calQ = null;
  }

	/*
  function handleOrientation(event) {
    callCount += 1;
    lastEvent = {
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      webkitCompassHeading: event.webkitCompassHeading,
      absolute: event.absolute,
    };

    const q = quaternionFromEvent(event);

    if (!calQ) {
      calQ = q;
    }

    const qRel = normalize(multiply(conjugate(calQ), q));

    const qFix = { x: 1, y: 0, z: 0, w: 0 };
    const qCorrected = normalize(multiply(qRel, qFix));

    onLook?.({ orientation: qCorrected });
  }*/

function handleOrientation(event) {
  callCount += 1;
  lastEvent = {
    alpha: event.alpha,
    beta: event.beta,
    gamma: event.gamma,
    webkitCompassHeading: event.webkitCompassHeading,
    absolute: event.absolute,
  };

  const q = quaternionFromEvent(event);

  if (!calQ) {
    calQ = q;
  }

  const qRel = normalize(multiply(conjugate(calQ), q));

  // Проверка: если кватернион нулевой, не отправляем
  if (qRel.w === 0 && qRel.x === 0 && qRel.y === 0 && qRel.z === 0) {
    return;
  }

  onLook?.({ orientation: qRel });
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

    // Пробуем сначала absolute, потом обычный
    eventName =
      'ondeviceorientationabsolute' in window
        ? 'deviceorientationabsolute'
        : 'deviceorientation';

    calibrate();
    callCount = 0;

    window.addEventListener(eventName, handleOrientation, { passive: true });

    enabled = true;
    onStatusChange?.({ status: 'enabled' });
    return { enabled: true };
  }

  function disable() {
    if (!enabled) return;

    window.removeEventListener(eventName, handleOrientation);
    enabled = false;
    calibrate();
    callCount = 0;
    lastEvent = null;
    onStatusChange?.({ status: 'disabled' });
  }

  return Object.freeze({
    enable,
    disable,
    calibrate,
    isEnabled,
    isSupported,
    isPermissionRequired,
    getCallCount,
    getLastEvent,
  });
}
