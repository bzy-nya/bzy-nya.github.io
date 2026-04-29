import { resolveEnemyTexture } from '../patterns/texture.js';

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

function scaleCssColor(color, scale, alphaScale = 1) {
    const hex = `${color}`.trim().match(/^#([0-9a-f]{6})$/i);
    if (hex) {
        const value = hex[1];
        const r = Math.max(0, Math.min(255, Math.round(parseInt(value.slice(0, 2), 16) * scale)));
        const g = Math.max(0, Math.min(255, Math.round(parseInt(value.slice(2, 4), 16) * scale)));
        const b = Math.max(0, Math.min(255, Math.round(parseInt(value.slice(4, 6), 16) * scale)));
        return `rgb(${r}, ${g}, ${b})`;
    }

    const match = `${color}`.match(/rgba?\(([^)]+)\)/);
    if (!match) return color;
    const values = match[1]
        .split(',')
        .map((value) => Number.parseFloat(value.trim()));
    if (values.length < 3 || values.slice(0, 3).some((value) => !Number.isFinite(value))) return color;

    const r = Math.max(0, Math.min(255, Math.round(values[0] * scale)));
    const g = Math.max(0, Math.min(255, Math.round(values[1] * scale)));
    const b = Math.max(0, Math.min(255, Math.round(values[2] * scale)));
    const a = Math.max(0, Math.min(1, (Number.isFinite(values[3]) ? values[3] : 1) * alphaScale));
    return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`;
}

export function getBulletRenderStyle(bullet) {
    const isDarkTheme = document.body.classList.contains('dark-theme');
    if (isDarkTheme) {
        return {
            color: bullet.color || '#fff',
            glowColor: bullet.glowColor || bullet.color || 'rgba(255,255,255,0.4)',
            coreColor: bullet.coreColor || '#fff',
            outlineColor: bullet.outlineColor || 'rgba(8, 18, 38, 0.72)',
            rimColor: 'rgba(255, 255, 255, 0.72)',
            outerStrokeColor: 'rgba(7, 59, 76, 0.50)',
            shadowColor: 'rgba(0, 0, 0, 0)',
            shadowScale: 1,
            visualScale: 1,
            trailColor: bullet.trailColor || bullet.glowColor || bullet.color || 'rgba(255,255,255,0.3)'
        };
    }

    return {
        color: bullet.dayColor || scaleCssColor(bullet.color || '#fff', 0.62),
        glowColor: bullet.dayGlowColor
            ? scaleCssColor(bullet.dayGlowColor, 1, 0.26)
            : scaleCssColor(bullet.glowColor || bullet.color || 'rgba(0,0,0,0.18)', 0.70, 0.24),
        coreColor: bullet.dayColor ? scaleCssColor(bullet.dayColor, 1.36) : (bullet.dayCoreColor || bullet.coreColor || '#fff'),
        outlineColor: bullet.dayOutlineColor || 'rgba(0, 0, 0, 0.98)',
        rimColor: 'rgba(255, 255, 255, 0.34)',
        outerStrokeColor: 'rgba(0, 0, 0, 1)',
        shadowColor: 'rgba(0, 0, 0, 0.58)',
        shadowScale: 1.18,
        visualScale: 1.28,
        trailColor: bullet.dayTrailColor || scaleCssColor(bullet.trailColor || bullet.glowColor || bullet.color || 'rgba(0,0,0,0.12)', 0.76, 0.86)
    };
}

function rememberBulletSprite(renderCache, key, sprite) {
    const cache = renderCache.bulletSprites;
    const maxSprites = 320;
    if (cache.size >= maxSprites && !cache.has(key)) {
        cache.delete(cache.keys().next().value);
    }
    cache.set(key, sprite);
}

export function getBulletSprite(renderCache, bullet) {
    const style = getBulletRenderStyle(bullet);
    const key = [
        bullet.sprite || 'orb',
        Math.round((bullet.r || 4) * 10) / 10,
        Math.round((style.visualScale || 1) * 100) / 100,
        normalizeColorKey(style.color),
        normalizeColorKey(style.glowColor),
        normalizeColorKey(style.coreColor),
        normalizeColorKey(style.outlineColor),
        normalizeColorKey(style.shadowColor),
        Math.round((style.shadowScale || 1) * 100) / 100
    ].join('|');

    if (renderCache.bulletSprites.has(key)) {
        return renderCache.bulletSprites.get(key);
    }

    const radius = (bullet.r || 4) * (style.visualScale || 1);
    const padding = radius * 3;
    const size = Math.ceil(radius * 2 + padding * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;

    const glowRadius = radius + padding * 0.7;
    const glowGradient = ctx.createRadialGradient(center, center, 0, center, center, glowRadius);
    glowGradient.addColorStop(0, style.glowColor);
    glowGradient.addColorStop(0.42, style.glowColor);
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(center, center, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (style.shadowColor && style.shadowColor !== 'rgba(0, 0, 0, 0)') {
        const shadowRadius = radius * (style.shadowScale || 1.25);
        const shadow = ctx.createRadialGradient(center, center, radius * 0.90, center, center, shadowRadius);
        shadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
        shadow.addColorStop(0.35, style.shadowColor);
        shadow.addColorStop(0.82, style.shadowColor);
        shadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.arc(center, center, shadowRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    const outlineColor = style.outlineColor;
    ctx.fillStyle = style.color;
    if (bullet.sprite === 'needle') {
        ctx.translate(center, center);
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = Math.max(1.25, radius * 0.28);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(radius * 1.45, 0);
        ctx.lineTo(-radius * 1.15, radius * 0.62);
        ctx.lineTo(-radius * 0.55, 0);
        ctx.lineTo(-radius * 1.15, -radius * 0.62);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.fillStyle = style.coreColor;
        ctx.beginPath();
        ctx.moveTo(radius * 0.7, 0);
        ctx.lineTo(-radius * 0.55, radius * 0.3);
        ctx.lineTo(-radius * 0.15, 0);
        ctx.lineTo(-radius * 0.55, -radius * 0.3);
        ctx.closePath();
        ctx.fill();
    } else if (bullet.sprite === 'petal') {
        ctx.translate(center, center);
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = Math.max(1.25, radius * 0.22);
        ctx.beginPath();
        ctx.moveTo(0, -radius * 1.2);
        ctx.quadraticCurveTo(radius * 0.9, -radius * 0.2, 0, radius * 1.15);
        ctx.quadraticCurveTo(-radius * 0.9, -radius * 0.2, 0, -radius * 1.2);
        ctx.stroke();
        ctx.fill();
        ctx.fillStyle = style.coreColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.25, radius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = Math.max(1.2, radius * 0.22);
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
        ctx.fillStyle = style.coreColor;
        ctx.beginPath();
        ctx.arc(center, center, Math.max(1.2, radius * 0.34), 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineWidth = Math.max(1.2, radius * 0.12);
    ctx.strokeStyle = style.outerStrokeColor;
    ctx.beginPath();
    ctx.arc(center, center, radius + ctx.lineWidth * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(0.8, radius * 0.06);
    ctx.strokeStyle = style.rimColor;
    ctx.beginPath();
    ctx.arc(center, center, Math.max(1, radius * 0.76), 0, Math.PI * 2);
    ctx.stroke();

    const sprite = {
        canvas,
        size,
        center
    };
    rememberBulletSprite(renderCache, key, sprite);
    return sprite;
}

export function getEnemySprite(renderCache, enemy) {
    const texture = resolveEnemyTexture(enemy);
    const frameIndex = texture.frameLoop[Math.floor(enemy.age / 8) % texture.frameLoop.length];
    const direction = enemy.facingDirection < 0 ? 'left' : enemy.facingDirection > 0 ? 'right' : 'idle';
    const moving = enemy.renderDirection !== 0;
    const turning = moving && enemy.turnAge < (texture.turnFrames || 10);
    const rowIndex = moving
        ? (turning ? texture.rowByMotion.rightTurn : texture.rowByMotion.rightMove)
        : texture.rowByMotion.idle;
    const flipX = direction === 'left';
    const key = `${enemy.texture || (enemy.isBoss ? 'bossFairy' : 'fairyMob')}-${direction}-${turning ? 'turn' : moving ? 'move' : 'idle'}-${frameIndex}`;
    if (renderCache.enemySprites.has(key)) {
        return renderCache.enemySprites.get(key);
    }

    if (renderCache.enemySpriteLoaded && renderCache.enemySpriteSheet) {
        const size = texture.cacheSize;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const srcX = texture.sourceXOffset + frameIndex * texture.frameWidth;
        const srcY = texture.sourceY + rowIndex * texture.frameHeight;
        const drawWidth = texture.drawWidth;
        const drawHeight = texture.drawHeight;
        if (flipX) {
            ctx.translate(size, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(
            renderCache.enemySpriteSheet,
            srcX,
            srcY,
            texture.frameWidth,
            texture.frameHeight,
            flipX ? size - (size - drawWidth) / 2 - drawWidth : (size - drawWidth) / 2,
            (size - drawHeight) / 2,
            drawWidth,
            drawHeight
        );

        const sprite = { canvas, size };
        renderCache.enemySprites.set(key, sprite);
        return sprite;
    }

    const size = texture.fallbackSize;
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
    renderCache.enemySprites.set(key, sprite);
    return sprite;
}
