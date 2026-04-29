import { GAME_CONSTANTS } from '../core/config.js';

export const mob_template = {
    fairyDefault: Object.freeze({
        radius: GAME_CONSTANTS.ENEMY.RADIUS,
        hp: GAME_CONSTANTS.ENEMY.HP,
        lifetime: GAME_CONSTANTS.ENEMY.LIFETIME_FRAMES,
        targetY: 56,
        texture: 'fairyMob',
        trajectory: 'laneHover',
        bulletPattern: null
    }),

    dreamScout: Object.freeze({
        count: 1,
        radius: GAME_CONSTANTS.ENEMY.RADIUS,
        hp: 6,
        lifetime: 420,
        targetY: 78,
        bobAmplitude: 10,
        texture: 'fairyMob',
        trajectory: 'dreamFormation',
        bulletPattern: 'DreamPetalFan'
    }),

    dreamDashScout: Object.freeze({
        count: 1,
        radius: GAME_CONSTANTS.ENEMY.RADIUS,
        hp: 3,
        lifetime: 1000,
        targetY: 88,
        bobAmplitude: 16,
        dashSpeed: 5.8,
        texture: 'fairyMob',
        trajectory: 'dreamDash',
        bulletPattern: 'DreamPetalFan'
    }),

    dreamSwerver: Object.freeze({
        count: 1,
        radius: GAME_CONSTANTS.ENEMY.RADIUS + 1,
        hp: 8,
        lifetime: 340,
        targetY: 116,
        bobAmplitude: 30,
        dashSpeed: 3.8,
        texture: 'fairyMob',
        trajectory: 'dreamSwerve',
        bulletPattern: 'DreamLattice'
    }),

    dreamWeaver: Object.freeze({
        count: 1,
        radius: GAME_CONSTANTS.ENEMY.RADIUS + 2,
        hp: 14,
        lifetime: 560,
        targetY: 116,
        bobAmplitude: 12,
        texture: 'fairyMob',
        trajectory: 'dreamFormation',
        bulletPattern: 'DreamLattice'
    }),

    dreamAnchor: Object.freeze({
        count: 1,
        radius: GAME_CONSTANTS.ENEMY.RADIUS + 3,
        hp: 18,
        lifetime: 660,
        targetY: 138,
        bobAmplitude: 0,
        texture: 'fairyMob',
        trajectory: 'dreamStableCaster',
        bulletPattern: 'DreamOrbit'
    }),

    fairyRain: Object.freeze({
        count: 5,
        targetY: 52,
        lifetime: 1080,
        texture: 'fairyMob',
        trajectory: 'laneHover'
    }),

    fairyWide: Object.freeze({
        count: 3,
        targetY: 58,
        lifetime: 1080,
        texture: 'fairyMob',
        trajectory: 'laneHover'
    }),

    fairyRandom: Object.freeze({
        count: 4,
        targetY: 54,
        lifetime: 1020,
        texture: 'fairyMob',
        trajectory: 'laneHover'
    }),

    fairySnowy: Object.freeze({
        count: 4,
        targetY: 56,
        lifetime: 1080,
        texture: 'fairyMob',
        trajectory: 'laneHover'
    }),

    bossWave: Object.freeze({
        boss: true,
        count: 1,
        radius: GAME_CONSTANTS.ENEMY.BOSS_RADIUS,
        hp: GAME_CONSTANTS.ENEMY.BOSS_HP,
        lifetime: GAME_CONSTANTS.ENEMY.BOSS_LIFETIME_FRAMES,
        targetY: 188,
        bobAmplitude: 18,
        texture: 'bossFairy',
        trajectory: 'laneHover',
        bulletPattern: 'Wave'
    }),

    bossGravity: Object.freeze({
        boss: true,
        count: 1,
        radius: GAME_CONSTANTS.ENEMY.BOSS_RADIUS + 2,
        hp: GAME_CONSTANTS.ENEMY.BOSS_HP + 10,
        lifetime: GAME_CONSTANTS.ENEMY.BOSS_LIFETIME_FRAMES,
        targetY: 176,
        bobAmplitude: 12,
        texture: 'bossFairy',
        trajectory: 'laneHover',
        bulletPattern: 'Gravity'
    }),

    dreamBoss: Object.freeze({
        boss: true,
        count: 1,
        radius: GAME_CONSTANTS.ENEMY.BOSS_RADIUS + 4,
        hp: 200,
        lifetime: 2400,
        targetY: 172,
        bobAmplitude: 0,
        texture: 'bossFairy',
        trajectory: 'dreamStableCaster',
        bulletPattern: 'DreamBossBloom'
    })
};

export function resolveMobTemplate(name) {
    return mob_template[name] || mob_template.fairyDefault;
}
