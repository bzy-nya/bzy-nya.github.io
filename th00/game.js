// Game constants
const SCREEN_WIDTH = 600;
const SCREEN_HEIGHT = 800;
// Add graze cooldown constant (in milliseconds)
const GRAZE_COOLDOWN = 1000; // 1 second cooldown between grazes

// Game mechanics constants
const GAME_CONSTANTS = {
  // Player constants
  PLAYER: {
    NORMAL_SPEED: 4,
    PRECISE_SPEED: 1,
    HITBOX_RADIUS: 3,
    GRAZE_RADIUS: 12,
    COLLISION_RADIUS: 3,
  },
  
  // AI constants
  AI: {
    COLLISION_ENERGY: 1e18,
    ENERGY_FACTOR_LINEAR: -16,
    ENERFG_EXP: 32
  },
  
  // Input constants
  INPUT: {
    GAMEPAD_DEADZONE: 0.2
  },
};

// Core game object that encapsulates all game state
const game = {
  // Game state
  bullets: [{x: 0, y: 0, dx: 0, dy: 0, r: 0, color:"#ffffff", removed: false}],
  player: {
    x: SCREEN_WIDTH / 2,
    y: SCREEN_HEIGHT * 9 / 10,
    isShift: false
  },
  mode: 1,
  graze: 0,
  
  // Settings
  settings: {
    observer: false,
    autoplay: false,
    inputMode: "keyboard",
    visualGrazeFeedback: true // Enable visual feedback for grazes
  },
  
  // Performance
  performance: {
    fps: 0,
    frameCount: 0,
    startTime: 0,
    requestId: 0,
    lastFrameTime: 0,
    deltaTime: 0, // Time in ms since last frame
    gameTime: 0,  // Total elapsed game time in ms
    fpsHistory: [], // Array to store frame times for moving average
    fpsUpdateInterval: 500, // Update FPS display every 500ms
    lastFpsUpdateTime: 0
  },
  
  // Initialize/reset game
  init: function(context) {
    // Store canvas context
    this.context = context;
    
    // Reset game state
    this.bullets = [];
    this.player.x = SCREEN_WIDTH / 2;
    this.player.y = SCREEN_HEIGHT * 9 / 10;
    this.player.isShift = false;
    this.graze = 0;
    this.bulletAccumulator = 0; // Reset bullet accumulator
    
    // Reset performance metrics
    this.performance.frameCount = 0;
    this.performance.gameTime = 0;
    this.performance.lastFrameTime = performance.now();
    this.performance.deltaTime = 0;
    this.performance.startTime = performance.now();
    
    // Start game loop
    this.performance.requestId = requestAnimationFrame(t => main_loop(t));
  },

  // Stop the game
  stop: function() {
    cancelAnimationFrame(this.performance.requestId);
  }
};

// Helper functions
function bullet_move(bullet) {
    const timeScale = game.performance.deltaTime / (1000 / 60); // Normalize to 60fps
    bullet.x += bullet.dx * timeScale; 
    bullet.y += bullet.dy * timeScale;
    return bullet;
}

function sqr(x) { return x * x; }

function dist(x1, y1, x2, y2) {
    return Math.sqrt(sqr(Math.abs(x1-x2)) + sqr(Math.abs(y1-y2)));
}

function random_int(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); 
}

function check_range(v, l, r) {
    if (v > r) return r;
    if (v < l) return l;
    return v;
}

// Bullet templates and generators
const bullet_template = {
    small:   {r: 3 , color:"Cyan", transform: bullet_move, lastGrazed: 0},
    big:     {r: 15, color:"Cyan", transform: bullet_move, lastGrazed: 0},
    gravity: {r: 3 , color:"Cyan", lastGrazed: 0,
        transform: (bullet) => {
            // Gravity acceleration is now from constants
            const timeScale = game.performance.deltaTime / (1000 / 60);
            bullet.dy += 0.06 * timeScale;
            return bullet_move(bullet);
        } 
    },
    colorful: {r:5, color:"Cyan", real_color: {r:0, g:255, b:255}, lastGrazed: 0,
        transform: (bullet) => {
            const dr = random_int(-10, 10);
            const dg = random_int(-10, 10);
            const db = random_int(-10, 10);
            bullet.real_color = {
                r: check_range(bullet.real_color.r + dr, 0, 255),
                g: check_range(bullet.real_color.g + dg, 0, 255),
                b: check_range(bullet.real_color.b + db, 0, 255)
            }
            bullet.color = `rgb(${bullet.real_color.r},${bullet.real_color.g},${bullet.real_color.g})`;
            return bullet_move(bullet);
        }
    }
};

function generate_random_location(bullet) {
    bullet.x = Math.random() * SCREEN_WIDTH;
    bullet.y = Math.random() * 10;
    return bullet;
}

function generate_bullet_1(bullet, cnt) {
    bullet = generate_random_location(bullet);

    if(Math.random() > 0.6) {
        bullet.dx = (game.player.x - bullet.x) * 0.012;
        bullet.dy = (game.player.y - bullet.y) * 0.012;
    } else {
        bullet.dx = (Math.random() > 0.5 ? 1 : -1) * Math.random() * 2.8;
        bullet.dy = Math.random() * 5.6;
    }

    return bullet;
}

function generate_bullet_2(bullet, cnt) {
    bullet = generate_random_location(bullet);

    bullet.dx = (Math.random() > 0.5 ? 1 : -1 ) * Math.random() * 2.8;
    bullet.dy = Math.random() * 5.6;

    return bullet;
}

function generate_bullet_3(bullet, cnt) {
    bullet = generate_random_location(bullet);

    const qx = game.player.x + (Math.random() > 0.5 ? 1 : -1) * Math.random() * 55.5;
    const qy = game.player.y + (Math.random() > 0.5 ? 1 : -1) * Math.random() * 55.5;
    bullet.dx = (qx - bullet.x) * 0.009;
    bullet.dy = (qy - bullet.y) * 0.009;

    return bullet;
}

function generate_bullet_4(bullet, cnt) {
    bullet = generate_random_location(bullet);

    bullet.dx = 0;
    bullet.dy = Math.random() * 7.2;

    return bullet;
}

function generate_bullet_5(bullet, cnt) {
    bullet.x = 300;
    bullet.y = 300;
    // Use gameTime (in ms) instead of frameCount for consistent experience across refresh rates
    const angle = Math.PI / 24000 * game.performance.gameTime * game.performance.gameTime / 400 + Math.PI / 4 * cnt;
    bullet.dx = 3 * Math.cos(angle);
    bullet.dy = 3 * Math.sin(angle);

    return bullet;
}

function generate_bullet_6(bullet, cnt) {
    bullet.x = 300;
    bullet.y = 200;
    bullet.dx = (Math.random() > 0.5 ? 1 : -1 ) * Math.random() * 2.8;
    bullet.dy = -Math.random() * 5.6;

    return bullet;
}

function generate_bullet_7(bullet, cnt) {
    bullet = generate_random_location(bullet);

    bullet.dx = (Math.random() > 0.5 ? 1 : -1 ) * Math.random() * 2.8;
    bullet.dy = Math.random() * 5.6;

    return bullet;
}

// Game modes configuration
const mode_meta = [
    {},
    {bullet_limit: 80    , bullet_per_second: 60,  generator: generate_bullet_1, bullet_templates: [bullet_template.small]},
    {bullet_limit: 200   , bullet_per_second: 240, generator: generate_bullet_2, bullet_templates: [bullet_template.small, bullet_template.big] },
    {bullet_limit: 120   , bullet_per_second: 60,  generator: generate_bullet_3, bullet_templates: [bullet_template.small] },
    {bullet_limit: 200   , bullet_per_second: 240, generator: generate_bullet_4, bullet_templates: [bullet_template.small] },
    {bullet_limit: 10000 , bullet_per_second: 480, generator: generate_bullet_5, bullet_templates: [bullet_template.small] },
    {bullet_limit: 500   , bullet_per_second: 240, generator: generate_bullet_6, bullet_templates: [bullet_template.gravity] },
    {bullet_limit: 200   , bullet_per_second: 120, generator: generate_bullet_7, bullet_templates: [bullet_template.colorful] },
];

// Drawing functions
function draw(bullet) {  
    game.context.beginPath();
    game.context.fillStyle = bullet.color;
    game.context.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    game.context.fill();
} 

function cls() {
    game.context.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

// Game Loop Functions
function updateGameState(current_time) {
    // Calculate delta time with a reasonable maximum to handle tab switching/sleep
    const rawDeltaTime = current_time - game.performance.lastFrameTime;
    // Cap deltaTime to 100ms (10 FPS minimum) to avoid huge jumps after tab switching
    game.performance.deltaTime = Math.min(rawDeltaTime, 100);
    game.performance.lastFrameTime = current_time;
    game.performance.gameTime += game.performance.deltaTime;
    
    // Initialize startTime on first frame
    if (game.performance.frameCount === 0) {
        game.performance.startTime = current_time;
        game.performance.lastFpsUpdateTime = current_time;
    }
    
    // Record current frame time in our history (maintain a history of last 120 frames)
    const MAX_FPS_SAMPLES = 120; // 2 seconds at 60fps
    
    // Add current frame time
    game.performance.fpsHistory.push({
        timestamp: current_time,
        deltaTime: game.performance.deltaTime
    });
    
    // Remove old samples
    if (game.performance.fpsHistory.length > MAX_FPS_SAMPLES) {
        game.performance.fpsHistory.shift();
    }
    
    // Calculate FPS based on moving average
    let fps = 60; // Default to 60 if not enough data
    
    if (game.performance.fpsHistory.length >= 2) {
        // Get total time span and count frames in our sample window
        const oldestSample = game.performance.fpsHistory[0];
        const timeSpan = current_time - oldestSample.timestamp;
        const numFrames = game.performance.fpsHistory.length - 1; // -1 because we're measuring time spans
        
        if (timeSpan > 0) {
            fps = 1000 * numFrames / timeSpan;
        }
    }
    
    // Apply light smoothing to avoid jumpy display
    const smoothingFactor = 0.9; // 90% old value, 10% new value
    game.performance.fps = game.performance.fps === 0
        ? fps 
        : (game.performance.fps * smoothingFactor) + (fps * (1 - smoothingFactor));
    
    // Increment frame counter
    game.performance.frameCount++;
    
    // Return current FPS for UI updates
    return game.performance.fps;
}

function generateBullets() {
    const { bullet_limit, bullet_per_second, generator, bullet_templates } = mode_meta[game.mode];
    
    // Calculate how many bullets to generate based on time elapsed
    // deltaTime is in milliseconds, so we divide by 1000 to get seconds
    const bulletsToGenerate = bullet_per_second * game.performance.deltaTime / 1000;
    
    // Use a fractional accumulator to handle partial bullets
    game.bulletAccumulator = (game.bulletAccumulator || 0) + bulletsToGenerate;
    
    // Generate whole bullets and keep track of the fractional part
    let count = Math.floor(game.bulletAccumulator);
    game.bulletAccumulator -= count;
    
    // Limit bullet generation in case of lag spikes (max 3x normal rate)
    count = Math.min(count, Math.ceil(bullet_per_second / 20));
    
    while(game.bullets.length < bullet_limit && count > 0) {
        const template_index = random_int(0, bullet_templates.length - 1);
        const new_bullet = { ...bullet_templates[template_index] };
        game.bullets.push(generator(new_bullet, count));
        count--;
    }
}

// Process bullet movement and collision detection with graze cooldown
function updateBullets() {
    let game_over = false;
    let gameOverPosition = { x: 0, y: 0 };  // Store position for game over effect
    const currentTime = performance.now();
    
    game.bullets.forEach(bullet_now => {
        bullet_now = bullet_now.transform(bullet_now);
        
        const { x, y, r } = bullet_now;
        
        // Remove bullets that go off-screen
        if(x < 0 || x > SCREEN_WIDTH || y < 0 || y > SCREEN_HEIGHT) {
            bullet_now.removed = true;
        }
        
        // Check collisions with player
        if(!game.settings.observer) {
            const playerDist = dist(x, y, game.player.x, game.player.y) - r;
            if(playerDist <= GAME_CONSTANTS.PLAYER.COLLISION_RADIUS) {
                game_over = true;
                gameOverPosition = { x: game.player.x, y: game.player.y };
            }
            
            // Enhanced graze detection with cooldown
            if(playerDist <= GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) {
                // Initialize lastGrazed if it doesn't exist
                if (typeof bullet_now.lastGrazed === 'undefined') {
                    bullet_now.lastGrazed = 0;
                }
                
                // Check if this bullet can register a new graze
                if (currentTime - bullet_now.lastGrazed >= GRAZE_COOLDOWN) {
                    game.graze++;
                    bullet_now.lastGrazed = currentTime;
                    
                    // Trigger visual effect for graze
                    if (game.settings.visualGrazeFeedback && typeof showGrazeEffect === 'function') {
                        showGrazeEffect(x, y, bullet_now.color);
                    }
                }
            }
        }
        
        draw(bullet_now);
    });
    
    // Remove bullets marked for deletion
    game.bullets = game.bullets.filter(bullet_now => !bullet_now.removed);
    
    return { game_over, position: gameOverPosition };
}

// Calculate "energy" from a bullet at a position (for AI)
function calculateEnergy(bullet, x, y) {
    // Create a deep copy of the bullet to avoid modifying the original
    const bullet_copy = { ...bullet };
    bullet_copy.transform(bullet_copy);
    
    const d = dist(bullet_copy.x, bullet_copy.y, x, y) - bullet_copy.r;
    
    // Avoid division by zero or negative values
    if (d <= GAME_CONSTANTS.PLAYER.COLLISION_RADIUS) {
        return GAME_CONSTANTS.AI.COLLISION_ENERGY;
    }
    
    // Enhanced energy calculation with better distance weighting
    return GAME_CONSTANTS.AI.ENERGY_FACTOR_LINEAR / d + Math.exp(GAME_CONSTANTS.AI.ENERFG_EXP / d) / 30;
}

// Update player position using AI in autoplay mode
function updatePlayerAI() {
    const timeScale = game.performance.deltaTime / (1000 / 60);
    // Use two movement patterns (normal and precise) with correct constant names
    const normal_move = [
        -GAME_CONSTANTS.PLAYER.NORMAL_SPEED * timeScale, 
        0, 
        GAME_CONSTANTS.PLAYER.NORMAL_SPEED * timeScale
    ];
    const precise_move = [
        -GAME_CONSTANTS.PLAYER.PRECISE_SPEED * timeScale, 
        0, 
        GAME_CONSTANTS.PLAYER.PRECISE_SPEED * timeScale
    ];
    
    let best_move = { x: game.player.x, y: game.player.y, energy: Infinity, precise: false };
    
    // Try normal movement first
    for(let dx of normal_move) {
        for(let dy of normal_move) {
            const nx = check_range(game.player.x + dx, 0, SCREEN_WIDTH);
            const ny = check_range(game.player.y + dy, 0, SCREEN_HEIGHT);
            
            // Calculate energy with safeguards against NaN
            let total_energy = 0;
            
            // Check each bullet and calculate its contribution to total energy
            for (const b of game.bullets) {
                const bulletEnergy = calculateEnergy(b, nx, ny);
                total_energy += bulletEnergy;
            }
            
            if(total_energy < best_move.energy) {
                best_move = { x: nx, y: ny, energy: total_energy, precise: false };
            }
        }
    }
    
    // Then try precise movement
    for(let dx of precise_move) {
        for(let dy of precise_move) {
            const nx = check_range(game.player.x + dx, 0, SCREEN_WIDTH);
            const ny = check_range(game.player.y + dy, 0, SCREEN_HEIGHT);
            
            // Calculate energy with better lookahead for precise movement
            let total_energy = 0;
            
            for (const b of game.bullets) {
                const bulletEnergy = calculateEnergy(b, nx, ny);
                total_energy += bulletEnergy;
            }
            
            if(total_energy < best_move.energy) {
                best_move = { x: nx, y: ny, energy: total_energy, precise: true };
            }
        }
    }
    
    // Better debugging information
    console.log("Best move:", best_move);
    
    game.player.x = best_move.x;
    game.player.y = best_move.y;
    game.player.isShift = best_move.precise;
}

// Update player position based on input
function updatePlayerPosition(mx, my, key_pressed) {
    if(game.settings.autoplay) {
        updatePlayerAI();
    } else {
        // Calculate movement speed based on deltaTime
        const baseSpeed = game.player.isShift ? 
            GAME_CONSTANTS.PLAYER.PRECISE_SPEED : 
            GAME_CONSTANTS.PLAYER.NORMAL_SPEED;
        const timeScale = game.performance.deltaTime / (1000 / 60); // Normalize to 60fps
        const move_speed = baseSpeed * timeScale;
        
        if(game.settings.inputMode === "keyboard") {
            if(key_pressed[37] || key_pressed["A".charCodeAt(0)]) game.player.x -= move_speed;
            if(key_pressed[39] || key_pressed["D".charCodeAt(0)]) game.player.x += move_speed;
            if(key_pressed[38] || key_pressed["W".charCodeAt(0)]) game.player.y -= move_speed;
            if(key_pressed[40] || key_pressed["S".charCodeAt(0)]) game.player.y += move_speed;
        } 
        else if(game.settings.inputMode === "mouse") {
            game.player.x = mx;
            game.player.y = my;
        }
        else if(game.settings.inputMode === "gamepad") {
            // Handle gamepad input with time scaling
            const gp = window.get_gamepad ? window.get_gamepad()[0] : null;
            if(gp) {
                game.player.isShift = gp.buttons[6].pressed;
                const gamepad_speed = (game.player.isShift ? 
                    GAME_CONSTANTS.PLAYER.PRECISE_SPEED : 
                    GAME_CONSTANTS.PLAYER.NORMAL_SPEED) * timeScale;
                
                const deadzone = GAME_CONSTANTS.INPUT.GAMEPAD_DEADZONE;
                if(gp.axes[0] < -deadzone) game.player.x -= gamepad_speed;
                if(gp.axes[0] > deadzone) game.player.x += gamepad_speed;
                if(gp.axes[1] < -deadzone) game.player.y -= gamepad_speed;
                if(gp.axes[1] > deadzone) game.player.y += gamepad_speed;
            }
        }
    }
    
    // Keep player within bounds
    game.player.x = check_range(game.player.x, 1, SCREEN_WIDTH);
    game.player.y = check_range(game.player.y, 1, SCREEN_HEIGHT);
}

// Render player
function renderPlayer() {
    if(!game.settings.observer) {
        draw({x: game.player.x, y: game.player.y, r: GAME_CONSTANTS.PLAYER.HITBOX_RADIUS, color:"Red"});
        
        if(game.settings.inputMode !== "mouse" && game.player.isShift) {
            game.context.beginPath();
            game.context.strokeStyle = "Red";
            game.context.arc(game.player.x, game.player.y, GAME_CONSTANTS.PLAYER.GRAZE_RADIUS, 0, Math.PI * 2);
            game.context.stroke();
        }
    }
}

// Main game loop
function main_loop(current_time) {
    cls();
    
    // Update game state and get current FPS
    const fps = updateGameState(current_time);
    
    // Generate new bullets
    generateBullets();
    
    // Update bullets and check for game over
    const result = updateBullets();
    if(result.game_over) {
        // Game over handling - notify UI with position
        if (typeof onGameOver === 'function') {
            onGameOver(result.position.x, result.position.y);
        }
        return;
    }
    
    // Update player position (input handled by UI)
    updatePlayerPosition(window.mx || 0, window.my || 0, window.key_pressed || []);
    
    // Render player
    renderPlayer();
    
    // Notify UI about updates
    if (typeof onGameStatUpdate === 'function') {
        onGameStatUpdate(fps, game.graze);
    }
    
    // Request next frame
    game.performance.requestId = requestAnimationFrame(t => main_loop(t));
}

// Make objects globally available instead of exporting
window.game = game;
window.SCREEN_WIDTH = SCREEN_WIDTH;
window.SCREEN_HEIGHT = SCREEN_HEIGHT;

window.main_loop = main_loop;
