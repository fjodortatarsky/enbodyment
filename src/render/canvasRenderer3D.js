import { CORE_CONFIG } from '../core/config.js';
import {
  basisFromYawPitchRoll,
  dot,
} from '../math/orientation.js';

/**
 * Первый 3D-рендерер на Canvas 2D.
 *
 * Он рисует не 2D-мир, а перспективную проекцию 3D-мира.
 *
 * Позже его можно заменить на WebGL / Three.js,
 * но для текущего рефакторинга это хороший промежуточный шаг.
 */

export function createCanvasRenderer(canvas) {
  const context = canvas.getContext('2d');

  const stars = createStars(420);

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

    const basis = {
		  forward: camera.forward,
		  right: camera.right,
		  up: camera.up,
    };

    const fov = camera.fov ?? Math.PI / 3;
    const focal = (height / 2) / Math.tan(fov / 2);

    drawBackground(context, width, height);
    drawStars(context, stars, basis, width, height, focal);

    const drawables = collectDrawables(world, camera, basis, focal, width, height);

    drawables.sort((a, b) => b.z - a.z);

    for (const drawable of drawables) {
      if (drawable.kind === 'planet') {
        drawPlanet(context, drawable, world, camera);
      }

      if (drawable.kind === 'station') {
        drawStation(context, drawable, world, camera);
      }
    }

    // Отрисовка локального корабля (голубоватый)
    if (world.player && world.player.alive) {
      drawShip(context, camera, basis, focal, width, height, world.player, 'rgba(100, 200, 255, 0.5)');
    }

    // Отрисовка удалённых игроков (красноватый)
    if (world.remotePlayers) {
      for (const remote of world.remotePlayers.values()) {
        drawShip(context, camera, basis, focal, width, height, remote, 'rgba(255, 100, 100, 0.6)');
      }
    }

    drawReticle(context, width, height);
  }

  return Object.freeze({
    render,
    resize,
  });
}

function createStars(count) {
  const stars = [];

  for (let i = 0; i < count; i += 1) {
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;

    const r = Math.sqrt(Math.max(0, 1 - u * u));

    stars.push({
      x: r * Math.cos(theta),
      y: u,
      z: r * Math.sin(theta),
      size: Math.random() * 1.8 + 0.4,
      alpha: Math.random() * 0.5 + 0.2,
    });
  }

  return stars;
}

function drawBackground(context, width, height) {
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height)
  );

  gradient.addColorStop(0, '#070b14');
  gradient.addColorStop(1, '#03050a');

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function drawStars(context, stars, basis, width, height, focal) {
  for (const star of stars) {
    const z = dot(star, basis.forward);

    if (z <= 0.05) {
      continue;
    }

    const x = width / 2 + (dot(star, basis.right) / z) * focal;
    const y = height / 2 - (dot(star, basis.up) / z) * focal;

    context.globalAlpha = star.alpha;
    context.fillStyle = '#bfe3ff';

    context.fillRect(x, y, star.size, star.size);
  }

  context.globalAlpha = 1;
}

function collectDrawables(world, camera, basis, focal, width, height) {
  const drawables = [];

  for (const planet of world.planets) {
    if (!planet.active) {
      continue;
    }

    const projected = projectPoint(
      camera,
      basis,
      focal,
      width,
      height,
      planet.position
    );

    if (!projected) {
      continue;
    }

    drawables.push({
      kind: 'planet',
      planet,
      screen: projected,
      z: projected.z,
    });
  }

  for (const station of world.stations) {
    if (!station.active) {
      continue;
    }

    if (station.collected) {
      continue;
    }

    const projected = projectPoint(
      camera,
      basis,
      focal,
      width,
      height,
      station.position
    );

    if (!projected) {
      continue;
    }

    drawables.push({
      kind: 'station',
      station,
      screen: projected,
      z: projected.z,
    });
  }

  return drawables;
}

function projectPoint(camera, basis, focal, width, height, position) {
  const rel = {
    x: position.x - camera.position.x,
    y: position.y - camera.position.y,
    z: position.z - camera.position.z,
  };

  const x = dot(rel, basis.right);
  const y = dot(rel, basis.up);
  const z = dot(rel, basis.forward);

  const near = 0.1;

  if (z <= near) {
    return null;
  }

  const scale = focal / z;

  return {
    x: width / 2 + x * scale,
    y: height / 2 - y * scale,
    scale,
    z,
  };
}

function drawPlanet(context, drawable, world, camera) {
  const planet = drawable.planet;
  const screen = drawable.screen;

  const radius = Math.max(0.7, planet.radius * screen.scale);

  // Внешнее свечение.
  context.beginPath();
  context.arc(screen.x, screen.y, radius * 1.7, 0, Math.PI * 2);
  context.fillStyle = 'rgba(255, 96, 64, 0.06)';
  context.fill();

  const bodyGradient = context.createRadialGradient(
    screen.x - radius * 0.35,
    screen.y - radius * 0.35,
    Math.max(0.5, radius * 0.15),
    screen.x,
    screen.y,
    radius
  );

  bodyGradient.addColorStop(0, '#ffc7a6');
  bodyGradient.addColorStop(0.55, '#b86a5a');
  bodyGradient.addColorStop(1, '#572a22');

  context.beginPath();
  context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  context.fillStyle = bodyGradient;
  context.fill();

  context.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  context.lineWidth = 1;
  context.stroke();
}

function drawStation(context, drawable, world, camera) {
  const station = drawable.station;
  const screen = drawable.screen;

  const pulse = 0.5 + Math.sin(station.pulsePhase) * 0.5;

  const coreRadius = Math.max(
    1.2,
    (station.radius + pulse * 4) * screen.scale
  );

  const captureRadius = Math.max(
    2,
    station.captureRadius * screen.scale
  );

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
  context.arc(screen.x, screen.y, captureRadius, 0, Math.PI * 2);
  context.fillStyle = '#48f2c3';
  context.fill();

  // Пульсирующее ядро станции.
  const haloRadius = coreRadius * 1.8;

  const stationGradient = context.createRadialGradient(
    screen.x,
    screen.y,
    0,
    screen.x,
    screen.y,
    haloRadius
  );

  stationGradient.addColorStop(0, 'rgba(233, 255, 248, 0.95)');
  stationGradient.addColorStop(0.35, 'rgba(84, 242, 200, 0.85)');
  stationGradient.addColorStop(1, 'rgba(84, 242, 200, 0)');

  context.globalAlpha = alpha * 0.9;
  context.beginPath();
  context.arc(screen.x, screen.y, haloRadius, 0, Math.PI * 2);
  context.fillStyle = stationGradient;
  context.fill();

  context.globalAlpha = 1;
}

function drawReticle(context, width, height) {
  const cx = width / 2;
  const cy = height / 2;

  context.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  context.lineWidth = 1;

  context.beginPath();

  context.moveTo(cx - 14, cy);
  context.lineTo(cx - 5, cy);

  context.moveTo(cx + 5, cy);
  context.lineTo(cx + 14, cy);

  context.moveTo(cx, cy - 14);
  context.lineTo(cx, cy - 5);

  context.moveTo(cx, cy + 5);
  context.lineTo(cx, cy + 14);

  context.stroke();

  context.beginPath();
  context.arc(cx, cy, 2, 0, Math.PI * 2);
  context.stroke();
}

function drawShip(context, camera, basis, focal, width, height, ship, color) {
  // Интерполяция позиции для плавности движения удалённых игроков
  const pos = ship.position;
  const target = ship.targetPosition || pos;

  // Плавное приближение к целевой позиции (экспоненциальное сглаживание)
  pos.x += (target.x - pos.x) * 0.2;
  pos.y += (target.y - pos.y) * 0.2;
  pos.z += (target.z - pos.z) * 0.2;

  const f = ship.forward;
  const r = ship.right;
  const u = ship.up;

  // Вершины конуса (пирамиды): остриё вперёд, основание сзади
  const tip = { x: pos.x + f.x * 2.0, y: pos.y + f.y * 2.0, z: pos.z + f.z * 2.0 };
  const b1 = { x: pos.x - f.x * 0.5 + r.x * 0.8 + u.x * 0.5, y: pos.y - f.y * 0.5 + r.y * 0.8 + u.y * 0.5, z: pos.z - f.z * 0.5 + r.z * 0.8 + u.z * 0.5 };
  const b2 = { x: pos.x - f.x * 0.5 - r.x * 0.8 + u.x * 0.5, y: pos.y - f.y * 0.5 - r.y * 0.8 + u.y * 0.5, z: pos.z - f.z * 0.5 - r.z * 0.8 + u.z * 0.5 };
  const b3 = { x: pos.x - f.x * 0.5 - u.x * 1.0, y: pos.y - f.y * 0.5 - u.y * 1.0, z: pos.z - f.z * 0.5 - u.z * 1.0 };

  const pTip = projectPoint(camera, basis, focal, width, height, tip);
  const p1 = projectPoint(camera, basis, focal, width, height, b1);
  const p2 = projectPoint(camera, basis, focal, width, height, b2);
  const p3 = projectPoint(camera, basis, focal, width, height, b3);

  // Если корабль за камерой, не рисуем
  if (!pTip || !p1 || !p2 || !p3) return;

  context.beginPath();
  context.moveTo(pTip.x, pTip.y);
  context.lineTo(p1.x, p1.y);
  context.lineTo(p2.x, p2.y);
  context.lineTo(p3.x, p3.y);
  context.closePath();

  context.fillStyle = color;
  context.fill();

  context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  context.lineWidth = 1.5;
  context.stroke();
}
