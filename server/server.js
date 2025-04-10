// server/server.js (patched)

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

io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);

  socket.on('createGame', ({ playerName }) => {
    const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const playerId = socket.id;
    const playerColor = '#32CD32';

    games[gameId] = {
      id: gameId,
      boardState: {
        size: 10,
        board: createEmptyBoard(10),
        players: [{ id: playerId, name: playerName, color: playerColor, territory: 0 }],
        currentTurn: playerId
      }
    };

    socket.join(gameId);
    socket.emit('gameCreated', { gameId, playerId, playerColor, boardState: games[gameId].boardState });
    console.log(`[${new Date().toISOString()}] Game created: ${gameId} by player ${playerId}`);
  });

  socket.on('joinGame', ({ gameId, playerName }) => {
    const game = games[gameId];
    if (!game) return socket.emit('error', { message: 'Game not found' });
    if (game.boardState.players.length >= 5) return socket.emit('error', { message: 'Game is full' });

    const playerId = socket.id;
    const colorPool = ['#32CD32', '#0080FF', '#FF5733', '#F3FF33', '#FF33F3'];
    const usedColors = game.boardState.players.map(p => p.color);
    const availableColors = colorPool.filter(c => !usedColors.includes(c));
    const playerColor = availableColors[0] || '#000';

    game.boardState.players.push({ id: playerId, name: playerName, color: playerColor, territory: 0 });
    socket.join(gameId);

    socket.emit('gameJoined', {
      gameId,
      playerId,
      playerColor,
      boardState: game.boardState
    });

    socket.to(gameId).emit('playerJoined', { playerId, playerName, playerColor });
    console.log(`[${new Date().toISOString()}] Player ${playerId} joined game ${gameId}`);
  });

  socket.on('claimTile', ({ gameId, x, y, playerId }) => {
    const game = games[gameId];
    if (!game) return;

    const board = game.boardState.board;
    if (game.boardState.currentTurn !== playerId) return;
    if (board[y][x] !== null) return;

    const player = game.boardState.players.find(p => p.id === playerId);
    if (!player) return;

    console.log(`[CLAIM] Player ${playerId} claimed (${x}, ${y})`);
    console.log(`[CLAIM] CurrentTurn before update: ${game.boardState.currentTurn}`);

    board[y][x] = player.color;
    player.territory++;

    io.in(gameId).emit('boardUpdated', {
      boardState: game.boardState,
      claimedTerritories: [{ x, y }]
    });

    const boardFull = board.every(row => row.every(cell => cell !== null));
    if (boardFull) {
      const scores = game.boardState.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        territory: p.territory
      })).sort((a, b) => b.territory - a.territory);

      io.in(gameId).emit('gameOver', { scores });
      console.log(`Game ${gameId} ended. Final scores:`, scores);
    }
  });

  socket.on('endTurn', ({ gameId, playerId }) => {
    const game = games[gameId];
    if (!game) return;
    if (game.boardState.currentTurn !== playerId) return;

    console.log(`[SERVER] endTurn from ${playerId} for game ${gameId}`);
    console.log(`[TURN] CurrentTurn before rotate: ${game.boardState.currentTurn}`);

    game.boardState.currentTurn = getNextTurnPlayer(game.boardState.players, playerId);
    console.log(`[TURN] Next turn set to: ${game.boardState.currentTurn}`);

    io.in(gameId).emit('boardUpdated', {
      boardState: game.boardState
    });
  });

  socket.on('disconnect', () => {
    console.log(`[${new Date().toISOString()}] Disconnected: ${socket.id}`);
    for (const gameId in games) {
      const game = games[gameId];
      const index = game.boardState.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        game.boardState.players.splice(index, 1);
        io.in(gameId).emit('playerLeft', { playerId: socket.id });

        if (game.boardState.players.length === 1) {
          const last = game.boardState.players[0];
          const scores = [{
            id: last.id,
            name: last.name,
            color: last.color,
            territory: last.territory
          }];
          io.in(gameId).emit('gameOver', { scores });
          console.log(`Game ${gameId} ended — ${last.name} wins by survival`);
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
