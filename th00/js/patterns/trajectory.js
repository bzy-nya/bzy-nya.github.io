import { GAME_CONSTANTS } from '../core/config.js';
import { check_range } from '../core/utils.js';

export const ENEMY_BULLET_SPEED_MULTIPLIER = 2;

export function bulletLinearTrajectory(bullet) {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.dx;
    bullet.y += bullet.dy;
    bullet.rotation = Math.atan2(bullet.dy || 0, bullet.dx || 0);
    return bullet;
}

export const trajectory_template = {
    bulletLinear: {
        transform: bulletLinearTrajectory
    },

    bulletGravity: {
        transform: (bullet) => {
            bullet.dy += 0.047 * ENEMY_BULLET_SPEED_MULTIPLIER;
            return bulletLinearTrajectory(bullet);
        }
    },

    bulletColorfulDrift: {
        transform: (bullet) => {
            if (Math.floor(Math.random() * 101) < 80) {
                const dr = Math.floor(Math.random() * 21) - 10;
                const dg = Math.floor(Math.random() * 21) - 10;
                const db = Math.floor(Math.random() * 21) - 10;
                bullet.real_color = {
                    r: check_range(bullet.real_color.r + dr, 0, 255),
                    g: check_range(bullet.real_color.g + dg, 0, 255),
                    b: check_range(bullet.real_color.b + db, 0, 255)
                };
            }
            if (bullet.r > (bullet.minRadius || 9) && Math.floor(Math.random() * 101) < 9) {
                bullet.r = Math.max(bullet.minRadius || 9, bullet.r - 0.25);
            }
            bullet.color = `rgba(${bullet.real_color.r},${bullet.real_color.g},${bullet.real_color.b},0.92)`;
            bullet.glowColor = `rgba(${bullet.real_color.r},${bullet.real_color.g},${bullet.real_color.b},0.32)`;
            bullet.trailColor = `rgba(${bullet.real_color.r},${bullet.real_color.g},${bullet.real_color.b},0.24)`;
            bullet.dayColor = `rgb(${Math.round(bullet.real_color.r * 0.34)},${Math.round(bullet.real_color.g * 0.34)},${Math.round(bullet.real_color.b * 0.34)})`;
            bullet.dayGlowColor = 'rgba(0,0,0,0.20)';
            bullet.dayTrailColor = `rgba(${Math.round(bullet.real_color.r * 0.34)},${Math.round(bullet.real_color.g * 0.34)},${Math.round(bullet.real_color.b * 0.34)},0.16)`;
            return bulletLinearTrajectory(bullet);
        }
    },

    laneHover: {
        update: (enemy) => {
            const hoverY = enemy.targetY + Math.sin(enemy.age * 0.02 + enemy.phase) * (enemy.isBoss ? 6 : 3.5);
            enemy.y = enemy.y + (hoverY - enemy.y) * GAME_CONSTANTS.ENEMY.ENTRY_LERP;
            enemy.x = enemy.laneX + Math.sin(enemy.age * enemy.bobSpeed * 0.016 + enemy.phase) * enemy.bobAmplitude;
        }
    },

    driftDown: {
        update: (enemy) => {
            const targetY = enemy.targetY + Math.sin(enemy.age * 0.026 + enemy.phase) * enemy.bobAmplitude;
            enemy.y = enemy.y + (targetY - enemy.y) * (enemy.entryLerp || 0.028);
            enemy.x += enemy.vx || 0;
        }
    },

    dreamArc: {
        update: (enemy) => {
            const progress = Math.min(1, enemy.age / Math.max(1, enemy.entryFrames || 180));
            const ease = 1 - Math.pow(1 - progress, 3);
            const centerX = enemy.originX + (enemy.targetX - enemy.originX) * ease;
            const centerY = enemy.originY + (enemy.targetY - enemy.originY) * ease;
            enemy.x = centerX + Math.sin(enemy.age * 0.035 + enemy.phase) * enemy.bobAmplitude;
            enemy.y = centerY + Math.sin(enemy.age * 0.022 + enemy.phase * 0.7) * (enemy.bobAmplitude * 0.42);
        }
    },

    dreamFormation: {
        update: (enemy) => {
            const progress = Math.min(1, enemy.age / Math.max(1, enemy.entryFrames || 54));
            const ease = 1 - Math.pow(1 - progress, 3);
            enemy.x = enemy.originX + (enemy.targetX - enemy.originX) * ease;
            enemy.y = enemy.originY + (enemy.targetY - enemy.originY) * ease;
            if (progress >= 1) {
                enemy.x = enemy.targetX + Math.sin(enemy.age * 0.018 + enemy.phase) * (enemy.bobAmplitude * 0.12);
                enemy.y = enemy.targetY + Math.sin(enemy.age * 0.026 + enemy.phase * 0.7) * (enemy.bobAmplitude * 0.16);
            }
        }
    },

    dreamStableCaster: {
        update: (enemy) => {
            const progress = Math.min(1, enemy.age / Math.max(1, enemy.entryFrames || 110));
            const ease = 1 - Math.pow(1 - progress, 4);
            enemy.x = enemy.originX + (enemy.targetX - enemy.originX) * ease;
            enemy.y = enemy.originY + (enemy.targetY - enemy.originY) * ease;
            if (progress >= 1) {
                enemy.x = enemy.targetX;
                enemy.y = enemy.targetY;
            }
        }
    },

    dreamDash: {
        update: (enemy) => {
            const direction = enemy.dashDirection || 1;
            const speed = enemy.dashSpeed || 5.8;
            enemy.x = enemy.originX + enemy.age * speed * direction;
            const progress = Math.min(1, enemy.age / Math.max(1, enemy.entryFrames || 36));
            const ease = 1 - Math.pow(1 - progress, 2);
            enemy.y = enemy.originY + (enemy.targetY - enemy.originY) * ease +
                Math.sin(enemy.age * 0.12 + enemy.phase) * (enemy.bobAmplitude * 0.20);
        }
    },

    dreamSwerve: {
        update: (enemy) => {
            const forward = (enemy.dashSpeed || 3.4) * (enemy.dashDirection || 1);
            enemy.x += forward;
            enemy.y = enemy.targetY +
                Math.sin(enemy.age * 0.045 + enemy.phase) * enemy.bobAmplitude +
                Math.sin(enemy.age * 0.014 + enemy.phase * 0.5) * enemy.bobAmplitude * 0.55;
        }
    },

    exitUp: {
        update: (enemy) => {
            enemy.x += Math.sin(enemy.age * 0.03 + enemy.phase) * 0.45;
            enemy.y -= enemy.exitSpeed || 2.4;
        }
    }
};

export function getTrajectory(name) {
    return trajectory_template[name] || trajectory_template.laneHover;
}
