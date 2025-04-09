// Game mechanics constants
const GAME_CONSTANTS = {
    // Screen dimensions
    SCREEN: {
		WIDTH: 600,
		HEIGHT: 800
    },
    
    TICK_RATE: 30,
    
    // Graze system
    GRAZE_COOLDOWN: 1000,
    
	BULLET_LIMIT: 1000,

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
	detected_fps: 60, // Default FPS
	context: null, // Canvas context for rendering

    // Game scene containing all game entities
    scene: {
		bullets: [{x: 0, y: 0, dx: 0, dy: 0, r: 0, color:"#ffffff", removed: false}],
		player: {
			x: GAME_CONSTANTS.SCREEN.WIDTH / 2,
			y: GAME_CONSTANTS.SCREEN.HEIGHT * 9 / 10,
			precisionMode: false  // Renamed from isShift
		},
		bulletGenerator: null  // Moved from tickSystem.currentGenerator
    },
    
    graze: 0,
    
    // Tick system
    tickSystem: {
		lastTickTime: 0,
		frame_per_tick: 0,
		tick_alert: 0,
    },
    
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
		this.scene.bullets = [];
		this.scene.player.x = GAME_CONSTANTS.SCREEN.WIDTH / 2;
		this.scene.player.y = GAME_CONSTANTS.SCREEN.HEIGHT * 9 / 10;
		this.scene.player.precisionMode = false;
		this.graze = 0;
		
		// Initialize tick system
		this.tickSystem.lastTickTime = performance.now();
		this.tickSystem.frame_per_tick = this.detected_fps / GAME_CONSTANTS.TICK_RATE;
		this.tickSystem.tick_alert = 0;

		// Use default generator (AimedRandomMix) if none set
		if (!this.scene.bulletGenerator) {
			this.scene.bulletGenerator = bullet_generator_template['AimedRandomMix'];
		}
		
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

function draw(bullet) {  
    game.context.beginPath();
    game.context.fillStyle = bullet.color;
    game.context.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    game.context.fill();
} 

function cls() {
    game.context.clearRect(0, 0, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT);
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

function generateBullets(deltaTime) {
    const currentGenerator = game.scene.bulletGenerator;
    const newBullets = currentGenerator.tick(game.scene, deltaTime);
            
    // Add bullets to the game's bullet array
    game.scene.bullets.push(...newBullets);
            
    // Enforce bullet limit
	if(game.scene.bullets.length > GAME_CONSTANTS.BULLET_LIMIT) {
		game.scene.bullets.splice(0, game.scene.bullets.length - GAME_CONSTANTS.BULLET_LIMIT);
	}
}

// Process bullet movement and collision detection with graze cooldown
function updateBullets() {
    let game_over = false;
    let gameOverPosition = { x: 0, y: 0 };  // Store position for game over effect
    const currentTime = performance.now();
    const deltaTime = game.performance.deltaTime / 1000.0;

    game.scene.bullets.forEach(bullet_now => {
        bullet_now = bullet_now.transform(bullet_now, deltaTime);
        
        const { x, y, r } = bullet_now;
        
        // Remove bullets that go off-screen
        if(x < 0 || x > GAME_CONSTANTS.SCREEN.WIDTH || y < 0 || y > GAME_CONSTANTS.SCREEN.HEIGHT) {
            bullet_now.removed = true;
        }
        
        // Check collisions with player
        if(!game.settings.observer) {
            const player = game.scene.player;
            const playerDist = dist(x, y, player.x, player.y) - r;
            if(playerDist <= GAME_CONSTANTS.PLAYER.COLLISION_RADIUS) {
                game_over = true;
                gameOverPosition = { x: player.x, y: player.y };
            }
            
            // Enhanced graze detection with cooldown
            if(playerDist <= GAME_CONSTANTS.PLAYER.GRAZE_RADIUS) {
                // Initialize lastGrazed if it doesn't exist
                if (typeof bullet_now.lastGrazed === 'undefined') {
                    bullet_now.lastGrazed = 0;
                }
                
                // Check if this bullet can register a new graze
                if (currentTime - bullet_now.lastGrazed >= GAME_CONSTANTS.GRAZE_COOLDOWN) {
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
    game.scene.bullets = game.scene.bullets.filter(bullet_now => !bullet_now.removed);
    
    return { game_over, position: gameOverPosition };
}

// Update player position based on input
function updatePlayerPosition(mx, my, key_pressed) {
    if(game.settings.autoplay) {
        updatePlayerAI();
    } else {
        // Calculate movement speed based on deltaTime
        const baseSpeed = game.scene.player.precisionMode ? 
            GAME_CONSTANTS.PLAYER.PRECISE_SPEED : 
            GAME_CONSTANTS.PLAYER.NORMAL_SPEED;
        const timeScale = game.performance.deltaTime / (1000 / 60); // Normalize to 60fps
        const move_speed = baseSpeed * timeScale;
        
        if(game.settings.inputMode === "keyboard") {
            if(key_pressed[37] || key_pressed["A".charCodeAt(0)]) game.scene.player.x -= move_speed;
            if(key_pressed[39] || key_pressed["D".charCodeAt(0)]) game.scene.player.x += move_speed;
            if(key_pressed[38] || key_pressed["W".charCodeAt(0)]) game.scene.player.y -= move_speed;
            if(key_pressed[40] || key_pressed["S".charCodeAt(0)]) game.scene.player.y += move_speed;
        } 
        else if(game.settings.inputMode === "mouse") {
            game.scene.player.x = mx;
            game.scene.player.y = my;
        }
        else if(game.settings.inputMode === "gamepad") {
            // Handle gamepad input with time scaling
            const gp = window.get_gamepad ? window.get_gamepad()[0] : null;
            if(gp) {
                game.scene.player.precisionMode = gp.buttons[6].pressed;
                const gamepad_speed = (game.scene.player.precisionMode ? 
                    GAME_CONSTANTS.PLAYER.PRECISE_SPEED : 
                    GAME_CONSTANTS.PLAYER.NORMAL_SPEED) * timeScale;
                
                const deadzone = GAME_CONSTANTS.INPUT.GAMEPAD_DEADZONE;
                if(gp.axes[0] < -deadzone) game.scene.player.x -= gamepad_speed;
                if(gp.axes[0] > deadzone) game.scene.player.x += gamepad_speed;
                if(gp.axes[1] < -deadzone) game.scene.player.y -= gamepad_speed;
                if(gp.axes[1] > deadzone) game.scene.player.y += gamepad_speed;
            }
        }
    }
    
    // Keep player within bounds
    game.scene.player.x = check_range(game.scene.player.x, 1, GAME_CONSTANTS.SCREEN.WIDTH);
    game.scene.player.y = check_range(game.scene.player.y, 1, GAME_CONSTANTS.SCREEN.HEIGHT);
}

// Render player
function renderPlayer() {
    if(!game.settings.observer) {
        draw({x: game.scene.player.x, y: game.scene.player.y, r: GAME_CONSTANTS.PLAYER.HITBOX_RADIUS, color:"Red"});
        
        if(game.settings.inputMode !== "mouse" && game.scene.player.precisionMode) {
            game.context.beginPath();
            game.context.strokeStyle = "Red";
            game.context.arc(game.scene.player.x, game.scene.player.y, GAME_CONSTANTS.PLAYER.GRAZE_RADIUS, 0, Math.PI * 2);
            game.context.stroke();
        }
    }
}

function tick(deltaTime) {
	// Update the game state based on the current tick
	generateBullets(deltaTime);
}

// Main game loop
function main_loop(current_time) {
    // Update game state and get current FPS
    const fps = updateGameState(current_time);

	cls();
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

    // Generate new bullets
	if( ++ game.tickSystem.tick_alert > game.tickSystem.frame_per_tick ) {
		game.tickSystem.tick_alert -= game.tickSystem.frame_per_tick;
		tick( (current_time - game.tickSystem.lastTickTime) / 1000.0);
		game.tickSystem.lastTickTime = current_time;
	}
    
    // Notify UI about updates
    if (typeof onGameStatUpdate === 'function') {
        onGameStatUpdate(fps, game.graze);
    }
    
    // Request next frame
    game.performance.requestId = requestAnimationFrame(t => main_loop(t));
}

// Update setBulletGenerator function to work with new template naming
function setBulletGenerator(generatorName) {
    // Check if the generator exists
    if (bullet_generator_template[generatorName]) {
        game.scene.bulletGenerator = bullet_generator_template[generatorName];
        
        // Reset generator state if needed
        if (game.scene.bulletGenerator.reset) {
            game.scene.bulletGenerator.reset();
        }
        
        // Return success
        return true;
    }
    
    // Return false if generator not found
    return false;
}

// Make objects globally available instead of exporting
window.game = game;
window.SCREEN_WIDTH = GAME_CONSTANTS.SCREEN.WIDTH;
window.SCREEN_HEIGHT = GAME_CONSTANTS.SCREEN.HEIGHT;

window.main_loop = main_loop;
window.setBulletGenerator = setBulletGenerator; // Export the generator switching function
