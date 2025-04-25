// client/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  const playerNameInput = document.getElementById('player-name-input');
  const createGameBtn = document.getElementById('create-game-btn');
  const gameIdInput = document.getElementById('game-id-input');
  const joinGameBtn = document.getElementById('join-game-btn');
  const gameIdDisplay = document.getElementById('game-id-display');
  const lobbPanel = document.getElementById('lobby');
  const gameBoardPanel = document.getElementById('game-board');
  const playerNameDisplay = document.getElementById('player-name');
  const playerColorDisplay = document.getElementById('player-color');
  const currentTurnDisplay = document.getElementById('current-turn');
  const messageBox = document.getElementById('message-box');
  const rollBtn = document.getElementById('roll-dice-btn');
  const cube = document.querySelector('.cube');
  const cubeContainer = document.getElementById('dice-cube');
  const endTurnBtn = document.getElementById('end-turn-btn');

  window.movesLeft = 0;
  const networkManager = new NetworkManager('http://localhost:3000');
  networkManager.onSyncTime = ({ serverTime }) => {
    const clientNow = Date.now();
    const offsetMs = serverTime - clientNow;
    const offsetSeconds = (offsetMs / 1000).toFixed(3);
    const sign = offsetMs >= 0 ? '+' : '-';
  
    document.getElementById('server-time-indicator').textContent =
      `🕒 Clock Offset: ${sign}${Math.abs(offsetSeconds)}s`;
  };
  
  console.log('[SYNC REQUESTED]');
  networkManager.send('syncTime');
  
  
  let gameBoard = null;
  let diceTimeout;
  let moveTimeout;
  



  let gameState = {
    gameId: null,
    playerId: null,
    playerColor: null,
    players: []
  };

  createGameBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim() || 'Player';
    networkManager.createGame(playerName);
  });

  joinGameBtn.addEventListener('click', () => {
    const gameId = gameIdInput.value.trim().toUpperCase();
    const playerName = playerNameInput.value.trim();
  
    if (!gameId || !playerName) {
      showMessage('Please enter both Game ID and your Name');
      return;
    }
  
    networkManager.joinGame(gameId, playerName);
  });
  

  networkManager.onGameCreated = (data) => {
    gameState.gameId = data.gameId;
    gameState.playerId = data.playerId;
    gameState.playerColor = data.playerColor;

    gameState.players = [{
      id: data.playerId,
      name: playerNameInput.value.trim() || 'Player',
      color: data.playerColor,
      territory: 0
    }];

    gameIdDisplay.textContent = `Game ID: ${data.gameId}`;
    playerNameDisplay.textContent = playerNameInput.value.trim() || 'Player';

    const colorSample = document.createElement('span');
    colorSample.style.display = 'inline-block';
    colorSample.style.width = '20px';
    colorSample.style.height = '20px';
    colorSample.style.backgroundColor = data.playerColor;
    colorSample.style.marginLeft = '10px';
    playerColorDisplay.appendChild(colorSample);

    showMessage('Waiting for another player to join...', 'info');
    updateTurnInfo(data.playerId);
  };

  networkManager.onGameJoined = (data) => {
    gameState.gameId = data.gameId;
    gameState.playerId = data.playerId;
    gameState.playerColor = data.playerColor;
    gameState.players = data.boardState.players;

    playerNameDisplay.textContent = playerNameInput.value.trim() || 'Player';

    const colorSample = document.createElement('span');
    colorSample.style.display = 'inline-block';
    colorSample.style.width = '20px';
    colorSample.style.height = '20px';
    colorSample.style.backgroundColor = data.playerColor;
    colorSample.style.marginLeft = '10px';
    playerColorDisplay.appendChild(colorSample);

    lobbPanel.classList.add('hidden');
    gameBoardPanel.classList.remove('hidden');

    const boardCanvas = document.getElementById('board-canvas');
    gameBoard = new GameBoard(boardCanvas, data.boardState.size, networkManager, gameState.playerId);
    gameBoard.setGameId(data.gameId);
    gameBoard.updateBoard(data.boardState);

    updateScores(data.boardState.players);
    updateTurnInfo(data.boardState.currentTurn);
  };

  // 🌐 Simulate random inter-node messages (Distributed System)
/*setInterval(() => {
  const others = gameState.players.filter(p => p.id !== gameState.playerId);
  if (!others.length) return;

  const to = others[Math.floor(Math.random() * others.length)].id;
  const from = gameState.playerId;
  const timestamp = Date.now();

  const messages = [
    'rolled dice 🎲',
    'placed a tile 🧱',
    'ended their turn ✅',
    'claimed a territory 🌍',
    'is strategizing 🤔'
  ];
  const message = messages[Math.floor(Math.random() * messages.length)];

  networkManager.send('nodeMessage', { from, to, message, timestamp });
}, Math.random() * 6000 + 4000);*/



  networkManager.onPlayerJoined = (data) => {
    const exists = gameState.players.some(p => p.id === data.playerId);
  if (!exists) {
    gameState.players.push({
      id: data.playerId,
      name: data.playerName,
      color: data.playerColor,
      territory: 0
    });
  }

    updateScores(gameState.players);
    showMessage(`${data.playerName} joined the game`, 'info');

    lobbPanel.classList.add('hidden');
    gameBoardPanel.classList.remove('hidden');

    if (!gameBoard) {
      const boardCanvas = document.getElementById('board-canvas');
      gameBoard = new GameBoard(boardCanvas, 10, networkManager, gameState.playerId);
      gameBoard.setGameId(gameState.gameId);

      gameBoard.updateBoard({
        size: 10,
        board: gameBoard.tiles,
        players: gameState.players,
        currentTurn: gameState.players[0]?.id || null
      });
    }
  };

  networkManager.onBoardUpdated = (data) => {
    gameBoard.updateBoard(data.boardState);
    updateScores(data.boardState.players);
  
    const isMyTurn = data.boardState.currentTurn === gameState.playerId;
    const canMove = isMyTurn && window.movesLeft > 0;
    if (gameBoard?.setInteractive) gameBoard.setInteractive(canMove);
    updateTurnInfo(data.boardState.currentTurn);
  
    clearTimeout(diceTimeout);
    if (isMyTurn && window.movesLeft === 0) {
      diceTimeout = setTimeout(() => {
        showMessage("⏰ You didn’t roll dice in time. Turn passed.", "warning");
        if (gameBoard?.setInteractive) gameBoard.setInteractive(false);
        networkManager.endTurn(gameState.gameId, gameState.playerId, () => {});
      }, 10000);
    }
  
    if (data.claimedTerritories?.length) {
      gameBoard.highlightTerritory(data.claimedTerritories);
    }
  };
  
  
  
  

  networkManager.onPlayerLeft = (data) => {
    gameState.players = gameState.players.filter(p => p.id !== data.playerId);
    updateScores(gameState.players);
    showMessage('A player has left the game', 'warning');
  };

  networkManager.onGameOver = (data) => {
    const winner = data.scores[0];
    showVictory(`${winner.name} wins the game! 🏆 (${winner.territory} territories)`);
    gameBoard.setInteractive(false);
  };

  networkManager.onLockStateUpdated = ({ locks }) => {
    for (const key in locks) {
      if (locks[key] === gameState.playerId) {
        console.log(`[✅ LOCK GRANTED] ${gameState.playerId} holds ${key}`);
        const [x, y] = key.split(',').map(Number);
        networkManager.placeTile(gameState.gameId, x, y);
      }
    }
  };
  
  
  networkManager.onLockDenied = ({ x, y }) => {
    console.log(`[BLOCKED] Lock denied at (${x},${y}) for ${gameState.playerId} – Possible deadlock wait`);
  };

  networkManager.socket.on('rpc_response', ({ type, payload }) => {
    if (type === 'deadlockDetected') {
      alert(payload.message || '💥 Deadlock Detected! Game Over!');
      if (gameBoard) {
        gameBoard.setInteractive(false);
      }
      document.getElementById('moves-left').textContent = ' | Deadlock!';
    }
  });

  

  networkManager.onError = (error) => {
    showMessage(error.message, 'error');
  };
  

  rollBtn.addEventListener('click', () => {
    clearTimeout(diceTimeout);
    clearTimeout(moveTimeout); // ← ADD THIS
  
    const roll = Math.floor(Math.random() * 6) + 1;
    document.getElementById('dice-result').textContent = `You rolled a ${roll}`;
    window.movesLeft = roll;
    document.getElementById('moves-left').textContent = ` | Moves Left: ${window.movesLeft}`;
  
    if (gameBoard && gameState.playerId === gameBoard.currentTurn) {
      if (gameBoard?.setInteractive) gameBoard.setInteractive(true);
      gameBoard.render();
    }
  
    clearTimeout(moveTimeout);
    moveTimeout = setTimeout(() => {
      showMessage("⏰ You didn't make a move. Turn skipped.", 'warning');
      if (gameBoard?.setInteractive) gameBoard.setInteractive(false);
      networkManager.endTurn(gameState.gameId, gameState.playerId, () => {});
    }, 10000);
  });
  
  

  function updateScores(players) {
    const scoresList = document.getElementById('player-scores');
    scoresList.innerHTML = '';
    players.forEach(player => {
      const li = document.createElement('li');
      li.textContent = `${player.name}: ${player.territory}`;
      li.style.borderLeft = `4px solid ${player.color}`;
      scoresList.appendChild(li);
    });
  }
  
  
  function updateTurnInfo(currentTurnId) {
    const isMyTurn = currentTurnId === gameState.playerId;
    const currentPlayer = gameState.players.find(p => p.id === currentTurnId);

    if (currentPlayer) {
      currentTurnDisplay.textContent = isMyTurn ? 'Your turn!' : `${currentPlayer.name}'s turn`;
      currentTurnDisplay.style.color = currentPlayer.color;
      currentTurnDisplay.style.fontWeight = isMyTurn ? 'bold' : 'normal';
    }

    const dicePanel = document.getElementById('dice-panel');
    const rollBtn = document.getElementById('roll-dice-btn');
    const diceResult = document.getElementById('dice-result');
    const movesLeft = document.getElementById('moves-left');
    const endTurn = document.getElementById('end-turn-btn');

    if (isMyTurn) {
      dicePanel.classList.remove('hidden');
      rollBtn.classList.remove('hidden');
      rollBtn.disabled = false;
      diceResult.textContent = '';
      movesLeft.textContent = '';
      endTurn.classList.add('hidden');

      if (gameBoard) {
        if (gameBoard?.setInteractive) gameBoard.setInteractive(true);
        gameBoard.render();
      }
    } else {
      dicePanel.classList.add('hidden');
      rollBtn.classList.add('hidden');
      endTurn.classList.add('hidden');
    }
  }


  function showMessage(message, type = 'error') {
    messageBox.textContent = message;
    messageBox.classList.remove('hidden');
    messageBox.style.backgroundColor = type === 'error' ? '#f8d7da' :
                                       type === 'success' ? '#d4edda' :
                                       type === 'warning' ? '#fff3cd' : '#d1ecf1';
    messageBox.style.color = type === 'error' ? '#721c24' :
                             type === 'success' ? '#155724' :
                             type === 'warning' ? '#856404' : '#0c5460';
    if (type !== 'error') {
      setTimeout(() => {
        messageBox.classList.add('hidden');
      }, 5000);
    }
  }

  function showVictory(text) {
    messageBox.textContent = text;
    messageBox.classList.remove('hidden');
    messageBox.style.backgroundColor = '#d4edda';
    messageBox.style.color = '#155724';
    messageBox.style.fontSize = '20px';
    messageBox.style.fontWeight = 'bold';
    messageBox.style.textAlign = 'center';
    startConfetti();
    document.getElementById('play-again-container').classList.remove('hidden');
  }

  function startConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.classList.remove('hidden');
    const w = canvas.width = window.innerWidth;
    const h = canvas.height = window.innerHeight;

    let particles = Array.from({ length: 150 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 4 + 1,
      d: Math.random() * 30 + 10,
      color: `hsl(${Math.random()*360},100%,50%)`,
      tilt: Math.random() * 10 - 10
    }));

    function draw() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.r, p.r);
      });
      update();
      requestAnimationFrame(draw);
    }

    function update() {
      particles.forEach(p => {
        p.y += Math.cos(p.d) + 1 + p.r / 2;
        p.x += Math.sin(p.d);
        if (p.y > h) {
          p.x = Math.random() * w;
          p.y = -10;
        }
      });
    }

    draw();
    setTimeout(() => {
      canvas.classList.add('hidden');
    }, 7000);
  }
});