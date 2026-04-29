// Core game object that encapsulates all game state
import { GAME_CONSTANTS, TH00_ASSET_PATHS, TH00_INPUT_STATE } from './config.js';
import { check_range, dist, lerp } from './utils.js';
import { createStageBackground, drawBloom as drawSceneBloom, renderBackground as renderStageBackground } from './scene.js';
import { getBulletRenderStyle, getBulletSprite, getEnemySprite } from './texture.js';
import { DEFAULT_STAGE, resolveStage } from '../patterns/stage.js';
import { generateEnemyBullets as generateMobBullets, updateEnemies as updateMobs } from './mob.js';
import { bullet_generator_template } from '../patterns/danmaku.js';
import { updatePlayerAI } from '../systems/ai.js';
import { pauseStageMusic, playPlayerScore, playSound, playStageMusic, resetAudioState, resumeStageMusic, stopStageMusic } from '../ui/audio.js';

const gameCallbacks = {
    onGameOver: null,
    onGameStatUpdate: null,
    onStageClear: null,
    showGrazeEffect: null,
    getGamepad: null
};

export function setGameCallbacks(callbacks) {
    Object.assign(gameCallbacks, callbacks);
}

export const game = {
	context: null, // Canvas context for rendering
    renderCache: {
        bulletSprites: new Map(),
        enemySprites: new Map(),
        enemySpriteSheet: null,
        enemySpriteLoaded: false,
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
        effects: [],
        enemySystem: {
            spawnCooldown: 0,
            waveCounter: 0,
            nextId: 1
        },
        stage: DEFAULT_STAGE,
        stageFrame: 0,
        stageClearPending: false,
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
        isGameOver: false,
        isStageClear: false
    },
    
    // Performance
    performance: {
		frameCount: 0,
		requestId: 0,
        loopId: 0,
        fps: 0,
        fpsSampleFrame: 0,
        fpsSampleTime: 0,
        lastStepTime: 0
    },
    
    // Initialize/reset game
    init: function(context) {
        if (this.performance.requestId) {
            cancelAnimationFrame(this.performance.requestId);
            this.performance.requestId = 0;
        }
        this.performance.loopId++;

		// Store canvas context
		this.context = context;
		
			// Reset game state
			this.scene.bullets = [];
            this.scene.playerBullets = [];
        this.scene.effects = [];
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
        this.scene.enemySystem.timeline = { fired: new Set() };
        this.scene.stage = resolveStage(this.scene.currentGeneratorName);
        this.scene.stageFrame = 0;
        this.scene.stageClearPending = false;
        this.scene.background = createStageBackground();
		this.graze = 0;
		
		// Use default generator (AimedRandomMix) if none set
		if (!this.scene.bulletGenerator) {
			this.scene.bulletGenerator = bullet_generator_template['AimedRandomMix'];
		}
        resetStageGenerators(this.scene.stage);

        if (!this.renderCache.cirnoSprite) {
            const cirnoSprite = new Image();
            cirnoSprite.onload = () => {
                this.renderCache.cirnoSpriteLoaded = true;
            };
            cirnoSprite.src = TH00_ASSET_PATHS.images.cirno;
            this.renderCache.cirnoSprite = cirnoSprite;
        }
        if (!this.renderCache.enemySpriteSheet) {
            const enemySpriteSheet = new Image();
            enemySpriteSheet.onload = () => {
                this.renderCache.enemySpriteLoaded = true;
                this.renderCache.enemySprites.clear();
            };
            enemySpriteSheet.src = TH00_ASSET_PATHS.images.enemySpriteSheet;
            this.renderCache.enemySpriteSheet = enemySpriteSheet;
        }
		
		// Reset performance metrics
		this.performance.frameCount = 0;
        this.performance.fps = 0;
        this.performance.fpsSampleFrame = 0;
        this.performance.fpsSampleTime = 0;
        this.performance.lastStepTime = 0;
        resetAudioState();
        playStageMusic(this.scene.stage.background?.music);

        this.state.hasStarted = true;
        this.state.isRunning = true;
        this.state.isPaused = false;
        this.state.isGameOver = false;
        this.state.isStageClear = false;
		
		// Start game loop
		scheduleMainLoop(this.performance.loopId);
    },

    // Stop the game
    stop: function() {
    	cancelAnimationFrame(this.performance.requestId);
        this.performance.requestId = 0;
        this.performance.loopId++;
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.state.isStageClear = false;
        stopStageMusic();
    },

    pause: function() {
        if (!this.state.isRunning || this.state.isGameOver) return;
        cancelAnimationFrame(this.performance.requestId);
        this.performance.requestId = 0;
        this.performance.loopId++;
        this.state.isRunning = false;
        this.state.isPaused = true;
        pauseStageMusic();
        playSound('pause');
    },

    resume: function() {
        if (!this.state.isPaused || this.state.isGameOver) return;
        this.state.isPaused = false;
        this.state.isRunning = true;
        this.performance.loopId++;
        this.performance.fpsSampleTime = 0;
        this.performance.fpsSampleFrame = this.performance.frameCount;
        this.performance.lastStepTime = 0;
        resumeStageMusic();
        scheduleMainLoop(this.performance.loopId);
    },

    markGameOver: function() {
        cancelAnimationFrame(this.performance.requestId);
        this.performance.requestId = 0;
        this.performance.loopId++;
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.state.isGameOver = true;
        this.state.isStageClear = false;
        stopStageMusic();
        playPlayerScore();
    },

    markStageClear: function() {
        cancelAnimationFrame(this.performance.requestId);
        this.performance.requestId = 0;
        this.performance.loopId++;
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.state.isGameOver = false;
        this.state.isStageClear = true;
        stopStageMusic();
    }
};

function drawBloom(x, y, radius, color, alpha = 1) {
    drawSceneBloom(game.context, x, y, radius, color, alpha);
}

function resetStageGenerators(stage) {
    const generatorNames = new Set([stage.defaultGenerator]);
    stage.timeline.forEach((event) => {
        if (event.generator) generatorNames.add(event.generator);
    });
    generatorNames.forEach((name) => {
        if (bullet_generator_template[name]?.reset) {
            bullet_generator_template[name].reset();
        } else if (bullet_generator_template[name]?.state) {
            bullet_generator_template[name].state = {};
        }
    });
}

function pushBullets(newBullets) {
    game.scene.bullets.push(...newBullets);
    if (game.scene.bullets.length > GAME_CONSTANTS.BULLET_LIMIT) {
        game.scene.bullets.splice(0, game.scene.bullets.length - GAME_CONSTANTS.BULLET_LIMIT);
    }
}

function spawnBreakEffect(source, options = {}) {
    const pieces = options.pieces ?? (source.isBoss ? 30 : 16);
    const colors = options.colors ?? (source.isBoss
        ? ['rgba(122, 236, 255, 0.96)', 'rgba(239, 71, 111, 0.92)', 'rgba(255, 209, 102, 0.90)']
        : ['rgba(122, 236, 255, 0.90)', 'rgba(255, 255, 255, 0.86)', `hsla(${source.hue}, 100%, 72%, 0.88)`]);
    game.scene.effects.push({
        type: 'break',
        x: source.x,
        y: source.y,
        radius: source.radius,
        age: 0,
        lifetime: options.lifetime ?? (source.isBoss ? 44 : 30),
        colors,
        pieces: Array.from({ length: pieces }, (_, index) => {
            const angle = Math.PI * 2 * index / pieces + Math.random() * 0.24;
            const speed = (source.isBoss ? 2.8 : 2.1) + Math.random() * (source.isBoss ? 3.1 : 2.2);
            return {
                angle,
                speed,
                size: (source.isBoss ? 2.8 : 2.0) + Math.random() * 3.2,
                spin: (Math.random() - 0.5) * 0.22,
                color: colors[index % colors.length]
            };
        })
    });
}

function spawnEnemyBreakEffect(enemy) {
    spawnBreakEffect(enemy);
}

function spawnPlayerBreakEffect(position) {
    spawnBreakEffect({
        x: position.x,
        y: position.y,
        radius: 18,
        hue: 196,
        isBoss: false
    }, {
        pieces: 22,
        lifetime: 40,
        colors: ['rgba(136, 230, 255, 0.96)', 'rgba(255, 111, 175, 0.92)', 'rgba(255, 255, 255, 0.88)']
    });
}

function updateEffects() {
    const effects = game.scene.effects;
    let writeIndex = 0;
    for (let i = 0; i < effects.length; i++) {
        const effect = effects[i];
        effect.age++;
        if (effect.age < effect.lifetime) {
            effects[writeIndex++] = effect;
        }
    }
    effects.length = writeIndex;
}

function renderEffects() {
    const ctx = game.context;
    game.scene.effects.forEach((effect) => {
        if (effect.type !== 'break') return;

        const t = effect.age / effect.lifetime;
        const alpha = Math.max(0, 1 - t);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const ringRadius = effect.radius + t * (effect.radius * 2.4 + 18);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.46 * alpha})`;
        ctx.lineWidth = 2 + (1 - t) * 3;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();

        effect.pieces.forEach((piece, index) => {
            const drift = piece.speed * effect.age;
            const px = effect.x + Math.cos(piece.angle) * drift;
            const py = effect.y + Math.sin(piece.angle) * drift + t * t * 18;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(piece.angle + effect.age * piece.spin);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = piece.color;
            if (index % 3 === 0) {
                ctx.fillRect(-piece.size, -piece.size, piece.size * 2.0, piece.size * 2.0);
            } else {
                ctx.beginPath();
                ctx.moveTo(0, -piece.size * 1.5);
                ctx.lineTo(piece.size, piece.size);
                ctx.lineTo(-piece.size, piece.size);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        });

        ctx.restore();
    });
}

function renderEnemies() {
    const ctx = game.context;
    game.scene.enemies.forEach((enemy) => {
        const glowColor = `hsla(${enemy.hue}, 100%, 78%, 0.32)`;
        drawBloom(enemy.x, enemy.y, (enemy.isBoss ? 44 : 28) + enemy.flash * 16, glowColor, 0.85);
        if (enemy.hitFlash > 0) {
            drawBloom(enemy.x, enemy.y, 24 + enemy.hitFlash * 12, 'rgba(255,255,255,0.48)', enemy.hitFlash);
        }

        const sprite = getEnemySprite(game.renderCache, enemy);
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
    player.auraPhase++;
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

function updatePlayerShooting() {
    const player = game.scene.player;
    player.shotCooldown = Math.max(0, player.shotCooldown - 1);

    const gamepad = game.settings.inputMode === "gamepad" && gameCallbacks.getGamepad
        ? gameCallbacks.getGamepad()[0]
        : null;
    const gamepadShooting = !!(gamepad && gamepad.buttons[0] && gamepad.buttons[0].pressed);
    const mouseShooting = game.settings.inputMode === "mouse" && TH00_INPUT_STATE.mouseDown;
    const keyboardShooting = game.settings.inputMode === "keyboard" && !!TH00_INPUT_STATE.keys["Z".charCodeAt(0)];
    const isShooting = game.settings.autoplay ||
        keyboardShooting ||
        mouseShooting ||
        gamepadShooting;

    if (!isShooting || game.settings.observer) {
        return;
    }

    while (player.shotCooldown <= 0) {
        const focus = player.precisionMode ? 1 : 0;
        const optionDistance = lerp(GAME_CONSTANTS.PLAYER.OPTION_DISTANCE, 14, focus);
        const originY = player.y - 22;

        spawnPlayerShot(player.x, originY, 0);
        spawnPlayerShot(player.x - optionDistance * 0.55, originY + 8, -0.5);
        spawnPlayerShot(player.x + optionDistance * 0.55, originY + 8, 0.5);

        player.shotCooldown += GAME_CONSTANTS.PLAYER.SHOT_INTERVAL_FRAMES;
    }
}

function updatePlayerBullets() {
    const shots = game.scene.playerBullets;
    const enemies = game.scene.enemies;

    for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        shot.x += shot.dx;
        shot.y += shot.dy;

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
                playSound('damage', game.performance.frameCount);
                if (enemy.hp <= 0) {
                    spawnEnemyBreakEffect(enemy);
                    playSound('blowup', game.performance.frameCount);
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

function drawBulletTrail(ctx, bullet, bulletCount) {
    const prevX = bullet.prevX ?? bullet.x - bullet.dx;
    const prevY = bullet.prevY ?? bullet.y - bullet.dy;
    const trailWidth = Math.max(1, bullet.r * 0.52);
    const style = getBulletRenderStyle(bullet);

    if (style.trailColor && bulletCount <= GAME_CONSTANTS.PERFORMANCE.TRAIL_BULLET_THRESHOLD) {
        ctx.strokeStyle = style.trailColor;
        ctx.lineWidth = trailWidth;
        ctx.globalAlpha = 0.78;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(bullet.x, bullet.y);
        ctx.stroke();
    }
}

function drawBulletSprite(ctx, bullet) {
    const sprite = getBulletSprite(game.renderCache, bullet);

    if (bullet.sprite === 'needle' || bullet.sprite === 'petal') {
        const rotation = bullet.sprite === 'needle'
            ? (bullet.rotation || 0)
            : (bullet.rotation || 0) + Math.PI / 2;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        ctx.setTransform(cos, sin, -sin, cos, bullet.x, bullet.y);
        ctx.drawImage(sprite.canvas, -sprite.center, -sprite.center, sprite.size, sprite.size);
        return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sprite.canvas, bullet.x - sprite.center, bullet.y - sprite.center, sprite.size, sprite.size);
}

function renderEnemyBullets() {
    const ctx = game.context;
    const bullets = game.scene.bullets;
    const bulletCount = bullets.length;
    if (bulletCount === 0) return;

    if (bulletCount <= GAME_CONSTANTS.PERFORMANCE.TRAIL_DISABLE_BULLET_THRESHOLD) {
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < bulletCount; i++) {
            drawBulletTrail(ctx, bullets[i], bulletCount);
        }
        ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < bulletCount; i++) {
        drawBulletSprite(ctx, bullets[i]);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
}

function cls() {
    game.context.clearRect(0, 0, GAME_CONSTANTS.SCREEN.WIDTH, GAME_CONSTANTS.SCREEN.HEIGHT);
}

function getFpsTimestamp() {
    return window.performance ? window.performance.now() : 0;
}

function updateGameState() {
    game.performance.frameCount++;
    const timestamp = getFpsTimestamp();

    if (!game.performance.fpsSampleTime) {
        game.performance.fpsSampleTime = timestamp;
        game.performance.fpsSampleFrame = game.performance.frameCount;
        game.performance.fps = GAME_CONSTANTS.TIMING.TARGET_FPS;
        return game.performance.fps;
    }

    const sampledFrames = game.performance.frameCount - game.performance.fpsSampleFrame;
    const elapsed = timestamp - game.performance.fpsSampleTime;
    if (sampledFrames >= 20 && elapsed > 0) {
        game.performance.fps = Math.round((sampledFrames * 1000) / elapsed);
        game.performance.fpsSampleFrame = game.performance.frameCount;
        game.performance.fpsSampleTime = timestamp;
    }

    return game.performance.fps;
}

// Process bullet movement and collision detection with graze cooldown
function updateBullets() {
    let game_over = false;
    let gameOverPosition = { x: 0, y: 0 };  // Store position for game over effect
    const bullets = game.scene.bullets;
    const currentFrame = game.performance.frameCount;
    const player = game.scene.player;
    const collisionRadius = GAME_CONSTANTS.PLAYER.COLLISION_RADIUS;
    const grazeRadius = GAME_CONSTANTS.PLAYER.GRAZE_RADIUS;
    let writeIndex = 0;

    for (let i = 0; i < bullets.length; i++) {
        const bullet_now = bullets[i].transform(bullets[i]);
        const { x, y, r } = bullet_now;

        // Remove bullets that go off-screen
        if(x < 0 || x > GAME_CONSTANTS.SCREEN.WIDTH || y < 0 || y > GAME_CONSTANTS.SCREEN.HEIGHT) {
            bullet_now.removed = true;
            continue;
        }

        // Check collisions with player
        if(!game.settings.observer) {
            const dx = x - player.x;
            const dy = y - player.y;
            const distanceSq = dx * dx + dy * dy;
            const hitRadius = collisionRadius + r;
            if(distanceSq <= hitRadius * hitRadius) {
                game_over = true;
                gameOverPosition = { x: player.x, y: player.y };
            }

            // Enhanced graze detection with cooldown
            const grazeDistance = grazeRadius + r;
            if(distanceSq <= grazeDistance * grazeDistance) {
                // Initialize lastGrazed if it doesn't exist
                if (typeof bullet_now.lastGrazed === 'undefined') {
                    bullet_now.lastGrazed = 0;
                }

                // Check if this bullet can register a new graze
                if (currentFrame - bullet_now.lastGrazed >= GAME_CONSTANTS.GRAZE_COOLDOWN_FRAMES) {
                    game.graze++;
                    bullet_now.lastGrazed = currentFrame;

                    // Trigger visual effect for graze
                    if (game.settings.visualGrazeFeedback && gameCallbacks.showGrazeEffect) {
                        const style = getBulletRenderStyle(bullet_now);
                        gameCallbacks.showGrazeEffect(x, y, style.color);
                    }
                }
            }
        }

        bullets[writeIndex++] = bullet_now;
    }

    bullets.length = writeIndex;
    return { game_over, position: gameOverPosition };
}

// Update player position based on input
function updatePlayerPosition(mx, my, key_pressed) {
    if(game.settings.autoplay) {
        updatePlayerAI(game);
    } else {
        const baseSpeed = game.scene.player.precisionMode ? 
            GAME_CONSTANTS.PLAYER.PRECISE_SPEED : 
            GAME_CONSTANTS.PLAYER.NORMAL_SPEED;
        const move_speed = baseSpeed;
        
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
            const gp = gameCallbacks.getGamepad ? gameCallbacks.getGamepad()[0] : null;
            if(gp) {
                game.scene.player.precisionMode = gp.buttons[6].pressed;
                const gamepad_speed = (game.scene.player.precisionMode ? 
                    GAME_CONSTANTS.PLAYER.PRECISE_SPEED : 
                    GAME_CONSTANTS.PLAYER.NORMAL_SPEED);
                
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

function getCirnoAnimFrame(frameGroup) {
    const tick = Math.floor(game.performance.frameCount / 6);
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

function tick() {
	updatePlayerTrail();
    updatePlayerShooting();
    updatePlayerBullets();
    const collidedWithEnemy = updateMobs(game);
    generateMobBullets(game, pushBullets);
    updateEffects();
    return collidedWithEnemy;
}

function isStageClearReady() {
    return game.scene.stageClearPending &&
        game.scene.bullets.length === 0;
}

function clearStageProjectiles() {
    game.scene.bullets.length = 0;
    game.scene.playerBullets.length = 0;
}

function renderStoppedEffectFrame() {
    cls();
    renderStageBackground(
        game.context,
        game.scene.background,
        game.performance.frameCount,
        game.scene.bullets.length,
        document.body.classList.contains('dark-theme')
    );
    renderEnemyBullets();
    renderEnemies();
    renderPlayerBullets();
    renderEffects();
}

function scheduleStoppedEffectLoop(loopId) {
    if (loopId !== game.performance.loopId || game.scene.effects.length === 0) return;
    game.performance.requestId = requestAnimationFrame(() => {
        if (loopId !== game.performance.loopId) return;
        game.performance.requestId = 0;
        game.performance.frameCount++;
        updateEffects();
        renderStoppedEffectFrame();
        scheduleStoppedEffectLoop(loopId);
    });
}

function scheduleMainLoop(loopId) {
    if (loopId !== game.performance.loopId || !game.state.isRunning) return;
    if (game.performance.requestId) {
        cancelAnimationFrame(game.performance.requestId);
    }
    game.performance.requestId = requestAnimationFrame((timestamp) => main_loop(timestamp, loopId));
}

// Main game loop
function main_loop(currentTime = 0, loopId) {
    if (loopId !== game.performance.loopId || !game.state.isRunning) {
        return;
    }
    game.performance.requestId = 0;

    const targetFrameTime = 1000 / GAME_CONSTANTS.TIMING.TARGET_FPS;
    if (!game.performance.lastStepTime) {
        game.performance.lastStepTime = currentTime;
    }

    const elapsedSinceLastStep = currentTime - game.performance.lastStepTime;
    if (elapsedSinceLastStep + 0.25 < targetFrameTime) {
        scheduleMainLoop(loopId);
        return;
    }

    if (elapsedSinceLastStep <= targetFrameTime * 1.5) {
        game.performance.lastStepTime += targetFrameTime;
    } else {
        game.performance.lastStepTime = currentTime;
    }

    const fps = updateGameState();

	cls();
    renderStageBackground(
        game.context,
        game.scene.background,
        game.performance.frameCount,
        game.scene.bullets.length,
        document.body.classList.contains('dark-theme')
    );

    // Update player position (input handled by UI)
    updatePlayerPosition(TH00_INPUT_STATE.mouseX, TH00_INPUT_STATE.mouseY, TH00_INPUT_STATE.keys);

    const enemyCollision = tick();

    if (game.scene.stageClearPending) {
        clearStageProjectiles();
    }

    // Update bullets and check for game over
    const result = updateBullets();
    if(result.game_over || enemyCollision) {
        const position = enemyCollision
            ? { x: game.scene.player.x, y: game.scene.player.y }
            : result.position;
        spawnPlayerBreakEffect(position);
        game.markGameOver();
        renderStoppedEffectFrame();
        scheduleStoppedEffectLoop(game.performance.loopId);
        if (gameCallbacks.onGameOver) {
            gameCallbacks.onGameOver(position.x, position.y);
        }
        return;
    }

    if (isStageClearReady()) {
        game.markStageClear();
        if (gameCallbacks.onStageClear) {
            gameCallbacks.onStageClear({
                stage: game.scene.stage.id,
                graze: game.graze,
                frame: game.scene.stageFrame
            });
        }
        return;
    }

    renderEnemyBullets();
    renderEffects();
    renderEnemies();
    renderPlayerBullets();
    renderPlayer();
    
    // Notify UI about updates
    if (gameCallbacks.onGameStatUpdate) {
        gameCallbacks.onGameStatUpdate(fps, game.graze);
    }

    scheduleMainLoop(loopId);
}

// Update setBulletGenerator function to work with new template naming
export function setBulletGenerator(generatorName) {
    // Check if the generator exists
    if (bullet_generator_template[generatorName]) {
        game.scene.stage = resolveStage(generatorName);
        game.scene.bulletGenerator = bullet_generator_template[generatorName];
        game.scene.currentGeneratorName = generatorName;
        game.scene.bullets = [];
        game.scene.playerBullets = [];
        game.scene.enemies = [];
        game.scene.enemySystem.spawnCooldown = 0;
        game.scene.enemySystem.waveCounter = 0;
        game.scene.enemySystem.timeline = { fired: new Set() };
        game.scene.stageFrame = 0;
        game.scene.stageClearPending = false;
        
        resetStageGenerators(game.scene.stage);
        
        // Return success
        return true;
    }
    
    // Return false if generator not found
    return false;
}

window.game = game;
