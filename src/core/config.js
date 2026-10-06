/**
 * Центральная конфигурация игры.
 *
 * Здесь живут параметры баланса и симуляции.
 * Позже сюда можно добавить уровни, сложности, настройки камеры и т.д.
 */

export const CORE_CONFIG = Object.freeze({
  simulation: Object.freeze({
    fixedDeltaTime: 1 / 60,
    maxSubSteps: 5,
    defaultTimeScale: 1.0,
  }),

  physics: Object.freeze({
    gravityConstant: 8000,
    softening: 24,
    maxSpeed: 900,
  }),

  player: Object.freeze({
    mass: 1,
    radius: 8,
    thrustPower: 90,
    brakePower: 220,
    maxSpeed: 320,
  }),

  station: Object.freeze({
    mass: 2,
    radius: 10,
    captureRadius: 22,
    pulseSpeed: 2.2,
    scoreValue: 10,
    lifetime: 14,
    maxSpeed: 260,
  }),

  planet: Object.freeze({
    minMass: 80,
    maxMass: 320,
    minRadius: 16,
    maxRadius: 42,
  }),

  world: Object.freeze({
    maxPlanets: 8,
    maxStations: 4,
    safeSpawnDistance: 180,
    boundsRadius: 520,
  }),

  spawn: Object.freeze({
    stationInterval: 3.5,

    stationMinRadius: 140,
    stationMaxRadius: 440,

    minDistanceFromPlayer: 90,
    minDistanceFromPlanets: 45,
    minDistanceBetweenStations: 80,

    attempts: 24,
  }),
});
