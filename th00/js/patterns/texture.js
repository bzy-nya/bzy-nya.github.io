export const enemy_texture_template = {
    fairyMob: Object.freeze({
        spriteSheet: 'enemySpriteSheet',
        frameWidth: 48,
        frameHeight: 32,
        frameLoop: Object.freeze([0, 1, 2, 3, 2, 1]),
        rowByMotion: Object.freeze({
            idle: 0,
            rightTurn: 1,
            rightMove: 2
        }),
        turnFrames: 10,
        sourceXOffset: 0,
        sourceY: 0,
        drawWidth: 56,
        drawHeight: 38,
        cacheSize: 72,
        fallbackSize: 68
    }),

    bossFairy: Object.freeze({
        spriteSheet: 'enemySpriteSheet',
        frameWidth: 48,
        frameHeight: 48,
        frameLoop: Object.freeze([0, 1, 2, 3, 2, 1]),
        rowByMotion: Object.freeze({
            idle: 0,
            rightTurn: 1,
            rightMove: 2
        }),
        turnFrames: 10,
        sourceXOffset: 320,
        sourceY: 0,
        drawWidth: 72,
        drawHeight: 72,
        cacheSize: 92,
        fallbackSize: 112
    })
};

export function resolveEnemyTexture(enemy) {
    const key = enemy.texture || (enemy.isBoss ? 'bossFairy' : 'fairyMob');
    return enemy_texture_template[key] || enemy_texture_template.fairyMob;
}
