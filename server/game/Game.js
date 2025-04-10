const Board = require('./Board');
const Player = require('./Player');
const TerritoryCalculator = require('./TerritoryCalculator');

class Game {
  constructor(id, boardSize = 10) {
    this.id = id;
    this.board = new Board(boardSize);
    this.players = new Map();
    this.currentTurn = null;
    this.gameStarted = false;
    this.territoryCalculator = new TerritoryCalculator(this.board);
  }

  addPlayer(id, name, color) {
    const player = new Player(id, name, color);
    this.players.set(id, player);
    
    // Set first player as current turn
    if (this.players.size === 1) {
      this.currentTurn = id;
    }
    
    // Start game when at least 2 players join
    if (this.players.size >= 2 && !this.gameStarted) {
      this.gameStarted = true;
    }
    
    return player;
  }

  removePlayer(id) {
    if (!this.players.has(id)) return;

    this.players.delete(id);
    
    // Handle turn rotation if leaving player was current
    if (this.currentTurn === id) {
      this.advanceTurn();
    }
    
    // Pause game if less than 2 players remain
    if (this.players.size < 2) {
      this.gameStarted = false;
    }
  }

  hasPlayer(id) {
    return this.players.has(id);
  }

  placeTile(playerId, x, y) {
    // Validate turn ownership
    if (playerId !== this.currentTurn) {
      return { success: false, message: "Not your turn" };
    }
    
    // Validate game state
    if (!this.gameStarted) {
      return { success: false, message: "Game not started" };
    }
    
    // Validate move position
    if (!this.board.isValidMove(x, y)) {
      return { success: false, message: "Invalid move position" };
    }

    const player = this.players.get(playerId);
    
    // Place tile on board
    this.board.placeTile(x, y, player.color);
    
    // Calculate and assign territories
    const claimedTerritories = this.territoryCalculator.calculateClaimedTerritories(x, y, player.color);
    player.addTerritories(claimedTerritories);
    
    // Rotate turn to next player
    this.advanceTurn();

    return {
      success: true,
      claimedTerritories,
      newTurn: this.currentTurn
    };
  }

  advanceTurn() {
    const activePlayers = Array.from(this.players.keys());
    if (activePlayers.length === 0) return;

    const currentIndex = activePlayers.indexOf(this.currentTurn);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    this.currentTurn = activePlayers[nextIndex];
  }

  getBoardState() {
    return {
      size: this.board.size,
      tiles: this.board.tiles,
      territories: this.board.territories,
      currentTurn: this.currentTurn,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        territory: p.territory
      }))
    };
  }

  isGameOver() {
    return this.board.isFull();
  }

  calculateScores() {
    return Array.from(this.players.values())
      .map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        territory: p.territory
      }))
      .sort((a, b) => b.territory - a.territory);
  }
}

module.exports = Game;