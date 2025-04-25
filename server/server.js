// server/server.js (RPC compliant)
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 3000;
let games = {};

function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function getNextTurnPlayer(players, currentId) {
  const idx = players.findIndex(p => p.id === currentId);
  return players[(idx + 1) % players.length].id;
}

function sendRPC(socket, type, payload) {
  socket.emit('rpc_response', { type, payload });
}

function broadcastRPC(room, type, payload) {
  io.to(room).emit('rpc_response', { type, payload });
}

function detectCycleUtil(graph, node, visited, stack) {
  visited[node] = true;
  stack[node] = true;

  const neighbors = graph[node] || [];
  for (const neighbor of neighbors) {
    if (!visited[neighbor] && detectCycleUtil(graph, neighbor, visited, stack)) {
      return true;
    } else if (stack[neighbor]) {
      return true;
    }
  }

  stack[node] = false;
  return false;
}

function detectDeadlock(waitGraph, gameId) {
  const visited = {};
  const stack = {};
  for (const node in waitGraph) {
    if (!visited[node]) {
      if (detectCycleUtil(waitGraph, node, visited, stack)) {
        console.log('💥 DEADLOCK DETECTED in wait graph!');
        broadcastRPC(gameId, 'deadlockDetected', { message: '💥 Deadlock detected! Game Stopped.' });
        return true;
      }
    }
  }
  return false;
}


io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);

  socket.on('syncTime', () => {
    console.log('[SERVER] syncTime triggered');
    socket.emit('syncTime', { time: Date.now() });
  });

  socket.on('rpc_request', ({ type, payload }) => {
    switch (type) {
      case 'createGame': {
        const { playerName, boardSize = 10 } = payload;
        const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        const playerId = socket.id;
        const playerColor = '#32CD32';

        games[gameId] = {
          id: gameId,
          boardState: {
            size: boardSize,
            board: createEmptyBoard(boardSize),
            players: [{ id: playerId, name: playerName, color: playerColor, territory: 0 }],
            currentTurn: playerId,
          },
          locks: {},
          waitGraph: {}  // Add this to track locked tiles
        };
        
        socket.join(gameId);
        sendRPC(socket, 'gameCreated', { gameId, playerId, playerColor, boardState: games[gameId].boardState });
        break;
      }

      case 'syncTime': {
        sendRPC(socket, 'syncTime', { serverTime: Date.now() });
        break;
      }
      

      case 'joinGame': {
        const { gameId, playerName } = payload;
        const game = games[gameId];
        if (!game) return sendRPC(socket, 'error', { message: 'Game not found' });
        if (game.boardState.players.length >= 5) return sendRPC(socket, 'error', { message: 'Game is full' });

        const playerId = socket.id;
        const colorPool = ['#32CD32', '#0080FF', '#FF5733', '#F3FF33', '#FF33F3'];
        const usedColors = game.boardState.players.map(p => p.color);
        const availableColors = colorPool.filter(c => !usedColors.includes(c));
        const playerColor = availableColors[0] || '#000';

        game.boardState.players.push({ id: playerId, name: playerName, color: playerColor, territory: 0 });
        socket.join(gameId);

        sendRPC(socket, 'gameJoined', { gameId, playerId, playerColor, boardState: game.boardState });
        socket.to(gameId).emit('rpc_response', {
          type: 'playerJoined',
          payload: { playerId, playerName, playerColor }
        });

        break;
      }

      case 'claimTile': {
        const { gameId, x, y, playerId } = payload;
        const game = games[gameId];
        if (!game) return;

        const board = game.boardState.board;
        if (game.boardState.currentTurn !== playerId || board[y][x] !== null) return;

        const player = game.boardState.players.find(p => p.id === playerId);
        if (!player) return;

        board[y][x] = player.color;
        player.territory += 1;

        broadcastRPC(gameId, 'boardUpdated', {
          boardState: game.boardState,
          claimedTerritories: [{ x, y }]
        });

        const boardFull = board.every(row => row.every(cell => cell !== null));
        if (boardFull) {
          const scores = game.boardState.players
            .map(p => ({ id: p.id, name: p.name, color: p.color, territory: p.territory }))
            .sort((a, b) => b.territory - a.territory);
          broadcastRPC(gameId, 'gameOver', { scores });
        }

        break;
      }

      case 'nodeMessage': {
        const { from, to, message, timestamp } = payload;
        const localTime = new Date(timestamp).toLocaleTimeString();
      
        console.log(`[MESSAGE] From ${from} → ${to} | Msg: "${message}" | ⏰ Local Time: ${localTime}`);
        break;
      }

      case 'requestLock': {
        const { gameId, playerId, x, y } = payload;
        const key = `${x},${y}`;
        const game = games[gameId];
        if (!game) return;

        if (!game.locks[key]) {
          game.locks[key] = playerId;
          delete game.waitGraph[playerId];
          sendRPC(socket, 'lockStateUpdated', { locks: game.locks });
          console.log(`[LOCK GRANTED] ${playerId} locked (${key})`);
        } else if (game.locks[key] !== playerId) {
          const currentHolder = game.locks[key];
          game.waitGraph[playerId] = [...(game.waitGraph[playerId] || []), currentHolder];
          sendRPC(socket, 'lockDenied', { x, y });
          console.log(`[BLOCKED] ${playerId} waiting for (${key}) held by ${currentHolder}`);
          if (detectDeadlock(game.waitGraph, gameId)) {
            console.log('💥 DEADLOCK DETECTED in game:', gameId);
          }
          
        }

        break;
      }

      case 'releaseLock': {
        const { gameId, playerId, x, y } = payload;
        const key = `${x},${y}`;
        const game = games[gameId];
        if (!game) return;
        if (game.locks[key] === playerId) {
          delete game.locks[key];
          sendRPC(socket, 'lockStateUpdated', { locks: game.locks });
          console.log(`[LOCK RELEASED] ${playerId} released (${key})`);
        }
        break;
      }

      case 'requestCS': {
        const { gameId, playerId, timestamp } = payload;
        const game = games[gameId];
        if (!game) return;

        game.logicalClocks[playerId] = Math.max(game.logicalClocks[playerId], timestamp);
        game.requestQueue.push({ playerId, timestamp });
        game.requestQueue.sort((a, b) => a.timestamp - b.timestamp || a.playerId.localeCompare(b.playerId));

        for (const player of game.boardState.players) {
          if (player.id !== playerId) {
            const target = io.sockets.sockets.get(player.id);
            if (target) sendRPC(target, 'ackCS', { from: playerId, to: player.id, timestamp });
          }
        }
        break;
      }

      case 'releaseCS': {
        const { gameId, playerId } = payload;
        const game = games[gameId];
        if (!game) return;
        game.requestQueue = game.requestQueue.filter(r => r.playerId !== playerId);
        break;
      }
      
      

      case 'endTurn': {
        const { gameId, playerId } = payload;
        const game = games[gameId];
        if (!game || game.boardState.currentTurn !== playerId) return;

        game.boardState.currentTurn = getNextTurnPlayer(game.boardState.players, playerId);
        broadcastRPC(gameId, 'boardUpdated', { boardState: game.boardState });
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Disconnected: ${socket.id}`);
    for (const gameId in games) {
      const game = games[gameId];
      const index = game.boardState.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        game.boardState.players.splice(index, 1);
        broadcastRPC(gameId, 'playerLeft', { playerId: socket.id });

        if (game.boardState.players.length === 1) {
          const last = game.boardState.players[0];
          const scores = [{
            id: last.id,
            name: last.name,
            color: last.color,
            territory: last.territory
          }];
          broadcastRPC(gameId, 'gameOver', { scores });
          delete games[gameId];
        }
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
});
