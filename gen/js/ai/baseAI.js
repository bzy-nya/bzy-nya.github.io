export class BaseAI {
    constructor(playerId, game) {
        this.playerId = playerId;
        this.game = game;
        this.isActive = true;
        this.visibilityMap = null;
        this.memory = {
            enemySightings: {}, // {x,y} -> {lastSeen, ownerLastSeen, unitsLastSeen}
            unexploredAreas: [], // Areas that should be explored
            generalGuesses: [], // Potential locations of enemy generals
            valueMap: {} // Value assessment of different regions
        };
    }
    
    getNextMove() {
        // Add safety checks to avoid TypeError
        if (!this.isActive) return null;
        if (!this.game || !this.game.players) return null;
        if (this.playerId === undefined || this.playerId < 0 || 
            this.playerId >= this.game.players.length) return null;
        if (!this.game.players[this.playerId] || !this.game.players[this.playerId].isAlive) {
            this.isActive = false;
            return null;
        }
        
        return this.calculateMove();
    }
    
    calculateMove() {
        // To be implemented by subclasses
        return null;
    }
    
    // Create a visibility map (true = visible, false = hidden)
    updateVisibility() {
        // Initialize visibility map
        this.visibilityMap = Array(this.game.height).fill().map(() => 
            Array(this.game.width).fill(false)
        );
        
        // Get owned cells
        const ownedCells = this.getOwnedCellsIgnoringFog();
        
        // Mark owned cells as visible
        for (const cell of ownedCells) {
            this.visibilityMap[cell.y][cell.x] = true;
            
            // Mark adjacent cells as visible
            const directions = [
                { dx: 0, dy: -1 },  // Up
                { dx: 1, dy: -1 },  // Top-right (diagonal)
                { dx: 1, dy: 0 },   // Right
                { dx: 1, dy: 1 },   // Bottom-right (diagonal)
                { dx: 0, dy: 1 },   // Down
                { dx: -1, dy: 1 },  // Bottom-left (diagonal)
                { dx: -1, dy: 0 },  // Left
                { dx: -1, dy: -1 }  // Top-left (diagonal)
            ];
            
            for (const dir of directions) {
                const newX = cell.x + dir.dx;
                const newY = cell.y + dir.dy;
                
                if (newX >= 0 && newX < this.game.width && 
                    newY >= 0 && newY < this.game.height) {
                    this.visibilityMap[newY][newX] = true;
                    
                    // Store information about observed enemy cells
                    const observedCell = this.game.grid[newY][newX];
                    if (observedCell.owner !== this.playerId && observedCell.owner >= 0) {
                        const key = `${newX},${newY}`;
                        this.memory.enemySightings[key] = {
                            lastSeen: this.game.tick,
                            ownerLastSeen: observedCell.owner,
                            unitsLastSeen: observedCell.units,
                            type: observedCell.type
                        };
                        
                        // If it's a general, note it
                        if (observedCell.type === 'general') {
                            this.memory.generalGuesses = this.memory.generalGuesses.filter(g => 
                                g.x !== newX || g.y !== newY);
                            this.memory.generalGuesses.push({
                                x: newX, y: newY, owner: observedCell.owner, confidence: 1.0
                            });
                        }
                    }
                }
            }
        }
        
        // Update unexplored areas - areas adjacent to visible but not visible themselves
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                if (!this.visibilityMap[y][x]) {
                    // Check if it's adjacent to any visible cell
                    let adjacentToVisible = false;
                    for (const dir of [{dx:0,dy:-1}, {dx:1,dy:0}, {dx:0,dy:1}, {dx:-1,dy:0}]) {
                        const nx = x + dir.dx;
                        const ny = y + dir.dy;
                        if (nx >= 0 && nx < this.game.width && 
                            ny >= 0 && ny < this.game.height &&
                            this.visibilityMap[ny][nx]) {
                            adjacentToVisible = true;
                            break;
                        }
                    }
                    
                    if (adjacentToVisible) {
                        // This is a frontier cell - adjacent to visible but not visible itself
                        const existingIndex = this.memory.unexploredAreas.findIndex(
                            a => a.x === x && a.y === y
                        );
                        
                        if (existingIndex === -1) {
                            this.memory.unexploredAreas.push({
                                x, y, 
                                value: this.evaluateExplorationValue(x, y)
                            });
                        }
                    }
                } else {
                    // Remove from unexplored if it's now visible
                    this.memory.unexploredAreas = this.memory.unexploredAreas.filter(
                        area => area.x !== x || area.y !== y
                    );
                }
            }
        }
        
        // Sort unexplored areas by value
        this.memory.unexploredAreas.sort((a, b) => b.value - a.value);
    }
    
    // Evaluate how valuable an unexplored area might be
    evaluateExplorationValue(x, y) {
        // Base value
        let value = 10;
        
        // Distance from our territory
        const ownedCells = this.getOwnedCellsIgnoringFog();
        if (ownedCells.length > 0) {
            // Find closest owned cell
            let minDistance = Infinity;
            for (const cell of ownedCells) {
                const dist = Math.abs(cell.x - x) + Math.abs(cell.y - y);
                minDistance = Math.min(minDistance, dist);
            }
            
            // Closer is better but not too close
            if (minDistance <= 3) {
                value += 15 - minDistance * 3; // Close areas are more valuable
            } else {
                value -= minDistance; // Far areas are less valuable
            }
        }
        
        // Factor in exploration time - value decays over time 
        const key = `${x},${y}`;
        const lastSeen = this.memory.enemySightings[key]?.lastSeen || 0;
        const timeSinceLastSeen = this.game.tick - lastSeen;
        value += Math.min(20, timeSinceLastSeen / 10); // More value the longer unseen (max +20)
        
        return value;
    }
    
    // Get owned cells without fog of war (internal use only)
    getOwnedCellsIgnoringFog() {
        const cells = [];
        
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                if (this.game.grid[y][x].owner === this.playerId) {
                    cells.push({ x, y, cell: this.game.grid[y][x] });
                }
            }
        }
        
        return cells;
    }
    
    // Get owned cells (respects fog of war)
    getOwnedCells() {
        // Update visibility first
        this.updateVisibility();
        return this.getOwnedCellsIgnoringFog(); // All owned cells are visible
    }
    
    // Get visible adjacent cells (respects fog of war)
    getAdjacentCells(x, y) {
        const directions = [
            { dx: 0, dy: -1 }, // Up
            { dx: 1, dy: 0 },  // Right
            { dx: 0, dy: 1 },  // Down
            { dx: -1, dy: 0 }  // Left
        ];
        
        const adjacentCells = [];
        
        for (const dir of directions) {
            const newX = x + dir.dx;
            const newY = y + dir.dy;
            
            if (newX >= 0 && newX < this.game.width && 
                newY >= 0 && newY < this.game.height) {
                // Only include if visible
                if (this.visibilityMap && this.visibilityMap[newY][newX]) {
                    const cell = this.game.grid[newY][newX];
                    if (cell.type !== 'mountain') {
                        adjacentCells.push({ x: newX, y: newY, cell: cell });
                    }
                }
            }
        }
        
        return adjacentCells;
    }
    
    // Find frontiers for exploration
    getFrontierCells() {
        if (!this.visibilityMap) this.updateVisibility();
        
        const frontiers = [];
        const ownedCells = this.getOwnedCells();
        
        for (const cell of ownedCells) {
            // Check for adjacent unexplored territories
            const directions = [
                { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, 
                { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
            ];
            
            for (const dir of directions) {
                const newX = cell.x + dir.dx;
                const newY = cell.y + dir.dy;
                
                // Check if this is a valid position adjacent to the fog
                if (newX >= 0 && newX < this.game.width && 
                    newY >= 0 && newY < this.game.height) {
                    
                    // Find cells that are adjacent to the unexplored territory
                    let hasUnexploredNeighbor = false;
                    for (const checkDir of directions) {
                        const checkX = newX + checkDir.dx;
                        const checkY = newY + checkDir.dy;
                        
                        if (checkX >= 0 && checkX < this.game.width && 
                            checkY >= 0 && checkY < this.game.height) {
                            // If this cell isn't visible, the original cell is a frontier
                            if (!this.visibilityMap[checkY][checkX]) {
                                hasUnexploredNeighbor = true;
                                break;
                            }
                        }
                    }
                    
                    if (hasUnexploredNeighbor) {
                        // Add to frontiers with exploration value
                        frontiers.push({
                            x: cell.x, 
                            y: cell.y,
                            cell: this.game.grid[cell.y][cell.x],
                            value: this.evaluateExplorationValue(newX, newY)
                        });
                    }
                }
            }
        }
        
        return frontiers;
    }
    
    // Helper method to check if a cell is neutral city
    isNeutralCity(cell) {
        return cell.owner === this.game.OWNER_NEUTRAL && cell.type === 'city';
    }
    
    // Helper method to check if a cell is empty
    isEmptyCell(cell) {
        return cell.owner === this.game.OWNER_EMPTY;
    }
}
