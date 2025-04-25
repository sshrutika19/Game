// client/js/GameBoard.js
if (typeof window.movesLeft === 'undefined') {
  window.movesLeft = 0;
}


// client/js/GameBoard.js
class GameBoard {
  constructor(canvas, size, networkManager, playerId) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = size;
    this.networkManager = networkManager;
    this.playerId = playerId;
    this.gameId = null;
    this.tileSize = 40;
    this.interactive = false;

    this.canvas.width = size * this.tileSize;
    this.canvas.height = size * this.tileSize;

    this.tiles = Array(size).fill().map(() => Array(size).fill(null));
    this.territories = Array(size).fill().map(() => Array(size).fill(null));
    this.players = [];
    this.currentTurn = null;

    this.animating = false;
    this.highlightedCells = [];
    this.highlightAlpha = 1;
    this.highlightTimer = null;

    this.canvas.addEventListener('click', this.handleClick.bind(this));
    this.render();
  }

  setGameId(gameId) {
    this.gameId = gameId;
  }

  updateBoard(boardState) {
    this.size = boardState.size;
    this.tiles = boardState.board || boardState.tiles;
    this.territories = boardState.territories || Array(this.size).fill().map(() => Array(this.size).fill(null));
    this.players = boardState.players;
    this.currentTurn = boardState.currentTurn;
    this.interactive = (this.currentTurn === this.playerId && window.movesLeft > 0);
    this.render();
  }

  handleClick(event) {
    if (
      !this.interactive ||
      !this.gameId ||
      this.currentTurn !== this.playerId ||
      !window.movesLeft ||
      window.movesLeft <= 0
    ) {
      console.log("Move blocked. Not your turn or no moves left.");
      return;
    }
  
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / this.tileSize);
    const y = Math.floor((event.clientY - rect.top) / this.tileSize);
  
    if (x >= 0 && x < this.size && y >= 0 && y < this.size && this.tiles[y][x] === null) {
      console.log(`[CLICK] Requesting lock for (${x},${y})`);

      this.networkManager.placeTile(this.gameId, x, y);
      window.movesLeft -= 1;
      const moveText = ` | Moves Left: ${window.movesLeft}`;
      const movesLeftDisplay = document.getElementById('moves-left');
      if (movesLeftDisplay) movesLeftDisplay.textContent = moveText;
  
      if (window.movesLeft <= 0) {
        this.interactive = false;
        this.networkManager.endTurn(this.gameId, this.playerId);
        console.log("[DEBUG] Sending endTurn to server");

      }
      
  
      this.render(); // important: force visual update
    }
  }
  

  highlightTerritory(cells) {
    if (!Array.isArray(cells)) return;
    this.highlightedCells = cells;
    this.highlightAlpha = 1;
    this.animating = true;
    this.animateHighlight();
  }
  

  animateHighlight() {
    this.highlightAlpha -= 0.02;
    this.render();

    if (this.highlightAlpha > 0) {
      this.highlightTimer = setTimeout(() => {
        requestAnimationFrame(this.animateHighlight.bind(this));
      }, 20);
    } else {
      this.animating = false;
      this.highlightedCells = [];
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = '#ddd';
    this.ctx.lineWidth = 1;

    for (let i = 0; i <= this.size; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * this.tileSize, 0);
      this.ctx.lineTo(i * this.tileSize, this.size * this.tileSize);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(0, i * this.tileSize);
      this.ctx.lineTo(this.size * this.tileSize, i * this.tileSize);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const territoryColor = this.territories[y][x];
        if (territoryColor) {
          this.ctx.fillStyle = this.lightenColor(territoryColor, 30);
          this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        }
      }
    }

    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const tileColor = this.tiles[y][x];
        if (tileColor) {
          this.ctx.fillStyle = tileColor;
          this.ctx.beginPath();
          this.ctx.arc(
            x * this.tileSize + this.tileSize / 2,
            y * this.tileSize + this.tileSize / 2,
            this.tileSize / 2 - 2,
            0,
            Math.PI * 2
          );
          this.ctx.fill();
        }
      }
    }

    if (this.animating && Array.isArray(this.highlightedCells) && this.highlightedCells.length > 0) {
      this.ctx.fillStyle = `rgba(255, 255, 0, ${this.highlightAlpha})`;
      for (const cell of this.highlightedCells) {
        if (!Array.isArray(cell) || cell.length !== 2) continue;
        const [x, y] = cell;
        this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
      }
    }
    
  }

  lightenColor(color, percent) {
    let r, g, b;
    if (color.startsWith('#')) {
      r = parseInt(color.substring(1, 3), 16);
      g = parseInt(color.substring(3, 5), 16);
      b = parseInt(color.substring(5, 7), 16);
    } else if (color.startsWith('rgb')) {
      const matches = color.match(/\d+/g);
      r = parseInt(matches[0]);
      g = parseInt(matches[1]);
      b = parseInt(matches[2]);
    } else {
      return color;
    }

    r = Math.min(255, r + Math.floor((percent / 100) * (255 - r)));
    g = Math.min(255, g + Math.floor((percent / 100) * (255 - g)));
    b = Math.min(255, b + Math.floor((percent / 100) * (255 - b)));

    return `rgb(${r}, ${g}, ${b})`;
  }
}
