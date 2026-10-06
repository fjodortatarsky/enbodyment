import { vec, clone } from '../math/vector.js';
import { CORE_CONFIG } from './config.js';
import { EntityType, GameStatus } from './constants.js';
import { identity, getForward, getRight, getUp } from '../math/quaternion.js';


/**
 * Фабрика игрового состояния.
 *
 * Важно:
 * - состояние мира не должно знать про DOM;
 * - состояние мира должно быть сериализуемым;
 * - позже это позволит отправлять его по сети или сохранять.
 */

function createEntityId(world, type) {
  world.meta.nextEntityId += 1;
  return `${type}-${world.meta.nextEntityId}`;
}

export function createInputState() {
  return {
    thrust: false,
    brake: false,
    look: vec(0, 0, 0),
    commands: [],
  };
}

export function createWorld({ seed = 1 } = {}) {
  const world = {
    schemaVersion: 1,
    seed,
    status: GameStatus.RUNNING,
    time: 0,
    timeScale: CORE_CONFIG.simulation.defaultTimeScale,
    score: 0,
    meta: {
      nextEntityId: 0,
      tick: 0,
      rngState: seed >>> 0,
      nextStationSpawnAt: CORE_CONFIG.spawn.stationInterval,
    },
    input: createInputState(),
    player: null,
    planets: [],
    stations: [],
  };

  world.player = createPlayer(world);

  return world;
}

export function createPlayer(world) {
  const orientation = identity();

  return {
    id: createEntityId(world, EntityType.PLAYER),
    type: EntityType.PLAYER,
    active: true,

    position: vec(0, 0, 0),
    velocity: vec(0, 0, 0),
    acceleration: vec(0, 0, 0),

    orientation,

    // Базисные векторы корабля, обновляются каждый тик.
    forward: getForward(orientation),
    right: getRight(orientation),
    up: getUp(orientation),

    // Целевая ориентация от датчиков.
    targetOrientation: identity(),

    mass: CORE_CONFIG.player.mass,
    radius: CORE_CONFIG.player.radius,
    maxSpeed: CORE_CONFIG.player.maxSpeed,

    isStatic: false,
    gravitySource: false,
    affectedByGravity: true,

    thrust: false,
    brake: false,
    alive: true,
  };
}

export function createPlanet(world, {
  position = vec(0, 0, 0),
  velocity = vec(0, 0, 0),
  mass = 120,
  radius = 24,

  // Пока по умолчанию делаем планеты статичными источниками гравитации.
  // Если захотим полноценную динамическую N-body симуляцию,
  // можно будет передавать isStatic: false.
  isStatic = true,

  affectedByGravity = !isStatic,
  gravitySource = true,
  maxSpeed = null,
} = {}) {
  return {
    id: createEntityId(world, EntityType.PLANET),
    type: EntityType.PLANET,
    active: true,

    position: clone(position),
    velocity: clone(velocity),
    acceleration: vec(0, 0, 0),

    mass,
    radius,
    maxSpeed,

    isStatic,
    gravitySource,
    affectedByGravity,
    hazard: true,
  };
}

export function createStation(world, {
  position = vec(0, 0, 0),
  velocity = vec(0, 0, 0),

  // Станции пока делаем статичными целями.
  // Если позже захотим дрейфующие станции, можно передать isStatic: false.
  isStatic = true,

  affectedByGravity = !isStatic,
  gravitySource = false,
  maxSpeed = CORE_CONFIG.station.maxSpeed,
} = {}) {
  return {
    id: createEntityId(world, EntityType.STATION),
    type: EntityType.STATION,
    active: true,

    position: clone(position),
    velocity: clone(velocity),
    acceleration: vec(0, 0, 0),

    mass: CORE_CONFIG.station.mass,
    radius: CORE_CONFIG.station.radius,
    captureRadius: CORE_CONFIG.station.captureRadius,
    maxSpeed,

    isStatic,
    gravitySource,
    affectedByGravity,

    scoreValue: CORE_CONFIG.station.scoreValue,
    collected: false,
    pulsePhase: 0,
    expiresAt: null,
  };
}

export function addPlanet(world, props) {
  const planet = createPlanet(world, props);
  world.planets.push(planet);
  return planet;
}

export function addStation(world, props) {
  const station = createStation(world, props);
  world.stations.push(station);
  return station;
}

export function resetWorld(world, { seed = world.seed } = {}) {
  const fresh = createWorld({ seed });
  Object.assign(world, fresh);
  return world;
}

export function createCommand(type, payload = {}, tick = null) {
  return {
    type,
    payload,
    tick,
  };
}

export function enqueueCommand(world, command) {
  world.input.commands.push(command);
}

export function drainCommands(world) {
  const commands = world.input.commands;
  world.input.commands = [];
  return commands;
}
