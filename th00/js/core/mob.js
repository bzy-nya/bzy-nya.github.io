import { GAME_CONSTANTS } from './config.js';
import { dist } from './utils.js';
import { bullet_generator_template } from '../patterns/danmaku.js';
import { getStageEventMobConfig } from '../patterns/stage.js';
import { getTrajectory } from '../patterns/trajectory.js';

export function createEnemy(gameState, laneIndex, totalLanes, rowIndex, config = {}) {
    const laneWidth = GAME_CONSTANTS.SCREEN.WIDTH / (totalLanes + 1);
    const laneX = config.laneX ?? config.targetX ?? config.x ?? (config.boss
        ? GAME_CONSTANTS.SCREEN.WIDTH / 2
        : laneWidth * (laneIndex + 1));
    const startX = config.x ?? laneX;
    const startY = config.y ?? (config.boss ? -90 : -50 - rowIndex * 35);
    const hue = config.hue ?? (config.boss ? 195 : 300 + laneIndex * 14 + rowIndex * 12);

    return {
        id: gameState.scene.enemySystem.nextId++,
        x: startX,
        y: startY,
        previousX: startX,
        renderDirection: 0,
        facingDirection: 0,
        turnAge: 999,
        originX: startX,
        originY: startY,
        laneX,
        targetX: config.targetX ?? laneX,
        targetY: config.targetY ?? (118 + rowIndex * 68),
        radius: config.radius ?? GAME_CONSTANTS.ENEMY.RADIUS,
        hp: config.hp ?? GAME_CONSTANTS.ENEMY.HP,
        maxHp: config.hp ?? GAME_CONSTANTS.ENEMY.HP,
        hitFlash: 0,
        bobAmplitude: config.bobAmplitude ?? (20 + Math.random() * 16),
        bobSpeed: config.bobSpeed ?? (config.boss ? 0.45 : (0.8 + Math.random() * 0.7)),
        dashSpeed: config.dashSpeed,
        dashDirection: config.dashDirection,
        vx: config.vx,
        phase: config.phase ?? Math.random() * Math.PI * 2,
        age: 0,
        flash: 0,
        spiralAngle: Math.random() * Math.PI * 2,
        modeLifetime: config.duration ?? config.lifetime ?? GAME_CONSTANTS.ENEMY.LIFETIME_FRAMES,
        exitAt: config.exitAt ?? null,
        exitTrajectory: config.exitTrajectory || 'exitUp',
        entryFrames: config.entryFrames ?? 180,
        exitSpeed: config.exitSpeed ?? 2.4,
        isBoss: !!config.boss,
        removed: false,
        hue,
        texture: config.texture || (config.boss ? 'bossFairy' : 'fairyMob'),
        trajectory: config.trajectory || 'laneHover',
        bulletPattern: config.generator || config.bulletPattern || null
    };
}

function ensureTimelineState(gameState) {
    if (!gameState.scene.enemySystem.timeline) {
        gameState.scene.enemySystem.timeline = {
            fired: new Set()
        };
    }
    return gameState.scene.enemySystem.timeline;
}

function shouldFireEvent(gameState, event, timelineState) {
    const frame = gameState.scene.stageFrame;
    if (frame < event.frame || (event.until != null && frame > event.until)) return false;
    if (!event.repeatEvery) {
        if (frame !== event.frame || timelineState.fired.has(event.id)) return false;
        timelineState.fired.add(event.id);
        return true;
    }
    return (frame - event.frame) % event.repeatEvery === 0;
}

function spawnStageEvent(gameState, event) {
    const config = getStageEventMobConfig(event);
    const totalLanes = config.count ?? 1;
    const rowIndex = gameState.scene.enemySystem.waveCounter % 2;
    if (config.boss && gameState.scene.enemies.some((enemy) => enemy.isBoss && !enemy.removed)) return;

    for (let laneIndex = 0; laneIndex < totalLanes; laneIndex++) {
        if (gameState.scene.enemies.length >= GAME_CONSTANTS.ENEMY.MAX_COUNT) break;

        const laneValue = config.lanes?.[laneIndex];
        const laneX = laneValue != null ? GAME_CONSTANTS.SCREEN.WIDTH * laneValue : config.laneX;
        const spreadOffset = laneValue == null && totalLanes > 1
            ? (laneIndex - (totalLanes - 1) / 2) * (config.spreadX ?? 42)
            : 0;
        const rowOffset = laneValue == null && totalLanes > 1
            ? (laneIndex - (totalLanes - 1) / 2) * (config.spreadY ?? 18)
            : 0;
        const eventConfig = {
            ...config,
            laneX: laneX != null ? laneX + spreadOffset : undefined,
            x: config.x != null ? config.x + spreadOffset : laneX,
            targetX: config.targetX != null ? config.targetX + spreadOffset : laneX,
            y: config.y != null ? config.y + rowOffset : undefined,
            targetY: config.targetY != null ? config.targetY + rowOffset : undefined
        };
        gameState.scene.enemies.push(createEnemy(gameState, laneIndex, totalLanes, rowIndex, eventConfig));
    }
    gameState.scene.enemySystem.waveCounter++;
}

export function spawnEnemyWave(gameState) {
    const stage = gameState.scene.stage;
    const timelineState = ensureTimelineState(gameState);
    stage.timeline.forEach((event) => {
        if (event.type === 'spawn' && shouldFireEvent(gameState, event, timelineState)) {
            spawnStageEvent(gameState, event);
        } else if (event.type === 'clear' && shouldFireEvent(gameState, event, timelineState)) {
            gameState.scene.stageClearPending = true;
        }
    });
}

export function generateEnemyBullets(gameState, pushBullets) {
    if (gameState.scene.stageClearPending) return;
    if (gameState.scene.enemies.length === 0) return;

    const activeEmitters = gameState.scene.enemies.filter((enemy) => !enemy.removed);
    if (activeEmitters.length === 0) return;

    const allNewBullets = [];
    for (let index = 0; index < activeEmitters.length; index++) {
        const enemy = activeEmitters[index];
        const generator = bullet_generator_template[enemy.bulletPattern] || gameState.scene.bulletGenerator;
        if (!generator) continue;

        const proxyScene = {
            player: gameState.scene.player,
            bullets: gameState.scene.bullets,
            emitter: enemy
        };
        const emitterBullets = generator.tick(proxyScene) || [];
        if (emitterBullets.length > 0) {
            enemy.flash = Math.max(enemy.flash, enemy.isBoss ? 0.7 : 0.18 + (index % 2) * 0.06);
            allNewBullets.push(...emitterBullets);
        }
    }

    if (allNewBullets.length > 0) {
        pushBullets(allNewBullets);
    }
}

export function updateEnemies(gameState) {
    spawnEnemyWave(gameState);

    let enemyCollision = false;
    const player = gameState.scene.player;

    gameState.scene.enemies.forEach((enemy) => {
        enemy.age++;
        enemy.flash = Math.max(0, enemy.flash - 0.047);
        enemy.hitFlash = Math.max(0, enemy.hitFlash - 0.075);

        enemy.previousX = enemy.x;
        if (enemy.exitAt != null && enemy.age >= enemy.exitAt) {
            enemy.trajectory = enemy.exitTrajectory;
        }
        getTrajectory(enemy.trajectory).update(enemy);
        const horizontalDelta = enemy.x - enemy.previousX;
        enemy.renderDirection = horizontalDelta < -0.18 ? -1 : horizontalDelta > 0.18 ? 1 : 0;
        if (enemy.renderDirection !== 0) {
            if (enemy.facingDirection !== enemy.renderDirection) {
                enemy.facingDirection = enemy.renderDirection;
                enemy.turnAge = 0;
            } else {
                enemy.turnAge++;
            }
        } else {
            enemy.turnAge++;
        }

        if (
            !gameState.settings.observer &&
            dist(enemy.x, enemy.y, player.x, player.y) <= enemy.radius + GAME_CONSTANTS.PLAYER.COLLISION_RADIUS + 2
        ) {
            enemyCollision = true;
        }

        if (enemy.age >= enemy.modeLifetime || enemy.y < -120 || enemy.x < -120 || enemy.x > GAME_CONSTANTS.SCREEN.WIDTH + 120) {
            enemy.removed = true;
        }
    });

    gameState.scene.enemies = gameState.scene.enemies.filter((enemy) => !enemy.removed);
    gameState.scene.stageFrame++;
    return enemyCollision;
}
