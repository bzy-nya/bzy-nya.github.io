import { GAME_CONSTANTS } from '../core/config.js';
import { random_int } from '../core/utils.js';
import { ENEMY_BULLET_SPEED_MULTIPLIER, trajectory_template } from './trajectory.js';

export const bullet_template = {
    small: {
        r: 4,
        color: 'rgba(0, 112, 255, 0.96)',
        dayColor: 'rgb(0, 48, 165)',
        glowColor: 'rgba(0, 112, 255, 0.34)',
        dayGlowColor: 'rgba(0, 70, 210, 0.82)',
        coreColor: '#ffffff',
        dayCoreColor: '#d9e7ff',
        outlineColor: 'rgba(5, 12, 34, 0.86)',
        trailColor: 'rgba(0, 112, 255, 0.30)',
        dayTrailColor: 'rgba(0, 48, 165, 0.82)',
        sprite: 'orb',
        trajectory: 'bulletLinear',
        simulationTransform: trajectory_template.bulletLinear.transform,
        transform: trajectory_template.bulletLinear.transform,
        lastGrazed: 0
    },
    needle: {
        r: 7,
        color: 'rgba(224, 20, 96, 0.96)',
        dayColor: 'rgb(138, 0, 52)',
        glowColor: 'rgba(224, 20, 96, 0.34)',
        dayGlowColor: 'rgba(178, 0, 70, 0.82)',
        coreColor: '#fff7fd',
        dayCoreColor: '#ffd3df',
        outlineColor: 'rgba(42, 4, 24, 0.86)',
        trailColor: 'rgba(224, 20, 96, 0.30)',
        dayTrailColor: 'rgba(138, 0, 52, 0.82)',
        sprite: 'needle',
        trajectory: 'bulletLinear',
        simulationTransform: trajectory_template.bulletLinear.transform,
        transform: trajectory_template.bulletLinear.transform,
        lastGrazed: 0
    },
    big: {
        r: 15,
        color: 'rgba(0, 142, 180, 0.94)',
        dayColor: 'rgb(0, 82, 112)',
        glowColor: 'rgba(0, 142, 180, 0.30)',
        dayGlowColor: 'rgba(0, 110, 145, 0.11)',
        coreColor: '#ffffff',
        dayCoreColor: '#d7fbff',
        outlineColor: 'rgba(3, 20, 34, 0.86)',
        trailColor: 'rgba(0, 142, 180, 0.24)',
        dayTrailColor: 'rgba(0, 82, 112, 0.82)',
        sprite: 'orb',
        trajectory: 'bulletLinear',
        simulationTransform: trajectory_template.bulletLinear.transform,
        transform: trajectory_template.bulletLinear.transform,
        lastGrazed: 0
    },
    petal: {
        r: 10,
        color: 'rgba(188, 24, 142, 0.96)',
        dayColor: 'rgb(124, 0, 92)',
        glowColor: 'rgba(188, 24, 142, 0.34)',
        dayGlowColor: 'rgba(160, 0, 120, 0.82)',
        coreColor: '#fff7fb',
        dayCoreColor: '#ffe0f5',
        outlineColor: 'rgba(38, 4, 32, 0.86)',
        trailColor: 'rgba(188, 24, 142, 0.27)',
        dayTrailColor: 'rgba(124, 0, 92, 0.82)',
        sprite: 'petal',
        trajectory: 'bulletLinear',
        simulationTransform: trajectory_template.bulletLinear.transform,
        transform: trajectory_template.bulletLinear.transform,
        lastGrazed: 0
    },
    gravity: {
        r: 4,
        color: 'rgba(78, 96, 220, 0.96)',
        dayColor: 'rgb(42, 38, 160)',
        glowColor: 'rgba(78, 96, 220, 0.34)',
        dayGlowColor: 'rgba(58, 54, 205, 0.82)',
        coreColor: '#ffffff',
        dayCoreColor: '#e1e0ff',
        outlineColor: 'rgba(10, 12, 44, 0.86)',
        trailColor: 'rgba(78, 96, 220, 0.28)',
        dayTrailColor: 'rgba(42, 38, 160, 0.82)',
        sprite: 'orb',
        trajectory: 'bulletGravity',
        simulationTransform: trajectory_template.bulletGravity.transform,
        transform: trajectory_template.bulletGravity.transform,
        lastGrazed: 0
    },
    colorful: {
        r: 15,
        minRadius: 9,
        color: 'rgba(0,145,210,0.94)',
        dayColor: 'rgb(0,72,130)',
        glowColor: 'rgba(0,145,210,0.32)',
        dayGlowColor: 'rgba(0,96,168,0.11)',
        coreColor: '#ffffff',
        dayCoreColor: '#d8f3ff',
        outlineColor: 'rgba(4, 18, 36, 0.86)',
        trailColor: 'rgba(0,145,210,0.24)',
        dayTrailColor: 'rgba(0,72,130,0.82)',
        sprite: 'orb',
        real_color: { r: 0, g: 145, b: 210 },
        trajectory: 'bulletColorfulDrift',
        simulationTransform: trajectory_template.bulletLinear.transform,
        transform: trajectory_template.bulletColorfulDrift.transform,
        lastGrazed: 0
    }
};

export function cloneBulletTemplate(template) {
    const bullet = { ...template };
    if (template.real_color) {
        bullet.real_color = { ...template.real_color };
    }
    bullet.lastGrazed = -GAME_CONSTANTS.GRAZE_COOLDOWN_FRAMES;
    return bullet;
}

export function getEmitterPoint(scene, fallbackX, fallbackY) {
    if (scene?.emitter) {
        return { x: scene.emitter.x, y: scene.emitter.y };
    }
    if (scene?.emitters && scene.emitters.length > 0) {
        const emitter = scene.emitters[random_int(0, scene.emitters.length - 1)];
        return { x: emitter.x, y: emitter.y };
    }
    return { x: fallbackX, y: fallbackY };
}

export function randomTopEmitterFallback() {
    return {
        x: Math.random() * GAME_CONSTANTS.SCREEN.WIDTH,
        y: 10
    };
}

export function randomSignedVelocity(maxSpeed) {
    return (Math.random() > 0.5 ? 1 : -1) * Math.random() * maxSpeed;
}

export function selectBulletTemplate(templates) {
    return templates[random_int(0, templates.length - 1)];
}

export function createGeneratorBullet(generator, scene, fallbackPoint = randomTopEmitterFallback) {
    const bullet = cloneBulletTemplate(selectBulletTemplate(generator.bullet_templates));
    const fallback = typeof fallbackPoint === 'function' ? fallbackPoint() : fallbackPoint;
    const emitter = getEmitterPoint(scene, fallback.x, fallback.y);

    bullet.x = emitter.x;
    bullet.y = emitter.y;
    return bullet;
}

export function generateRateLimitedBullets(generator, scene, configureBullet, fallbackPoint = randomTopEmitterFallback) {
    const newBullets = [];
    generator.state.accumulator = (generator.state.accumulator || 0) + generator.bullets_per_frame;
    const bulletsToGenerate = Math.floor(generator.state.accumulator);
    generator.state.accumulator -= bulletsToGenerate;

    for (let i = 0; i < bulletsToGenerate; i++) {
        if (scene.bullets.length + newBullets.length >= generator.bullet_limit) break;

        const bullet = createGeneratorBullet(generator, scene, fallbackPoint);
        configureBullet(bullet, scene);
        newBullets.push(bullet);
    }

    return newBullets;
}

export { ENEMY_BULLET_SPEED_MULTIPLIER };
