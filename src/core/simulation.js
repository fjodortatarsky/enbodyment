import { copy } from '../math/vector.js';
import { CommandType, GameEvent, GameStatus } from './constants.js';
import { drainCommands, resetWorld } from './state.js';

import {
  resetAccelerations,
  updateGravitySystem,
  updateIntegrationSystem,
} from '../systems/physics.js';

import {
  updateControlSystem,
} from '../systems/control.js';

import {
  updateStationSystem,
} from '../systems/station.js';

import {
  updateCollisionSystem,
} from '../systems/collision.js';

/**
 * Симуляция мира.
 *
 * Порядок систем важен:
 * 1. обрабатываем команды;
 * 2. сбрасываем ускорения;
 * 3. применяем управление;
 * 4. применяем гравитацию;
 * 5. интегрируем движение;
 * 6. обновляем станции;
 * 7. проверяем коллизии.
 */

export function updateWorld(world, fixedDelta, eventBus) {
  processCommands(world, eventBus);

  if (world.status !== GameStatus.RUNNING) {
    return;
  }

  world.time += fixedDelta;
  world.meta.tick += 1;

  resetAccelerations(world);
  updateControlSystem(world, fixedDelta);
  updateGravitySystem(world, fixedDelta);
  updateIntegrationSystem(world, fixedDelta);

  updateStationSystem(world, fixedDelta, eventBus);
  updateCollisionSystem(world, eventBus);

  eventBus?.emit(GameEvent.TICK, {
    time: world.time,
    tick: world.meta.tick,
  });
}

function processCommands(world, eventBus) {
  const commands = drainCommands(world);

  for (const command of commands) {
    applyCommand(world, command, eventBus);
  }
}

export function applyCommand(world, command, eventBus) {
  switch (command.type) {
    case CommandType.SET_THRUST: {
      const value = Boolean(command.payload?.value);
      world.input.thrust = value;
      world.player.thrust = value;
      break;
    }

    case CommandType.SET_BRAKE: {
      const value = Boolean(command.payload?.value);
      world.input.brake = value;
      world.player.brake = value;
      break;
    }

  case CommandType.LOOK: {
  if (command.payload?.orientation) {
    if (world.player) {
      world.player.targetOrientation = command.payload.orientation;
    }
  }

  break;
}

    case CommandType.SET_TIME_SCALE: {
      setTimeScale(world, command.payload?.value, eventBus);
      break;
    }

    case CommandType.TOGGLE_PAUSE: {
      togglePause(world, eventBus);
      break;
    }

    case CommandType.RESET: {
      resetWorld(world, { seed: command.payload?.seed ?? world.seed });
      eventBus?.emit(GameEvent.WORLD_RESET, { world });
      break;
    }

    default: {
      console.warn(`Unknown command type: ${command.type}`);
    }
  }
}

function setTimeScale(world, value, eventBus) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return;
  }

  const nextTimeScale = Math.max(0, parsed);

  if (world.timeScale === nextTimeScale) {
    return;
  }

  world.timeScale = nextTimeScale;

  eventBus?.emit(GameEvent.TIME_SCALE_CHANGED, {
    timeScale: world.timeScale,
  });
}

function togglePause(world, eventBus) {
  if (world.status === GameStatus.RUNNING) {
    world.status = GameStatus.PAUSED;
  } else if (world.status === GameStatus.PAUSED) {
    world.status = GameStatus.RUNNING;
  } else {
    return;
  }

  eventBus?.emit(GameEvent.STATUS_CHANGED, {
    status: world.status,
  });
}
