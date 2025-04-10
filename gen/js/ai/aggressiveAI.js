import { BaseAI } from './baseAI.js';

export class AggressiveAI extends BaseAI {
    constructor(playerId, game) {
        super(playerId, game);
        
        // Parameters for decision making
        this.temperature = 0.5; // Temperature for softmax selection - lower means more deterministic
        this.currentPath = null; // Current planned path to follow
        this.targetType = null; // Current target type ('merge', 'explore', 'attack')
        this.pathIndex = 0; // Current position in the path
        this.lastPathUpdate = 0; // Game tick when path was last updated
        
        // Strategy weights (can be tuned)
        this.weights = {
            merge: 0.5,     // Preference for merging forces
            explore: 0.8,   // Preference for exploration
            attack: 1.5     // Preference for attacking enemies
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
            this.game.tick - this.lastPathUpdate < 20) { // Path expires after 20 ticks
            
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
        
        // Choose whether to split move based on distance to target
        const splitMove = false; // In general aggressive AI doesn't split - sends maximum force
        
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
            case 'merge':
                targets = this.evaluateMergeTargetsForSource(sourceCell, ownedCells);
                break;
            case 'explore':
                targets = this.evaluateExploreTargetsForSource(sourceCell);
                break;
            case 'attack':
                targets = this.evaluateAttackTargetsForSource(sourceCell);
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
    
    // New method to select a source cell using softmax
    selectSourceCell(ownedCells) {
        if (ownedCells.length === 0) return null;
        
        // Calculate weights for each source cell based on unit count and position
        const sourcesWithWeights = ownedCells.map(cell => {
            // Prefer cells with more units
            let weight = cell.cell.units * 2;
            
            // Prefer cells at the frontier (adjacent to non-owned cells)
            const adjacentCells = this.getAdjacentCells(cell.x, cell.y);
            const adjacentEnemies = adjacentCells.filter(adj => adj.cell.owner !== this.playerId);
            if (adjacentEnemies.length > 0) {
                weight *= 1.5; // Bonus for frontline cells
            }
            
            return {
                source: cell,
                weight: weight
            };
        });
        
        // Use softmax to select a source
        return this.softMaxSelect(sourcesWithWeights).source;
    }
    
    // New method to select a strategy using softmax
    selectStrategy() {
        const strategies = [
            { type: 'merge', weight: this.weights.merge },
            { type: 'explore', weight: this.weights.explore },
            { type: 'attack', weight: this.weights.attack }
        ];
        
        return this.softMaxSelect(strategies).type;
    }
    
    // Modified methods to evaluate targets for a specific source
    evaluateMergeTargetsForSource(source, ownedCells) {
        const targets = [];
        
        // Find other owned cells to merge with (excluding self)
        for (const target of ownedCells) {
            if (source.x === target.x && source.y === target.y) continue;
            
            // Calculate distance
            const distance = Math.abs(source.x - target.x) + Math.abs(source.y - target.y);
            if (distance <= 10) { // Only consider cells within reasonable distance
                // Calculate weight based on target's unit count and distance
                // Prefer cells with more units and closer
                const weight = (target.cell.units * 2) / (distance + 1);
                
                targets.push({
                    x: target.x,
                    y: target.y,
                    weight: weight
                });
            }
        }
        
        return targets;
    }
    
    evaluateExploreTargetsForSource(source) {
        const targets = [];
        
        // Get frontier cells (our cells adjacent to unexplored areas)
        const frontiers = this.getFrontierCells();
        
        // Consider unexplored areas from memory
        for (const unexplored of this.memory.unexploredAreas.slice(0, 10)) { // Consider top 10
            // Calculate distance
            const distance = Math.abs(source.x - unexplored.x) + Math.abs(source.y - unexplored.y);
            
            // Calculate weight - prefer closer unexplored areas with higher value
            const weight = unexplored.value / (distance + 1);
            
            targets.push({
                x: unexplored.x,
                y: unexplored.y,
                weight: weight
            });
        }
        
        // Also consider frontier cells
        for (const frontier of frontiers) {
            if (source.x === frontier.x && source.y === frontier.y) continue; // Skip self
            
            // Calculate distance
            const distance = Math.abs(source.x - frontier.x) + Math.abs(source.y - frontier.y);
            
            // Calculate weight based on frontier value and distance
            const weight = frontier.value / (distance + 1);
            
            targets.push({
                x: frontier.x,
                y: frontier.y,
                weight: weight
            });
        }
        
        return targets;
    }
    
    evaluateAttackTargetsForSource(source) {
        const targets = [];
        
        // Consider adjacent enemy or neutral cells first (immediate attacks)
        const adjacentCells = this.getAdjacentCells(source.x, source.y);
        for (const adj of adjacentCells) {
            if (adj.cell.owner !== this.playerId && adj.cell.type !== 'mountain') {
                // Calculate weight - higher for enemy generals and cities
                let weight = source.cell.units - adj.cell.units; // Favor attacks we can win
                
                if (adj.cell.type === 'general') {
                    weight *= 10; // Very high priority for generals
                } else if (adj.cell.type === 'city') {
                    weight *= 5; // High priority for cities
                }
                
                targets.push({
                    x: adj.x,
                    y: adj.y,
                    weight: Math.max(1, weight) // Ensure positive weight
                });
            }
        }
        
        // Consider known enemy generals from memory
        for (const general of this.memory.generalGuesses) {
            // Skip if it's our general
            if (general.owner === this.playerId) continue;
            
            // Calculate distance
            const distance = Math.abs(source.x - general.x) + Math.abs(source.y - general.y);
            
            // Calculate weight - higher for closer generals and higher confidence
            const weight = (1000 * general.confidence) / (distance + 1);
            
            targets.push({
                x: general.x,
                y: general.y,
                weight: weight
            });
        }
        
        // Consider recent enemy sightings
        for (const key in this.memory.enemySightings) {
            const sighting = this.memory.enemySightings[key];
            const [x, y] = key.split(',').map(Number);
            
            // Skip if too old (more than 50 ticks)
            if (this.game.tick - sighting.lastSeen > 50) continue;
            
            // Calculate distance
            const distance = Math.abs(source.x - x) + Math.abs(source.y - y);
            
            // Calculate weight - higher for recent sightings with fewer units
            let weight = 50 / (this.game.tick - sighting.lastSeen + 1); // Recency factor
            weight *= source.cell.units / (sighting.unitsLastSeen + 1); // Strength factor
            
            if (sighting.type === 'general') {
                weight *= 10; // Higher priority for generals
            } else if (sighting.type === 'city') {
                weight *= 2; // Higher priority for cities
            }
            
            targets.push({
                x: x,
                y: y,
                weight: weight / (distance + 1) // Distance factor
            });
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
                
                // Add to queue with extended path
                const newPath = [...current.path, { x: newX, y: newY }];
                queue.push({ x: newX, y: newY, path: newPath });
                visited.add(key);
            }
        }
        
        // No path found
        return null;
    }
    
    // 新增：softmax概率选择
    softMaxSelect(items) {
        // 计算softmax概率
        const weights = items.map(item => item.weight);
        const maxWeight = Math.max(...weights);
        
        // 指数化并除以最大值防止溢出
        const exps = weights.map(w => Math.exp((w - maxWeight) / this.temperature));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        const probs = exps.map(exp => exp / sumExps);
        
        // 基于概率选择
        const r = Math.random();
        let cumProb = 0;
        for (let i = 0; i < probs.length; i++) {
            cumProb += probs[i];
            if (r <= cumProb) {
                return items[i];
            }
        }
        
        // 防止浮点精度问题，默认返回最后一项
        return items[items.length - 1];
    }
}
