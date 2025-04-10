import { GameMap } from './map.js';

export class Game {
    constructor(mapSettings) {
        this.width = mapSettings.width;
        this.height = mapSettings.height;
        this.playerCount = mapSettings.playerCount;
        this.mountainDensity = mapSettings.mountainDensity;
        this.cityDensity = mapSettings.cityDensity;
        this.tick = 0;
        
        // Define constants for special owner types
        this.OWNER_EMPTY = -1;
        this.OWNER_NEUTRAL = -2;
        
        // Create map using the GameMap class with MapSettings
        const mapGenerator = new GameMap(mapSettings);
        const { grid, generalPositions } = mapGenerator.createGrid();
        
        // Initialize grid
        this.grid = grid;
        
        // Initialize players
        this.players = this.createPlayers(generalPositions);
        
        // Game status
        this.gameOver = false;
    }
    
    createPlayers(generalPositions) {
        const players = [];
        const colors = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00', 
            '#FF00FF', '#00FFFF', '#FF8000', '#8000FF'
        ];
        
        for (let i = 0; i < this.playerCount; i++) {
            players.push({
                id: i,
                aiName: null, // Will be set by UI
                color: colors[i % colors.length],
                isAlive: true,
                unitCount: 1,
                territoryCount: 1,
                generalPosition: generalPositions[i]
            });
        }
        
        return players;
    }
    
    update() {
        this.tick++;
        
        // Add units every tick to generals and owned cities (1 unit per second = every 2 ticks)
        if (this.tick % 2 === 0) {
            // Add units to generals and cities
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const cell = this.grid[y][x];
                    
                    // Add units to generals and player-owned cities
                    if (cell.owner >= 0 && (cell.type === 'general' || cell.type === 'city')) {
                        cell.units++;
                        this.players[cell.owner].unitCount++;
                    }
                }
            }
        }
        
        // Add units every 25 ticks to regular tiles (keep existing behavior)
        if (this.tick % 50 === 0) {
            // Add units to owned territories (not cities or generals)
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const cell = this.grid[y][x];
                    if (cell.owner >= 0 && cell.type === 'empty') {
                        cell.units++;
                        this.players[cell.owner].unitCount++;
                    }
                }
            }
        }
        
        // Check for eliminated players
        for (let i = 0; i < this.playerCount; i++) {
            if (this.players[i].isAlive) {
                const { x, y } = this.players[i].generalPosition;
                if (this.grid[y][x].owner !== i) {
                    this.players[i].isAlive = false;
                }
            }
        }
        
        // Check if game is over (only one player remaining)
        const activePlayers = this.players.filter(p => p.isAlive);
        if (activePlayers.length <= 1 && this.playerCount > 1) {
            this.gameOver = true;
        }
        
        // Update player territory counts
        this.updatePlayerStats();
    }
    
    updatePlayerStats() {
        // Reset counts
        this.players.forEach(player => {
            player.unitCount = 0;
            player.territoryCount = 0;
        });
        
        // Count units and territories
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (cell.owner >= 0) {
                    this.players[cell.owner].unitCount += cell.units;
                    this.players[cell.owner].territoryCount++;
                }
            }
        }
    }
    
    makeMove(playerId, from, to, splitMove = false) {
        // Validate move
        if (!this.isValidMove(playerId, from, to)) {
            return false;
        }
        
        const fromCell = this.grid[from.y][from.x];
        const toCell = this.grid[to.y][to.x];
        
        // Calculate units to move
        let unitsToMove = fromCell.units - 1;
        if (splitMove) {
            unitsToMove = Math.floor(fromCell.units / 2);
        }
        
        if (unitsToMove <= 0) return false;
        
        // Deduct units from source
        fromCell.units -= unitsToMove;
        
        // If target is owned by another player or neutral, battle occurs
        if ((toCell.owner !== playerId && toCell.owner >= 0) || toCell.owner === this.OWNER_NEUTRAL) {
            if (unitsToMove > toCell.units) {
                // Attacker wins
                const remainingUnits = unitsToMove - toCell.units;
                
                // Store the previous owner for general capture check
                const previousOwner = toCell.owner;
                toCell.owner = playerId;
                toCell.units = remainingUnits;
                
                // Check if a general was captured
                if (toCell.type === 'general' && previousOwner >= 0) {
                    // Mark as eliminated
                    this.players[previousOwner].isAlive = false;
                    
                    // Convert the captured general tile to a city tile
                    toCell.type = 'city';
                    
                    // Transfer all territories to the conqueror with half units
                    this.transferTerritories(previousOwner, playerId);
                }
            } else {
                // Defender wins or draw
                toCell.units -= unitsToMove;
            }
        } else if (toCell.owner === this.OWNER_EMPTY) {
            // Empty cell
            toCell.owner = playerId;
            toCell.units = unitsToMove;
        } else {
            // Own territory, just add units
            toCell.units += unitsToMove;
        }
        
        return true;
    }
    
    transferTerritories(fromPlayerId, toPlayerId) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (cell.owner === fromPlayerId) {
                    // Transfer ownership
                    cell.owner = toPlayerId;
                    
                    // Halve units and floor the result
                    cell.units = Math.floor(cell.units / 2);
                    
                    // Ensure minimum 1 unit
                    if (cell.units < 1) {
                        cell.units = 1;
                    }
                }
            }
        }
    }
    
    isValidMove(playerId, from, to) {
        // Check if positions are within bounds
        if (from.x < 0 || from.x >= this.width || from.y < 0 || from.y >= this.height ||
            to.x < 0 || to.x >= this.width || to.y < 0 || to.y >= this.height) {
            return false;
        }
        
        // Check if source cell belongs to player and has enough units
        const fromCell = this.grid[from.y][from.x];
        if (fromCell.owner !== playerId || fromCell.units <= 1) {
            return false;
        }
        
        // Check if target is adjacent
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        if (!((dx === 1 && dy === 0) || (dx === 0 && dy === 1))) {
            return false;
        }
        
        // Check if target is not a mountain
        const toCell = this.grid[to.y][to.x];
        if (toCell.type === 'mountain') {
            return false;
        }
        
        return true;
    }
    
    isGameOver() {
        return this.gameOver;
    }

    // Example modification to getCellColor in the renderer if needed
    getCellColor(cell) {
        // Make mountains use the standard empty cell color instead of a special color
        // since we'll be using SVG icons for mountains now
        
        if (cell.owner >= 0) {
            // Get player color without applying additional transparency
            return this.getPlayerColor(cell.owner);
        }
        
        if (cell.owner === this.game.OWNER_NEUTRAL) { 
            return "#777"; // Gray color for neutral cities
        }
        
        return "#222"; // Empty cell and mountain background
    }
}
