export class MapSettings {
    constructor(width, height, playerCount, mountainDensity = 0.2, cityDensity = 0.1) {
        this.width = width;
        this.height = height;
        this.playerCount = playerCount;
        this.mountainDensity = mountainDensity;
        this.cityDensity = cityDensity;
    }
    
    // Convenience method to create settings from map size name
    static fromSizePreset(playerCount, sizeName, mountainDensity = 0.2, cityDensity = 0.1) {
        let width, height;
        
        switch (sizeName) {
            case 'small':
                width = height = 15;
                break;
            case 'large':
                width = height = 35;
                break;
            case 'huge':
                width = height = 50;
                break;
            case 'medium':
            default:
                width = height = 25;
                break;
        }
        
        return new MapSettings(width, height, playerCount, mountainDensity, cityDensity);
    }
    
    // Clone method for creating copies
    clone() {
        return new MapSettings(
            this.width, 
            this.height, 
            this.playerCount, 
            this.mountainDensity, 
            this.cityDensity
        );
    }
}

export class GameMap {
    constructor(mapSettings) {
        this.width = mapSettings.width;
        this.height = mapSettings.height;
        this.playerCount = mapSettings.playerCount;
        this.mountainDensity = mapSettings.mountainDensity;
        this.cityDensity = mapSettings.cityDensity;
        
        // Define constants for special owner types
        this.OWNER_EMPTY = -1;
        this.OWNER_NEUTRAL = -2;
    }
    
    createGrid() {
        // Initialize empty grid
        let grid = this.initializeEmptyGrid();
        
        // Place mountains and cities according to density parameters
        grid = this.placeMountainsAndCities(grid);
        
        // Find suitable general positions
        const generalPositions = this.findGeneralPositions(grid);
        
        // Ensure all generals are connected using union-find for efficiency
        this.ensureConnectedGenerals(grid, generalPositions);
        
        // Place generals on the grid
        for (let i = 0; i < generalPositions.length; i++) {
            const pos = generalPositions[i];
            grid[pos.y][pos.x].type = 'general';
            grid[pos.y][pos.x].owner = i;
            grid[pos.y][pos.x].units = 1;
        }
        
        return {
            grid,
            generalPositions
        };
    }
    
    initializeEmptyGrid() {
        const grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push({
                    type: 'empty', // empty, mountain, city, general
                    owner: this.OWNER_EMPTY, // Player ID, OWNER_EMPTY, or OWNER_NEUTRAL
                    units: 0,      // Number of army units
                    isFog: false   // For fog of war (not implemented in this basic version)
                });
            }
            grid.push(row);
        }
        return grid;
    }
    
    placeMountainsAndCities(grid, mountainScaleFactor = 1.0) {
        // Add mountains (obstacles) - use mountainDensity parameter
        const mountainCount = Math.floor(this.width * this.height * this.mountainDensity * mountainScaleFactor);
        for (let i = 0; i < mountainCount; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            if (grid[y][x].type === 'empty') {
                grid[y][x].type = 'mountain';
            }
        }
        
        // Add cities (neutral territory) - use cityDensity parameter
        const cityCount = Math.floor(this.width * this.height * this.cityDensity);
        for (let i = 0; i < cityCount; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            if (grid[y][x].type === 'empty') {
                grid[y][x].type = 'city';
                grid[y][x].owner = this.OWNER_NEUTRAL; // Mark as neutral city
                grid[y][x].units = 40; // Initial garrison for neutral cities
            }
        }
        
        return grid;
    }
    
    findGeneralPositions(grid) {
        // Ensure generals are spaced apart
        const minDistance = Math.floor(Math.min(this.width, this.height) / 3);
        const positions = [];
        
        for (let i = 0; i < this.playerCount; i++) {
            let valid = false;
            let x, y;
            
            // Try to find a valid position
            let attempts = 0;
            while (!valid && attempts < 100) {
                x = Math.floor(Math.random() * this.width);
                y = Math.floor(Math.random() * this.height);
                
                if (grid[y][x].type !== 'empty') {
                    attempts++;
                    continue;
                }
                
                // Check distance from other generals
                valid = true;
                for (const pos of positions) {
                    const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
                    if (distance < minDistance) {
                        valid = false;
                        break;
                    }
                }
                
                attempts++;
            }
            
            if (valid) {
                positions.push({ x, y });
            }
        }
        
        return positions;
    }
    
    ensureConnectedGenerals(grid, generalPositions) {
        if (generalPositions.length < 2) return;
        
        // Initialize union-find data structure
        const uf = new UnionFind(generalPositions.length);
        
        // Create a grid to map positions to general indices
        const generalIndices = Array(this.height).fill().map(() => Array(this.width).fill(-1));
        generalPositions.forEach((pos, index) => {
            generalIndices[pos.y][pos.x] = index;
        });
        
        // Initial connectivity check using flood fill from each general
        generalPositions.forEach((pos, index) => {
            this.floodFillAndUnion(grid, pos.x, pos.y, index, generalIndices, uf);
        });
        
        // If all generals are connected, we're done
        if (uf.count === 1) return;
        
        // Find mountains to remove to connect generals
        let mountainsToRemove = this.findMountainsToRemove(grid, generalPositions, uf);
        let mountainsRemoved = 0;
        let maxRemoval = Math.floor(this.width * this.height * 0.1); // Cap at 10% of map
        
        // Remove mountains and update connectivity
        while (uf.count > 1 && mountainsRemoved < maxRemoval && mountainsToRemove.length > 0) {
            const mountain = mountainsToRemove.shift();
            grid[mountain.y][mountain.x].type = 'empty';
            mountainsRemoved++;
            
            // Update connectivity after removing each mountain
            uf.reset(generalPositions.length);
            generalPositions.forEach((pos, index) => {
                this.floodFillAndUnion(grid, pos.x, pos.y, index, generalIndices, uf);
            });
            
            // If connectivity has changed, recalculate mountains to remove
            if (uf.count < generalPositions.length && uf.count > 1) {
                mountainsToRemove = this.findMountainsToRemove(grid, generalPositions, uf);
            }
        }
        
        // Last resort: if still not connected, create direct paths
        if (uf.count > 1) {
            this.createDirectPaths(grid, generalPositions, uf);
        }
    }
    
    floodFillAndUnion(grid, startX, startY, generalIndex, generalIndices, uf) {
        const directions = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
        ];
        
        const visited = Array(this.height).fill().map(() => Array(this.width).fill(false));
        const queue = [{ x: startX, y: startY }];
        visited[startY][startX] = true;
        
        while (queue.length > 0) {
            const { x, y } = queue.shift();
            
            // Check if this position contains another general
            const foundGeneralIndex = generalIndices[y][x];
            if (foundGeneralIndex !== -1 && foundGeneralIndex !== generalIndex) {
                // Union the two generals
                uf.union(generalIndex, foundGeneralIndex);
            }
            
            // Continue flood fill
            for (const { dx, dy } of directions) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && 
                    !visited[ny][nx] && grid[ny][nx].type !== 'mountain') {
                    visited[ny][nx] = true;
                    queue.push({ x: nx, y: ny });
                }
            }
        }
    }
    
    findMountainsToRemove(grid, generalPositions, uf) {
        // Enhanced mountain removal strategy - prioritize mountains between disconnected components
        const mountains = [];
        const components = this.findDisconnectedComponents(generalPositions, uf);
        
        // Collect all mountains
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (grid[y][x].type === 'mountain') {
                    // Score prioritizes mountains that connect different components
                    const score = this.scoreMountainRemoval(grid, x, y, generalPositions, components);
                    mountains.push({ x, y, score });
                }
            }
        }
        
        // Sort mountains by their score (higher score = better candidate for removal)
        mountains.sort((a, b) => b.score - a.score);
        
        return mountains;
    }
    
    findDisconnectedComponents(generalPositions, uf) {
        const components = new Map(); // root -> [general indices]
        
        for (let i = 0; i < generalPositions.length; i++) {
            const root = uf.find(i);
            if (!components.has(root)) {
                components.set(root, []);
            }
            components.get(root).push(i);
        }
        
        return Array.from(components.values());
    }
    
    scoreMountainRemoval(grid, x, y, generalPositions, components) {
        // Calculate how strategic this mountain is for connectivity
        let score = 0;
        
        const directions = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
        ];
        
        // Check if removing this mountain would connect different components
        const tempGrid = this.createTempGridWithMountainRemoved(grid, x, y);
        const connectedComponentsAfterRemoval = this.checkConnectionsAfterRemoval(
            tempGrid, generalPositions, x, y
        );
        
        // Huge bonus if this mountain connects previously disconnected components
        if (connectedComponentsAfterRemoval < components.length) {
            score += 1000; // Very high priority
        }
        
        // Check adjacent cells
        let emptyNeighbors = 0;
        let adjacentToGeneralComponent = false;
        const adjacentComponentsMap = new Map();
        
        for (const { dx, dy } of directions) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                // Check if this neighbor connects to any general's component
                const neighborConnectsToComponent = this.neighborConnectsToComponent(
                    grid, nx, ny, generalPositions, components
                );
                
                if (neighborConnectsToComponent.length > 0) {
                    adjacentToGeneralComponent = true;
                    
                    // Add all components this neighbor connects to
                    for (const compIndex of neighborConnectsToComponent) {
                        adjacentComponentsMap.set(compIndex, true);
                    }
                }
                
                if (grid[ny][nx].type !== 'mountain') {
                    emptyNeighbors++;
                    score += 1;
                }
            }
        }
        
        // Extra bonus for mountains adjacent to multiple different components
        const adjacentComponentsCount = adjacentComponentsMap.size;
        if (adjacentComponentsCount > 1) {
            score += adjacentComponentsCount * 100;
        } else if (adjacentToGeneralComponent) {
            score += 20;
        }
        
        // Mountains with more empty neighbors are better candidates
        score += emptyNeighbors * 5;
        
        // Calculate average distance to generals - prefer mountains closer to paths between generals
        score += this.calculateDistanceScore(x, y, generalPositions, components);
        
        return score;
    }
    
    createTempGridWithMountainRemoved(grid, x, y) {
        // Create a lightweight grid representation just for pathfinding
        const tempGrid = Array(this.height).fill().map(() => Array(this.width).fill(false));
        
        // Mark mountains as true (blocked)
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                tempGrid[y][x] = grid[y][x].type === 'mountain';
            }
        }
        
        // Remove the mountain we're testing
        tempGrid[y][x] = false;
        
        return tempGrid;
    }
    
    checkConnectionsAfterRemoval(tempGrid, generalPositions, removedX, removedY) {
        // Check how many disconnected components would exist after removing this mountain
        const uf = new UnionFind(generalPositions.length);
        
        // For each pair of generals, check if there's a path
        for (let i = 0; i < generalPositions.length; i++) {
            for (let j = i + 1; j < generalPositions.length; j++) {
                const hasPath = this.checkPathExists(
                    tempGrid,
                    generalPositions[i].x,
                    generalPositions[i].y,
                    generalPositions[j].x,
                    generalPositions[j].y
                );
                
                if (hasPath) {
                    uf.union(i, j);
                }
            }
        }
        
        return uf.count;
    }
    
    checkPathExists(tempGrid, startX, startY, targetX, targetY) {
        // BFS to check if path exists without using the full grid
        const visited = Array(this.height).fill().map(() => Array(this.width).fill(false));
        const queue = [{ x: startX, y: startY }];
        visited[startY][startX] = true;
        
        while (queue.length > 0) {
            const { x, y } = queue.shift();
            
            if (x === targetX && y === targetY) {
                return true;
            }
            
            const directions = [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 }
            ];
            
            for (const { dx, dy } of directions) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && 
                    !visited[ny][nx] && !tempGrid[ny][nx]) {
                    visited[ny][nx] = true;
                    queue.push({ x: nx, y: ny });
                }
            }
        }
        
        return false;
    }
    
    neighborConnectsToComponent(grid, x, y, generalPositions, components) {
        // Check if this position connects to any general's component
        if (grid[y][x].type === 'mountain') return [];
        
        const connectedComponents = [];
        
        // Do a small BFS from this position to see which generals it can reach
        const visited = Array(this.height).fill().map(() => Array(this.width).fill(false));
        const queue = [{ x, y }];
        visited[y][x] = true;
        
        while (queue.length > 0) {
            const { x: cx, y: cy } = queue.shift();
            
            // Check if this is a general position
            for (let i = 0; i < generalPositions.length; i++) {
                const gen = generalPositions[i];
                if (gen.x === cx && gen.y === cy) {
                    // Find which component this general belongs to
                    for (let c = 0; c < components.length; c++) {
                        if (components[c].includes(i) && !connectedComponents.includes(c)) {
                            connectedComponents.push(c);
                        }
                    }
                }
            }
            
            // Stop early if we've found connections to all components
            if (connectedComponents.length === components.length) break;
            
            // Continue BFS, but limit depth to avoid expensive computation
            if (queue.length > 10) continue;
            
            const directions = [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 }
            ];
            
            for (const { dx, dy } of directions) {
                const nx = cx + dx;
                const ny = cy + dy;
                
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && 
                    !visited[ny][nx] && grid[ny][nx].type !== 'mountain') {
                    visited[ny][nx] = true;
                    queue.push({ x: nx, y: ny });
                }
            }
        }
        
        return connectedComponents;
    }
    
    calculateDistanceScore(x, y, generalPositions, components) {
        let score = 0;
        
        // For each pair of generals in different components
        for (let i = 0; i < components.length; i++) {
            for (let j = i + 1; j < components.length; j++) {
                // Take the first general from each component as representative
                const gen1 = generalPositions[components[i][0]];
                const gen2 = generalPositions[components[j][0]];
                
                // Check if this mountain is on the path between these generals
                const onPath = this.isOnStraightLinePath(x, y, gen1.x, gen1.y, gen2.x, gen2.y);
                
                if (onPath) {
                    score += 50;
                }
                
                // Check proximity to the straight line between these generals
                const distToLine = this.pointDistanceToLine(
                    x, y, gen1.x, gen1.y, gen2.x, gen2.y
                );
                
                if (distToLine < 3) {
                    score += (3 - distToLine) * 15;
                }
            }
        }
        
        return score;
    }
    
    isOnStraightLinePath(x, y, x1, y1, x2, y2) {
        // Check if (x,y) is approximately on the straight line from (x1,y1) to (x2,y2)
        // using a threshold for proximity
        const d1 = Math.abs(x - x1) + Math.abs(y - y1);
        const d2 = Math.abs(x - x2) + Math.abs(y - y2);
        const lineLength = Math.abs(x1 - x2) + Math.abs(y1 - y2);
        
        // If point is within 1 unit of the straight line Manhattan distance
        return Math.abs(d1 + d2 - lineLength) <= 2;
    }
    
    pointDistanceToLine(x, y, x1, y1, x2, y2) {
        // Calculate Manhattan-based "distance" from point to line
        // Simplified for grid-based context
        const lineLength = Math.abs(x1 - x2) + Math.abs(y1 - y2);
        if (lineLength === 0) return Math.abs(x - x1) + Math.abs(y - y1);
        
        // Project point onto line
        const dot = (x - x1) * (x2 - x1) + (y - y1) * (y2 - y1);
        const projFactor = Math.max(0, Math.min(1, dot / (lineLength * lineLength)));
        
        // Calculate Manhattan distance to the projected point
        const projX = x1 + projFactor * (x2 - x1);
        const projY = y1 + projFactor * (y2 - y1);
        
        return Math.abs(x - projX) + Math.abs(y - projY);
    }
    
    createDirectPaths(grid, generalPositions, uf) {
        const components = this.findDisconnectedComponents(generalPositions, uf);
        
        // For each pair of disconnected components, create a direct path
        for (let i = 0; i < components.length; i++) {
            for (let j = i + 1; j < components.length; j++) {
                // Check if these components are not yet connected
                const gen1 = components[i][0]; // First general in component i
                const gen2 = components[j][0]; // First general in component j
                
                if (!uf.isConnected(gen1, gen2)) {
                    // Create a direct path between these generals
                    const pos1 = generalPositions[gen1];
                    const pos2 = generalPositions[gen2];
                    this.createDirectPath(grid, pos1.x, pos1.y, pos2.x, pos2.y);
                    
                    // Update union-find
                    uf.union(gen1, gen2);
                }
            }
        }
    }
    
    createDirectPath(grid, x1, y1, x2, y2) {
        // Create a direct path between two points using Bresenham's line algorithm
        const points = this.getBresenhamLine(x1, y1, x2, y2);
        
        // Clear all mountains on this direct path
        for (const { x, y } of points) {
            if (grid[y][x].type === 'mountain') {
                grid[y][x].type = 'empty';
                grid[y][x].owner = this.OWNER_EMPTY;
            }
        }
    }
    
    getBresenhamLine(x1, y1, x2, y2) {
        // Bresenham's line algorithm for grid-based line drawing
        const points = [];
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        
        while (true) {
            points.push({ x: x1, y: y1 });
            
            if (x1 === x2 && y1 === y2) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x1 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y1 += sy;
            }
        }
        
        return points;
    }
}

// Union-Find data structure for efficient connectivity tracking
class UnionFind {
    constructor(n) {
        this.parent = Array(n).fill().map((_, i) => i);
        this.size = Array(n).fill(1);
        this.count = n; // Number of disjoint sets
    }
    
    find(x) {
        if (this.parent[x] !== x) {
            this.parent[x] = this.find(this.parent[x]); // Path compression
        }
        return this.parent[x];
    }
    
    union(x, y) {
        const rootX = this.find(x);
        const rootY = this.find(y);
        
        if (rootX === rootY) return;
        
        // Union by size
        if (this.size[rootX] < this.size[rootY]) {
            this.parent[rootX] = rootY;
            this.size[rootY] += this.size[rootX];
        } else {
            this.parent[rootY] = rootX;
            this.size[rootX] += this.size[rootY];
        }
        
        this.count--; // Decrease the number of disjoint sets
    }
    
    isConnected(x, y) {
        return this.find(x) === this.find(y);
    }
    
    reset(n) {
        this.parent = Array(n).fill().map((_, i) => i);
        this.size = Array(n).fill(1);
        this.count = n;
    }
}
