// Game mechanics constants
const GAME_CONSTANTS = {
    // Screen dimensions
    SCREEN: {
		WIDTH: 600,
		HEIGHT: 800
    },
    
    TIMING: {
        TARGET_FPS: 60,
        FRAME_TIME_MS: 1000 / 60,
        MAX_DELTA_TIME_MS: 100
    },
    
    // Graze system
    GRAZE_COOLDOWN: 1000,
    
	BULLET_LIMIT: 850,

    // Player constants
    PLAYER: {
		NORMAL_SPEED: 6,
		PRECISE_SPEED: 2.2,
		HITBOX_RADIUS: 3,
		GRAZE_RADIUS: 20,
		COLLISION_RADIUS: 3,
        TRAIL_LENGTH: 8,
        OPTION_DISTANCE: 26,
        SHOT_INTERVAL: 0.09,
        SHOT_SPEED: 560,
        SHOT_RADIUS: 5,
        SHOT_POWER: 1
    },

    ENEMY: {
        RADIUS: 14,
        SPAWN_INTERVAL: 2.2,
        WAVE_SIZE: 3,
        MAX_COUNT: 6,
        LIFETIME: 15,
        ENTRY_SPEED: 2.1,
        HP: 7,
        BOSS_RADIUS: 28,
        BOSS_HP: 48,
        BOSS_LIFETIME: 999
    },

    BACKGROUND: {
        STAR_COUNT: 34,
        PETAL_COUNT: 8
    },

    PERFORMANCE: {
        TRAIL_BULLET_THRESHOLD: 240,
        BACKGROUND_EFFECT_BULLET_THRESHOLD: 280
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
	context: null, // Canvas context for rendering
    renderCache: {
        bulletSprites: new Map(),
        enemySprites: new Map(),
        enemySpriteSheet: null,
        enemySpriteLoaded: false,
        enemyFrameWidth: 48,
        enemyMobFrameHeight: 32,
        enemyBossFrameHeight: 48,
        cirnoSprite: null,
        cirnoSpriteLoaded: false,
        cirnoFrameWidth: 32,
        cirnoFrameHeight: 45,
        cirnoSourceX: 11,
        cirnoSourceY: 16,
        cirnoFrameGroups: 3,
        cirnoFramesPerGroup: 8
    },

    // Game scene containing all game entities
    scene: {
			bullets: [],
        playerBullets: [],
        enemies: [],
        enemySystem: {
            spawnCooldown: 0,
            waveCounter: 0,
            nextId: 1
        },
        background: null,
			player: {
				x: GAME_CONSTANTS.SCREEN.WIDTH / 2,
				y: GAME_CONSTANTS.SCREEN.HEIGHT * 9 / 10,
				precisionMode: false,
            trail: [],
            auraPhase: 0,
            shotCooldown: 0,
            renderDirection: 0,
            previousX: GAME_CONSTANTS.SCREEN.WIDTH / 2
			},
		bulletGenerator: null,
        currentGeneratorName: 'AimedRandomMix'
    },
    
    graze: 0,
    
    // Settings
    settings: {
		observer: false,
		autoplay: false,
		inputMode: "keyboard",
		visualGrazeFeedback: true // Enable visual feedback for grazes
    },

    state: {
        hasStarted: false,
        isRunning: false,
        isPaused: false,
        isGameOver: false
    },
    
    // Performance
    performance: {
		fps: 0,
		frameCount: 0,
		startTime: 0,
		requestId: 0,
		lastFrameTime: 0,
        lastStepTime: 0,
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
            this.scene.playerBullets = [];
			this.scene.player.x = GAME_CONSTANTS.SCREEN.WIDTH / 2;
				this.scene.player.y = GAME_CONSTANTS.SCREEN.HEIGHT * 9 / 10;
				this.scene.player.precisionMode = false;
        this.scene.player.trail = [];
        this.scene.player.auraPhase = 0;
        this.scene.player.shotCooldown = 0;
        this.scene.player.renderDirection = 0;
        this.scene.player.previousX = this.scene.player.x;
        this.scene.enemies = [];
        this.scene.enemySystem.spawnCooldown = 0;
        this.scene.enemySystem.waveCounter = 0;
        this.scene.enemySystem.nextId = 1;
        this.scene.background = createStageBackground();
		this.graze = 0;
		
		// Use default generator (AimedRandomMix) if none set
		if (!this.scene.bulletGenerator) {
			this.scene.bulletGenerator = bullet_generator_template['AimedRandomMix'];
		}

        if (!this.renderCache.cirnoSprite) {
            const cirnoSprite = new Image();
            cirnoSprite.onload = () => {
                this.renderCache.cirnoSpriteLoaded = true;
            };
            cirnoSprite.src = 'th00/Cirno.png';
            this.renderCache.cirnoSprite = cirnoSprite;
        }
        if (!this.renderCache.enemySpriteSheet) {
            const enemySpriteSheet = new Image();
            enemySpriteSheet.onload = () => {
                this.renderCache.enemySpriteLoaded = true;
                this.renderCache.enemySprites.clear();
            };
            enemySpriteSheet.src = 'th00/enermy.png';
            this.renderCache.enemySpriteSheet = enemySpriteSheet;
        }
		
		// Reset performance metrics
		this.performance.frameCount = 0;
		this.performance.gameTime = 0;
		this.performance.lastFrameTime = performance.now();
        this.performance.lastStepTime = this.performance.lastFrameTime;
		this.performance.deltaTime = 0;
		this.performance.startTime = performance.now();
        this.performance.fpsHistory = [];

        this.state.hasStarted = true;
        this.state.isRunning = true;
        this.state.isPaused = false;
        this.state.isGameOver = false;
		
		// Start game loop
		this.performance.requestId = requestAnimationFrame(t => main_loop(t));
    },

    // Stop the game
    stop: function() {
    	cancelAnimationFrame(this.performance.requestId);
        this.performance.requestId = 0;
        this.state.isRunning = false;
        this.state.isPaused = false;
    },

    pause: function() {
        if (!this.state.isRunning || this.state.isGameOver) return;
        cancelAnimationFrame(this.performance.requestId);
        this.performance.requestId = 0;
        this.state.isRunning = false;
        this.state.isPaused = true;
    },

    resume: function() {
        if (!this.state.isPaused || this.state.isGameOver) return;
        this.state.isPaused = false;
        this.state.isRunning = true;
        this.performance.lastFrameTime = performance.now();
        this.performance.lastStepTime = this.performance.lastFrameTime;
        this.performance.requestId = requestAnimationFrame(t => main_loop(t));
    },

    markGameOver: function() {
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.state.isGameOver = true;
    }
};

function createStageBackground() {
    const staticLayer = document.createElement('canvas');
    staticLayer.width = GAME_CONSTANTS.SCREEN.WIDTH;
    staticLayer.height = GAME_CONSTANTS.SCREEN.HEIGHT;
    const sctx = staticLayer.getContext('2d');

    const stars = Array.from({ length: GAME_CONSTANTS.BACKGROUND.STAR_COUNT }, () => ({
        x: Math.random() * GAME_CONSTANTS.SCREEN.WIDTH,
        y: Math.random() * GAME_CONSTANTS.SCREEN.HEIGHT,
        radius: Math.random() * 1.8 + 0.4,
        speed: Math.random() * 16 + 10,
        alpha: Math.random() * 0.5 + 0.15,
        drift: Math.random() * 18 + 6,
        phase: Math.random() * Math.PI * 2
    }));

    const petals = Array.from({ length: GAME_CONSTANTS.BACKGROUND.PETAL_COUNT }, () => ({
        x: Math.random() * GAME_CONSTANTS.SCREEN.WIDTH,
        y: Math.random() * GAME_CONSTANTS.SCREEN.HEIGHT,
        radius: Math.random() * 8 + 5,
        speed: Math.random() * 24 + 14,
        sway: Math.random() * 24 + 18,
        alpha: Math.random() * 0.15 + 0.06,
        rotation: Math.random() * Math.PI * 2
    }));

    const ribbons = Array.from({ length: 4 }, (_, index) => ({
        baseY: 90 + index * 108,
        amplitude: 12 + index * 5,
        speed: 0.18 + index * 0.05,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.07 + index * 0.02,
        hue: 198 + index * 16
    }));

    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 160;
    patternCanvas.height = 160;
    const pctx = patternCanvas.getContext('2d');

    pctx.clearRect(0, 0, patternCanvas.width, patternCanvas.height);
    pctx.strokeStyle = 'rgba(255, 173, 220, 0.14)';
    pctx.lineWidth = 1;
    for (let i = -40; i < 200; i += 20) {
        pctx.beginPath();
        pctx.moveTo(i, 0);
        pctx.lineTo(i + 80, 160);
        pctx.stroke();
    }

    pctx.fillStyle = 'rgba(180, 229, 255, 0.08)';
    for (let y = 20; y < 160; y += 40) {
        for (let x = 20; x < 160; x += 40) {
            pctx.beginPath();
            pctx.arc(x, y, 2.4, 0, Math.PI * 2);
            pctx.fill();
        }
    }

    const baseGradient = sctx.createLinearGradient(0, 0, 0, GAME_CONSTANTS.SCREEN.HEIGHT);
    baseGradient.addColorStop(0, '#07101f');
    baseGradient.addColorStop(0.28, '#0f1b35');
    baseGradient.addColorStop(0.62, '#1a2147');
    baseGradient.addColorStop(1, '#2b1431');
    sctx.fillStyle = baseGradient;
    sctx.fillRect(0, 0, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT);

    const moonGradient = sctx.createRadialGradient(
        GAME_CONSTANTS.SCREEN.WIDTH * 0.74,
        118,
        12,
        GAME_CONSTANTS.SCREEN.WIDTH * 0.74,
        118,
        110
    );
    moonGradient.addColorStop(0, 'rgba(231, 247, 255, 0.95)');
    moonGradient.addColorStop(0.32, 'rgba(188, 225, 255, 0.4)');
    moonGradient.addColorStop(1, 'rgba(100, 154, 255, 0)');
    sctx.fillStyle = moonGradient;
    sctx.beginPath();
    sctx.arc(GAME_CONSTANTS.SCREEN.WIDTH * 0.74, 118, 110, 0, Math.PI * 2);
    sctx.fill();

    sctx.fillStyle = 'rgba(242, 251, 255, 0.9)';
    sctx.beginPath();
    sctx.arc(GAME_CONSTANTS.SCREEN.WIDTH * 0.74, 118, 36, 0, Math.PI * 2);
    sctx.fill();

    const pattern = sctx.createPattern(patternCanvas, 'repeat');
    sctx.save();
    sctx.globalAlpha = 0.22;
    sctx.fillStyle = pattern;
    sctx.fillRect(0, 0, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT);
    sctx.restore();

    sctx.save();
    const curtainGradient = sctx.createLinearGradient(0, 0, 0, GAME_CONSTANTS.SCREEN.HEIGHT);
    curtainGradient.addColorStop(0, 'rgba(255, 181, 229, 0.16)');
    curtainGradient.addColorStop(0.36, 'rgba(110, 144, 255, 0.05)');
    curtainGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = curtainGradient;
    for (let x = -40; x < GAME_CONSTANTS.SCREEN.WIDTH + 40; x += 74) {
        sctx.beginPath();
        sctx.moveTo(x, 0);
        sctx.quadraticCurveTo(x + 26, 110, x + 10, 240);
        sctx.quadraticCurveTo(x + 44, 360, x + 18, GAME_CONSTANTS.SCREEN.HEIGHT);
        sctx.lineTo(x + 38, GAME_CONSTANTS.SCREEN.HEIGHT);
        sctx.quadraticCurveTo(x + 64, 360, x + 28, 240);
        sctx.quadraticCurveTo(x + 48, 110, x + 18, 0);
        sctx.closePath();
        sctx.fill();
    }
    sctx.restore();

    sctx.save();
    sctx.strokeStyle = 'rgba(190, 222, 255, 0.06)';
    sctx.lineWidth = 1;
    for (let y = 80; y < GAME_CONSTANTS.SCREEN.HEIGHT; y += 64) {
        sctx.beginPath();
        sctx.moveTo(0, y);
        sctx.bezierCurveTo(
            GAME_CONSTANTS.SCREEN.WIDTH * 0.25, y - 16,
            GAME_CONSTANTS.SCREEN.WIDTH * 0.75, y + 18,
            GAME_CONSTANTS.SCREEN.WIDTH, y - 6
        );
        sctx.stroke();
    }
    sctx.restore();

    sctx.save();
    sctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    sctx.lineWidth = 2;
    sctx.strokeRect(14, 14, GAME_CONSTANTS.SCREEN.WIDTH - 28, GAME_CONSTANTS.SCREEN.HEIGHT - 28);
    sctx.strokeStyle = 'rgba(125, 211, 255, 0.08)';
    sctx.strokeRect(28, 28, GAME_CONSTANTS.SCREEN.WIDTH - 56, GAME_CONSTANTS.SCREEN.HEIGHT - 56);
    sctx.strokeStyle = 'rgba(255, 179, 223, 0.08)';
    sctx.lineWidth = 1;
    sctx.strokeRect(42, 42, GAME_CONSTANTS.SCREEN.WIDTH - 84, GAME_CONSTANTS.SCREEN.HEIGHT - 84);
    sctx.restore();

    sctx.save();
    const floorGradient = sctx.createLinearGradient(0, GAME_CONSTANTS.SCREEN.HEIGHT * 0.66, 0, GAME_CONSTANTS.SCREEN.HEIGHT);
    floorGradient.addColorStop(0, 'rgba(126, 163, 255, 0)');
    floorGradient.addColorStop(0.28, 'rgba(116, 170, 255, 0.08)');
    floorGradient.addColorStop(1, 'rgba(255, 184, 226, 0.18)');
    sctx.fillStyle = floorGradient;
    sctx.fillRect(0, GAME_CONSTANTS.SCREEN.HEIGHT * 0.66, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT * 0.34);
    sctx.restore();

    return {
        stars,
        petals,
        ribbons,
        staticLayer
    };
}

function normalizeColorKey(color) {
    const match = `${color}`.match(/rgba?\(([^)]+)\)/);
    if (!match) return `${color}`;
    const values = match[1]
        .split(',')
        .map((value) => Number.parseFloat(value.trim()))
        .filter((value) => Number.isFinite(value));
    if (values.length < 3) return `${color}`;
    const alpha = values.length > 3 ? Math.round(values[3] * 100) / 100 : 1;
    const quantized = values.slice(0, 3).map((value) => Math.round(value / 24) * 24);
    return `${quantized.join('-')}-${alpha}`;
}

function getBulletSprite(bullet, simplified = false) {
    const key = [
        bullet.sprite || 'orb',
        Math.round((bullet.r || 4) * 10) / 10,
        normalizeColorKey(bullet.color || '#fff'),
        normalizeColorKey(bullet.coreColor || '#fff'),
        simplified ? 'simple' : 'glow'
    ].join('|');

    if (game.renderCache.bulletSprites.has(key)) {
        return game.renderCache.bulletSprites.get(key);
    }

    const radius = bullet.r || 4;
    const padding = simplified ? radius + 4 : radius * 3;
    const size = Math.ceil(radius * 2 + padding * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;

    if (!simplified) {
        const glowGradient = ctx.createRadialGradient(center, center, 0, center, center, radius + padding * 0.7);
        glowGradient.addColorStop(0, bullet.glowColor || bullet.color || 'rgba(255,255,255,0.4)');
        glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(center, center, radius + padding * 0.7, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = bullet.color || '#fff';
    if (bullet.sprite === 'needle') {
        ctx.translate(center, center);
        ctx.beginPath();
        ctx.moveTo(radius * 1.45, 0);
        ctx.lineTo(-radius * 1.15, radius * 0.62);
        ctx.lineTo(-radius * 0.55, 0);
        ctx.lineTo(-radius * 1.15, -radius * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = bullet.coreColor || '#fff';
        ctx.beginPath();
        ctx.moveTo(radius * 0.7, 0);
        ctx.lineTo(-radius * 0.55, radius * 0.3);
        ctx.lineTo(-radius * 0.15, 0);
        ctx.lineTo(-radius * 0.55, -radius * 0.3);
        ctx.closePath();
        ctx.fill();
    } else if (bullet.sprite === 'petal') {
        ctx.translate(center, center);
        ctx.beginPath();
        ctx.moveTo(0, -radius * 1.2);
        ctx.quadraticCurveTo(radius * 0.9, -radius * 0.2, 0, radius * 1.15);
        ctx.quadraticCurveTo(-radius * 0.9, -radius * 0.2, 0, -radius * 1.2);
        ctx.fill();
        ctx.fillStyle = bullet.coreColor || '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.25, radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = bullet.coreColor || '#fff';
        ctx.beginPath();
        ctx.arc(center, center, Math.max(1.2, radius * 0.34), 0, Math.PI * 2);
        ctx.fill();
    }

    const sprite = {
        canvas,
        size,
        center
    };
    game.renderCache.bulletSprites.set(key, sprite);
    return sprite;
}

function getEnemySprite(enemy) {
    const frameLoop = [0, 1, 2, 3, 2, 1];
    const frameIndex = frameLoop[Math.floor(enemy.age * 10) % frameLoop.length];
    const key = `${enemy.isBoss ? 'boss' : 'mob'}-${frameIndex}`;
    if (game.renderCache.enemySprites.has(key)) {
        return game.renderCache.enemySprites.get(key);
    }

    if (game.renderCache.enemySpriteLoaded && game.renderCache.enemySpriteSheet) {
        const size = enemy.isBoss ? 92 : 72;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const srcX = enemy.isBoss ? 320 + frameIndex * 48 : frameIndex * 48;
        const srcY = 0;
        const srcHeight = enemy.isBoss ? game.renderCache.enemyBossFrameHeight : game.renderCache.enemyMobFrameHeight;
        const drawWidth = enemy.isBoss ? 72 : 56;
        const drawHeight = enemy.isBoss ? 72 : 38;
        ctx.drawImage(
            game.renderCache.enemySpriteSheet,
            srcX,
            srcY,
            game.renderCache.enemyFrameWidth,
            srcHeight,
            (size - drawWidth) / 2,
            (size - drawHeight) / 2,
            drawWidth,
            drawHeight
        );

        const sprite = { canvas, size };
        game.renderCache.enemySprites.set(key, sprite);
        return sprite;
    }

    const size = enemy.isBoss ? 112 : 68;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size * (enemy.isBoss ? 0.56 : 0.58);
    const scale = enemy.isBoss ? 1.45 : 1;
    const hairColor = `hsl(${enemy.hue - 18}, 78%, 58%)`;
    const dressColor = `hsl(${enemy.hue + 6}, 88%, 62%)`;
    const dressShadow = `hsl(${enemy.hue - 4}, 70%, 40%)`;
    const ribbonColor = `hsl(${enemy.hue + 28}, 95%, 76%)`;
    const crystalStroke = `hsla(${enemy.hue + 16}, 100%, 86%, 0.92)`;
    const crystalFill = `hsla(${enemy.hue + 6}, 100%, 84%, 0.34)`;
    const skinColor = '#f8f6ff';
    const outlineColor = 'rgba(20, 32, 60, 0.22)';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    ctx.strokeStyle = crystalStroke;
    ctx.lineWidth = 1.15;
    [-1, 1].forEach((dir) => {
        for (let i = 0; i < 4; i++) {
            const offsetY = -18 + i * 10;
            const outerX = dir * (18 + i * 7);
            ctx.beginPath();
            ctx.moveTo(dir * 8, offsetY);
            ctx.lineTo(outerX, offsetY - 7);
            ctx.lineTo(dir * (outerX + dir * 8), offsetY - 1);
            ctx.lineTo(outerX, offsetY + 7);
            ctx.closePath();
            ctx.fillStyle = crystalFill;
            ctx.fill();
            ctx.stroke();
        }
    });

    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(0, -20, 11.5, Math.PI, Math.PI * 2);
    ctx.quadraticCurveTo(12, -14, 8, -4);
    ctx.quadraticCurveTo(0, 3, -8, -4);
    ctx.quadraticCurveTo(-12, -14, 0, -20);
    ctx.fill();

    ctx.fillStyle = ribbonColor;
    ctx.beginPath();
    ctx.moveTo(-10, -25);
    ctx.lineTo(-2, -31);
    ctx.lineTo(-1, -20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, -25);
    ctx.lineTo(2, -31);
    ctx.lineTo(1, -20);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.arc(0, -16, 9.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#203a76';
    ctx.beginPath();
    ctx.arc(-3.5, -17, 1.35, 0, Math.PI * 2);
    ctx.arc(3.5, -17, 1.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -16, 9.5, Math.PI * 1.04, Math.PI * 1.96);
    ctx.stroke();

    const dressGradient = ctx.createLinearGradient(0, -8, 0, 28);
    dressGradient.addColorStop(0, '#fbffff');
    dressGradient.addColorStop(0.28, ribbonColor);
    dressGradient.addColorStop(0.29, dressColor);
    dressGradient.addColorStop(1, dressShadow);
    ctx.fillStyle = dressGradient;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.quadraticCurveTo(14, -2, 16, 18);
    ctx.quadraticCurveTo(0, 32, -16, 18);
    ctx.quadraticCurveTo(-14, -2, 0, -5);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(8, 4, 8, 18);
    ctx.quadraticCurveTo(0, 23, -8, 18);
    ctx.quadraticCurveTo(-8, 4, 0, -2);
    ctx.fill();

    ctx.fillStyle = ribbonColor;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(-5, 11);
    ctx.lineTo(0, 9);
    ctx.lineTo(5, 11);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-3.4, -17.5, 0.85, 0, Math.PI * 2);
    ctx.arc(3.1, -17.5, 0.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-12, 20);
    ctx.quadraticCurveTo(0, 28, 12, 20);
    ctx.stroke();

    ctx.restore();

    const sprite = { canvas, size };
    game.renderCache.enemySprites.set(key, sprite);
    return sprite;
}

function drawBloom(x, y, radius, color, alpha = 1) {
    const gradient = game.context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    game.context.save();
    game.context.globalAlpha = alpha;
    game.context.fillStyle = gradient;
    game.context.beginPath();
    game.context.arc(x, y, radius, 0, Math.PI * 2);
    game.context.fill();
    game.context.restore();
}

function getCirnoAnimFrame(frameGroup) {
    const tick = Math.floor(game.performance.gameTime / 95);
    if (frameGroup === 0) {
        const loop = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1];
        return loop[tick % loop.length];
    }

    if (tick < 8) {
        return tick;
    }

    const loop = [3, 4, 5, 6, 7, 6, 5, 4];
    return loop[(tick - 8) % loop.length];
}

function renderBackground() {
    const ctx = game.context;
    const width = GAME_CONSTANTS.SCREEN.WIDTH;
    const height = GAME_CONSTANTS.SCREEN.HEIGHT;
    const background = game.scene.background;
    const time = game.performance.gameTime / 1000;
    const heavyEffectsEnabled = game.scene.bullets.length < GAME_CONSTANTS.PERFORMANCE.BACKGROUND_EFFECT_BULLET_THRESHOLD;

    ctx.drawImage(background.staticLayer, 0, 0);

    if (heavyEffectsEnabled) {
        drawBloom(width * 0.5, height * 0.22, 260, 'rgba(146, 129, 255, 0.18)', 1);
        drawBloom(width * 0.5, height * 0.86, 220, 'rgba(255, 126, 190, 0.13)', 1);
        drawBloom(width * 0.74, 118, 120, 'rgba(178, 225, 255, 0.11)', 1);
    }

    background.ribbons.forEach((ribbon, index) => {
        ctx.save();
        ctx.strokeStyle = `hsla(${ribbon.hue}, 100%, 78%, ${ribbon.alpha})`;
        ctx.lineWidth = 18 - index * 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let x = -40; x <= width + 40; x += 40) {
            const waveY = ribbon.baseY +
                Math.sin(x * 0.014 + time * (1.1 + ribbon.speed) + ribbon.phase) * ribbon.amplitude +
                Math.sin(x * 0.028 - time * 0.8 + ribbon.phase) * (ribbon.amplitude * 0.35);
            if (x === -40) {
                ctx.moveTo(x, waveY);
            } else {
                ctx.lineTo(x, waveY);
            }
        }
        ctx.stroke();
        ctx.restore();
    });

    background.stars.forEach((star) => {
        const x = (star.x + Math.sin(time + star.phase) * star.drift + width) % width;
        const y = (star.y + time * star.speed) % height;
        const twinkle = 0.55 + 0.45 * Math.sin(time * 2.4 + star.phase);
        ctx.fillStyle = `rgba(214, 236, 255, ${star.alpha * twinkle})`;
        ctx.beginPath();
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    if (!heavyEffectsEnabled) {
        return;
    }

    background.petals.forEach((petal, index) => {
        const y = (petal.y + time * petal.speed) % (height + 30) - 15;
        const x = petal.x + Math.sin(time * 0.9 + index) * petal.sway;
        const rotation = petal.rotation + time * 0.7;
        ctx.save();
        ctx.globalAlpha = petal.alpha;
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.fillStyle = 'rgba(255, 191, 224, 0.95)';
        ctx.beginPath();
        ctx.moveTo(0, -petal.radius);
        ctx.quadraticCurveTo(petal.radius * 0.8, 0, 0, petal.radius * 0.9);
        ctx.quadraticCurveTo(-petal.radius * 0.8, 0, 0, -petal.radius);
        ctx.fill();
        ctx.restore();
    });

}

function emitBullet(template, x, y, dx, dy, extra = {}) {
    const templateState = template.real_color ? { real_color: { ...template.real_color } } : {};
    return {
        ...template,
        ...templateState,
        ...extra,
        x,
        y,
        dx,
        dy,
        prevX: x,
        prevY: y,
        removed: false
    };
}

function pushBullets(newBullets) {
    game.scene.bullets.push(...newBullets);
    if (game.scene.bullets.length > GAME_CONSTANTS.BULLET_LIMIT) {
        game.scene.bullets.splice(0, game.scene.bullets.length - GAME_CONSTANTS.BULLET_LIMIT);
    }
}

function getAimAngle(fromX, fromY, toX, toY) {
    return Math.atan2(toY - fromY, toX - fromX);
}

function getModeEnemyConfig() {
    switch (game.scene.currentGeneratorName) {
        case 'Wave':
            return {
                boss: true,
                count: 1,
                radius: GAME_CONSTANTS.ENEMY.BOSS_RADIUS,
                hp: GAME_CONSTANTS.ENEMY.BOSS_HP,
                lifetime: GAME_CONSTANTS.ENEMY.BOSS_LIFETIME,
                targetY: 188,
                bobAmplitude: 18
            };
        case 'Gravity':
            return {
                boss: true,
                count: 1,
                radius: GAME_CONSTANTS.ENEMY.BOSS_RADIUS + 2,
                hp: GAME_CONSTANTS.ENEMY.BOSS_HP + 10,
                lifetime: GAME_CONSTANTS.ENEMY.BOSS_LIFETIME,
                targetY: 176,
                bobAmplitude: 12
            };
        case 'Rain':
            return {
                count: 5,
                targetY: 52,
                lifetime: 18
            };
        case 'WideAngleAim':
            return {
                count: 3,
                targetY: 58,
                lifetime: 18
            };
        case 'Random':
            return {
                count: 4,
                targetY: 54,
                lifetime: 17
            };
        case 'Snowy':
            return {
                count: 4,
                targetY: 56,
                lifetime: 18
            };
        default:
            return {
                count: 3,
                targetY: 56,
                lifetime: 17
            };
    }
}

function createEnemy(laneIndex, totalLanes, rowIndex, config = {}) {
    const laneWidth = GAME_CONSTANTS.SCREEN.WIDTH / (totalLanes + 1);
    const laneX = config.boss
        ? GAME_CONSTANTS.SCREEN.WIDTH / 2
        : laneWidth * (laneIndex + 1);
    const hue = config.boss ? 195 : 300 + laneIndex * 14 + rowIndex * 12;
    return {
        id: game.scene.enemySystem.nextId++,
        x: laneX,
        y: config.boss ? -90 : -50 - rowIndex * 35,
        laneX,
        targetY: config.targetY ?? (118 + rowIndex * 68),
        radius: config.radius ?? GAME_CONSTANTS.ENEMY.RADIUS,
        hp: config.hp ?? GAME_CONSTANTS.ENEMY.HP,
        maxHp: config.hp ?? GAME_CONSTANTS.ENEMY.HP,
        hitFlash: 0,
        bobAmplitude: config.bobAmplitude ?? (20 + Math.random() * 16),
        bobSpeed: config.boss ? 0.45 : (0.8 + Math.random() * 0.7),
        phase: Math.random() * Math.PI * 2,
        age: 0,
        flash: 0,
        spiralAngle: Math.random() * Math.PI * 2,
        modeLifetime: config.lifetime ?? GAME_CONSTANTS.ENEMY.LIFETIME,
        isBoss: !!config.boss,
        removed: false,
        hue
    };
}

function spawnEnemyWave() {
    const modeConfig = getModeEnemyConfig();
    const totalLanes = modeConfig.count ?? (GAME_CONSTANTS.ENEMY.WAVE_SIZE + (game.scene.enemySystem.waveCounter % 2));
    const rowIndex = game.scene.enemySystem.waveCounter % 2;
    if (modeConfig.boss && game.scene.enemies.length > 0) {
        return;
    }
    for (let laneIndex = 0; laneIndex < totalLanes; laneIndex++) {
        if (game.scene.enemies.length >= GAME_CONSTANTS.ENEMY.MAX_COUNT) {
            break;
        }
        game.scene.enemies.push(createEnemy(laneIndex, totalLanes, rowIndex, modeConfig));
    }
    game.scene.enemySystem.waveCounter++;
}

function generateEnemyBullets(deltaTime) {
    if (!game.scene.bulletGenerator || game.scene.enemies.length === 0) {
        return;
    }

    const activeEmitters = game.scene.enemies.filter((enemy) => !enemy.removed);
    if (activeEmitters.length === 0) {
        return;
    }

    const allNewBullets = [];
    for (let index = 0; index < activeEmitters.length; index++) {
        const enemy = activeEmitters[index];
        const proxyScene = {
            player: game.scene.player,
            bullets: game.scene.bullets,
            emitter: enemy
        };
        const emitterBullets = game.scene.bulletGenerator.tick(proxyScene, deltaTime) || [];
        if (emitterBullets.length > 0) {
            enemy.flash = Math.max(enemy.flash, enemy.isBoss ? 0.7 : 0.18 + (index % 2) * 0.06);
            allNewBullets.push(...emitterBullets);
        }
    }

    if (allNewBullets.length > 0) {
        pushBullets(allNewBullets);
    }
}

function updateEnemies(deltaTime) {
    const modeConfig = getModeEnemyConfig();
    game.scene.enemySystem.spawnCooldown -= deltaTime;
    if (
        game.scene.enemies.length < (modeConfig.boss ? 1 : GAME_CONSTANTS.ENEMY.MAX_COUNT) &&
        game.scene.enemySystem.spawnCooldown <= 0
    ) {
        spawnEnemyWave();
        game.scene.enemySystem.spawnCooldown = modeConfig.boss ? 0.8 : GAME_CONSTANTS.ENEMY.SPAWN_INTERVAL;
    }

    let enemyCollision = false;
    const player = game.scene.player;

    game.scene.enemies.forEach((enemy) => {
        enemy.age += deltaTime;
        enemy.flash = Math.max(0, enemy.flash - deltaTime * 2.8);
        enemy.hitFlash = Math.max(0, enemy.hitFlash - deltaTime * 4.5);

        const hoverY = enemy.targetY + Math.sin(enemy.age * 1.2 + enemy.phase) * (enemy.isBoss ? 6 : 3.5);
        enemy.y = lerp(enemy.y, hoverY, clamp01(deltaTime * GAME_CONSTANTS.ENEMY.ENTRY_SPEED));
        enemy.x = enemy.laneX + Math.sin(enemy.age * enemy.bobSpeed + enemy.phase) * enemy.bobAmplitude;

        if (
            !game.settings.observer &&
            dist(enemy.x, enemy.y, player.x, player.y) <= enemy.radius + GAME_CONSTANTS.PLAYER.COLLISION_RADIUS + 2
        ) {
            enemyCollision = true;
        }

        if (enemy.age >= enemy.modeLifetime) {
            enemy.removed = true;
        }
    });

    game.scene.enemies = game.scene.enemies.filter((enemy) => !enemy.removed);
    return enemyCollision;
}

function renderEnemies() {
    const ctx = game.context;
    game.scene.enemies.forEach((enemy) => {
        const glowColor = `hsla(${enemy.hue}, 100%, 78%, 0.32)`;
        drawBloom(enemy.x, enemy.y, (enemy.isBoss ? 44 : 28) + enemy.flash * 16, glowColor, 0.85);
        if (enemy.hitFlash > 0) {
            drawBloom(enemy.x, enemy.y, 24 + enemy.hitFlash * 12, 'rgba(255,255,255,0.48)', enemy.hitFlash);
        }

        const sprite = getEnemySprite(enemy);
        ctx.save();
        ctx.fillStyle = 'rgba(12, 18, 33, 0.28)';
        ctx.beginPath();
        ctx.ellipse(enemy.x, enemy.y + enemy.radius + 10, enemy.radius + 12, enemy.isBoss ? 10 : 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9 + enemy.flash * 0.1;
        ctx.drawImage(sprite.canvas, enemy.x - sprite.size / 2, enemy.y - sprite.size / 2, sprite.size, sprite.size);
        ctx.restore();

        ctx.save();
        const normalizedHp = enemy.hp / enemy.maxHp;
        ctx.fillStyle = 'rgba(9, 15, 30, 0.55)';
        const hpWidth = enemy.isBoss ? 64 : 32;
        ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - enemy.radius - 14, hpWidth, 4);
        ctx.fillStyle = 'rgba(122, 236, 255, 0.9)';
        ctx.fillRect(enemy.x - hpWidth / 2, enemy.y - enemy.radius - 14, hpWidth * normalizedHp, 4);

        ctx.restore();
    });
}

function updatePlayerTrail() {
    const player = game.scene.player;
    player.auraPhase += game.performance.deltaTime / 1000;
    player.trail.unshift({
        x: player.x,
        y: player.y,
        precisionMode: player.precisionMode
    });
    if (player.trail.length > GAME_CONSTANTS.PLAYER.TRAIL_LENGTH) {
        player.trail.length = GAME_CONSTANTS.PLAYER.TRAIL_LENGTH;
    }
}

function spawnPlayerShot(x, y, dx = 0) {
    game.scene.playerBullets.push({
        x,
        y,
        dx,
        dy: -GAME_CONSTANTS.PLAYER.SHOT_SPEED,
        radius: GAME_CONSTANTS.PLAYER.SHOT_RADIUS,
        power: GAME_CONSTANTS.PLAYER.SHOT_POWER,
        removed: false
    });
}

function updatePlayerShooting(deltaTime) {
    const player = game.scene.player;
    player.shotCooldown = Math.max(0, player.shotCooldown - deltaTime);

    const gamepad = game.settings.inputMode === "gamepad" && window.get_gamepad
        ? window.get_gamepad()[0]
        : null;
    const gamepadShooting = !!(gamepad && gamepad.buttons[0] && gamepad.buttons[0].pressed);
    const isShooting = game.settings.autoplay ||
        !!(window.key_pressed && window.key_pressed["Z".charCodeAt(0)]) ||
        gamepadShooting;

    if (!isShooting || game.settings.observer) {
        return;
    }

    while (player.shotCooldown <= 0) {
        const focus = player.precisionMode ? 1 : 0;
        const optionDistance = lerp(GAME_CONSTANTS.PLAYER.OPTION_DISTANCE, 14, focus);
        const originY = player.y - 22;

        spawnPlayerShot(player.x, originY, 0);
        spawnPlayerShot(player.x - optionDistance * 0.55, originY + 8, -30);
        spawnPlayerShot(player.x + optionDistance * 0.55, originY + 8, 30);

        player.shotCooldown += GAME_CONSTANTS.PLAYER.SHOT_INTERVAL;
    }
}

function updatePlayerBullets(deltaTime) {
    const shots = game.scene.playerBullets;
    const enemies = game.scene.enemies;

    for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        shot.x += shot.dx * deltaTime;
        shot.y += shot.dy * deltaTime;

        if (
            shot.x < -20 || shot.x > GAME_CONSTANTS.SCREEN.WIDTH + 20 ||
            shot.y < -30 || shot.y > GAME_CONSTANTS.SCREEN.HEIGHT + 30
        ) {
            shot.removed = true;
            continue;
        }

        for (let j = 0; j < enemies.length; j++) {
            const enemy = enemies[j];
            if (enemy.removed) continue;

            if (dist(shot.x, shot.y, enemy.x, enemy.y) <= enemy.radius + shot.radius) {
                enemy.hp -= shot.power;
                enemy.hitFlash = 1;
                enemy.flash = Math.max(enemy.flash, 0.55);
                shot.removed = true;
                if (enemy.hp <= 0) {
                    enemy.removed = true;
                    enemy.flash = 1;
                }
                break;
            }
        }
    }

    game.scene.playerBullets = shots.filter((shot) => !shot.removed);
    game.scene.enemies = enemies.filter((enemy) => !enemy.removed);
}

function renderPlayerBullets() {
    const ctx = game.context;
    game.scene.playerBullets.forEach((shot) => {
        ctx.save();
        ctx.translate(shot.x, shot.y);
        ctx.globalCompositeOperation = 'lighter';
        const gradient = ctx.createLinearGradient(0, -16, 0, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,0.96)');
        gradient.addColorStop(0.45, 'rgba(163, 245, 255, 0.92)');
        gradient.addColorStop(1, 'rgba(66, 181, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(4.5, 4);
        ctx.lineTo(0, 10);
        ctx.lineTo(-4.5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    });
}

function draw(bullet) {
    const ctx = game.context;
    const bulletCount = game.scene.bullets.length;
    const simplified = bulletCount > GAME_CONSTANTS.PERFORMANCE.BACKGROUND_EFFECT_BULLET_THRESHOLD;
    const prevX = bullet.prevX ?? bullet.x - bullet.dx * (game.performance.deltaTime / 1000);
    const prevY = bullet.prevY ?? bullet.y - bullet.dy * (game.performance.deltaTime / 1000);
    const trailWidth = Math.max(1, bullet.r * 0.52);
    const sprite = getBulletSprite(bullet, simplified);

    if (bullet.trailColor && bulletCount <= GAME_CONSTANTS.PERFORMANCE.TRAIL_BULLET_THRESHOLD) {
        ctx.save();
        ctx.strokeStyle = bullet.trailColor;
        ctx.lineWidth = trailWidth;
        ctx.lineCap = 'round';
        ctx.globalAlpha = simplified ? 0.45 : 0.78;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(bullet.x, bullet.y);
        ctx.stroke();
        ctx.restore();
    }

    ctx.save();
    if (!simplified) {
        ctx.globalCompositeOperation = 'lighter';
    }
    ctx.translate(bullet.x, bullet.y);
    if (bullet.sprite === 'needle') {
        ctx.rotate(bullet.rotation || 0);
    } else if (bullet.sprite === 'petal') {
        ctx.rotate((bullet.rotation || 0) + Math.PI / 2);
    }
    ctx.drawImage(sprite.canvas, -sprite.center, -sprite.center, sprite.size, sprite.size);
    ctx.restore();
}

function cls() {
    game.context.clearRect(0, 0, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT);
}

// Game Loop Functions
function updateGameState(current_time, frameDeltaTime) {
    game.performance.deltaTime = frameDeltaTime;
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

// Process bullet movement and collision detection with graze cooldown
function updateBullets() {
    let game_over = false;
    let gameOverPosition = { x: 0, y: 0 };  // Store position for game over effect
    const currentTime = performance.now();
    const deltaTime = game.performance.deltaTime / 1000.0;
    const bullets = game.scene.bullets;

    for (let i = 0; i < bullets.length; i++) {
        let bullet_now = bullets[i];
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
    }
    
    // Remove bullets marked for deletion
    game.scene.bullets = bullets.filter(bullet_now => !bullet_now.removed);
    
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
            const horizontal = (key_pressed[39] || key_pressed["D".charCodeAt(0)] ? 1 : 0) -
                (key_pressed[37] || key_pressed["A".charCodeAt(0)] ? 1 : 0);
            const vertical = (key_pressed[40] || key_pressed["S".charCodeAt(0)] ? 1 : 0) -
                (key_pressed[38] || key_pressed["W".charCodeAt(0)] ? 1 : 0);
            const diagonalFactor = horizontal !== 0 && vertical !== 0 ? Math.SQRT1_2 : 1;
            game.scene.player.x += horizontal * move_speed * diagonalFactor;
            game.scene.player.y += vertical * move_speed * diagonalFactor;
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
                let axisX = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
                let axisY = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0;
                const axisLength = Math.hypot(axisX, axisY);
                if (axisLength > 1) {
                    axisX /= axisLength;
                    axisY /= axisLength;
                }
                game.scene.player.x += axisX * gamepad_speed;
                game.scene.player.y += axisY * gamepad_speed;
            }
        }
    }

    const horizontalDelta = game.scene.player.x - game.scene.player.previousX;
    if (horizontalDelta < -0.4) {
        game.scene.player.renderDirection = -1;
    } else if (horizontalDelta > 0.4) {
        game.scene.player.renderDirection = 1;
    } else {
        game.scene.player.renderDirection = 0;
    }
    game.scene.player.previousX = game.scene.player.x;
    
    // Keep player within bounds
    game.scene.player.x = check_range(game.scene.player.x, 1, GAME_CONSTANTS.SCREEN.WIDTH);
    game.scene.player.y = check_range(game.scene.player.y, 1, GAME_CONSTANTS.SCREEN.HEIGHT);
}

// Render player
function renderPlayer() {
    if(!game.settings.observer) {
        const ctx = game.context;
        const player = game.scene.player;

        player.trail.forEach((afterImage, index) => {
            const alpha = (1 - index / player.trail.length) * 0.18;
            drawBloom(afterImage.x, afterImage.y + 4, 16, 'rgba(255, 126, 190, 0.4)', alpha);
        });

        drawBloom(player.x, player.y + 6, 40, 'rgba(255, 111, 175, 0.12)', 1);
        drawBloom(player.x, player.y, 24, 'rgba(136, 230, 255, 0.16)', 1);

        ctx.save();
        ctx.translate(player.x, player.y);
        if (game.renderCache.cirnoSpriteLoaded && game.renderCache.cirnoSprite) {
            const frameGroup = player.renderDirection < 0 ? 1 : player.renderDirection > 0 ? 2 : 0;
            const animFrame = getCirnoAnimFrame(frameGroup);
            const sx = game.renderCache.cirnoSourceX + animFrame * game.renderCache.cirnoFrameWidth;
            const sy = game.renderCache.cirnoSourceY + frameGroup * game.renderCache.cirnoFrameHeight;
            const drawWidth = 48;
            const drawHeight = 72;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                game.renderCache.cirnoSprite,
                sx,
                sy,
                game.renderCache.cirnoFrameWidth,
                game.renderCache.cirnoFrameHeight,
                -drawWidth / 2,
                -drawHeight / 2,
                drawWidth,
                drawHeight
            );
        } else {
            ctx.fillStyle = 'rgba(184, 239, 255, 0.62)';
            ctx.beginPath();
            ctx.moveTo(-12, 6);
            ctx.quadraticCurveTo(-34, 10, -22, 24);
            ctx.quadraticCurveTo(-10, 12, -4, 8);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(12, 6);
            ctx.quadraticCurveTo(34, 10, 22, 24);
            ctx.quadraticCurveTo(10, 12, 4, 8);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(156, 241, 255, 0.78)';
            [-1, 1].forEach((dir) => {
                for (let i = 0; i < 3; i++) {
                    const offsetY = -6 + i * 8;
                    ctx.beginPath();
                    ctx.moveTo(dir * 10, offsetY);
                    ctx.lineTo(dir * (18 + i * 5), offsetY - 7);
                    ctx.lineTo(dir * (22 + i * 6), offsetY);
                    ctx.lineTo(dir * (18 + i * 5), offsetY + 7);
                    ctx.closePath();
                    ctx.fill();
                }
            });

            const dressGradient = ctx.createLinearGradient(0, -16, 0, 20);
            dressGradient.addColorStop(0, '#f9ffff');
            dressGradient.addColorStop(0.42, '#69dfff');
            dressGradient.addColorStop(1, '#2f8fdc');
            ctx.fillStyle = dressGradient;
            ctx.beginPath();
            ctx.moveTo(0, -16);
            ctx.quadraticCurveTo(14, -8, 12, 6);
            ctx.quadraticCurveTo(16, 20, 0, 24);
            ctx.quadraticCurveTo(-16, 20, -12, 6);
            ctx.quadraticCurveTo(-14, -8, 0, -16);
            ctx.fill();
        }
        ctx.restore();
        
        if(game.scene.player.precisionMode) {
            game.context.save();
            game.context.strokeStyle = "rgba(162, 239, 255, 0.72)";
            game.context.lineWidth = 1.4;
            game.context.beginPath();
            game.context.arc(game.scene.player.x, game.scene.player.y, GAME_CONSTANTS.PLAYER.GRAZE_RADIUS, 0, Math.PI * 2);
            game.context.stroke();
            game.context.fillStyle = "rgba(255,255,255,0.92)";
            game.context.beginPath();
            game.context.arc(game.scene.player.x, game.scene.player.y, GAME_CONSTANTS.PLAYER.HITBOX_RADIUS + 1.2, 0, Math.PI * 2);
            game.context.fill();
            game.context.fillStyle = "#1aaeff";
            game.context.beginPath();
            game.context.arc(game.scene.player.x, game.scene.player.y, GAME_CONSTANTS.PLAYER.HITBOX_RADIUS - 0.4, 0, Math.PI * 2);
            game.context.fill();
            game.context.restore();
        }
    }
}

function tick(deltaTime) {
	updatePlayerTrail();
    updatePlayerShooting(deltaTime);
    updatePlayerBullets(deltaTime);
    const collidedWithEnemy = updateEnemies(deltaTime);
    generateEnemyBullets(deltaTime);
    return collidedWithEnemy;
}

// Main game loop
function main_loop(current_time) {
    // Update game state and get current FPS
    const targetFrameTime = GAME_CONSTANTS.TIMING.FRAME_TIME_MS;
    const elapsedSinceLastStep = current_time - game.performance.lastStepTime;

    if (elapsedSinceLastStep + 0.25 < targetFrameTime) {
        game.performance.requestId = requestAnimationFrame(t => main_loop(t));
        return;
    }

    let frameDeltaTime;
    if (elapsedSinceLastStep <= targetFrameTime * 1.5) {
        frameDeltaTime = targetFrameTime;
        game.performance.lastStepTime += targetFrameTime;
    } else {
        frameDeltaTime = Math.min(elapsedSinceLastStep, GAME_CONSTANTS.TIMING.MAX_DELTA_TIME_MS);
        game.performance.lastStepTime = current_time;
    }

    const fps = updateGameState(current_time, frameDeltaTime);

	cls();
    renderBackground();

    // Update player position (input handled by UI)
    updatePlayerPosition(window.mx || 0, window.my || 0, window.key_pressed || []);

    const enemyCollision = tick(frameDeltaTime / 1000.0);

    // Update bullets and check for game over
    const result = updateBullets();
    if(result.game_over || enemyCollision) {
        const position = enemyCollision
            ? { x: game.scene.player.x, y: game.scene.player.y }
            : result.position;
        game.markGameOver();
        if (typeof onGameOver === 'function') {
            onGameOver(position.x, position.y);
        }
        return;
    }

    renderEnemies();
    renderPlayerBullets();
    renderPlayer();
    
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
        game.scene.currentGeneratorName = generatorName;
        game.scene.bullets = [];
        game.scene.playerBullets = [];
        game.scene.enemies = [];
        game.scene.enemySystem.spawnCooldown = 0;
        game.scene.enemySystem.waveCounter = 0;
        
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
window.GAME_CONSTANTS = GAME_CONSTANTS;
window.SCREEN_WIDTH = GAME_CONSTANTS.SCREEN.WIDTH;
window.SCREEN_HEIGHT = GAME_CONSTANTS.SCREEN.HEIGHT;

window.main_loop = main_loop;
window.setBulletGenerator = setBulletGenerator; // Export the generator switching function
