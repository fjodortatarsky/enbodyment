export const GameStatus = Object.freeze({
  BOOT: 'boot',
  MENU: 'menu',
  RUNNING: 'running',
  PAUSED: 'paused',
  GAME_OVER: 'game-over',
});

export const EntityType = Object.freeze({
  PLAYER: 'player',
  PLANET: 'planet',
  STATION: 'station',
});

export const CommandType = Object.freeze({
  SET_THRUST: 'input/set-thrust',
  SET_BRAKE: 'input/set-brake',
  LOOK: 'input/look',
  RESET: 'game/reset',
  SET_TIME_SCALE: 'game/set-time-scale',
  TOGGLE_PAUSE: 'game/toggle-pause',
});

export const GameEvent = Object.freeze({
  WORLD_CREATED: 'world/created',
  WORLD_RESET: 'world/reset',

  TICK: 'game/tick',
  STATUS_CHANGED: 'game/status-changed',
  SCORE_CHANGED: 'game/score-changed',
  TIME_SCALE_CHANGED: 'game/time-scale-changed',

  STATION_COLLECTED: 'station/collected',
  STATION_SPAWNED: 'station/spawned',
  STATION_EXPIRED: 'station/expired',

  PLAYER_CRASHED: 'player/crashed',
});
