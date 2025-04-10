class Player {
  constructor(id, name, color) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.territory = 0;
  }

  addTerritories(territories) {
    this.territory += territories.length;
  }
}

module.exports = Player;