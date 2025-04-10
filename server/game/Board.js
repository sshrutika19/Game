// server/game/Board.js
class Board {
    constructor(size) {
      this.size = size;
      this.tiles = Array(size).fill().map(() => Array(size).fill(null));
      this.territories = Array(size).fill().map(() => Array(size).fill(null));
    }
    
    isValidMove(x, y) {
      // Check if coordinates are within bounds
      if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
        return false;
      }
      
      // Check if tile is empty
      return this.tiles[y][x] === null;
    }
    
    placeTile(x, y, color) {
      this.tiles[y][x] = color;
    }
    
    claimTerritory(cells, color) {
      for (const [x, y] of cells) {
        this.territories[y][x] = color;
      }
    }
    
    isFull() {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          if (this.tiles[y][x] === null) {
            return false;
          }
        }
      }
      return true;
    }
  }
  
  module.exports = Board;