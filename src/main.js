import { CORE_CONFIG } from './core/config.js';
import { createEventBus } from './core/events.js';
import { createClock } from './core/time.js';
import { fromYawPitchRoll, identity } from './math/quaternion.js';

import {
  createWorld,
  addPlanet,
  addStation,
  enqueueCommand,
  createCommand,
} from './core/state.js';

import { updateWorld } from './core/simulation.js';

import { vec, copy } from './math/vector.js';
import { lerpAngle, degToRad } from './math/angle.js';

import {
  CommandType,
  GameEvent,
  GameStatus,
} from './core/constants.js';

import { addScore } from './systems/score.js';
import { createFeedbackSystem } from './systems/feedback.js'; // <-- НОВЫЙ ИМПОРТ

import { createCanvasRenderer } from './render/canvasRenderer3D.js';

import { createDeviceOrientationQuatInput } from './input/deviceOrientationQuat.js';

const canvas = document.getElementById('game');
const renderer = createCanvasRenderer(canvas);

const eventBus = createEventBus();
const world = createWorld({ seed: 1 });

// Создаём feedback систему с базовым FOV 72 градуса
const feedbackSystem = createFeedbackSystem({
  baseFov: degToRad(72),
  fovNarrowing: 0.7,
  smoothingSpeed: 8,
});

const cameraState = {
  position: vec(0, 0, 0),
  orientation: identity(),
  forward: { x: 0, y: 0, z: 1 },
  right: { x: 1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  fov: degToRad(72),
};

const targetOrientation = {
  yaw: 0,
  pitch: 0,
  roll: 0,
};

let latestLook = null;
let latestSensorDebug = null;
let frameCount = 0;

function seedDemoWorld(targetWorld) {
  targetWorld.planets.length = 0;
  targetWorld.stations.length = 0;

  targetWorld.player.position = vec(0, 0, -2200);
  targetWorld.player.velocity = vec(0, 0, 60);
  targetWorld.player.heading = vec(0, 0, 1);

  addPlanet(targetWorld, {
    position: vec(0, 0, 80),
    velocity: vec(0, 0, 0),
    mass: 320,
    radius: 30,
    isStatic: true,
  });

  addPlanet(targetWorld, {
    position: vec(180, 60, 220),
    velocity: vec(0, 0, 0),
    mass: 160,
    radius: 20,
    isStatic: true,
  });

  addPlanet(targetWorld, {
    position: vec(-220, -70, 260),
    velocity: vec(0, 0, 0),
    mass: 200,
    radius: 24,
    isStatic: true,
  });

  const stationA = addStation(targetWorld, {
    position: vec(-80, 30, 40),
  });

  const stationB = addStation(targetWorld, {
    position: vec(120, -40, 260),
  });

  stationA.expiresAt = targetWorld.time + 18;
  stationB.expiresAt = targetWorld.time + 26;
}

seedDemoWorld(world);

const clock = createClock(CORE_CONFIG.simulation);

const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const sensorDebugEl = document.getElementById('sensor-debug');

const btnThrust = document.getElementById('btn-thrust');
const btnBrake = document.getElementById('btn-brake');
const btnReset = document.getElementById('btn-reset');
const btnPause = document.getElementById('btn-pause');
const btnFullscreen = document.getElementById('btn-fullscreen');

const actions = {
  setThrust(value) {
    enqueueCommand(world, createCommand(CommandType.SET_THRUST, { value }));
    
    // Уведомляем feedback систему
    feedbackSystem.onThrustChanged(value);
    
    // Эмитим событие для других систем (например, звука мотора в будущем)
    eventBus.emit(GameEvent.THRUST_CHANGED, { isActive: value });
  },

  setBrake(value) {
    enqueueCommand(world, createCommand(CommandType.SET_BRAKE, { value }));
    
    // Уведомляем feedback систему
    feedbackSystem.onBrakeChanged(value);
    
    // Эмитим событие для других систем
    eventBus.emit(GameEvent.BRAKE_CHANGED, { isActive: value });
  },

  togglePause() {
    enqueueCommand(world, createCommand(CommandType.TOGGLE_PAUSE));
  },

  reset() {
    enqueueCommand(world, createCommand(CommandType.RESET));
  },

  look(orientation) {
    world.input.commands = world.input.commands.filter((command) => {
      return command.type !== CommandType.LOOK;
    });

    enqueueCommand(
      world,
      createCommand(CommandType.LOOK, { orientation })
    );
  },
};

function statusToText(status) {
  switch (status) {
    case GameStatus.RUNNING:
      return 'Игра';
    case GameStatus.PAUSED:
      return 'Пауза';
    case GameStatus.GAME_OVER:
      return 'Катастрофа';
    default:
      return status;
  }
}

function updateHud() {
  if (scoreEl) {
    scoreEl.textContent = `Очки: ${world.score}`;
  }

  if (statusEl) {
    statusEl.textContent = statusToText(world.status);
  }

  if (btnPause) {
    btnPause.textContent = world.status === GameStatus.PAUSED
      ? 'Продолжить'
      : 'Пауза';
  }
}

function handleSensorLook(payload) {
  if (payload?.orientation) {
    const q = payload.orientation;
    if (q.w === 0 && q.x === 0 && q.y === 0 && q.z === 0) {
      return;
    }

    const qFixed = {
      x: q.x,
      y: q.y,
      z: q.z,
      w: q.w,
    };

    actions.look(q);
    latestSensorDebug = payload;
  }
}

const orientationInput = createDeviceOrientationQuatInput({
  onLook: handleSensorLook,
  onStatusChange: () => {},
});

function resetCameraOrientation() {
  targetOrientation.yaw = 0;
  targetOrientation.pitch = 0;
  targetOrientation.roll = 0;

  cameraState.yaw = 0;
  cameraState.pitch = 0;
  cameraState.roll = 0;

  orientationInput.calibrate();
}

// Сбрасываем feedback систему при сбросе мира
eventBus.on(GameEvent.WORLD_RESET, () => {
  seedDemoWorld(world);
  resetCameraOrientation();
  feedbackSystem.reset();
});

eventBus.on(GameEvent.STATION_COLLECTED, (payload) => {
  const scoreValue = payload?.scoreValue ?? payload?.station?.scoreValue ?? 0;
  addScore(world, scoreValue, eventBus);
});

eventBus.on(GameEvent.SCORE_CHANGED, updateHud);
eventBus.on(GameEvent.STATUS_CHANGED, updateHud);
eventBus.on(GameEvent.WORLD_RESET, updateHud);
eventBus.on(GameEvent.PLAYER_CRASHED, updateHud);

let lastFrameTime = performance.now();

function frame(now) {
  const frameDelta = Math.min((now - lastFrameTime) / 1000, 0.25);
  lastFrameTime = now;

  frameCount += 1;

  if (latestLook) {
    actions.look(latestLook);
    latestLook = null;
  }

  // Обновляем feedback систему
  feedbackSystem.update(frameDelta);

  clock.update(frameDelta, world.timeScale, (fixedDelta) => {
    updateWorld(world, fixedDelta, eventBus);
  });

  if (world.player) {
    cameraState.position = world.player.position;
    cameraState.orientation = world.player.orientation;
    cameraState.forward = world.player.forward;
    cameraState.right = world.player.right;
    cameraState.up = world.player.up;
    
    // Применяем FOV из feedback системы
    cameraState.fov = feedbackSystem.getCurrentFov();
  }

  renderer.render(world, cameraState);

  if (sensorDebugEl && frameCount % 6 === 0) {
    const feedbackDebug = feedbackSystem.getDebugInfo();
    
    if (!orientationInput.isEnabled()) {
      sensorDebugEl.textContent = 'Датчики: выкл';
    } else {
      const count = orientationInput.getCallCount();
      const lastEvt = orientationInput.getLastEvent();

      if (count === 0) {
        sensorDebugEl.textContent = `Событий: 0\nFOV: ${feedbackDebug.currentFov}`;
      } else if (lastEvt && world.player) {
        const qTarget = world.player.targetOrientation;
        const qCurrent = world.player.orientation;
        const fwd = world.player.forward;

        const isZeroTarget = qTarget.w === 0 && qTarget.x === 0 && qTarget.y === 0 && qTarget.z === 0;
        const isZeroCurrent = qCurrent.w === 0 && qCurrent.x === 0 && qCurrent.y === 0 && qCurrent.z === 0;

        sensorDebugEl.textContent =
          `Событий: ${count}\n` +
          `a:${lastEvt.alpha?.toFixed(0) ?? 'null'} ` +
          `b:${lastEvt.beta?.toFixed(0) ?? 'null'} ` +
          `g:${lastEvt.gamma?.toFixed(0) ?? 'null'}\n` +
          `target: ${isZeroTarget ? 'НУЛЬ' : `w:${qTarget.w.toFixed(2)} x:${qTarget.x.toFixed(2)}`}\n` +
          `current: ${isZeroCurrent ? 'НУЛЬ' : `w:${qCurrent.w.toFixed(2)}`}\n` +
          `fwd: ${fwd.x.toFixed(2)},${fwd.y.toFixed(2)},${fwd.z.toFixed(2)}\n` +
          `FOV: ${feedbackDebug.currentFov} → ${feedbackDebug.targetFov}\n` +
          `Тяга: ${feedbackDebug.thrustActive ? 'ВКЛ' : 'выкл'}`;
      } else {
        sensorDebugEl.textContent = `Событий: ${count} | нет данных\nFOV: ${feedbackDebug.currentFov}`;
      }
    }
  }

  requestAnimationFrame(frame);
}

updateHud();
requestAnimationFrame(frame);

window.game = {
  world,
  eventBus,
  cameraState,
  actions,
  orientationInput,
  feedbackSystem, // <-- Добавляем для отладки
  createCommand,
  enqueueCommand,
  CommandType,

  calibrateSensors() {
    resetCameraOrientation();
  },
};

function bindHoldButton(element, onPress, onRelease) {
  if (!element) {
    return;
  }

  const handlePress = (event) => {
    event.preventDefault();
    if (element.setPointerCapture) {
      try {
        element.setPointerCapture(event.pointerId);
      } catch (error) {
        // Игнорируем, если браузер не дал захватить указатель.
      }
    }
    onPress();
  };

  const handleRelease = () => {
    onRelease();
  };

  element.addEventListener('pointerdown', handlePress);
  element.addEventListener('pointerup', handleRelease);
  element.addEventListener('pointercancel', handleRelease);
  element.addEventListener('pointerleave', handleRelease);
  element.addEventListener('lostpointercapture', handleRelease);

  element.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

bindHoldButton(
  btnThrust,
  () => actions.setThrust(true),
  () => actions.setThrust(false)
);

bindHoldButton(
  btnBrake,
  () => actions.setBrake(true),
  () => actions.setBrake(false)
);

btnReset?.addEventListener('click', () => {
  actions.reset();
});

btnPause?.addEventListener('click', () => {
  actions.togglePause();
});

btnFullscreen?.addEventListener('click', () => {
  toggleFullscreen();
});

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    return;
  }

  document.documentElement.requestFullscreen().catch(() => {});
}

const loginScreen = document.getElementById('login-screen');
const btnStartGame = document.getElementById('btn-start-game');
const btnGenerateId = document.getElementById('btn-generate-id');
const networkIdInput = document.getElementById('network-id-input');

btnGenerateId?.addEventListener('click', () => {
  console.log('Генерация ID: пока не реализовано');
});

btnStartGame?.addEventListener('click', async () => {
  if (loginScreen) {
    loginScreen.style.display = 'none';
  }

  toggleFullscreen();

  if (orientationInput && !orientationInput.isEnabled()) {
    try {
      const result = await orientationInput.enable();
      if (result.enabled) {
        console.log('Датчики успешно включены');
      } else {
        console.log('Датчики не включены:', result.reason);
      }
    } catch (error) {
      console.error('Ошибка включения датчиков:', error);
    }
  }
});
