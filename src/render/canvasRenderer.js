import { CORE_CONFIG } from '../core/config.js';
import { worldToScreen } from './camera.js';

/**
 * Canvas-рендерер.
 *
 * Он только рисует текущее состояние мира.
 * Он не должен менять world.
 */

export function createCanvasRenderer(canvas) {
  const context = canvas.getContext('2d');

  function resize() {
    const dpr = window.devicePixelRatio || 1;

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  window.addEventListener('resize', resize);
  resize();

  function render(world, camera) {
    const dpr = window.devicePixelRatio || 1;

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBackground(context, width, height);
    drawWorldBounds(context, camera);
    drawPlanets(context, world, camera, width, height);
    drawStations(context, world, camera, width, height);
    drawPlayer(context, world, camera);
  }

  return Object.freeze({
    render,
    resize,
  });
}

function drawBackground(context, width, height) {
  const backgroundGradient = context.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height)
  );

  backgroundGradient.addColorStop(0, '#0b1220');
  backgroundGradient.addColorStop(1, '#04060a');

  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, width, height);
}

function drawWorldBounds(context, camera) {
  const origin = { x: 0, y: 0, z: 0 };
  const screenCenter = worldToScreen(camera, origin);

  context.strokeStyle = 'rgba(120, 170, 255, 0.08)';
  context.lineWidth = 1;

  context.beginPath();
  context.arc(
    screenCenter.x,
    screenCenter.y,
    CORE_CONFIG.world.boundsRadius * camera.zoom,
    0,
    Math.PI * 2
  );

  context.stroke();
}

function drawPlanets(context, world, camera, width, height) {
  for (const planet of world.planets) {
    if (!planet.active) {
      continue;
    }

    const screenPosition = worldToScreen(camera, planet.position);
    const radius = Math.max(2, planet.radius * camera.zoom);
    const glowRadius = radius * 2.1;

    if (!isOnScreen(screenPosition, glowRadius, width, height)) {
      continue;
    }

    // Внешнее свечение опасности.
    context.beginPath();
    context.arc(screenPosition.x, screenPosition.y, glowRadius, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255, 96, 64, 0.07)';
    context.fill();

    // Тело планеты.
    const bodyGradient = context.createRadialGradient(
      screenPosition.x - radius * 0.35,
      screenPosition.y - radius * 0.35,
      Math.max(0.5, radius * 0.15),
      screenPosition.x,
      screenPosition.y,
      radius
    );

    bodyGradient.addColorStop(0, '#ffc7a6');
    bodyGradient.addColorStop(0.55, '#b86a5a');
    bodyGradient.addColorStop(1, '#572a22');

    context.beginPath();
    context.arc(screenPosition.x, screenPosition.y, radius, 0, Math.PI * 2);
    context.fillStyle = bodyGradient;
    context.fill();

    context.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    context.lineWidth = 1;
    context.stroke();
  }
}

function drawStations(context, world, camera, width, height) {
  for (const station of world.stations) {
    if (!station.active) {
      continue;
    }

    if (station.collected) {
      continue;
    }

    const screenPosition = worldToScreen(camera, station.position);

    const pulse = 0.5 + Math.sin(station.pulsePhase) * 0.5;
    const captureRadius = Math.max(3, station.captureRadius * camera.zoom);
    const coreRadius = Math.max(2, (station.radius + pulse * 5) * camera.zoom);
    const haloRadius = coreRadius * 1.8;

    if (!isOnScreen(screenPosition, captureRadius * 1.5, width, height)) {
      continue;
    }

    let alpha = 1;

    if (station.expiresAt !== null) {
      const remaining = station.expiresAt - world.time;

      if (remaining < 3) {
        alpha = 0.3 + 0.7 * Math.abs(Math.sin(world.time * 10));
      }
    }

    // Зона захвата.
    context.globalAlpha = alpha * 0.14;
    context.beginPath();
    context.arc(screenPosition.x, screenPosition.y, captureRadius, 0, Math.PI * 2);
    context.fillStyle = '#48f2c3';
    context.fill();

    // Пульсирующее ядро станции.
    const stationGradient = context.createRadialGradient(
      screenPosition.x,
      screenPosition.y,
      0,
      screenPosition.x,
      screenPosition.y,
      haloRadius
    );

    stationGradient.addColorStop(0, 'rgba(233, 255, 248, 0.95)');
    stationGradient.addColorStop(0.35, 'rgba(84, 242, 200, 0.85)');
    stationGradient.addColorStop(1, 'rgba(84, 242, 200, 0)');

    context.globalAlpha = alpha * 0.9;
    context.beginPath();
    context.arc(screenPosition.x, screenPosition.y, haloRadius, 0, Math.PI * 2);
    context.fillStyle = stationGradient;
    context.fill();

    context.globalAlpha = 1;
  }
}

function drawPlayer(context, world, camera) {
  const player = world.player;

  if (!player) {
    return;
  }

  const screenPosition = worldToScreen(camera, player.position);
  const radius = Math.max(5, player.radius * camera.zoom);

  context.save();
  context.translate(screenPosition.x, screenPosition.y);
  context.rotate(getPlayerScreenAngle(player, camera));

  if (!player.alive) {
    context.globalAlpha = 0.45;
  }

  // Тормозное кольцо.
  if (player.brake && player.alive) {
    context.strokeStyle = 'rgba(120, 190, 255, 0.75)';
    context.lineWidth = 2;

    context.beginPath();
    context.arc(0, 0, radius * 2.1, 0, Math.PI * 2);
    context.stroke();
  }

  // Пламя тяги.
  if (player.thrust && player.alive) {
    const flicker = 0.7 + Math.sin(world.time * 30) * 0.3;

    context.globalAlpha = 0.75 * flicker;
    context.fillStyle = '#ff9f43';

    context.beginPath();
    context.moveTo(-radius * 1.2, radius * 0.55);
    context.lineTo(-radius * (2.3 + flicker), 0);
    context.lineTo(-radius * 1.2, -radius * 0.55);
    context.closePath();
    context.fill();

    context.globalAlpha = player.alive ? 1 : 0.45;
  }

  // Корпус корабля.
  context.beginPath();
  context.moveTo(radius * 1.7, 0);
  context.lineTo(-radius * 1.1, radius * 1.05);
  context.lineTo(-radius * 0.5, 0);
  context.lineTo(-radius * 1.1, -radius * 1.05);
  context.closePath();

  context.fillStyle = player.alive ? '#ffd166' : '#8a93a6';
  context.fill();

  context.strokeStyle = player.alive
    ? 'rgba(255, 255, 255, 0.75)'
    : 'rgba(255, 255, 255, 0.25)';

  context.lineWidth = 1.5;
  context.stroke();

  context.restore();
}

function getPlayerScreenAngle(player, camera) {
  let worldAngle = 0;

  const speedSq =
    player.velocity.x * player.velocity.x +
    player.velocity.y * player.velocity.y;

  if (speedSq > 0.0001) {
    worldAngle = Math.atan2(player.velocity.y, player.velocity.x);
  } else if (player.heading) {
    worldAngle = Math.atan2(player.heading.y, player.heading.x);
  }

  return worldAngle + camera.rotation;
}

function isOnScreen(point, radius, width, height) {
  return (
    point.x + radius >= 0 &&
    point.x - radius <= width &&
    point.y + radius >= 0 &&
    point.y - radius <= height
  );
}
