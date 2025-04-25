class NetworkManager {
  constructor(serverUrl) {
    this.socket = io(serverUrl);
    this.playerId = null;

    this.onGameCreated = null;
    this.onGameJoined = null;
    this.onBoardUpdated = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onGameOver = null;
    this.onError = null;
    this.onSyncTime = null;

    this.onLockStateUpdated = null; // 🟩 New for lock acquired
    this.onLockDenied = null;       // 🟥 New for lock denied

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('rpc_response', ({ type, payload }) => {
      const handlerMap = {
        gameCreated: this.onGameCreated,
        gameJoined: this.onGameJoined,
        boardUpdated: this.onBoardUpdated,
        playerJoined: this.onPlayerJoined,
        playerLeft: this.onPlayerLeft,
        gameOver: this.onGameOver,
        error: this.onError,
        syncTime: this.onSyncTime,
        lockStateUpdated: this.onLockStateUpdated, // 🟩
        lockDenied: this.onLockDenied              // 🟥
        
      };
      if (type === 'gameCreated') this.playerId = payload.playerId;
      if (type === 'gameJoined') this.playerId = payload.playerId;
      if (handlerMap[type]) handlerMap[type](payload);
    });
  }

  send(type, payload) {
    this.socket.emit('rpc_request', { type, payload });
  }

  createGame(playerName, boardSize = 10) {
    this.send('createGame', { playerName, boardSize });
  }

  joinGame(gameId, playerName) {
    this.send('joinGame', { gameId, playerName });
  }

  placeTile(gameId, x, y) {
    this.send('claimTile', { gameId, x, y, playerId: this.playerId });
  }

  endTurn(gameId, playerId) {
    this.send('endTurn', { gameId, playerId });
    console.log("[DEBUG] endTurn emitted", { gameId, playerId });
  }

  requestTimeSync() {
    this.send('syncTimeRequest', { clientTime: Date.now() }); // 🆕
  }

  requestLock(gameId, x, y) {
    this.send('requestLock', { gameId, x, y, playerId: this.playerId }); // 🆕 Lock request
  }

  releaseLock(gameId, x, y) {
    this.send('releaseLock', { gameId, x, y, playerId: this.playerId }); // 🆕 Lock release
  }

  disconnect() {
    this.socket.disconnect();
  }
}
