import { BaseAI } from './baseAI.js';

export class ExpansionAI extends BaseAI {
    constructor(playerId, game) {
        super(playerId, game);
        
        // Parameters for decision making
        this.temperature = 0.6; // Medium temperature - balance between exploration and exploitation
        this.currentPath = null; // Current planned path to follow
        this.targetType = null; // Current target type ('expand', 'capture', 'consolidate')
        this.pathIndex = 0; // Current position in the path
        this.lastPathUpdate = 0; // Game tick when path was last updated
        
        // Strategy weights - expansion AI prioritizes growth
        this.weights = {
            expand: 1.5,     // High preference for expansion into empty territory
            capture: 1.2,    // High preference for capturing neutral cities
            consolidate: 0.5 // Lower preference for internal consolidation
        }
    }
    
    calculateMove() {
        // Update visibility map to get current state
        this.updateVisibility();
        
        // Check if the AI player is eliminated
        if (!this.game.players[this.playerId].isAlive) {
            this.isActive = false;
            return null;
        }
        
        // Get all owned cells that can move (have more than 1 unit)
        const ownedCells = this.getOwnedCells().filter(cell => cell.cell.units > 1);
        if (ownedCells.length === 0) return null;
        
        // Follow existing path if we have one and it's not too old
        if (this.currentPath && this.currentPath.length > 0 && 
            this.pathIndex < this.currentPath.length - 1 &&
            this.game.tick - this.lastPathUpdate < 25) { // Longer path expiry for expansion (more commitment)
            
            return this.followPath(ownedCells);
        }
        
        // No path or expired path - select a new objective and plan path
        return this.selectObjectiveAndPlan(ownedCells);
    }
    
    followPath(ownedCells) {
        // Get current and next positions in path
        const current = this.currentPath[this.pathIndex];
        const next = this.currentPath[this.pathIndex + 1];
        
        // Find the cell at current position
        const sourceCell = ownedCells.find(c => c.x === current.x && c.y === current.y);
        if (!sourceCell || sourceCell.cell.units <= 1) {
            // Invalid path state, need to replan
            this.currentPath = null;
            return this.selectObjectiveAndPlan(ownedCells);
        }
        
        // Verify the move is valid
        const adjacentCells = this.getAdjacentCells(current.x, current.y);
        const targetCell = adjacentCells.find(c => c.x === next.x && c.y === next.y);
        
        if (!targetCell) {
            // Target is not accessible, need to replan
            this.currentPath = null;
            return this.selectObjectiveAndPlan(ownedCells);
        }
        
        // Execute the move
        this.pathIndex++;
        
        // Choose whether to split move based on strategy
        // Expansion AI splits forces when expanding to claim more territory quickly
        const splitMove = this.targetType === 'expand' && 
                        sourceCell.cell.units > 6 && // Only split if we have enough units
                        targetCell.cell.owner === this.game.OWNER_EMPTY; // Only split when moving to empty cells
        
        return {
            from: { x: current.x, y: current.y },
            to: { x: next.x, y: next.y },
            splitMove: splitMove
        };
    }
    
    selectObjectiveAndPlan(ownedCells) {
        // Step 1: Use softmax to select a source cell
        const sourceCell = this.selectSourceCell(ownedCells);
        if (!sourceCell) return null;
        
        // Step 2: Use softmax to select a strategy
        const strategy = this.selectStrategy();
        
        // Step 3: Evaluate targets based on the selected strategy and source
        let targets = [];
        switch(strategy) {
            case 'expand':
                targets = this.evaluateExpandTargetsForSource(sourceCell);
                break;
            case 'capture':
                targets = this.evaluateCaptureTargetsForSource(sourceCell);
                break;
            case 'consolidate':
                targets = this.evaluateConsolidateTargetsForSource(sourceCell, ownedCells);
                break;
        }
        
        // If no targets available for this strategy, try again
        if (targets.length === 0) {
            // Try another strategy or source
            return this.selectObjectiveAndPlan(ownedCells);
        }
        
        // Select the best target based on evaluation scores
        targets.sort((a, b) => b.weight - a.weight);
        const target = targets[0]; // Choose the highest weight target
        
        // Plan path to the selected target
        const path = this.planPath(sourceCell, target);
        if (!path || path.length < 2) return null;
        
        // Store the path and target type
        this.currentPath = path;
        this.targetType = strategy;
        this.pathIndex = 0;
        this.lastPathUpdate = this.game.tick;
        
        // Return first move in the path
        return this.followPath(ownedCells);
    }
    
    // Select a source cell using softmax
    selectSourceCell(ownedCells) {
        if (ownedCells.length === 0) return null;
        
        // Calculate weights for each source cell based on expansion criteria
        const sourcesWithWeights = ownedCells.map(cell => {
            // Base weight is unit count - expansion AI prefers cells with more units
            let weight = cell.cell.units * 1.5;
            
            // Check if this is a border cell (adjacent to non-owned cells)
            const adjacentCells = this.getAdjacentCells(cell.x, cell.y);
            const adjacentNonOwned = adjacentCells.filter(adj => adj.cell.owner !== this.playerId);
            
            if (adjacentNonOwned.length > 0) {
                // Border cells are higher priority for expansion
                weight *= 2.0;
                
                // Even higher priority if there are empty cells to claim
                const emptyCells = adjacentNonOwned.filter(adj => 
                    adj.cell.owner === this.game.OWNER_EMPTY);
                if (emptyCells.length > 0) {
                    weight *= 1.5;
                }
                
                // Even higher priority if there are neutral cities nearby
                const neutralCities = adjacentNonOwned.filter(adj => 
                    adj.cell.owner === this.game.OWNER_NEUTRAL && adj.cell.type === 'city');
                if (neutralCities.length > 0) {
                    weight *= 2.0;
                }
            }
            
            // Generals and cities have lower priority as source cells, as they should accumulate units
            if (cell.cell.type === 'general' || cell.cell.type === 'city') {
                // Only use as sources if they have excess units
                if (cell.cell.units < 20) {
                    weight *= 0.5;
                }
            }
            
            return {
                source: cell,
                weight: weight
            };
        });
        
        // Use softmax to select a source
        return this.softMaxSelect(sourcesWithWeights).source;
    }
    
    // Select a strategy using softmax
    selectStrategy() {
        const strategies = [
            { type: 'expand', weight: this.weights.expand },
            { type: 'capture', weight: this.weights.capture },
            { type: 'consolidate', weight: this.weights.consolidate }
        ];
        
        return this.softMaxSelect(strategies).type;
    }
    
    // Evaluate targets for expansion (claiming empty territories)
    evaluateExpandTargetsForSource(source) {
        const targets = [];
        
        // First check adjacent cells for immediate expansion
        const adjacentCells = this.getAdjacentCells(source.x, source.y);
        
        // Prioritize empty cells
        for (const adj of adjacentCells) {
            // Skip cells we already own
            if (adj.cell.owner === this.playerId) continue;
            
            // Empty cells are prime targets for expansion
            if (adj.cell.owner === this.game.OWNER_EMPTY) {
                // Calculate weight - expansion AI highly values empty territory
                let weight = 100;
                
                // Check if this empty cell is adjacent to other empty cells (for chain expansion)
                const secondaryAdjacents = this.getAdjacentCells(adj.x, adj.y);
                const adjacentEmptyCells = secondaryAdjacents.filter(c => 
                    c.cell.owner === this.game.OWNER_EMPTY);
                
                // Higher weight for cells that can lead to more expansion
                weight += adjacentEmptyCells.length * 20;
                
                targets.push({
                    x: adj.x,
                    y: adj.y,
                    weight: weight
                });
            }
        }
        
        // Consider nearby unexplored areas (optimistic that they're empty)
        for (const unexplored of this.memory.unexploredAreas.slice(0, 20)) { // Consider more unexplored areas
            const distance = Math.abs(source.x - unexplored.x) + Math.abs(source.y - unexplored.y);
            
            if (distance <= 10) { // Willing to travel further for expansion
                // Weight based on exploration value and inverse distance
                const weight = (unexplored.value * 2) / (distance + 1);
                
                targets.push({
                    x: unexplored.x,
                    y: unexplored.y,
                    weight: weight
                });
            }
        }
        
        return targets;
    }
    
    // Evaluate targets for capturing neutral cities and territories
    evaluateCaptureTargetsForSource(source) {
        const targets = [];
        
        // First check adjacent neutral cities/territory for immediate capture
        const adjacentCells = this.getAdjacentCells(source.x, source.y);
        
        // Prioritize neutral cities over enemy cities
        for (const adj of adjacentCells) {
            // Skip cells we already own
            if (adj.cell.owner === this.playerId) continue;
            
            // Neutral cities are very high value
            if (adj.cell.owner === this.game.OWNER_NEUTRAL && adj.cell.type === 'city') {
                // Only target if we have enough units to capture
                if (source.cell.units > adj.cell.units + 1) {
                    targets.push({
                        x: adj.x,
                        y: adj.y,
                        weight: 200  // Very high priority for neutral cities
                    });
                }
            }
        }
        
        // Search for neutral cities in visible area
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                // Skip if not visible
                if (!this.visibilityMap[y][x]) continue;
                
                const cell = this.game.grid[y][x];
                
                // Look for neutral cities
                if (cell.owner === this.game.OWNER_NEUTRAL && cell.type === 'city') {
                    const distance = Math.abs(source.x - x) + Math.abs(source.y - y);
                    
                    // Only consider if within reasonable distance
                    if (distance <= 15) {
                        // Weight based on inverse distance
                        const weight = 150 / (distance + 1);
                        
                        targets.push({
                            x: x,
                            y: y,
                            weight: weight
                        });
                    }
                }
            }
        }
        
        // Also consider enemy territory, but with lower priority
        for (const adj of adjacentCells) {
            // Only consider enemy territory if we have significant advantage
            if (adj.cell.owner >= 0 && adj.cell.owner !== this.playerId) {
                if (source.cell.units > adj.cell.units * 1.5) {
                    let weight = 50;  // Base weight lower than neutral cities
                    
                    // Higher weight for enemy cities
                    if (adj.cell.type === 'city') {
                        weight = 100;
                    }
                    // Highest weight for generals (game winning move)
                    else if (adj.cell.type === 'general') {
                        weight = 300;
                    }
                    
                    targets.push({
                        x: adj.x,
                        y: adj.y,
                        weight: weight
                    });
                }
            }
        }
        
        return targets;
    }
    
    // Evaluate targets for consolidation (building up forces for future expansion)
    evaluateConsolidateTargetsForSource(source, ownedCells) {
        const targets = [];
        
        // Consider strategic positions within our territory
        for (const target of ownedCells) {
            // Skip the source itself
            if (source.x === target.x && source.y === target.y) continue;
            
            // Calculate distance
            const distance = Math.abs(source.x - target.x) + Math.abs(source.y - target.y);
            if (distance <= 10) {
                // Calculate base weight - expansion AI prefers border cells
                let weight = 10;
                
                // Check if target is at a border (good for future expansion)
                const adjacentCells = this.getAdjacentCells(target.x, target.y);
                const adjacentNonOwned = adjacentCells.filter(adj => adj.cell.owner !== this.playerId);
                
                if (adjacentNonOwned.length > 0) {
                    weight *= 3; // Border cells are much more valuable
                    
                    // Even higher weight if there are neutral cities or empty cells adjacent
                    const valuableCells = adjacentNonOwned.filter(adj => 
                        adj.cell.owner === this.game.OWNER_EMPTY || 
                        (adj.cell.owner === this.game.OWNER_NEUTRAL && adj.cell.type === 'city'));
                    
                    if (valuableCells.length > 0) {
                        weight *= 2;
                    }
                }
                
                // Adjust for distance
                weight = weight / (distance + 1);
                
                targets.push({
                    x: target.x,
                    y: target.y,
                    weight: weight
                });
            }
        }
        
        return targets;
    }
    
    // Path planning using BFS
    planPath(source, target) {
        // Queue for BFS
        const queue = [{ x: source.x, y: source.y, path: [{ x: source.x, y: source.y }] }];
        // Visited cells
        const visited = new Set([`${source.x},${source.y}`]);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            // Check if we reached the target
            if (current.x === target.x && current.y === target.y) {
                return current.path;
            }
            
            // Get adjacent cells
            const directions = [
                { dx: 0, dy: -1 }, // Up
                { dx: 1, dy: 0 },  // Right
                { dx: 0, dy: 1 },  // Down
                { dx: -1, dy: 0 }  // Left
            ];
            
            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;
                const key = `${newX},${newY}`;
                
                // Skip if out of bounds or already visited
                if (newX < 0 || newX >= this.game.width || 
                    newY < 0 || newY >= this.game.height ||
                    visited.has(key)) {
                    continue;
                }
                
                // Skip mountains
                if (this.game.grid[newY][newX].type === 'mountain') {
                    continue;
                }
                
                // Add to queue with extended path
                const newPath = [...current.path, { x: newX, y: newY }];
                queue.push({ x: newX, y: newY, path: newPath });
                visited.add(key);
            }
        }
        
        // No path found
        return null;
    }
    
    // Softmax probability selection
    softMaxSelect(items) {
        if (!items || items.length === 0) return null;
        
        // Calculate softmax probabilities
        const weights = items.map(item => item.weight);
        const maxWeight = Math.max(...weights);
        
        // Exponentiate and normalize to prevent overflow
        const exps = weights.map(w => Math.exp((w - maxWeight) / this.temperature));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        const probs = exps.map(exp => exp / sumExps);
        
        // Select based on probabilities
        const r = Math.random();
        let cumProb = 0;
        for (let i = 0; i < probs.length; i++) {
            cumProb += probs[i];
            if (r <= cumProb) {
                return items[i];
            }
        }
        
        // Fallback to prevent errors
        return items[items.length - 1];
    }
}
