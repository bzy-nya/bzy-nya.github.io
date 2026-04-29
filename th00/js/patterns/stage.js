import { TH00_ASSET_PATHS } from '../core/config.js';
import { resolveMobTemplate } from './mob.js';

const background = Object.freeze({
    scene: 'themeReactiveCitySpace',
    music: null
});

const dreamBackground = Object.freeze({
    scene: 'themeReactiveCitySpace',
    music: TH00_ASSET_PATHS.music.dream
});

function stage(id, defaultGenerator, timeline, options = {}) {
    return Object.freeze({
        id,
        defaultGenerator,
        background: options.background || background,
        clearFrame: options.clearFrame ?? null,
        timeline: Object.freeze(timeline.map((event) => Object.freeze({ ...event })))
    });
}

function repeatedWave(id, frame, until, repeatEvery, mob, count, generator, targetY) {
    return {
        id,
        type: 'spawn',
        frame,
        until,
        repeatEvery,
        mob,
        count,
        generator,
        targetY
    };
}

export const stage_template = {
    AimedRandomMix: stage('AimedRandomMix', 'AimedRandomMix', [
        repeatedWave('aimed-basic-a', 0, 5400, 132, 'fairyDefault', 3, 'AimedRandomMix', 56),
        repeatedWave('aimed-basic-b', 132, 5400, 264, 'fairyDefault', 4, 'AimedRandomMix', 124)
    ]),

    Random: stage('Random', 'Random', [
        repeatedWave('random-four', 0, 5400, 132, 'fairyRandom', 4, 'Random', 54)
    ]),

    WideAngleAim: stage('WideAngleAim', 'WideAngleAim', [
        repeatedWave('wide-three', 0, 5400, 132, 'fairyWide', 3, 'WideAngleAim', 58)
    ]),

    Rain: stage('Rain', 'Rain', [
        repeatedWave('rain-five', 0, 5400, 132, 'fairyRain', 5, 'Rain', 52)
    ]),

    Wave: stage('Wave', 'Wave', [
        { id: 'wave-boss', type: 'spawn', frame: 0, mob: 'bossWave', count: 1, generator: 'Wave', x: 300, y: -90, targetX: 300, targetY: 188 }
    ]),

    Gravity: stage('Gravity', 'Gravity', [
        { id: 'gravity-boss', type: 'spawn', frame: 0, mob: 'bossGravity', count: 1, generator: 'Gravity', x: 300, y: -90, targetX: 300, targetY: 176 }
    ]),

    Snowy: stage('Snowy', 'Snowy', [
        repeatedWave('snowy-four', 0, 5400, 132, 'fairySnowy', 4, 'Snowy', 56)
    ]),

    Dream: stage('dream', 'Dream', [
        { id: 'dream-intro-left', type: 'spawn', frame: 0, mob: 'dreamDashScout', count: 1, generator: 'DreamPetalFan', lanes: [0.16, 0.30], x: -64, targetX: 126, y: 70, targetY: 82, dashDirection: 1, entryFrames: 24, duration: 216 },
        { id: 'dream-intro-left-2', type: 'spawn', frame: 18, mob: 'dreamDashScout', count: 1, generator: 'DreamPetalFan', lanes: [0.16, 0.30], x: -64, targetX: 126, y: 70, targetY: 82, dashDirection: 1, entryFrames: 24, duration: 216 },
        { id: 'dream-intro-right', type: 'spawn', frame: 96, mob: 'dreamDashScout', count: 1, generator: 'DreamPetalFan', lanes: [0.84, 0.70], x: 664, targetX: 474, y: 112, targetY: 98, dashDirection: -1, entryFrames: 24, duration: 216 },
        { id: 'dream-intro-right-2', type: 'spawn', frame: 114, mob: 'dreamDashScout', count: 1, generator: 'DreamPetalFan', lanes: [0.84, 0.70], x: 664, targetX: 474, y: 112, targetY: 98, dashDirection: -1, entryFrames: 24, duration: 216 },
        { id: 'dream-a-middle', type: 'spawn', frame: 398, mob: 'dreamScout', count: 4, generator: 'DreamPetalFan', lanes: [0.18, 0.38, 0.58, 0.78], y: -64, targetY: 76, entryFrames: 48, exitAt: 200, duration: 432 },
        { id: 'dream-a-right', type: 'spawn', frame: 686, mob: 'dreamScout', count: 2, generator: 'DreamPetalFan', lanes: [0.82, 0.62], y: -64, targetY: 92, entryFrames: 48, exitAt: 210, duration: 432 },
        { id: 'dream-a-left', type: 'spawn', frame: 786, mob: 'dreamScout', count: 2, generator: 'DreamPetalFan', lanes: [0.18, 0.38], y: -64, targetY: 92, entryFrames: 48, exitAt: 210, duration: 432 },
        { id: 'dream-a-cross-l', type: 'spawn', frame: 1064, mob: 'dreamSwerver', count: 4, generator: 'DreamLattice', x: -60, targetX: 84, y: 104, targetY: 112, dashDirection: 1, duration: 432 },
        { id: 'dream-a-cross-r', type: 'spawn', frame: 1324, mob: 'dreamSwerver', count: 4, generator: 'DreamLattice', x: 660, targetX: 516, y: 138, targetY: 120, dashDirection: -1, duration: 432 },
        //{ id: 'dream-bridge-weave', type: 'spawn', frame: 1248, mob: 'dreamWeaver', count: 4, generator: 'DreamLattice', lanes: [0.16, 0.39, 0.61, 0.84], y: -64, targetY: 112, entryFrames: 48, exitAt: 288, duration: 432 },
        { id: 'dream-bridge-orbit', type: 'spawn', frame: 1486, mob: 'dreamAnchor', count: 2, generator: 'DreamOrbit', lanes: [0.28, 0.72], y: -76, targetY: 142, entryFrames: 72, exitAt: 372, duration: 624 },
        { id: 'dream-preboss-dash-l', type: 'spawn', frame: 1894, mob: 'dreamDashScout', count: 4, generator: 'DreamPetalFan', x: -64, targetX: 104, y: 74, targetY: 80, dashDirection: 1, entryFrames: 20, duration: 192 },
        { id: 'dream-preboss-dash-r', type: 'spawn', frame: 1990, mob: 'dreamDashScout', count: 4, generator: 'DreamPetalFan', x: 664, targetX: 496, y: 132, targetY: 126, dashDirection: -1, entryFrames: 20, duration: 192 },
        { id: 'dream-boss', type: 'spawn', frame: 2292, mob: 'dreamBoss', count: 1, generator: 'DreamBossBloom', x: 300, y: -112, targetX: 300, targetY: 170, entryFrames: 96, exitAt: 1206, duration: 1408 },
        { id: 'dream-boss-dash-l', type: 'spawn', frame: 2592, until: 3168, repeatEvery: 384, mob: 'dreamDashScout', count: 2, generator: 'DreamPetalFan', x: -64, targetX: 116, y: 80, targetY: 84, dashDirection: 1, entryFrames: 24, duration: 216 },
        { id: 'dream-boss-dash-r', type: 'spawn', frame: 2692, until: 3360, repeatEvery: 384, mob: 'dreamDashScout', count: 2, generator: 'DreamPetalFan', x: 664, targetX: 484, y: 130, targetY: 124, dashDirection: -1, entryFrames: 24, duration: 216 },
        { id: 'dream-final-anchors', type: 'spawn', frame: 2864, mob: 'dreamAnchor', count: 2, generator: 'DreamOrbit', lanes: [0.24, 0.76], y: -76, targetY: 138, entryFrames: 72, exitAt: 264, duration: 436 },
        { id: 'dream-clear', type: 'clear', frame: 3550 }
    ], { clearFrame: 3550, background: dreamBackground })
};

export const DEFAULT_STAGE = stage_template.AimedRandomMix;

export function resolveStage(name) {
    return stage_template[name] || DEFAULT_STAGE;
}

export function getStageEventMobConfig(event) {
    return {
        ...resolveMobTemplate(event.mob),
        ...event
    };
}
