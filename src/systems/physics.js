import { CORE_CONFIG } from '../core/config.js';
import {
  set,
  addScaledTo,
  multiplyScalar,
  lengthSq,
} from '../math/vector.js';

/**
 * Физическая система.
 *
 * Сейчас она отвечает за:
 * - сброс ускорений перед тиком;
 * - расчёт гравитации;
 * - интеграцию скоростей и позиций;
 * - ограничение максимальной скорости.
 *
 * Позже сюда можно добавить:
 * - пространственные сетки;
 * - оптимизацию дальних тел;
 * - подшаги;
 * - специфичные ограничения.
 */

export function resetAccelerations(world) {
  forEachBody(world, (body) => {
    if (body.acceleration) {
      set(body.acceleration, 0, 0, 0);
    }
  });
}

export function updateGravitySystem(world) {
  const bodies = collectBodies(world);
  const { gravityConstant, softening } = CORE_CONFIG.physics;
  const softeningSq = softening * softening;

  for (const target of bodies) {
    if (!canFeelGravity(target)) {
      continue;
    }

    for (const source of bodies) {
      if (source === target) {
        continue;
      }

      if (!isGravitySource(source)) {
        continue;
      }

      const dx = source.position.x - target.position.x;
      const dy = source.position.y - target.position.y;
      const dz = source.position.z - target.position.z;

      const distSq = dx * dx + dy * dy + dz * dz + softeningSq;

      // Защита от деления на ноль и сингулярностей.
      const invDist = 1 / Math.sqrt(distSq);

      // Ускорение цели от источника:
      // a = G * M / r^2
      const accelerationMagnitude = gravityConstant * source.mass / distSq;

      target.acceleration.x += dx * invDist * accelerationMagnitude;
      target.acceleration.y += dy * invDist * accelerationMagnitude;
      target.acceleration.z += dz * invDist * accelerationMagnitude;
    }
  }
}

export function updateIntegrationSystem(world, fixedDelta) {
  forEachBody(world, (body) => {
    integrateBody(body, fixedDelta);
  });
}

export function collectBodies(world) {
  const bodies = [];

  if (world.player) {
    bodies.push(world.player);
  }

  for (const planet of world.planets) {
    bodies.push(planet);
  }

  for (const station of world.stations) {
    bodies.push(station);
  }

  return bodies;
}

function forEachBody(world, callback) {
  if (world.player) {
    callback(world.player);
  }

  for (const planet of world.planets) {
    callback(planet);
  }

  for (const station of world.stations) {
    callback(station);
  }
}

function integrateBody(body, fixedDelta) {
  if (!isDynamicBody(body)) {
    return;
  }

  // v += a * dt
  addScaledTo(body.velocity, body.acceleration, fixedDelta);

  clampSpeed(body);

  // p += v * dt
  addScaledTo(body.position, body.velocity, fixedDelta);
}

function clampSpeed(body) {
  const maxSpeed = body.maxSpeed ?? CORE_CONFIG.physics.maxSpeed;

  if (!Number.isFinite(maxSpeed)) {
    return;
  }

  const speedSq = lengthSq(body.velocity);

  if (speedSq <= maxSpeed * maxSpeed) {
    return;
  }

  const speed = Math.sqrt(speedSq);

  if (speed === 0) {
    return;
  }

  multiplyScalar(body.velocity, maxSpeed / speed);
}

function isDynamicBody(body) {
  return Boolean(
    body &&
    body.active !== false &&
    body.isStatic !== true
  );
}

function canFeelGravity(body) {
  return isDynamicBody(body) && body.affectedByGravity !== false;
}

function isGravitySource(body) {
  return Boolean(
    body &&
    body.active !== false &&
    body.gravitySource === true &&
    body.mass > 0
  );
}
