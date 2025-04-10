export function createAI(type, playerId, game) {
    switch (type) {
        case 0:
            return new AggressiveAI(playerId, game);
        case 1:
            return new ExpansionAI(playerId, game);
        case 2:
            return new DefensiveAI(playerId, game);
        default:
            return new RandomAI(playerId, game);
    }
}

class BaseAI {
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
                { dx: 0, dy: -1 }, // Up
                { dx: 1, dy: 0 },  // Right
                { dx: 0, dy: 1 },  // Down
                { dx: -1, dy: 0 }  // Left
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

class AggressiveAI extends BaseAI {
    constructor(playerId, game) {
        super(playerId, game);
        
        // Aggressive AI 参数调整（更偏向进攻）
        this.attackWeight = 2.0;       // 加大进攻偏好
        this.expansionWeight = 0.5;    // 降低扩张优先级
        this.defenseWeight = 0.1;      // 极低防御兴趣
        this.explorationWeight = 0.6;  // 保持适中探索
        
        this.targetTimeout = 0;
        this.currentTarget = null;
        
        // 用于存储高价值目标和移动历史信息
        this.concentrationPoints = [];
        this.moveHistory = {};
        this.historyWeight = 0.95;     // 重复行动分数衰减较小
        
        // 新增：记录上次的移动，用于防止两格来回循环
        this.lastMove = null;

        // 新增：记忆之前探索到的敌方将军和城市目标
        // 数组项格式：{ x, y, type, value }
        this.memoryTargets = [];
    }
    
    calculateMove() {
        // 更新当前高价值目标，同时更新记忆中的目标
        this.updateConcentrationPoints();
        
        const ownedCells = this.getOwnedCells();
        if (ownedCells.length === 0) return null;
        
        // 筛选出有足够单位可以移动的细胞
        const movableCells = ownedCells.filter(c => c.cell.units > 1);
        if (movableCells.length === 0) return null;
        
        // 检查是否有庞大军队优先向高价值目标进攻
        const strongCells = movableCells.filter(c => c.cell.units > 30);
        if (strongCells.length > 0) {
            const targetMove = this.findHighValueTarget(strongCells);
            if (targetMove) {
                this.lastMove = { from: targetMove.from, to: targetMove.to }; // 记录上次移动
                return targetMove;
            }
        }
        
        // 按单位数排序，并略加随机化，防止固定模式
        movableCells.sort((a, b) => (b.cell.units - a.cell.units) + (Math.random() * 5 - 2.5));
        
        const scoredMoves = [];
        // 对每个可移动单元的细胞，检查所有相邻目标并计算移动得分
        for (const fromCell of movableCells) {
            const adjacentCells = this.getAdjacentCells(fromCell.x, fromCell.y);
            if (adjacentCells.length === 0) continue;
            
            for (const toCell of adjacentCells) {
                const score = this.scoreMove(fromCell, toCell);
                if (score > 0) {
                    scoredMoves.push({
                        from: fromCell,
                        to: toCell,
                        score: score
                    });
                }
            }
        }
        
        // 若无有利移动方案，则采用后备随机策略
        if (scoredMoves.length === 0) {
            const fallbackCells = this.getOwnedCells().filter(c => c.cell.units > 1);
            if (fallbackCells.length === 0) return null;
            
            const randomCell = fallbackCells[Math.floor(Math.random() * fallbackCells.length)];
            const adjacentCells = this.getAdjacentCells(randomCell.x, randomCell.y);
            if (adjacentCells.length === 0) return null;
            
            const randomAdjCell = adjacentCells[Math.floor(Math.random() * adjacentCells.length)];
            const fallbackMove = {
                from: { x: randomCell.x, y: randomCell.y },
                to: { x: randomAdjCell.x, y: randomAdjCell.y },
                splitMove: randomCell.cell.units > 10
            };
            this.lastMove = { from: fallbackMove.from, to: fallbackMove.to };
            return fallbackMove;
        }
        
        // 选择评分最高的移动
        scoredMoves.sort((a, b) => b.score - a.score);
        const bestMove = scoredMoves[0];
        this.recordMove(bestMove.from.x, bestMove.from.y, bestMove.to.x, bestMove.to.y);
        this.lastMove = { from: { x: bestMove.from.x, y: bestMove.from.y }, to: { x: bestMove.to.x, y: bestMove.to.y } };
        
        // 智能分裂策略：仅在己方强化或制造假攻时拆分部队
        const splitMove = 
            (bestMove.to.cell.owner === this.playerId && bestMove.from.cell.units > 12) ||
            (bestMove.from.cell.units > 35);
        
        return {
            from: { x: bestMove.from.x, y: bestMove.from.y },
            to: { x: bestMove.to.x, y: bestMove.to.y },
            splitMove: splitMove
        };
    }
    
    updateConcentrationPoints() {
        // 清空当前回合的高价值目标列表
        this.concentrationPoints = [];
        
        // 先更新记忆：从当前可见区域发现敌人将军和城市
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                if (!this.visibilityMap || !this.visibilityMap[y][x]) continue;
                const cell = this.game.grid[y][x];
                if (cell.owner >= 0 && cell.owner !== this.playerId) {
                    if (cell.type === 'general' || cell.type === 'city') {
                        // 检查记忆中是否已经有该目标，如果有则更新数值，否则新增记录
                        let found = false;
                        for (let target of this.memoryTargets) {
                            if (target.x === x && target.y === y && target.type === cell.type) {
                                target.value = (cell.type === 'general') ? 1000 : 300;
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            this.memoryTargets.push({ x, y, type: cell.type, value: (cell.type === 'general') ? 1000 : 300 });
                        }
                    }
                }
            }
        }
        
        // 遍历当前视野内所有敌人细胞，记录它们的战略价值
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                if (!this.visibilityMap || !this.visibilityMap[y][x]) continue;
                const cell = this.game.grid[y][x];
                if (cell.owner >= 0 && cell.owner !== this.playerId) {
                    let value = 0;
                    if (cell.type === 'general') {
                        value = 1000;
                    } else if (cell.type === 'city') {
                        value = 300;
                    } else if (cell.units > 20) {
                        value = 100 + cell.units;
                    }
                    if (value > 0) {
                        this.concentrationPoints.push({ x, y, owner: cell.owner, value });
                    }
                }
            }
        }
        
        // 将记忆中的目标（若当前视野中未见）并入目标列表
        for (let mem of this.memoryTargets) {
            // 如果同一坐标的目标已存在，则跳过
            let exists = this.concentrationPoints.some(cp => cp.x === mem.x && cp.y === mem.y);
            if (!exists) {
                this.concentrationPoints.push({ x: mem.x, y: mem.y, owner: null, value: mem.value });
            }
        }
        
        // 按目标价值从高到低排序
        this.concentrationPoints.sort((a, b) => b.value - a.value);
    }
    
    findHighValueTarget(strongCells) {
        if (this.concentrationPoints.length === 0) return null;
        
        // 遍历每个强大细胞，寻找最近的高价值目标
        for (const cell of strongCells) {
            let closestTarget = null;
            let minDistance = Infinity;
            for (const target of this.concentrationPoints) {
                const distance = Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y);
                if (distance < minDistance) {
                    closestTarget = target;
                    minDistance = distance;
                }
            }
            
            // 如果目标在可接受范围内（这里放宽到距离 < 12），则向其方向移动
            if (closestTarget && minDistance < 12) {
                const adjacentCells = this.getAdjacentCells(cell.x, cell.y);
                if (adjacentCells.length === 0) continue;
                
                adjacentCells.sort((a, b) => {
                    const distA = Math.abs(a.x - closestTarget.x) + Math.abs(a.y - closestTarget.y);
                    const distB = Math.abs(b.x - closestTarget.x) + Math.abs(b.y - closestTarget.y);
                    return distA - distB;
                });
                
                return {
                    from: { x: cell.x, y: cell.y },
                    to: { x: adjacentCells[0].x, y: adjacentCells[0].y },
                    splitMove: false // 定向攻击时不分裂
                };
            }
        }
        return null;
    }
    
    recordMove(fromX, fromY, toX, toY) {
        const moveKey = `${fromX},${fromY}->${toX},${toY}`;
        this.moveHistory[moveKey] = (this.moveHistory[moveKey] || 0) + 1;
    }
    
    // 对移动评分，加入正向进攻奖励、部队数量、以及规避反向循环等策略
    scoreMove(from, to) {
        let score = 10;
        const moveKey = `${from.x},${from.y}->${to.x},${to.y}`;
        const repetitions = this.moveHistory[moveKey] || 0;
        const repetitionPenalty = repetitions > 0 ? Math.pow(this.historyWeight, repetitions) : 1;
        
        // 检查是否为上一回合的反向移动，若是则施以重罚
        if (this.lastMove) {
            if (from.x === this.lastMove.to.x && from.y === this.lastMove.to.y &&
                to.x === this.lastMove.from.x && to.y === this.lastMove.from.y) {
                score -= 500;
            }
        }
        
        if (to.cell.owner >= 0 && to.cell.owner !== this.playerId) {
            // 针对敌人发动进攻，奖励更高
            score += 80 * this.attackWeight;
            
            if (to.cell.type === 'general') {
                score += 600;  // 针对将军的攻击额外奖励
            }
            
            const strengthRatio = from.cell.units / Math.max(1, to.cell.units);
            score += (strengthRatio - 1) * 30;
            
            if (from.cell.units > to.cell.units * 1.8) {
                score += 70; // 压倒性优势奖励
            }
            if (from.cell.units > to.cell.units * 2) {
                score += 30; // 额外奖励
            }
            
            if (to.cell.type === 'city') {
                score += 150;  // 针对城市的奖励
            }
            
            // 若己方部队数量不足以进攻，则惩罚较低（鼓励冒险尝试）
            if (from.cell.units <= to.cell.units + 1) {
                score -= 100;
            }
            
            // 如果移动能够靠近某个高价值目标，则额外加分
            for (const target of this.concentrationPoints) {
                const currentDist = Math.abs(from.x - target.x) + Math.abs(from.y - target.y);
                const newDist = Math.abs(to.x - target.x) + Math.abs(to.y - target.y);
                if (newDist < currentDist) {
                    score += 30;
                }
            }
        } 
        else if (to.cell.owner === this.game.OWNER_NEUTRAL) {
            score += 20 * this.expansionWeight;
            const strengthRatio = from.cell.units / Math.max(1, to.cell.units);
            score += (strengthRatio - 2) * 15;
            if (from.cell.units <= to.cell.units + 1) {
                score -= 100;
            }
        }
        else if (to.cell.owner === this.game.OWNER_EMPTY) {
            score += 15 * this.expansionWeight;
            if (this.isTargetNearby(to.x, to.y, 3)) {
                score += 30;
            }
        }
        else if (to.cell.owner === this.playerId) {
            score += 5;
            if (from.cell.units > 20) {
                score -= 30;
            }
            if (to.cell.units < from.cell.units / 4) {
                score += 15 * this.defenseWeight;
            } else {
                score -= 20;
            }
        }
        
        // 根据使用的大军给予额外奖励
        score += Math.min(from.cell.units / 8, 25);
        score *= repetitionPenalty;
        return score;
    }
    
    isTargetNearby(x, y, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= this.game.width || ny < 0 || ny >= this.game.height) continue;
                if (!this.visibilityMap[ny][nx]) continue;
                
                const cell = this.game.grid[ny][nx];
                if ((cell.owner >= 0 && cell.owner !== this.playerId) || cell.type === 'city') {
                    return true;
                }
            }
        }
        return false;
    }
}

class ExpansionAI extends BaseAI {
    constructor(playerId, game) {
        super(playerId, game);

        // ExpansionAI 参数设置，突出扩张优先级
        this.attackWeight = 0.5;        // 对敌人的进攻意愿较低，仅在敌方较弱时考虑
        this.expansionWeight = 2.0;     // 扩张权重大大提升，优先占领空白或中立区域
        this.defenseWeight = 1.0;       // 对己方防御也有一定关注，但不作为主要目标
        this.explorationWeight = 1.5;   // 探索未知区域的意愿较高

        // 移动历史记录，用于减少重复路径的使用
        this.moveHistory = {};
        this.historyWeight = 0.9;

        // 记录潜在的扩张目标（优先攻击中立或空白区域）
        this.expansionPoints = [];
    }

    calculateMove() {
        // 更新潜在扩张目标信息（例如空白或中立区域）
        this.updateExpansionPoints();

        // 获取所有己方占领的单元格
        const ownedCells = this.getOwnedCells();
        if (ownedCells.length === 0) return null;

        // 仅筛选出拥有多余兵力可供移动的单元格（单位数大于 1）
        const movableCells = ownedCells.filter(c => c.cell.units > 1);
        if (movableCells.length === 0) return null;

        const scoredMoves = [];
        // 遍历所有可调动的单元格及其相邻目标，计算评分
        for (const fromCell of movableCells) {
            const adjacentCells = this.getAdjacentCells(fromCell.x, fromCell.y);
            if (!adjacentCells || adjacentCells.length === 0) continue;

            for (const toCell of adjacentCells) {
                const score = this.scoreMove(fromCell, toCell);
                if (score > 0) {
                    scoredMoves.push({
                        from: fromCell,
                        to: toCell,
                        score: score
                    });
                }
            }
        }

        // 若所有方案均不满足，则采用后备随机移动策略
        if (scoredMoves.length === 0) {
            const fallbackCells = this.getOwnedCells().filter(c => c.cell.units > 1);
            if (fallbackCells.length === 0) return null;

            const randomCell = fallbackCells[Math.floor(Math.random() * fallbackCells.length)];
            const adjacent = this.getAdjacentCells(randomCell.x, randomCell.y);
            if (!adjacent || adjacent.length === 0) return null;

            const randomAdj = adjacent[Math.floor(Math.random() * adjacent.length)];
            return {
                from: { x: randomCell.x, y: randomCell.y },
                to: { x: randomAdj.x, y: randomAdj.y },
                splitMove: randomCell.cell.units > 10
            };
        }

        // 选择评分最高的移动策略
        scoredMoves.sort((a, b) => b.score - a.score);
        const bestMove = scoredMoves[0];

        // 记录此次移动，避免重复行动导致评分降低
        this.recordMove(bestMove.from.x, bestMove.from.y, bestMove.to.x, bestMove.to.y);

        // 根据当前局面决定是否分裂行动（若目标己方且有充足兵力，则可以分兵）
        const splitMove = (bestMove.to.cell.owner === this.playerId && bestMove.from.cell.units > 12);

        return {
            from: { x: bestMove.from.x, y: bestMove.from.y },
            to: { x: bestMove.to.x, y: bestMove.to.y },
            splitMove: splitMove
        };
    }

    // 更新扩张目标信息：选择那些中立和空白区域作为扩展目标
    updateExpansionPoints() {
        this.expansionPoints = [];
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                // 只有在己方视野范围内才考虑目标
                if (!this.visibilityMap || !this.visibilityMap[y][x]) continue;

                const cell = this.game.grid[y][x];
                if (cell.owner === this.game.OWNER_NEUTRAL || cell.owner === this.game.OWNER_EMPTY) {
                    // 设定基本扩张价值：如城市赋予更高价值，其他区域基础价值较低
                    let value = (cell.type === 'city') ? 400 : 100;
                    this.expansionPoints.push({
                        x: x,
                        y: y,
                        value: value
                    });
                }
            }
        }
        // 根据目标价值排序，优先考虑高价值扩张目标
        this.expansionPoints.sort((a, b) => b.value - a.value);
    }

    // 记录行动历史，以减少重复行动的倾向
    recordMove(fromX, fromY, toX, toY) {
        const moveKey = `${fromX},${fromY}->${toX},${toY}`;
        this.moveHistory[moveKey] = (this.moveHistory[moveKey] || 0) + 1;
    }

    // 对每个可能的移动方案进行评分，侧重于扩张能力和扩大领土
    scoreMove(from, to) {
        let score = 10; // 基本评分
        const moveKey = `${from.x},${from.y}->${to.x},${to.y}`;
        const repetitions = this.moveHistory[moveKey] || 0;
        const repetitionPenalty = repetitions > 0 ? Math.pow(this.historyWeight, repetitions) : 1;

        // 目标为空白或中立单元时，给予高额扩张奖励
        if (to.cell.owner === this.game.OWNER_EMPTY || to.cell.owner === this.game.OWNER_NEUTRAL) {
            score += 100 * this.expansionWeight;
            // 若目标为城市，则附加额外奖励，因城市通常能增加兵力产出
            if (to.cell.type === 'city') {
                score += 150;
            }
            // 根据进攻方与目标的兵力对比给予一定奖励，确保扩张较为安全
            const strengthRatio = from.cell.units / Math.max(1, to.cell.units);
            score += (strengthRatio - 1) * 20;
        }
        // 当目标为敌方占领时，ExpansionAI 通常选择回避，除非敌人极为薄弱可以顺势扩张
        else if (to.cell.owner >= 0 && to.cell.owner !== this.playerId) {
            const strengthRatio = from.cell.units / Math.max(1, to.cell.units);
            if (strengthRatio > 1.8) {
                score += 50 * this.attackWeight;
                if (to.cell.type === 'city') {
                    score += 100;
                }
            } else {
                score -= 100;
            }
        }
        // 当目标为己方领土时，移动可有利于巩固扩张边界，逐步向目标区域靠拢
        else if (to.cell.owner === this.playerId) {
            for (const exp of this.expansionPoints) {
                // 采用曼哈顿距离，若移动后距离扩张目标更近，则给予加分
                const currentDist = Math.abs(from.x - exp.x) + Math.abs(from.y - exp.y);
                const newDist = Math.abs(to.x - exp.x) + Math.abs(to.y - exp.y);
                if (newDist < currentDist) {
                    score += 20;
                }
            }
            score += 10 * this.defenseWeight;
        }

        // 考虑兵力数量：大部队更有扩张能力
        score += Math.min(from.cell.units / 10, 20);
        score *= repetitionPenalty;
        return score;
    }

    // 辅助函数：检测指定范围内是否存在扩张机会（邻近空白或中立单元）
    isExpansionOpportunity(x, y, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= this.game.width || ny < 0 || ny >= this.game.height) continue;
                if (!this.visibilityMap[ny][nx]) continue;
                const cell = this.game.grid[ny][nx];
                if (cell.owner === this.game.OWNER_NEUTRAL || cell.owner === this.game.OWNER_EMPTY) {
                    return true;
                }
            }
        }
        return false;
    }
}

class DefensiveAI extends BaseAI {
    constructor(playerId, game) {
        super(playerId, game);
        
        // Defensive AI 参数设置：进攻和扩张意愿较低，防御强化
        this.attackWeight = 0.5;       // 进攻权重较低
        this.expansionWeight = 0.6;    // 扩张权重较低
        this.defenseWeight = 2.0;      // 防御权重大大提升
        this.explorationWeight = 0.3;  // 探索意愿较低
        
        // 用于记录己方薄弱区域，用作防御加固目标
        this.vulnerabilityPoints = [];
        this.moveHistory = {};
        this.historyWeight = 0.9;      // 重复行动的惩罚
    }
    
    calculateMove() {
        // 更新当前防御薄弱区域（即那些与敌人接壤且部队较少的己方单元）
        this.updateVulnerabilityPoints();
        
        // 获取所有己方占领的细胞
        const ownedCells = this.getOwnedCells();
        if (!ownedCells || ownedCells.length === 0) return null;
        
        // 选择可以调动的细胞（单位数大于 1 才能行动）
        const movableCells = ownedCells.filter(c => c.cell.units > 1);
        if (movableCells.length === 0) return null;
        
        // 针对每个可调动的细胞，评估其相邻细胞的移动得分
        let scoredMoves = [];
        for (const fromCell of movableCells) {
            const adjacentCells = this.getAdjacentCells(fromCell.x, fromCell.y);
            if (!adjacentCells || adjacentCells.length === 0) continue;
            
            for (const toCell of adjacentCells) {
                const score = this.scoreMove(fromCell, toCell);
                if (score > 0) {
                    scoredMoves.push({
                        from: fromCell,
                        to: toCell,
                        score: score
                    });
                }
            }
        }
        
        // 如果没有合适的得分移动，则采用后备策略随机选取可行动单元进行微调
        if (scoredMoves.length === 0) {
            const fallbackCells = this.getOwnedCells().filter(c => c.cell.units > 1);
            if (fallbackCells.length === 0) return null;
            
            const randomCell = fallbackCells[Math.floor(Math.random() * fallbackCells.length)];
            const adjacent = this.getAdjacentCells(randomCell.x, randomCell.y);
            if (!adjacent || adjacent.length === 0) return null;
            
            const randomAdj = adjacent[Math.floor(Math.random() * adjacent.length)];
            return {
                from: { x: randomCell.x, y: randomCell.y },
                to: { x: randomAdj.x, y: randomAdj.y },
                splitMove: randomCell.cell.units > 10 // 单位充裕时允许分裂部分部队
            };
        }
        
        // 按得分从高到低排序，选择最佳移动
        scoredMoves.sort((a, b) => b.score - a.score);
        const bestMove = scoredMoves[0];
        
        // 记录此次移动，避免陷入重复路线
        this.recordMove(bestMove.from.x, bestMove.from.y, bestMove.to.x, bestMove.to.y);
        
        // DefensiveAI 主要目标是巩固防御，对己方内部调动的分裂操作仅在有助于加强薄弱区域时发生
        const splitMove =
            (bestMove.to.cell.owner === this.playerId &&
             bestMove.from.cell.units > 12 &&
             bestMove.to.cell.units < bestMove.from.cell.units);
        
        return {
            from: { x: bestMove.from.x, y: bestMove.from.y },
            to: { x: bestMove.to.x, y: bestMove.to.y },
            splitMove: splitMove
        };
    }
    
    // 遍历己方细胞，找出那些与敌人接壤且部队不足的“脆弱点”
    updateVulnerabilityPoints() {
        this.vulnerabilityPoints = [];
        const ownedCells = this.getOwnedCells();
        
        for (const cellInfo of ownedCells) {
            const adjacentCells = this.getAdjacentCells(cellInfo.x, cellInfo.y);
            let isVulnerable = false;
            for (const adj of adjacentCells) {
                // 如果相邻单元为敌方或者中立（不空）则视为存在威胁
                if (adj.cell.owner !== this.playerId && adj.cell.owner !== this.game.OWNER_EMPTY) {
                    isVulnerable = true;
                    break;
                }
            }
            
            // 仅当己方部队低于某一阈值时将其视为需要加固（例如：阈值设为 20）
            if (isVulnerable) {
                const weakness = Math.max(0, 20 - cellInfo.cell.units);
                if (weakness > 0) {
                    this.vulnerabilityPoints.push({
                        x: cellInfo.x,
                        y: cellInfo.y,
                        weakness: weakness
                    });
                }
            }
        }
        
        // 根据薄弱程度排序，弱点越大排在前面
        this.vulnerabilityPoints.sort((a, b) => b.weakness - a.weakness);
    }
    
    // 记录移动路径，避免连续重复
    recordMove(fromX, fromY, toX, toY) {
        const moveKey = `${fromX},${fromY}->${toX},${toY}`;
        this.moveHistory[moveKey] = (this.moveHistory[moveKey] || 0) + 1;
    }
    
    // 评分函数：主要关注于内部调动是否能加强防御（补充薄弱单元）、避免冒险进攻
    scoreMove(from, to) {
        let score = 10;
        const moveKey = `${from.x},${from.y}->${to.x},${to.y}`;
        const repetitions = this.moveHistory[moveKey] || 0;
        const repetitionPenalty = repetitions > 0 ? Math.pow(this.historyWeight, repetitions) : 1;
        
        // 如果目标细胞属于己方，则为防御增援类移动
        if (to.cell.owner === this.playerId) {
            // 检查该目标是否存在防御薄弱问题
            let vulnerabilityBonus = 0;
            for (const vp of this.vulnerabilityPoints) {
                if (vp.x === to.x && vp.y === to.y) {
                    // 薄弱程度越高，奖励越大
                    vulnerabilityBonus = vp.weakness * 5;
                    break;
                }
            }
            // 强制调动得分明显增加，以便补充弱点
            score += 50 * this.defenseWeight * (vulnerabilityBonus || 1);
            
            // 调动来源细胞必须有足够余力，否则不划算
            if (from.cell.units > 10) {
                score += 20;
            } else {
                score -= 20;
            }
        } 
        // 如果目标细胞是中立领地，防御性 AI 扩张优先级不高
        else if (to.cell.owner === this.game.OWNER_NEUTRAL) {
            score += 10 * this.expansionWeight;
            const strengthRatio = from.cell.units / Math.max(1, to.cell.units);
            score += (strengthRatio - 1) * 5;
            if (from.cell.units <= to.cell.units + 1) {
                score -= 50;
            }
        } 
        // 如果目标为敌方细胞，防御性 AI 通常不会主动出击，除非绝对压倒性优势
        else if (to.cell.owner >= 0 && to.cell.owner !== this.playerId) {
            const strengthRatio = from.cell.units / Math.max(1, to.cell.units);
            if (strengthRatio > 2.5) {
                score += 30 * this.attackWeight;
            } else {
                score -= 100;
            }
        }
        
        // 鼓励调动方向上靠近那些薄弱点（即需要加固的区域）
        for (const vp of this.vulnerabilityPoints) {
            const currentDist = Math.abs(from.x - vp.x) + Math.abs(from.y - vp.y);
            const newDist = Math.abs(to.x - vp.x) + Math.abs(to.y - vp.y);
            if (newDist < currentDist) {
                score += 20;
            }
        }
        
        // 大部队调动时给予适当奖励
        score += Math.min(from.cell.units / 10, 15);
        score *= repetitionPenalty;
        return score;
    }
    
    // 判断指定坐标附近是否存在敌方威胁（防御用途）
    isTargetNearby(x, y, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || nx >= this.game.width || ny < 0 || ny >= this.game.height)
                    continue;
                if (!this.visibilityMap[ny][nx])
                    continue;
                const cell = this.game.grid[ny][nx];
                if (cell.owner !== this.playerId && cell.owner !== this.game.OWNER_EMPTY)
                    return true;
            }
        }
        return false;
    }
}

class RandomAI extends BaseAI {
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
