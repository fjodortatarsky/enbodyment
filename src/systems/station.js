import { CORE_CONFIG } from '../core/config.js';
import { addStation } from '../core/state.js';
import {
  vec,
  distanceSq,
  add,
  scale,
  length,
} from '../math/vector.js';
import { GameEvent } from '../core/constants.js';
import { randomAngle, randomRange } from '../core/random.js';

/**
 * Система станций.
 *
 * Отвечает за:
 * - пульсацию станций;
 * - срок жизни станций;
 * - удаление неактивных и собранных станций;
 * - спавн новых станций.
 *
 * Спавн сделан детерминированным через world.meta.rngState.
 */

export function updateStationSystem(world, fixedDelta, eventBus) {
  cleanupStations(world);
  updateExistingStations(world, fixedDelta, eventBus);
  cleanupStations(world);
  spawnStationsIfNeeded(world, eventBus);
}

function cleanupStations(world) {
  world.stations = world.stations.filter((station) => {
    return station.active && !station.collected;
  });
}

function updateExistingStations(world, fixedDelta, eventBus) {
  for (const station of world.stations) {
    if (!station.active) {
      continue;
    }

    if (station.collected) {
      continue;
    }

    station.pulsePhase += CORE_CONFIG.station.pulseSpeed * fixedDelta;

    if (station.expiresAt !== null && world.time >= station.expiresAt) {
      station.active = false;

      eventBus?.emit(GameEvent.STATION_EXPIRED, {
        station,
      });
    }
  }
}

function spawnStationsIfNeeded(world, eventBus) {
  if (!Number.isFinite(world.meta.nextStationSpawnAt)) {
    world.meta.nextStationSpawnAt = world.time + CORE_CONFIG.spawn.stationInterval;
  }

  if (world.time < world.meta.nextStationSpawnAt) {
    return;
  }

  world.meta.nextStationSpawnAt = world.time + CORE_CONFIG.spawn.stationInterval;

  const activeStationCount = world.stations.filter((station) => {
    return station.active && !station.collected;
  }).length;

  if (activeStationCount >= CORE_CONFIG.world.maxStations) {
    return;
  }

  const position = findStationSpawnPosition(world);

  if (!position) {
    return;
  }

  const station = addStation(world, {
    position,
    isStatic: true,
  });

  station.expiresAt = world.time + CORE_CONFIG.station.lifetime;

  eventBus?.emit(GameEvent.STATION_SPAWNED, {
    station,
  });
}

function findStationSpawnPosition(world) {
  const spawn = CORE_CONFIG.spawn;

  for (let attempt = 0; attempt < spawn.attempts; attempt += 1) {
    const direction = randomUnitVector(world);

    const distance = randomRange(
      world,
      spawn.stationMinRadius,
      spawn.stationMaxRadius
    );

    let position = add(
      world.player.position,
      scale(direction, distance)
    );

    // Не даём станции улететь слишком далеко от центра мира.
    const maxWorldRadius = CORE_CONFIG.world.boundsRadius;
    const positionLength = length(position);

    if (positionLength > maxWorldRadius) {
      position = scale(position, (maxWorldRadius * 0.96) / positionLength);
    }

    if (!isFarEnoughFromPlayer(world, position)) {
      continue;
    }

    if (!isFarEnoughFromPlanets(world, position)) {
      continue;
    }

    if (!isFarEnoughFromStations(world, position)) {
      continue;
    }

    return position;
  }

  return null;
}

function randomUnitVector(world) {
  const u = randomRange(world, -1, 1);
  const theta = randomAngle(world);

  const r = Math.sqrt(Math.max(0, 1 - u * u));

  return vec(
    r * Math.cos(theta),
    u,
    r * Math.sin(theta)
  );
}

function isFarEnoughFromPlayer(world, position) {
  const minDistance = CORE_CONFIG.spawn.minDistanceFromPlayer;
  const distSq = distanceSq(position, world.player.position);

  return distSq >= minDistance * minDistance;
}

function isFarEnoughFromPlanets(world, position) {
  const spawn = CORE_CONFIG.spawn;

  for (const planet of world.planets) {
    if (!planet.active) {
      continue;
    }

    const minDistance = planet.radius + spawn.minDistanceFromPlanets;
    const distSq = distanceSq(position, planet.position);

    if (distSq < minDistance * minDistance) {
      return false;
    }
  }

  return true;
}

function isFarEnoughFromStations(world, position) {
  const minDistance = CORE_CONFIG.spawn.minDistanceBetweenStations;

  for (const station of world.stations) {
    if (!station.active) {
      continue;
    }

    if (station.collected) {
      continue;
    }

    const distSq = distanceSq(position, station.position);

    if (distSq < minDistance * minDistance) {
      return false;
    }
  }

  return true;
}
