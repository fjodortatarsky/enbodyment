import { vec, copy } from '../math/vector.js';
import { CORE_CONFIG } from '../core/config.js';

/**
 * Камера — это часть представления, не часть игровой логики.
 *
 * Позже сюда можно добавить:
 * - вращение через датчики телефона;
 * - плавное следование;
 * - тряску;
 * - зум;
 * - режим наблюдения за другим сетевым игроком.
 */

export function createCamera() {
  return {
    center: vec(0, 0, 0),
    zoom: 1,
    rotation: 0,

    viewRadius: CORE_CONFIG.world.boundsRadius + 80,

    viewportWidth: 1,
    viewportHeight: 1,
  };
}

export function updateCamera(camera, world) {
  if (world.player) {
    copy(camera.center, world.player.position);
  }

  camera.viewRadius = CORE_CONFIG.world.boundsRadius + 80;
}

export function updateCameraViewport(camera, width, height) {
  camera.viewportWidth = Math.max(1, width);
  camera.viewportHeight = Math.max(1, height);

  const available = Math.min(camera.viewportWidth, camera.viewportHeight);

  camera.zoom = available / (camera.viewRadius * 2);
}

export function worldToScreen(camera, position) {
  const dx = position.x - camera.center.x;
  const dy = position.y - camera.center.y;

  const cos = Math.cos(camera.rotation);
  const sin = Math.sin(camera.rotation);

  const rotatedX = dx * cos - dy * sin;
  const rotatedY = dx * sin + dy * cos;

  return {
    x: camera.viewportWidth / 2 + rotatedX * camera.zoom,
    y: camera.viewportHeight / 2 + rotatedY * camera.zoom,
  };
}
