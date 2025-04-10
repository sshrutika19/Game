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

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('gameCreated', (data) => {
      this.playerId = data.playerId;
      if (this.onGameCreated) this.onGameCreated(data);
    });

    this.socket.on('gameJoined', (data) => {
      this.playerId = data.playerId;
      if (this.onGameJoined) this.onGameJoined(data);
    });

    this.socket.on('boardUpdated', (data) => {
      if (this.onBoardUpdated) this.onBoardUpdated(data);
    });

    this.socket.on('playerJoined', (data) => {
      if (this.onPlayerJoined) this.onPlayerJoined(data);
    });

    this.socket.on('playerLeft', (data) => {
      if (this.onPlayerLeft) this.onPlayerLeft(data);
    });

    this.socket.on('gameOver', (data) => {
      if (this.onGameOver) this.onGameOver(data);
    });

    this.socket.on('error', (data) => {
      console.error("Server error:", data);
      if (this.onError) this.onError(data);
    });
  }

  createGame(playerName, boardSize = 10) {
    this.socket.emit('createGame', {
      playerName,
      boardSize
    });
  }

  joinGame(gameId, playerName) {
    this.socket.emit('joinGame', {
      gameId,
      playerName
    });
  }

  placeTile(gameId, x, y) {
    this.socket.emit('claimTile', {
      gameId,
      x,
      y,
      playerId: this.playerId
    });
  }
  endTurn(gameId, playerId) {
    this.socket.emit('endTurn', { gameId, playerId });
    console.log("[DEBUG] endTurn emitted", { gameId, playerId });
  }
  

  disconnect() {
    this.socket.disconnect();
  }
}
