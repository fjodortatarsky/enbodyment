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

import { createCanvasRenderer } from './render/canvasRenderer3D.js';

import { createDeviceOrientationQuatInput } from './input/deviceOrientationQuat.js';

/**
 * Точка входа.
 *
 * Теперь камера 3D:
 * - позиция берётся от игрока;
 * - ориентация берётся от телефона;
 * - телефон работает как окно в 3D-мир.
 */

let eventName = 'deviceorientation';

const canvas = document.getElementById('game');

const renderer = createCanvasRenderer(canvas);

const eventBus = createEventBus();
const world = createWorld({ seed: 1 });

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

  // Игрок стартует так, чтобы смотреть вперёд по +Z.
  targetWorld.player.position = vec(0, 0, -2200);
  targetWorld.player.velocity = vec(0, 0, 60);
  targetWorld.player.heading = vec(0, 0, 1);

  // Планеты впереди и сбоку, уже в 3D.
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

  // Начальные станции.
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
const timeScaleEl = document.getElementById('time-scale');
const statusEl = document.getElementById('status');
const sensorDebugEl = document.getElementById('sensor-debug');

const btnThrust = document.getElementById('btn-thrust');
const btnBrake = document.getElementById('btn-brake');
const btnReset = document.getElementById('btn-reset');
const btnPause = document.getElementById('btn-pause');
const btnTimeUp = document.getElementById('btn-time-up');
const btnTimeDown = document.getElementById('btn-time-down');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnSensors = document.getElementById('btn-sensors');

const actions = {
  setThrust(value) {
    enqueueCommand(world, createCommand(CommandType.SET_THRUST, { value }));
  },

  setBrake(value) {
    enqueueCommand(world, createCommand(CommandType.SET_BRAKE, { value }));
  },

  setTimeScale(value) {
    enqueueCommand(world, createCommand(CommandType.SET_TIME_SCALE, { value }));
  },

  changeTimeScale(delta) {
    if (delta < 0 && world.timeScale <= 0) {
      return;
    }

    const next = Math.min(10, Math.max(0, world.timeScale + delta));
    actions.setTimeScale(next);
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

  if (timeScaleEl) {
    timeScaleEl.textContent = `Скорость времени: ${world.timeScale.toFixed(1)}x`;
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

function updateSensorButton(payload) {
  if (!btnSensors) {
    return;
  }

  const status = payload?.status;

  if (status === 'enabled') {
    btnSensors.textContent = 'Выключить датчики';
    btnSensors.disabled = false;
    return;
  }

  if (status === 'unsupported') {
    btnSensors.textContent = 'Датчики недоступны';
    btnSensors.disabled = true;
    return;
  }

  if (status === 'denied' || status === 'error') {
    btnSensors.textContent = 'Датчики запрещены';
    btnSensors.disabled = false;
    return;
  }

  btnSensors.textContent = 'Включить датчики';
  btnSensors.disabled = false;
}

function handleSensorLook(payload) {
  // Временная проверка: что приходит в payload
  if (payload?.orientation) {
    const q = payload.orientation;
    // Если кватернион нулевой или некорректный, пропускаем
    if (q.w === 0 && q.x === 0 && q.y === 0 && q.z === 0) {
      return; // нулевой кватернион, не применяем
    }


    // Инверсия отдельных осей:
    // Чтобы инвертировать поворот вокруг оси, инвертируем соответствующую компоненту кватерниона
    const qFixed = {
      x: q.x,   // инвертируй знаком, если поворот вокруг X неправильный
      y: q.y,   // инвертируй знаком, если поворот вокруг Y неправильный
      z: q.z,   // инвертируй знаком, если поворот вокруг Z неправильный
      w: q.w,
    };

    actions.look(q);
    latestSensorDebug = payload;
  }
}

const orientationInput = createDeviceOrientationQuatInput({
  onLook: handleSensorLook,
  onStatusChange: updateSensorButton,
});

/*
function handleSensorLook(payload) {
  const orientation = fromYawPitchRoll(
    payload.yaw,
    payload.pitch,
    payload.roll
  );

  actions.look(orientation);
  latestSensorDebug = payload;
}
const orientationInput = createDeviceOrientation3DInput({
  onLook: handleSensorLook,
  onStatusChange: updateSensorButton,

  /**
   * Если какое-то направление будет инвертировано,
   * поменяй знак через консоль:
   *
   * game.setSensorSigns({ yaw: -1 })
   * game.setSensorSigns({ pitch: -1 })
   * game.setSensorSigns({ roll: -1 })
   * /
  signs: {
    yaw: 1,
    pitch: 1,
    roll: 1,
  },
});

updateSensorButton({
  status: orientationInput.isSupported() ? 'disabled' : 'unsupported',
});*/

function resetCameraOrientation() {
  targetOrientation.yaw = 0;
  targetOrientation.pitch = 0;
  targetOrientation.roll = 0;

  cameraState.yaw = 0;
  cameraState.pitch = 0;
  cameraState.roll = 0;

  orientationInput.calibrate();
}

eventBus.on(GameEvent.WORLD_RESET, () => {
  seedDemoWorld(world);
  resetCameraOrientation();
});

eventBus.on(GameEvent.STATION_COLLECTED, (payload) => {
  const scoreValue = payload?.scoreValue ?? payload?.station?.scoreValue ?? 0;
  addScore(world, scoreValue, eventBus);
});

eventBus.on(GameEvent.SCORE_CHANGED, updateHud);
eventBus.on(GameEvent.STATUS_CHANGED, updateHud);
eventBus.on(GameEvent.TIME_SCALE_CHANGED, updateHud);
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

  /**
   * Сглаживание ориентации камеры.
   * Если захочется резче — увеличь 14 до 20–30.
   */
  const rotationSmoothing = 1 - Math.exp(-frameDelta * 14);


  clock.update(frameDelta, world.timeScale, (fixedDelta) => {
    updateWorld(world, fixedDelta, eventBus);
  });

	// Камера = взгляд из корабля.
	if (world.player) {
		cameraState.position = world.player.position;
		cameraState.orientation = world.player.orientation;
		cameraState.forward = world.player.forward;
		cameraState.right = world.player.right;
		cameraState.up = world.player.up;
	}

  renderer.render(world, cameraState);

if (sensorDebugEl && frameCount % 6 === 0) {
  if (!orientationInput.isEnabled()) {
    sensorDebugEl.textContent = 'Датчики: выкл';
  } else {
    const count = orientationInput.getCallCount();
    const lastEvt = orientationInput.getLastEvent();

    if (count === 0) {
      sensorDebugEl.textContent = `Событий: 0`;
    } else if (lastEvt && world.player) {
      const qTarget = world.player.targetOrientation;
      const qCurrent = world.player.orientation;
      const fwd = world.player.forward;

      // Проверяем, нулевой ли кватернион
      const isZeroTarget = qTarget.w === 0 && qTarget.x === 0 && qTarget.y === 0 && qTarget.z === 0;
      const isZeroCurrent = qCurrent.w === 0 && qCurrent.x === 0 && qCurrent.y === 0 && qCurrent.z === 0;

      sensorDebugEl.textContent =
        `Событий: ${count}\n` +
        `a:${lastEvt.alpha?.toFixed(0) ?? 'null'} ` +
        `b:${lastEvt.beta?.toFixed(0) ?? 'null'} ` +
        `g:${lastEvt.gamma?.toFixed(0) ?? 'null'}\n` +
        `target: ${isZeroTarget ? 'НУЛЬ' : `w:${qTarget.w.toFixed(2)} x:${qTarget.x.toFixed(2)}`}\n` +
        `current: ${isZeroCurrent ? 'НУЛЬ' : `w:${qCurrent.w.toFixed(2)}`}\n` +
        `fwd: ${fwd.x.toFixed(2)},${fwd.y.toFixed(2)},${fwd.z.toFixed(2)}`;
    } else {
      sensorDebugEl.textContent = `Событий: ${count} | нет данных`;
    }
  }
}

  requestAnimationFrame(frame);
}

updateHud();
requestAnimationFrame(frame);


/**
 * Доступ из консоли для настройки и отладки.
 */
window.game = {
  world,
  eventBus,
  cameraState,
  actions,
  orientationInput,
  createCommand,
  enqueueCommand,
  CommandType,

  calibrateSensors() {
    resetCameraOrientation();
  },
};

//game.setSensorSigns({ yaw: 1, pitch: 1, roll: -1 })

/**
 * Привязка экранных кнопок управления.
 */
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

btnTimeUp?.addEventListener('click', () => {
  actions.changeTimeScale(0.5);
});

btnTimeDown?.addEventListener('click', () => {
  actions.changeTimeScale(-0.5);
});

btnFullscreen?.addEventListener('click', () => {
  toggleFullscreen();
});

/*
btnSensors?.addEventListener('click', async () => {
  if (orientationInput.isEnabled()) {
    orientationInput.disable();
    return;
  }

  await orientationInput.enable();
});
*/

btnSensors?.addEventListener('click', async () => {
  if (orientationInput.isEnabled()) {
    orientationInput.disable();
    updateSensorButton({ status: 'disabled' });
    return;
  }

  btnSensors.textContent = '...включение...';
  btnSensors.disabled = true;

  try {
    const result = await orientationInput.enable();
    if (result.enabled) {
      updateSensorButton({ status: 'enabled' });
    } else {
      updateSensorButton({ status: result.reason || 'error' });
    }
  } catch (error) {
    console.error('Sensor enable error:', error);
    updateSensorButton({ status: 'error' });
  } finally {
    btnSensors.disabled = false;
  }
});


function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {
      // Ничего критичного, если браузер отказался выходить из полноэкранного режима.
    });

    return;
  }

  document.documentElement.requestFullscreen().catch(() => {
    // Ничего критичного, если браузер отказался входить в полноэкранный режим.
  });
}

// ==========================================
// Логика экрана входа
// ==========================================
const loginScreen = document.getElementById('login-screen');
const btnStartGame = document.getElementById('btn-start-game');
const btnGenerateId = document.getElementById('btn-generate-id');
const networkIdInput = document.getElementById('network-id-input');

// Пока без логики, просто заглушка для будущего функционала
btnGenerateId?.addEventListener('click', () => {
  console.log('Генерация ID: пока не реализовано');
  // В будущем здесь будет логика генерации или запроса ID
});

btnStartGame?.addEventListener('click', async () => {
  // 1. Скрываем экран входа
  if (loginScreen) {
    loginScreen.style.display = 'none';
  }

  // 2. Разворачиваем на полный экран
  // (Вызов внутри обработчика клика является валидным пользовательским жестом для браузеров)
  toggleFullscreen();

  // 3. Включаем датчики (запрашиваем разрешение, особенно критично для iOS 13+)
  if (orientationInput && !orientationInput.isEnabled()) {
    try {
      if (btnSensors) {
        btnSensors.textContent = '...включение...';
        btnSensors.disabled = true;
      }

      const result = await orientationInput.enable();

      if (result.enabled) {
        updateSensorButton({ status: 'enabled' });
      } else {
        updateSensorButton({ status: result.reason || 'error' });
      }
    } catch (error) {
      console.error('Ошибка включения датчиков:', error);
      updateSensorButton({ status: 'error' });
    }
  }
});
