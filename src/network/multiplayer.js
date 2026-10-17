// src/network/multiplayer.js
import { joinRoom } from 'https://esm.sh/@trystero-p2p/torrent';
import { clone } from '../math/vector.js';

const APP_ID = 'fjodortatarsky-enbodyment-mp-v1';

export function createMultiplayer(world, eventBus) {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room') || `room-${Math.random().toString(36).substring(2, 8)}`;
  
  if (!urlParams.has('room')) {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('room', roomId);
    window.history.replaceState({}, '', newUrl);
  }

  const room = joinRoom({ appId: APP_ID }, roomId);

  const playerStateAction = room.makeAction('playerState');

  playerStateAction.onMessage = (state, { peerId }) => {
    // ЗАЩИТА: игнорируем некорректные пакеты, чтобы не сломать рендер и интерполяцию
    if (!state || !state.position || !state.forward) {
      console.warn('Получено некорректное состояние от', peerId, state);
      return;
    }

    if (!world.remotePlayers) {
      world.remotePlayers = new Map();
    }
    
    const remote = world.remotePlayers.get(peerId) || { 
      id: peerId, 
      position: clone(state.position), 
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

  room.onPeerLeave = (peerId) => {
    if (world.remotePlayers) {
      world.remotePlayers.delete(peerId);
    }
    eventBus.emit('network:playerLeft', { peerId });
  };

  let lastBroadcast = 0;
  const broadcastInterval = 100;

  function update(now) {
    // ОЧИСТКА: удаляем игроков, от которых не было обновлений дольше 5 секунд
    // Это предотвращает "мерцание" и зависание кораблей при обрыве соединения
    if (world.remotePlayers) {
      for (const [peerId, remote] of world.remotePlayers.entries()) {
        if (now - remote.lastUpdate > 5000) {
          world.remotePlayers.delete(peerId);
        }
      }
    }

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

  return {
    roomId,
    update,
  };
}
