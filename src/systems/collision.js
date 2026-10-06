import { distanceSq } from '../math/vector.js';
import { GameEvent, GameStatus } from '../core/constants.js';

/**
 * Система столкновений.
 *
 * Сейчас она обрабатывает:
 * - столкновение игрока с планетами;
 * - захват станций игроком.
 *
 * Важно:
 * - система не рисует;
 * - система не знает про DOM;
 * - система только меняет состояние мира и испускает события.
 */

export function updateCollisionSystem(world, eventBus) {
  const player = world.player;

  if (!player) {
    return;
  }

  if (!player.alive) {
    return;
  }

  handlePlanetCollisions(world, eventBus);

  if (!player.alive) {
    return;
  }

  handleStationCollisions(world, eventBus);
}

function handlePlanetCollisions(world, eventBus) {
  const player = world.player;

  for (const planet of world.planets) {
    if (!planet.active) {
      continue;
    }

    if (!planet.hazard) {
      continue;
    }

    const collisionRadius = planet.radius + player.radius;
    const distSq = distanceSq(player.position, planet.position);

    if (distSq <= collisionRadius * collisionRadius) {
      player.alive = false;
      world.status = GameStatus.GAME_OVER;

      eventBus?.emit(GameEvent.PLAYER_CRASHED, {
        player,
        planet,
      });

      eventBus?.emit(GameEvent.STATUS_CHANGED, {
        status: world.status,
      });

      return;
    }
  }
}

function handleStationCollisions(world, eventBus) {
  const player = world.player;

  for (const station of world.stations) {
    if (!station.active) {
      continue;
    }

    if (station.collected) {
      continue;
    }

    const captureRadius = station.captureRadius + player.radius;
    const distSq = distanceSq(player.position, station.position);

    if (distSq <= captureRadius * captureRadius) {
      station.collected = true;
      station.active = false;

      eventBus?.emit(GameEvent.STATION_COLLECTED, {
        station,
        scoreValue: station.scoreValue,
      });
    }
  }
}
