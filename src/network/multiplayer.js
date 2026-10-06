// src/network/multiplayer.js
import { joinRoom } from 'https://esm.sh/trystero/torrent';
import { clone } from '../math/vector.js';

const APP_ID = 'fjodortatarsky-enbodyment-v1'; // Уникальный ID твоего приложения

export function createMultiplayer(world, eventBus) {
  // Берем ID комнаты из URL (например, ?room=abc123) или генерируем стандартный
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room') || 'default-room';
  
  const room = joinRoom({ appId: APP_ID }, roomId);

  // Создаем действия (actions) для обмена данными
  const [sendPlayerState, onPlayerState] = room.makeAction('playerState');
  const [sendGameEvent, onGameEvent] = room.makeAction('gameEvent');

  // Подписка на состояние других игроков
  onPlayerState((state, peerId) => {
    // Обновляем или создаем "теневого" игрока в мире
    if (!world.remotePlayers) {
      world.remotePlayers = new Map();
    }
    
    const remote = world.remotePlayers.get(peerId) || { 
      id: peerId, 
      position: clone(state.position), 
      targetPosition: clone(state.position),
      orientation: state.orientation,
      alive: state.alive,
      lastUpdate: performance.now()
    };

    remote.targetPosition = clone(state.position);
    remote.orientation = state.orientation;
    remote.alive = state.alive;
    remote.lastUpdate = performance.now();

    world.remotePlayers.set(peerId, remote);
    eventBus.emit('network:playerUpdate', { peerId, state });
  });

  // Подписка на игровые события от других пиров
  onGameEvent((eventData, peerId) => {
    eventBus.emit(`network:${eventData.type}`, { peerId, ...eventData.payload });
  });

  // Отслеживание отключения игроков
  room.onPeerLeave((peerId) => {
    if (world.remotePlayers) {
      world.remotePlayers.delete(peerId);
    }
    eventBus.emit('network:playerLeft', { peerId });
  });

  // Функция для отправки состояния (ее нужно вызывать с троттлингом, не каждый кадр!)
  function broadcastPlayerState(player) {
    sendPlayerState({
      position: player.position,
      orientation: player.orientation,
      velocity: player.velocity,
      alive: player.alive,
    });
  }

  return {
    roomId,
    broadcastPlayerState,
    sendGameEvent,
  };
}
