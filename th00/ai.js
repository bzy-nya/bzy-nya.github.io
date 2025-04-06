// Enhanced calculateEnergy with trajectory prediction and graze incentives
function calculateEnergy(bullet, x, y) {
    const bullet_copy = { ...bullet };
    bullet_copy.transform(bullet_copy);
    
    const d = dist(bullet_copy.x, bullet_copy.y, x, y) - bullet_copy.r;
    
    // Avoid division by zero or negative values - collision is maximum energy
    if (d <= GAME_CONSTANTS.PLAYER.COLLISION_RADIUS) {
        return GAME_CONSTANTS.AI.COLLISION_ENERGY;
    }
    
    // Calculate trajectory danger - how directly is bullet heading towards player?
    let trajectoryDanger = 0;
    if (bullet_copy.dx || bullet_copy.dy) {
        // Calculate bullet direction
        const bulletSpeed = Math.sqrt(bullet_copy.dx * bullet_copy.dx + bullet_copy.dy * bullet_copy.dy);
        if (bulletSpeed > 0) {
            const normDx = bullet_copy.dx / bulletSpeed;
            const normDy = bullet_copy.dy / bulletSpeed;
            
            // Vector from bullet to player
            const vx = x - bullet_copy.x;
            const vy = y - bullet_copy.y;
            const distance = Math.sqrt(vx * vx + vy * vy);
            
            if (distance > 0) {
                const normVx = vx / distance;
                const normVy = vy / distance;
                const dotProduct = normDx * normVx + normDy * normVy;
                
                // Higher danger for bullets heading straight at player
                if (dotProduct > 0) {
                    // Scale danger by dot product (directness) and distance
                    trajectoryDanger = dotProduct * 800 / (d * d + 1);
                }
            }
        }
    }
    
    // Base energy calculation using distance
    let baseEnergy = GAME_CONSTANTS.AI.ENERGY_FACTOR_LINEAR / d + 
                     Math.exp(GAME_CONSTANTS.AI.ENERFG_EXP / d) / 30;
    
    // Graze incentive: Negative energy (reward) for being in graze range but not collision range
    // This encourages the AI to get close to bullets without hitting them
    const GRAZE_INCENTIVE = 300; // Strength of graze incentive
    let grazeReward = 0;
    
    // Optimal grazing distance is halfway between collision radius and graze radius
    const optimalGrazeDistance = (GAME_CONSTANTS.PLAYER.COLLISION_RADIUS + GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) / 2;
    
    if (d > GAME_CONSTANTS.PLAYER.COLLISION_RADIUS && d <= GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) {
        // Maximum reward at the optimal distance, decreasing as we move away from it
        const distanceFromOptimal = Math.abs(d - optimalGrazeDistance);
        const grazeRangeWidth = GAME_CONSTANTS.PLAYER.GRAZE_RADIUS - GAME_CONSTANTS.PLAYER.COLLISION_RADIUS;
        
        // Normalize to 0-1 range how close we are to optimal graze distance
        const grazeQuality = 1 - (distanceFromOptimal / (grazeRangeWidth / 2));
        
        // Apply the reward based on graze quality
        grazeReward = -GRAZE_INCENTIVE * grazeQuality;
    }
    
    // Return combined energy value - lower is better
    return baseEnergy + trajectoryDanger + grazeReward;
}

// Filter bullets that are unlikely to be a threat to the player
function filterBullets(bullets, playerX, playerY, lookAheadFrames = 10) {
    const MAX_CONSIDERATION_DISTANCE = 350; // Maximum distance to consider bullets as threats
    
    return bullets.filter(bullet => {
        const bullet_copy = { ...bullet };
        if (bullet_copy.transform) {
            bullet_copy.transform(bullet_copy);
        }
        
        // Calculate distance between bullet and player
        const d = dist(bullet_copy.x, bullet_copy.y, playerX, playerY) - bullet_copy.r;
        
        // If bullet is already very close, always consider it
        if (d < MAX_CONSIDERATION_DISTANCE * 0.5) {
            return true;
        }
        
        // If bullet is far away, check if it's moving toward player and fast enough
        if (d > MAX_CONSIDERATION_DISTANCE) {
            // If bullet doesn't move, it's not a threat if it's far
            if (!bullet_copy.dx && !bullet_copy.dy) {
                return false;
            }
            
            // Vector from bullet to player
            const vx = playerX - bullet_copy.x;
            const vy = playerY - bullet_copy.y;
            const distance = Math.sqrt(vx * vx + vy * vy);
            
            // Calculate bullet direction and speed
            const bulletSpeed = Math.sqrt(bullet_copy.dx * bullet_copy.dx + bullet_copy.dy * bullet_copy.dy);
            if (bulletSpeed > 0) {
                const normDx = bullet_copy.dx / bulletSpeed;
                const normDy = bullet_copy.dy / bulletSpeed;
                
                const normVx = vx / distance;
                const normVy = vy / distance;
                
                // Dot product tells us if bullet is heading toward player
                const dotProduct = normDx * normVx + normDy * normVy;
                
                // If not heading toward player or too slow to reach within timeframe, ignore
                if (dotProduct <= 0.3 || bulletSpeed * lookAheadFrames < d * 0.7) {
                    return false;
                }
            }
        }
        
        return true;
    });
}

// Predict future positions of bullets to enable look-ahead planning
function predictBulletPositions(frames) {
    const predictions = [];
    // Start with filtered bullets to improve efficiency
    let currentBullets = filterBullets(game.bullets, game.player.x, game.player.y, frames);
    
    // For each future frame
    for (let frame = 0; frame < frames; frame++) {
        // Transform all bullets one step
        currentBullets = currentBullets.map(bullet => {
            const bulletCopy = { ...bullet };
            // Apply the bullet's transform function if it exists
            return bulletCopy.transform ? bulletCopy.transform(bulletCopy) : bulletCopy;
        }).filter(b => {
            // Remove bullets that would be off-screen
            return b.x >= 0 && b.x <= SCREEN_WIDTH && 
                   b.y >= 0 && b.y <= SCREEN_HEIGHT && 
                   !b.removed;
        });
        
        // Store this frame's bullet positions
        predictions[frame] = currentBullets;
    }
    
    return predictions;
}

// Evaluate the total energy at a position considering all bullets
function evaluatePosition(x, y, bullets, timeWeight = 1.0) {
    if (!bullets || bullets.length === 0) return 0;
    
    // Filter bullets first for efficiency
    const relevantBullets = Array.isArray(bullets) === true ? 
        filterBullets(bullets, x, y) : bullets;
    
    let totalEnergy = 0;
    for (const bullet of relevantBullets) {
        const bulletEnergy = calculateEnergy(bullet, x, y);
        totalEnergy += bulletEnergy * timeWeight;
    }
    return totalEnergy;
}

// Completely redesigned AI player movement with improved strategy
function updatePlayerAI() {
    const timeScale = game.performance.deltaTime / (1000/60);
    
    // Filter bullets once at the beginning of decision making
    const filteredBullets = filterBullets(game.bullets, game.player.x, game.player.y, 5);
    
    // More efficient way to define candidate moves - use 8 directions + stay
    const directions = [
        {dx: 0, dy: 0},      // Stay
        {dx: 1, dy: 0},      // Right
        {dx: -1, dy: 0},     // Left
        {dx: 0, dy: 1},      // Down
        {dx: 0, dy: -1},     // Up
        {dx: 1, dy: 1},      // Down-Right
        {dx: -1, dy: 1},     // Down-Left
        {dx: 1, dy: -1},     // Up-Right
        {dx: -1, dy: -1}     // Up-Left
    ];
    
    // Initialize best move with current position and highest possible energy
    let best_move = { 
        x: game.player.x, 
        y: game.player.y, 
        energy: Infinity, 
        precise: false, 
        grazeOpportunities: 0 
    };
    
    // Predict bullet positions for the next few frames
    const LOOK_AHEAD_FRAMES = 3;
    const futureBullets = predictBulletPositions(LOOK_AHEAD_FRAMES);
    
    // Evaluate all candidate moves
    directions.forEach(dir => {
        // Try both normal and precise movement for each direction
        [false, true].forEach(isPrecise => {
            // Calculate speed based on movement mode
            const speed = isPrecise ? 
                GAME_CONSTANTS.PLAYER.PRECISE_SPEED : 
                GAME_CONSTANTS.PLAYER.NORMAL_SPEED;
            
            // Calculate move vector
            const dx = dir.dx * speed * timeScale;
            const dy = dir.dy * speed * timeScale;
            
            // Calculate new position
            const nx = check_range(game.player.x + dx, 0, SCREEN_WIDTH);
            const ny = check_range(game.player.y + dy, 0, SCREEN_HEIGHT);
            
            // Start with current frame energy - use filtered bullets
            let total_energy = evaluatePosition(nx, ny, filteredBullets);
            
            // Count potential graze opportunities
            let grazeOpportunities = 0;
            for (const bullet of filteredBullets) {
                const d = dist(bullet.x, bullet.y, nx, ny) - bullet.r;
                if (d > GAME_CONSTANTS.PLAYER.COLLISION_RADIUS && 
                    d <= GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) {
                    grazeOpportunities++;
                }
            }
            
            // Project future positions and energy
            let futureX = nx;
            let futureY = ny;
            
            // Simulate continued movement in the same direction
            for (let frame = 0; frame < LOOK_AHEAD_FRAMES; frame++) {
                // Project position with continued movement
                futureX = check_range(futureX + dx, 0, SCREEN_WIDTH);
                futureY = check_range(futureY + dy, 0, SCREEN_HEIGHT);
                
                if (frame < futureBullets.length) {
                    // Discount future frames (less important than immediate danger)
                    const timeWeight = Math.pow(0.8, frame + 1);
                    total_energy += evaluatePosition(futureX, futureY, futureBullets[frame], timeWeight);
                    
                    // Count additional future graze opportunities
                    for (const bullet of futureBullets[frame]) {
                        const d = dist(bullet.x, bullet.y, futureX, futureY) - bullet.r;
                        if (d > GAME_CONSTANTS.PLAYER.COLLISION_RADIUS && 
                            d <= GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) {
                            grazeOpportunities += 0.2; // Count future opportunities less
                        }
                    }
                }
            }
            
            // Add small penalty for staying still to encourage movement
            if (dx === 0 && dy === 0) {
                total_energy += 50;
            }
            
            // Avoid screen edges slightly
            const edgeDistance = Math.min(nx, SCREEN_WIDTH - nx, ny, SCREEN_HEIGHT - ny);
            if (edgeDistance < 30) {
                total_energy += (30 - edgeDistance) * 2;
            }
            
            // Very small bias toward center of playfield when safe
            const centerBias = 0.01 * (Math.abs(nx - SCREEN_WIDTH/2) + Math.abs(ny - SCREEN_HEIGHT/2));
            total_energy += centerBias;
            
            // Apply small discount for precise movement mode to prefer it in close situations
            if (isPrecise) {
                total_energy *= 0.95;
            }
            
            // Update best move if this is better
            if (total_energy < best_move.energy || 
                (Math.abs(total_energy - best_move.energy) < 1e-6 && grazeOpportunities > best_move.grazeOpportunities)) {
                best_move = { 
                    x: nx, 
                    y: ny, 
                    energy: total_energy, 
                    precise: isPrecise, 
                    grazeOpportunities: grazeOpportunities 
                };
            }
        });
    });
    
    // Apply the best move
    game.player.x = best_move.x;
    game.player.y = best_move.y;
    game.player.isShift = best_move.precise;
}

window.updatePlayerAI = updatePlayerAI;