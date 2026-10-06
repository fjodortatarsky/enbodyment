import { CORE_CONFIG } from '../core/config.js';
import {
  length,
  lengthSq,
  scale,
  addScaledTo,
} from '../math/vector.js';
import {
  slerp,
  getForward,
  getRight,
  getUp,
} from '../math/quaternion.js';

/**
 * Система управления кораблём.
 *
 * Ньютоновская физика в космосе:
 * - тяга вдоль носа корабля;
 * - ускорение добавляется к скорости;
 * - без тяги — движение по инерции;
 * - корабль может вращаться независимо от направления движения.
 */

export function updateControlSystem(world, fixedDelta) {
  const player = world.player;

  if (!player) {
    return;
  }

  if (!player.alive) {
    return;
  }

  if (player.isStatic) {
    return;
  }

  // Плавное вращение корабля к целевой ориентации.
  updateShipOrientation(player, fixedDelta);

  if (player.brake) {
    applyBrake(player, fixedDelta);
  }

  if (player.thrust) {
    applyThrust(player, fixedDelta);
  }
}

function updateShipOrientation(player, fixedDelta) {
  /**
   * Сглаживание поворота корабля.
   * Можно настроить для более резкого или плавного отклика.
   */
  const rotationSpeed = 8;
  const t = 1 - Math.exp(-fixedDelta * rotationSpeed);

  player.orientation = slerp(
    player.orientation,
    player.targetOrientation,
    t
  );

  // Обновляем базисные векторы.
  player.forward = getForward(player.orientation);
  player.right = getRight(player.orientation);
  player.up = getUp(player.orientation);
}

function applyThrust(player, fixedDelta) {
  /**
   * Тяга вдоль носа корабля.
   *
   * Это классическая космическая физика:
   * - двигатель толкает корабль вперёд;
   * - ускорение добавляется к скорости;
   * - корабль может лететь боком, если повернулся.
   */
  addScaledTo(
    player.acceleration,
    player.forward,
    CORE_CONFIG.player.thrustPower
  );
}

function applyBrake(player, fixedDelta) {
  const speed = length(player.velocity);

  if (speed <= 0.0001) {
    player.velocity.x = 0;
    player.velocity.y = 0;
    player.velocity.z = 0;
    return;
  }

  /**
   * Тормоз гасит скорость.
   *
   * Это как ретро-двигатели или атмосферное торможение.
   * Тормозим против текущей скорости, но не разворачиваем корабль.
   */
  const oppositeDirection = scale(player.velocity, -1 / speed);

  const neededAcceleration = speed / fixedDelta;
  const brakeAcceleration = Math.min(
    CORE_CONFIG.player.brakePower,
    neededAcceleration
  );

  addScaledTo(player.acceleration, oppositeDirection, brakeAcceleration);
}
