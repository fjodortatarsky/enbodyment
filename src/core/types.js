/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} Entity
 * @property {string} id
 * @property {string} type
 * @property {boolean} active
 */

/**
 * @typedef {Entity & Object} PhysicsBody
 * @property {Vec3} position
 * @property {Vec3} velocity
 * @property {Vec3} acceleration
 * @property {number} mass
 * @property {number} radius
 */

/**
 * @typedef {PhysicsBody & Object} PlayerState
 * @property {boolean} thrust
 * @property {boolean} brake
 * @property {boolean} alive
 */

/**
 * @typedef {PhysicsBody & Object} PlanetState
 * @property {boolean} gravitySource
 * @property {boolean} hazard
 */

/**
 * @typedef {Object} StationState
 * @property {string} id
 * @property {string} type
 * @property {boolean} active
 * @property {Vec3} position
 * @property {Vec3} velocity
 * @property {Vec3} acceleration
 * @property {number} radius
 * @property {number} captureRadius
 * @property {number} scoreValue
 * @property {boolean} collected
 * @property {number} pulsePhase
 * @property {number | null} expiresAt
 */

/**
 * @typedef {Object} InputState
 * @property {boolean} thrust
 * @property {boolean} brake
 * @property {Vec3} look
 * @property {Array<GameCommand>} commands
 */

/**
 * @typedef {Object} GameCommand
 * @property {string} type
 * @property {Record<string, any>} payload
 * @property {number | null} tick
 */

/**
 * @typedef {Object} WorldMeta
 * @property {number} nextEntityId
 * @property {number} tick
 */

/**
 * @typedef {Object} WorldState
 * @property {number} schemaVersion
 * @property {number} seed
 * @property {string} status
 * @property {number} time
 * @property {number} timeScale
 * @property {number} score
 * @property {WorldMeta} meta
 * @property {InputState} input
 * @property {PlayerState} player
 * @property {Array<PlanetState>} planets
 * @property {Array<StationState>} stations
 */

/**
 * @typedef {Object} EventBus
 * @property {(type: string, handler: Function) => Function} on
 * @property {(type: string, handler: Function) => void} off
 * @property {(type: string, payload?: any) => void} emit
 * @property {() => void} clear
 */

/**
 * @typedef {Object} Clock
 * @property {(frameDelta: number, timeScale: number, onTick: (fixedDelta: number) => void) => number} update
 * @property {() => void} reset
 */

export {};
