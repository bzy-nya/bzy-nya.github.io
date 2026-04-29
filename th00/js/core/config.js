// Centralized runtime configuration for the th00 game.
export const TH00_ASSET_PATHS = Object.freeze({
    images: Object.freeze({
        cirno: 'assets/images/Cirno.png',
        enemySpriteSheet: 'assets/images/enemy.png'
    }),
    sounds: Object.freeze({
        graze: 'assets/sounds/se_graze.wav',
        gameOver: 'assets/sounds/Touhou_Death_Sound.ogg',
        damage: 'assets/sounds/damage00.wav',
        blowup: 'assets/sounds/tan_01.wav',
        pause: 'assets/sounds/touhou-pause-sfx.mp3'
    }),
    music: Object.freeze({
        dream: 'assets/music/Dream Shrine Run.mp3',
        playerScore: "assets/music/Player's Score.mp3"
    })
});

export const TH00_MODE_MAP = Object.freeze({
    1: 'AimedRandomMix',
    2: 'Random',
    3: 'WideAngleAim',
    4: 'Rain',
    5: 'Wave',
    6: 'Gravity',
    7: 'Snowy',
    8: 'Dream'
});

export const TH00_INPUT_STATE = {
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    keys: Array(256)
};

export const GAME_CONSTANTS = {
    SCREEN: {
        WIDTH: 600,
        HEIGHT: 800
    },

    TIMING: {
        TARGET_FPS: 60
    },

    GRAZE_COOLDOWN_FRAMES: 60,
    BULLET_LIMIT: 850,

    PLAYER: {
        NORMAL_SPEED: 8.0,
        PRECISE_SPEED: 4.2,
        HITBOX_RADIUS: 3,
        GRAZE_RADIUS: 20,
        COLLISION_RADIUS: 3,
        TRAIL_LENGTH: 8,
        OPTION_DISTANCE: 26,
        SHOT_INTERVAL_FRAMES: 5,
        SHOT_SPEED: 9.3,
        SHOT_RADIUS: 5,
        SHOT_POWER: 1
    },

    ENEMY: {
        RADIUS: 14,
        SPAWN_INTERVAL_FRAMES: 132,
        WAVE_SIZE: 3,
        MAX_COUNT: 6,
        LIFETIME_FRAMES: 900,
        ENTRY_LERP: 0.035,
        HP: 7,
        BOSS_RADIUS: 28,
        BOSS_HP: 48,
        BOSS_LIFETIME_FRAMES: 59940
    },

    BACKGROUND: {
        STAR_COUNT: 34,
        PETAL_COUNT: 8
    },

    PERFORMANCE: {
        TRAIL_BULLET_THRESHOLD: 240,
        BACKGROUND_EFFECT_BULLET_THRESHOLD: 280,
        TRAIL_DISABLE_BULLET_THRESHOLD: 360
    },

    AI: {
        COLLISION_ENERGY: 1e18,
        ENERGY_FACTOR_LINEAR: 260
    },

    INPUT: {
        GAMEPAD_DEADZONE: 0.2
    }
};
