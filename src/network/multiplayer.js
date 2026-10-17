// src/network/multiplayer.js
import { joinRoom } from 'https://esm.sh/@trystero-p2p/torrent';
import { clone } from '../math/vector.js';

const APP_ID = 'com.fjodortatarsky.enbodyment.mp.v2';

export function createMultiplayer(world, eventBus) {
  const urlParams = new URLSearchParams(window.location.search);
  let roomId = urlParams.get('room');
  
  if (!roomId) {
    roomId = `room-${Math.random().toString(36).substring(2, 8)}`;
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('room', roomId);
    window.history.replaceState({}, '', newUrl);
  }

  console.log(`[Multiplayer] Инициализация комнаты: ${roomId}`);

  const room = joinRoom({ appId: APP_ID }, roomId);
  console.log('[Multiplayer] Объект комнаты создан. Ожидаем подключения пиров...');

  // 1. Отслеживаем присоединение (этого не хватало)
  room.onPeerJoin = (peerId) => {
    console.log(`✅ [Multiplayer] Пир присоединился: ${peerId}`);
    if (!world.remotePlayers) world.remotePlayers = new Map();
    eventBus.emit('network:playerJoined', { peerId });
  };

  // 2. Отслеживаем отключение
  room.onPeerLeave = (peerId) => {
    console.log(`❌ [Multiplayer] Пир отключился: ${peerId}`);
    if (world.remotePlayers) {
      world.remotePlayers.delete(peerId);
    }
    eventBus.emit('network:playerLeft', { peerId });
  };

  // 3. Действие для обмена состоянием
  const playerStateAction = room.makeAction('playerState');

  playerStateAction.onMessage = (state, { peerId }) => {
    console.log(`📩 [Multiplayer] Получены данные от ${peerId}`, state);
    if (!world.remotePlayers) world.remotePlayers = new Map();
    
    const isNew = !world.remotePlayers.has(peerId);
    const remote = world.remotePlayers.get(peerId) || { 
      id: peerId, 
      position: {
        x: state.position.x + (isNew ? (Math.random() - 0.5) * 15 : 0),
        y: state.position.y + (isNew ? (Math.random() - 0.5) * 15 : 0),
        z: state.position.z + (isNew ? (Math.random() - 0.5) * 15 : 0)
      }, 
      targetPosition: clone(state.position),
      forward: clone(state.forward),
      right: clone(state.right),
      up: clone(state.up),
      alive: state.alive,
      lastUpdate: performance.now()
    };

    remote.targetPosition = clone(state.position);
    remote.forward = clone(state.forward);
    remote.right = clone(state.right);
    remote.up = clone(state.up);
    remote.alive = state.alive;
    remote.lastUpdate = performance.now();

    world.remotePlayers.set(peerId, remote);
    eventBus.emit('network:playerUpdate', { peerId, state });
  };

  let lastBroadcast = 0;
  const broadcastInterval = 100;

  function update(now) {
    if (now - lastBroadcast > broadcastInterval && world.player && world.player.alive) {
      lastBroadcast = now;
      playerStateAction.send({
        position: world.player.position,
        forward: world.player.forward,
        right: world.player.right,
        up: world.player.up,
        alive: world.player.alive,
      });
    }
  }

  return { roomId, update, room };
}
