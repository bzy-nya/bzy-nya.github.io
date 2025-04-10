import { BaseAI } from './baseAI.js';

export class RandomAI extends BaseAI {
    constructor(playerId, game) {
        super(playerId, game);
        
        // Random AI is chaotic but still has some minimal strategy
        this.randomFactor = Math.random(); // Unique personality for each instance
    }
    
    calculateMove() {
        const ownedCells = this.getOwnedCells();
        if (ownedCells.length === 0) return null;
        
        // Filter cells with more than 1 unit
        const movableCells = ownedCells.filter(c => c.cell.units > 1);
        if (movableCells.length === 0) return null;
        
        // Randomly select a cell to move from, but slightly prefer cells with more units
        movableCells.sort(() => Math.random() - 0.5 + this.randomFactor);
        
        // Try a few random cells to find a good move (basic local search)
        for (let i = 0; i < Math.min(3, movableCells.length); i++) {
            const fromCell = movableCells[i];
            const adjacentCells = this.getAdjacentCells(fromCell.x, fromCell.y);
            
            if (adjacentCells.length > 0) {
                // Apply some minimal scoring to adjacent cells
                const scoredAdjCells = adjacentCells.map(cell => {
                    let score = Math.random() * 50; // Large random component
                    
                    // Small bonuses for various properties
                    if (cell.cell.owner !== this.playerId && cell.cell.owner >= 0) {
                        score += 20; // Small bonus for attacks
                        
                        if (fromCell.cell.units > cell.cell.units) {
                            score += 10; // Bonus for favorable matchups
                        } else {
                            score -= 15; // Penalty for unfavorable
                        }
                    } 
                    else if (cell.cell.owner === this.game.OWNER_EMPTY) {
                        score += 15; // Bonus for empty cells
                    }
                    
                    return { cell, score };
                });
                
                // Sort by score
                scoredAdjCells.sort((a, b) => b.score - a.score);
                const bestAdj = scoredAdjCells[0].cell;
                
                // 50% chance of splitting move (modified by random personality)
                const splitMove = Math.random() < 0.5 + (this.randomFactor - 0.5) * 0.2;
                
                return {
                    from: { x: fromCell.x, y: fromCell.y },
                    to: { x: bestAdj.x, y: bestAdj.y },
                    splitMove: splitMove && fromCell.cell.units > 10
                };
            }
        }
        
        // Completely random fallback
        const randomCell = movableCells[Math.floor(Math.random() * movableCells.length)];
        const adjacentCells = this.getAdjacentCells(randomCell.x, randomCell.y);
        
        if (adjacentCells.length > 0) {
            const randomAdjCell = adjacentCells[Math.floor(Math.random() * adjacentCells.length)];
            return {
                from: { x: randomCell.x, y: randomCell.y },
                to: { x: randomAdjCell.x, y: randomAdjCell.y },
                splitMove: Math.random() > 0.5
            };
        }
        
        return null;
    }
}
