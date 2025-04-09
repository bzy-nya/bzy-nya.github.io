// Enhanced AI for bullet dodging with optimized calculations

// Enhanced calculateEnergy with trajectory prediction and graze incentives
function calculateEnergy(bullet, x, y) {
    // Create a copy of the bullet to predict its next position
    const bullet_copy = { ...bullet };
    const deltaTime = game.performance.deltaTime / 1000.0;

    try {
        // Transform the bullet to get its next position
        bullet_copy.transform(bullet_copy, deltaTime);
        
        // Calculate distance between bullet and player position
        const d = dist(bullet_copy.x, bullet_copy.y, x, y) - bullet_copy.r;
        
        // Collision detection - maximum energy if collision would occur
        if (d <= GAME_CONSTANTS.PLAYER.COLLISION_RADIUS) {
            return GAME_CONSTANTS.AI.COLLISION_ENERGY;
        }
        
        // Calculate trajectory danger - how directly is bullet heading towards player?
        let trajectoryDanger = 0;
        // Only calculate for bullets that are actually moving
        if (bullet_copy.dx || bullet_copy.dy) {
            const bulletSpeed = Math.sqrt(bullet_copy.dx * bullet_copy.dx + bullet_copy.dy * bullet_copy.dy);
            if (bulletSpeed > 0) {
                // Calculate normalized bullet direction
                const normDx = bullet_copy.dx / bulletSpeed;
                const normDy = bullet_copy.dy / bulletSpeed;
                
                // Vector from bullet to player
                const vx = x - bullet_copy.x;
                const vy = y - bullet_copy.y;
                const distance = Math.sqrt(vx * vx + vy * vy);
                
                if (distance > 0) {
                    // Calculate normalized direction to player
                    const normVx = vx / distance;
                    const normVy = vy / distance;
                    
                    // Dot product tells us how aligned the bullet's direction is with the player's position
                    const dotProduct = normDx * normVx + normDy * normVy;
                    
                    // Higher danger for bullets heading straight at player
                    if (dotProduct > 0) {
                        // Scale by dot product (directness) and inverse square of distance
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
    } catch (e) {
        // If bullet transformation fails, consider it high energy to avoid
        console.error("Error in calculateEnergy:", e);
        return 1000;
    }
}

// Filter bullets that are unlikely to be a threat to save computation
function filterBullets(bullets, playerX, playerY, lookAheadFrames = 10) {
    const MAX_CONSIDERATION_DISTANCE = 350; // Maximum distance to consider bullets as threats
    const deltaTime = game.performance.deltaTime / 1000.0;
    
    if (!bullets || !bullets.length) return [];
    
    // Create a result array with preallocated capacity to avoid resizing
    const result = [];
    
    for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        if (!bullet || bullet.removed) continue;
        
        try {
            // Make a copy to avoid modifying the original
            const bullet_copy = { ...bullet };
            if (bullet_copy.transform) {
                bullet_copy.transform(bullet_copy, deltaTime);
            }
            
            // Calculate distance between bullet and player
            const d = dist(bullet_copy.x, bullet_copy.y, playerX, playerY) - bullet_copy.r;
            
            // If bullet is already close, always consider it a threat
            if (d < MAX_CONSIDERATION_DISTANCE * 0.5) {
                result.push(bullet);
                continue;
            }
            
            // For far away bullets, check if they're moving toward the player
            if (d > MAX_CONSIDERATION_DISTANCE) {
                // Skip stationary bullets that are far away
                if (!bullet_copy.dx && !bullet_copy.dy) continue;
                
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
                    
                    // Only consider bullets that are heading somewhat toward the player
                    // and are fast enough to potentially reach the player
                    if (dotProduct <= 0.3 || bulletSpeed * lookAheadFrames < d * 0.7) {
                        continue;
                    }
                }
            }
            
            // If we get here, the bullet is a potential threat
            result.push(bullet);
        } catch (e) {
            // Skip this bullet if there's an error processing it
            console.error("Error in filterBullets:", e);
        }
    }
    
    return result;
}

// Predict future positions of bullets for look-ahead planning
function predictBulletPositions(frames) {
    const predictions = [];
    // Start with filtered bullets to improve efficiency
    const player = game.scene.player;
    let currentBullets = filterBullets(game.scene.bullets, player.x, player.y, frames);
    
    if (!currentBullets.length) return predictions;
    
    const deltaTime = game.performance.deltaTime / 1000.0;
    
    // For each future frame
    for (let frame = 0; frame < frames; frame++) {
        const frameBullets = [];
        
        // Transform all bullets one step
        for (let i = 0; i < currentBullets.length; i++) {
            try {
                const bullet = currentBullets[i];
                const bulletCopy = { ...bullet };
                
                // Apply the bullet's transform function
                if (bulletCopy.transform) {
                    bulletCopy.transform(bulletCopy, deltaTime);
                    
                    // Keep bullet if it's still on screen
                    if (bulletCopy.x >= 0 && bulletCopy.x <= GAME_CONSTANTS.SCREEN.WIDTH && 
                        bulletCopy.y >= 0 && bulletCopy.y <= GAME_CONSTANTS.SCREEN.HEIGHT && 
                        !bulletCopy.removed) {
                        frameBullets.push(bulletCopy);
                    }
                }
            } catch (e) {
                // Skip this bullet if there's an error
                console.error("Error in predictBulletPositions:", e);
            }
        }
        
        // Store this frame's bullet positions
        predictions[frame] = frameBullets;
        // Update current bullets for next iteration
        currentBullets = frameBullets;
        
        // If we've lost all bullets, we can stop
        if (!currentBullets.length) break;
    }
    
    return predictions;
}

// Evaluate the total energy at a position considering all bullets
function evaluatePosition(x, y, bullets, timeWeight = 1.0) {
    if (!bullets || !bullets.length) return 0;
    
    // Use the filtered bullets directly if already filtered, otherwise filter them
    const relevantBullets = Array.isArray(bullets) ? 
        filterBullets(bullets, x, y) : bullets;
    
    if (!relevantBullets.length) return 0;
    
    let totalEnergy = 0;
    let maxSingleEnergy = 0;
    
    // Calculate energy for each bullet
    for (const bullet of relevantBullets) {
        const bulletEnergy = calculateEnergy(bullet, x, y);
        
        // Keep track of the maximum single bullet energy
        // This ensures we prioritize avoiding the most dangerous bullet
        maxSingleEnergy = Math.max(maxSingleEnergy, bulletEnergy);
        
        // Add to the total weighted energy
        totalEnergy += bulletEnergy;
    }
    
    // Blend total energy with max energy to balance between overall safety and avoiding the worst threat
    const blendedEnergy = 0.7 * maxSingleEnergy + 0.3 * (totalEnergy / relevantBullets.length);
    
    // Apply time weight (future frames are less important)
    return blendedEnergy * timeWeight;
}

// Function that updates player position based on AI logic
function updatePlayerAI() {
    // Get player reference and bullets
    const player = game.scene.player;
    const bullets = game.scene.bullets;
    
    // No need to do anything if there are no bullets
    if (!bullets || !bullets.length) return;
    
    const timeScale = game.performance.deltaTime / (1000/60);
    
    // Filter bullets once at the beginning of decision making
    const filteredBullets = filterBullets(bullets, player.x, player.y, 5);
    
    // If no threats, just stay in place
    if (!filteredBullets.length) return;
    
    // Define possible movement directions (8 directions + stay)
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
        x: player.x, 
        y: player.y, 
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
            const nx = check_range(player.x + dx, 0, GAME_CONSTANTS.SCREEN.WIDTH);
            const ny = check_range(player.y + dy, 0, GAME_CONSTANTS.SCREEN.HEIGHT);
            
            // Skip evaluation if we wouldn't actually move
            if (nx === player.x && ny === player.y && best_move.energy < Infinity) {
                return;
            }
            
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
                futureX = check_range(futureX + dx, 0, GAME_CONSTANTS.SCREEN.WIDTH);
                futureY = check_range(futureY + dy, 0, GAME_CONSTANTS.SCREEN.HEIGHT);
                
                if (frame < futureBullets.length && futureBullets[frame].length > 0) {
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
            const edgeDistance = Math.min(nx, GAME_CONSTANTS.SCREEN.WIDTH - nx, ny, GAME_CONSTANTS.SCREEN.HEIGHT - ny);
            if (edgeDistance < 30) {
                total_energy += (30 - edgeDistance) * 2;
            }
            
            // Very small bias toward center of playfield when safe
            const centerBias = 0.01 * (Math.abs(nx - GAME_CONSTANTS.SCREEN.WIDTH/2) + Math.abs(ny - GAME_CONSTANTS.SCREEN.HEIGHT/2));
            total_energy += centerBias;
            
            // Apply small discount for precise movement mode to prefer it in close situations
            if (isPrecise) {
                total_energy *= 0.95;
            }
            
            // Update best move if this is better or if it has the same energy but more graze opportunities
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
    player.x = best_move.x;
    player.y = best_move.y;
    player.precisionMode = best_move.precise;
}

// Export updatePlayerAI to the global scope
window.updatePlayerAI = updatePlayerAI;