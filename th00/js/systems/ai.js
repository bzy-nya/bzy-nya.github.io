// Enhanced AI for bullet dodging with optimized calculations
import { GAME_CONSTANTS } from '../core/config.js';
import { check_range, dist } from '../core/utils.js';

function getNormalizedMove(dx, dy, speed) {
    const scale = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
    return {
        dx: dx * speed * scale,
        dy: dy * speed * scale
    };
}

function measureClearance(x, y, bullets) {
    let minDistance = Infinity;
    for (const bullet of bullets) {
        const d = dist(bullet.x, bullet.y, x, y) - bullet.r;
        if (d < minDistance) {
            minDistance = d;
        }
    }
    return Number.isFinite(minDistance) ? minDistance : 9999;
}

function getAimQuality(x, y, enemies) {
    if (!enemies || !enemies.length) return 0;

    let bestQuality = 0;
    for (const enemy of enemies) {
        if (!enemy || enemy.removed) continue;

        const verticalDistance = Math.max(24, y - enemy.y);
        const horizontalError = Math.abs(x - enemy.x);
        const laneTolerance = enemy.isBoss ? 56 : 34;
        const alignment = Math.max(0, 1 - horizontalError / laneTolerance);
        if (alignment <= 0) continue;

        const proximityWeight = 1 / (1 + verticalDistance / 240);
        const priority = enemy.isBoss ? 1.55 : 1;
        const damagedWeight = 1 + (1 - enemy.hp / enemy.maxHp) * 0.35;
        const quality = alignment * proximityWeight * priority * damagedWeight;
        if (quality > bestQuality) {
            bestQuality = quality;
        }
    }

    return bestQuality;
}

function cloneBulletForSimulation(bullet) {
    const copy = { ...bullet };
    if (bullet.real_color) {
        copy.real_color = { ...bullet.real_color };
    }
    return copy;
}

function simulateBulletStep(bullet) {
    const copy = cloneBulletForSimulation(bullet);
    const transform = copy.simulationTransform || copy.transform;
    if (transform) {
        transform(copy);
    }
    return copy;
}

// Enhanced calculateEnergy with trajectory prediction and graze incentives
function calculateEnergy(bullet, x, y) {
    try {
        // Calculate distance between bullet and player position
        const d = dist(bullet.x, bullet.y, x, y) - bullet.r;
        
        // Collision detection - maximum energy if collision would occur
        if (d <= GAME_CONSTANTS.PLAYER.COLLISION_RADIUS + 2) {
            return GAME_CONSTANTS.AI.COLLISION_ENERGY;
        }
        
        // Calculate trajectory danger - how directly is bullet heading towards player?
        let trajectoryDanger = 0;
        // Only calculate for bullets that are actually moving
        if (bullet.dx || bullet.dy) {
            const bulletSpeed = Math.sqrt(bullet.dx * bullet.dx + bullet.dy * bullet.dy);
            if (bulletSpeed > 0) {
                // Calculate normalized bullet direction
                const normDx = bullet.dx / bulletSpeed;
                const normDy = bullet.dy / bulletSpeed;
                
                // Vector from bullet to player
                const vx = x - bullet.x;
                const vy = y - bullet.y;
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
        
        const safeDistance = Math.max(0.01, d);
        // Positive field: closer bullets must always be worse unless collision is impossible.
        let baseEnergy = GAME_CONSTANTS.AI.ENERGY_FACTOR_LINEAR / (safeDistance + 1) +
                         2200 / ((safeDistance + 8) * (safeDistance + 8));
        
        // Graze incentive: Negative energy (reward) for being in graze range but not collision range
        // This encourages the AI to get close to bullets without hitting them
        const GRAZE_INCENTIVE = 24; // Keep grazing far below survival and routing.
        let grazeReward = 0;
        
        // Optimal grazing distance is halfway between collision radius and graze radius
        const optimalGrazeDistance = (GAME_CONSTANTS.PLAYER.COLLISION_RADIUS + GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) / 2;
        
        if (d > GAME_CONSTANTS.PLAYER.COLLISION_RADIUS + 8 && d <= GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) {
            // Maximum reward at the optimal distance, decreasing as we move away from it
            const distanceFromOptimal = Math.abs(d - optimalGrazeDistance);
            const grazeRangeWidth = GAME_CONSTANTS.PLAYER.GRAZE_RADIUS - GAME_CONSTANTS.PLAYER.COLLISION_RADIUS;
            
            // Normalize to 0-1 range how close we are to optimal graze distance
            const grazeQuality = 1 - (distanceFromOptimal / (grazeRangeWidth / 2));
            
            // Apply the reward based on graze quality
            grazeReward = -GRAZE_INCENTIVE * Math.max(0, grazeQuality);
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
function filterBullets(bullets, playerX, playerY, lookAheadFrames = 10, simulateNextFrame = true) {
    const MAX_CONSIDERATION_DISTANCE = 350; // Maximum distance to consider bullets as threats
    
    if (!bullets || !bullets.length) return [];
    
    // Create a result array with preallocated capacity to avoid resizing
    const result = [];
    
    for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        if (!bullet || bullet.removed) continue;
        
        try {
            const bulletForCheck = simulateNextFrame ? simulateBulletStep(bullet) : bullet;
            
            // Calculate distance between bullet and player
            const d = dist(bulletForCheck.x, bulletForCheck.y, playerX, playerY) - bulletForCheck.r;
            
            // If bullet is already close, always consider it a threat
            if (d < MAX_CONSIDERATION_DISTANCE * 0.5) {
                result.push(bulletForCheck);
                continue;
            }
            
            // For far away bullets, check if they're moving toward the player
            if (d > MAX_CONSIDERATION_DISTANCE) {
                // Skip stationary bullets that are far away
                if (!bulletForCheck.dx && !bulletForCheck.dy) continue;
                
                // Vector from bullet to player
                const vx = playerX - bulletForCheck.x;
                const vy = playerY - bulletForCheck.y;
                const distance = Math.sqrt(vx * vx + vy * vy);
                
                // Calculate bullet direction and speed
                const bulletSpeed = Math.sqrt(bulletForCheck.dx * bulletForCheck.dx + bulletForCheck.dy * bulletForCheck.dy);
                if (bulletSpeed > 0) {
                    const normDx = bulletForCheck.dx / bulletSpeed;
                    const normDy = bulletForCheck.dy / bulletSpeed;
                    
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
            result.push(bulletForCheck);
        } catch (e) {
            // Skip this bullet if there's an error processing it
            console.error("Error in filterBullets:", e);
        }
    }
    
    return result;
}

// Predict future positions of bullets for look-ahead planning
function predictBulletPositions(gameState, frames) {
    const predictions = [];
    // Start with filtered bullets to improve efficiency
    const player = gameState.scene.player;
    let currentBullets = filterBullets(gameState.scene.bullets, player.x, player.y, frames, false);
    
    if (!currentBullets.length) return predictions;
    
    // For each future frame
    for (let frame = 0; frame < frames; frame++) {
        const frameBullets = [];
        
        // Transform all bullets one step
        for (let i = 0; i < currentBullets.length; i++) {
            try {
                const bullet = currentBullets[i];
                const bulletCopy = simulateBulletStep(bullet);
                
                // Keep bullet if it's still on screen
                if (bulletCopy.x >= 0 && bulletCopy.x <= GAME_CONSTANTS.SCREEN.WIDTH && 
                    bulletCopy.y >= 0 && bulletCopy.y <= GAME_CONSTANTS.SCREEN.HEIGHT && 
                    !bulletCopy.removed) {
                    frameBullets.push(bulletCopy);
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
function evaluatePosition(x, y, bullets, frameWeight = 1.0, alreadyPredicted = false) {
    if (!bullets || !bullets.length) return 0;
    
    const relevantBullets = alreadyPredicted ? bullets : filterBullets(bullets, x, y, 10, true);
    
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
    
    return blendedEnergy * frameWeight;
}

// Function that updates player position based on AI logic
export function updatePlayerAI(gameState) {
    // Get player reference and bullets
    const player = gameState.scene.player;
    const bullets = gameState.scene.bullets;
    const enemies = gameState.scene.enemies.filter((enemy) => !enemy.removed);
    
    // No need to do anything if there are no bullets
    if (!bullets || !bullets.length) return;
    
    // Filter bullets once at the beginning of decision making
    const filteredBullets = filterBullets(bullets, player.x, player.y, 5, true);
    
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
        grazeOpportunities: 0,
        clearance: -Infinity
    };
    
    // Predict bullet positions for the next few frames
    const LOOK_AHEAD_FRAMES = 5;
    const futureBullets = predictBulletPositions(gameState, LOOK_AHEAD_FRAMES);

    const initialCandidates = [];

    // Evaluate all candidate moves
    directions.forEach(dir => {
        // Try both normal and precise movement for each direction
        [false, true].forEach(isPrecise => {
            // Calculate speed based on movement mode
            const speed = isPrecise ? 
                GAME_CONSTANTS.PLAYER.PRECISE_SPEED : 
                GAME_CONSTANTS.PLAYER.NORMAL_SPEED;
            
            // Calculate move vector
            const move = getNormalizedMove(dir.dx, dir.dy, speed);
            const dx = move.dx;
            const dy = move.dy;
            
            // Calculate new position
            const nx = check_range(player.x + dx, 0, GAME_CONSTANTS.SCREEN.WIDTH);
            const ny = check_range(player.y + dy, 0, GAME_CONSTANTS.SCREEN.HEIGHT);
            
            // Skip evaluation if we wouldn't actually move
            if (nx === player.x && ny === player.y && best_move.energy < Infinity) {
                return;
            }
            
            // Start with current frame energy - use filtered bullets
            let total_energy = evaluatePosition(nx, ny, filteredBullets, 1, true);
            
            // Count potential graze opportunities
            let grazeOpportunities = 0;
            for (const bullet of filteredBullets) {
                const d = dist(bullet.x, bullet.y, nx, ny) - bullet.r;
                if (d > GAME_CONSTANTS.PLAYER.COLLISION_RADIUS && 
                    d <= GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) {
                    grazeOpportunities++;
                }
            }

            const clearance = measureClearance(nx, ny, filteredBullets);
            const aimQuality = getAimQuality(nx, ny, enemies);
            
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

            if (clearance > GAME_CONSTANTS.PLAYER.GRAZE_RADIUS * 1.35) {
                total_energy -= aimQuality * 58;
            }

            initialCandidates.push({
                x: nx,
                y: ny,
                dx,
                dy,
                dir,
                precise: isPrecise,
                grazeOpportunities,
                energy: total_energy,
                clearance,
                aimQuality
            });
        });
    });

    initialCandidates.sort((a, b) => {
        if (Math.abs(a.energy - b.energy) > 1e-6) return a.energy - b.energy;
        return b.clearance - a.clearance;
    });

    const topCandidates = initialCandidates.slice(0, 6);
    topCandidates.forEach((candidate) => {
        let total_energy = candidate.energy;
        let grazeOpportunities = candidate.grazeOpportunities;
        let futureX = candidate.x;
        let futureY = candidate.y;
        let bestFutureClearance = candidate.clearance;
        let bestAimQuality = candidate.aimQuality;

        for (let frame = 0; frame < LOOK_AHEAD_FRAMES; frame++) {
            const futurePrecision = candidate.precise || bestFutureClearance < GAME_CONSTANTS.PLAYER.GRAZE_RADIUS * 1.4;
            const futureSpeed = futurePrecision ? GAME_CONSTANTS.PLAYER.PRECISE_SPEED : GAME_CONSTANTS.PLAYER.NORMAL_SPEED;
            const futureMove = getNormalizedMove(candidate.dir.dx, candidate.dir.dy, futureSpeed);
            futureX = check_range(futureX + futureMove.dx, 0, GAME_CONSTANTS.SCREEN.WIDTH);
            futureY = check_range(futureY + futureMove.dy, 0, GAME_CONSTANTS.SCREEN.HEIGHT);

            if (frame < futureBullets.length && futureBullets[frame].length > 0) {
                const frameWeight = Math.pow(0.78, frame + 1);
                total_energy += evaluatePosition(futureX, futureY, futureBullets[frame], frameWeight, true);
                const futureClearance = measureClearance(futureX, futureY, futureBullets[frame]);
                bestFutureClearance = Math.min(bestFutureClearance, futureClearance);
                total_energy -= Math.min(futureClearance, 24) * 0.65;
                const futureAimQuality = getAimQuality(futureX, futureY, enemies);
                bestAimQuality = Math.max(bestAimQuality, futureAimQuality);
                if (futureClearance > GAME_CONSTANTS.PLAYER.GRAZE_RADIUS * 1.5) {
                    total_energy -= futureAimQuality * 24 * frameWeight;
                }

                for (const bullet of futureBullets[frame]) {
                    const d = dist(bullet.x, bullet.y, futureX, futureY) - bullet.r;
                    if (d > GAME_CONSTANTS.PLAYER.COLLISION_RADIUS && d <= GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) {
                        grazeOpportunities += 0.2;
                    }
                }
            }
        }

        if (candidate.precise && bestFutureClearance > GAME_CONSTANTS.PLAYER.GRAZE_RADIUS * 1.8) {
            total_energy += 22;
        }

        if (
            total_energy < best_move.energy ||
            (Math.abs(total_energy - best_move.energy) < 1e-6 && bestFutureClearance > best_move.clearance) ||
            (
                Math.abs(total_energy - best_move.energy) < 1e-6 &&
                Math.abs(bestFutureClearance - best_move.clearance) < 1e-6 &&
                grazeOpportunities > best_move.grazeOpportunities
            )
        ) {
            best_move = {
                x: candidate.x,
                y: candidate.y,
                energy: total_energy,
                precise: candidate.precise,
                grazeOpportunities,
                clearance: bestFutureClearance,
                aimQuality: bestAimQuality
            };
        }
    });
    
    // Apply the best move
    player.x = best_move.x;
    player.y = best_move.y;
    player.precisionMode = best_move.precise;
}
