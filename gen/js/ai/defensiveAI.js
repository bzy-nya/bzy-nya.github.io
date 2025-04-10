import { BaseAI } from './baseAI.js';

export class DefensiveAI extends BaseAI {
    constructor(playerId, game) {
        super(playerId, game);
        
        // Parameters for decision making
        this.temperature = 0.7; // Higher temperature for more randomness in defensive play
        this.currentPath = null; // Current planned path to follow
        this.targetType = null; // Current target type ('fortify', 'consolidate', 'expand')
        this.pathIndex = 0; // Current position in the path
        this.lastPathUpdate = 0; // Game tick when path was last updated
        
        // Strategy weights (can be tuned) - defensive AI prioritizes fortification
        this.weights = {
            fortify: 1.5,    // Highest preference for fortifying borders
            consolidate: 1.0, // Medium preference for consolidating forces
            expand: 0.3      // Lowest preference for expansion
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
            this.game.tick - this.lastPathUpdate < 15) { // Path expires sooner for defensive AI (more reactive)
            
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
        // Defensive AI splits more often to maintain defensive positions
        const splitMove = this.targetType === 'expand' || 
                         (this.targetType === 'fortify' && sourceCell.cell.units > 10);
        
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
            case 'fortify':
                targets = this.evaluateFortifyTargetsForSource(sourceCell);
                break;
            case 'consolidate':
                targets = this.evaluateConsolidateTargetsForSource(sourceCell, ownedCells);
                break;
            case 'expand':
                targets = this.evaluateExpandTargetsForSource(sourceCell);
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
        
        // Calculate weights for each source cell based on defensive criteria
        const sourcesWithWeights = ownedCells.map(cell => {
            // Base weight is unit count
            let weight = cell.cell.units;
            
            // Check if this is a border cell (adjacent to non-owned cells)
            const adjacentCells = this.getAdjacentCells(cell.x, cell.y);
            const adjacentEnemies = adjacentCells.filter(adj => adj.cell.owner !== this.playerId);
            
            if (adjacentEnemies.length > 0) {
                // This is a border cell - more important for defense
                weight *= 1.5;
                
                // Check if there are threats (enemy cells with units)
                const threats = adjacentEnemies.filter(adj => 
                    adj.cell.owner >= 0 && adj.cell.owner !== this.playerId);
                
                if (threats.length > 0) {
                    // This cell is under threat - even higher priority
                    weight *= 2.0;
                    
                    // If we're outnumbered, extremely high priority
                    const totalEnemyUnits = threats.reduce((sum, adj) => sum + adj.cell.units, 0);
                    if (totalEnemyUnits > cell.cell.units) {
                        weight *= 3.0;
                    }
                }
            } else {
                // Interior cell - lower priority for a defensive AI
                weight *= 0.5;
                
                // Except generals and cities which are high value
                if (cell.cell.type === 'general' || cell.cell.type === 'city') {
                    weight *= 4.0;
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
            { type: 'fortify', weight: this.weights.fortify },
            { type: 'consolidate', weight: this.weights.consolidate },
            { type: 'expand', weight: this.weights.expand }
        ];
        
        return this.softMaxSelect(strategies).type;
    }
    
    // Evaluate targets for fortification (moving units to vulnerable borders)
    evaluateFortifyTargetsForSource(source) {
        const targets = [];
        
        // Get all our border cells (cells adjacent to non-owned territory)
        const borderCells = this.getOwnedCells().filter(cell => {
            // Skip the source cell itself
            if (cell.x === source.x && cell.y === source.y) return false;
            
            // Check if this cell is adjacent to non-owned territory
            const adjacentCells = this.getAdjacentCells(cell.x, cell.y);
            return adjacentCells.some(adj => adj.cell.owner !== this.playerId);
        });
        
        // Score border cells based on defensive value
        for (const borderCell of borderCells) {
            // Base weight - inverse of units (fewer units means more need for reinforcement)
            let weight = 100 / (borderCell.cell.units + 1);
            
            // Distance factor - closer targets preferred
            const distance = Math.abs(source.x - borderCell.x) + Math.abs(source.y - borderCell.y);
            weight = weight / (distance * 0.5 + 1);
            
            // Threat assessment - check adjacent enemy units
            const adjacentCells = this.getAdjacentCells(borderCell.x, borderCell.y);
            const enemyCells = adjacentCells.filter(adj => 
                adj.cell.owner >= 0 && adj.cell.owner !== this.playerId);
            
            if (enemyCells.length > 0) {
                // Calculate total enemy threat
                const totalEnemyUnits = enemyCells.reduce((sum, adj) => sum + adj.cell.units, 0);
                
                // Higher weight for cells under threat
                weight *= (1 + (totalEnemyUnits / 10));
                
                // Very high priority if our general is threatened
                if (borderCell.cell.type === 'general') {
                    weight *= 10;
                }
                // High priority for threatened cities
                else if (borderCell.cell.type === 'city') {
                    weight *= 5;
                }
            }
            
            targets.push({
                x: borderCell.x,
                y: borderCell.y,
                weight: weight
            });
        }
        
        return targets;
    }
    
    // Evaluate targets for consolidation (merging with other owned cells to build strength)
    evaluateConsolidateTargetsForSource(source, ownedCells) {
        const targets = [];
        
        // Find other owned cells to merge with (excluding self)
        for (const target of ownedCells) {
            if (source.x === target.x && source.y === target.y) continue;
            
            // Calculate distance
            const distance = Math.abs(source.x - target.x) + Math.abs(source.y - target.y);
            if (distance <= 10) { // Only consider cells within reasonable distance
                // Calculate weight - defensive AI prefers cells with fewer units to strengthen them
                let weight = 50 / (target.cell.units + 1);
                
                // Adjust weight based on cell value
                if (target.cell.type === 'general') {
                    weight *= 10; // Very high priority for generals
                } else if (target.cell.type === 'city') {
                    weight *= 5;  // High priority for cities
                }
                
                // Cells closer to borders are higher priority
                const adjacentCells = this.getAdjacentCells(target.x, target.y);
                const borderFactor = adjacentCells.some(adj => adj.cell.owner !== this.playerId) ? 3.0 : 1.0;
                weight *= borderFactor;
                
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
    
    // Evaluate targets for cautious expansion
    evaluateExpandTargetsForSource(source) {
        const targets = [];
        
        // Check adjacent cells for safe expansion
        const adjacentCells = this.getAdjacentCells(source.x, source.y);
        
        // Prefer empty cells and neutral cities/generals that we can capture
        for (const adj of adjacentCells) {
            // Skip cells we already own
            if (adj.cell.owner === this.playerId) continue;
            
            // Calculate base weight
            let weight = 10;
            
            // Strongly prefer empty cells (safe expansion)
            if (adj.cell.owner === this.game.OWNER_EMPTY) {
                weight = 50;
            } 
            // Consider neutral cities if we have enough units
            else if (adj.cell.owner === this.game.OWNER_NEUTRAL) {
                // Only if we have enough units to capture
                if (source.cell.units > adj.cell.units + 1) {
                    weight = 30;
                    
                    // Higher weight for cities (valuable defensive positions)
                    if (adj.cell.type === 'city') {
                        weight = 100;
                    }
                } else {
                    // Too risky, low weight
                    weight = 5;
                }
            }
            // Consider attacking enemy cells only if we have a significant advantage
            else if (adj.cell.owner >= 0) {
                if (source.cell.units > adj.cell.units * 1.5) {
                    weight = 20;
                    
                    // Higher weight for generals (game winning)
                    if (adj.cell.type === 'general') {
                        weight = 200;
                    }
                    // Higher for cities (good defensive positions)
                    else if (adj.cell.type === 'city') {
                        weight = 60;
                    }
                } else {
                    // Too risky for defensive AI
                    weight = 1;
                }
            }
            
            targets.push({
                x: adj.x,
                y: adj.y,
                weight: weight
            });
        }
        
        // Also consider some cautious exploring options if we have enough units
        if (source.cell.units > 10) {
            for (const unexplored of this.memory.unexploredAreas.slice(0, 5)) {
                const distance = Math.abs(source.x - unexplored.x) + Math.abs(source.y - unexplored.y);
                
                // Only consider close unexplored areas (defensive AI is cautious)
                if (distance <= 5) {
                    const weight = unexplored.value / (distance + 1);
                    
                    targets.push({
                        x: unexplored.x,
                        y: unexplored.y, 
                        weight: weight * 0.5  // Lower weight for exploration
                    });
                }
            }
        }
        
        return targets;
    }
    
    // Simple path planning using BFS
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
                
                // Defensive AI avoids enemy territory when possible
                const cell = this.game.grid[newY][newX];
                if (cell.owner >= 0 && cell.owner !== this.playerId) {
                    // Only continue through enemy territory if absolutely necessary or target is there
                    if (newX !== target.x || newY !== target.y) {
                        if (queue.length > 0) { // If we have other options, skip enemy territory
                            continue;
                        }
                    }
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
