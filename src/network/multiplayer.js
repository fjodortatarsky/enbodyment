// src/network/multiplayer.js
import { joinRoom } from 'https://esm.sh/@trystero-p2p/torrent';
import { clone } from '../math/vector.js';

const APP_ID = 'fjodortatarsky-enbodyment-mp-v1';

export function createMultiplayer(world, eventBus) {
  const urlParams = new URLSearchParams(window.location.search);
  // Если комнаты нет в URL, генерируем случайную
  const roomId = urlParams.get('room') || `room-${Math.random().toString(36).substring(2, 8)}`;
  
  // Обновляем URL без перезагрузки страницы, чтобы можно было скопировать ссылку
  if (!urlParams.has('room')) {
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('room', roomId);
    window.history.replaceState({}, '', newUrl);
  }

  // Теперь joinRoom импортируется напрямую из пакета torrent
  const room = joinRoom({ appId: APP_ID }, roomId);

  const [sendPlayerState, onPlayerState] = room.makeAction('playerState');

  onPlayerState((state, peerId) => {
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
  });

  room.onPeerLeave((peerId) => {
    if (world.remotePlayers) {
      world.remotePlayers.delete(peerId);
    }
    eventBus.emit('network:playerLeft', { peerId });
  });

  let lastBroadcast = 0;
  const broadcastInterval = 100; // Отправляем состояние 10 раз в секунду

  function update(now) {
    if (now - lastBroadcast > broadcastInterval && world.player && world.player.alive) {
      lastBroadcast = now;
      sendPlayerState({
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
