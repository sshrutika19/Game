// server/game/TerritoryCalculator.js
class TerritoryCalculator {
    constructor(board) {
      this.board = board;
    }
    
    calculateClaimedTerritories(lastMoveX, lastMoveY, playerColor) {
      const claimedCells = [];
      const size = this.board.size;
      
      // Get empty cells adjacent to the last move
      const adjacentEmptyCells = this.getAdjacentEmptyCells(lastMoveX, lastMoveY);
      
      for (const [x, y] of adjacentEmptyCells) {
        // Skip cells that we've already processed
        if (this.board.territories[y][x] !== null) continue;
        
        // Perform flood fill to find connected empty region
        const visited = new Set();
        const boundary = new Set();
        
        this.floodFill(x, y, visited, boundary);
        
        // Check if region is enclosed by the player's tiles
        if (this.isEnclosedByPlayer(boundary, playerColor)) {
          // Claim this territory
          const cells = Array.from(visited).map(pos => pos.split(',').map(Number));
          this.board.claimTerritory(cells, playerColor);
          claimedCells.push(...cells);
        }
      }
      
      return claimedCells;
    }
    
    getAdjacentEmptyCells(x, y) {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const emptyCells = [];
      
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (this.isValidCell(nx, ny) && this.board.tiles[ny][nx] === null) {
          emptyCells.push([nx, ny]);
        }
      }
      
      return emptyCells;
    }
    
    floodFill(x, y, visited, boundary) {
      const key = `${x},${y}`;
      
      // If we've already visited this cell, return
      if (visited.has(key)) return;
      
      // If this is a non-empty cell, add to boundary and return
      if (this.board.tiles[y][x] !== null) {
        boundary.add(key);
        return;
      }
      
      // Mark cell as visited
      visited.add(key);
      
      // Recursively check adjacent cells
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (this.isValidCell(nx, ny)) {
          this.floodFill(nx, ny, visited, boundary);
        } else {
          // If we hit the edge of the board, region is not enclosed
          return false;
        }
      }
      
      return true;
    }
    
    isEnclosedByPlayer(boundary, playerColor) {
      for (const pos of boundary) {
        const [x, y] = pos.split(',').map(Number);
        const cellColor = this.board.tiles[y][x];
        
        if (cellColor !== playerColor) {
          return false;
        }
      }
      
      return true;
    }
    
    isValidCell(x, y) {
      return x >= 0 && x < this.board.size && y >= 0 && y < this.board.size;
    }
  }
  
  module.exports = TerritoryCalculator;