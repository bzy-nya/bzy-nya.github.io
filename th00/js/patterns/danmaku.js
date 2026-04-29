// Danmaku generator templates. Bullet instance templates live in bullet.js.
import { random_int } from '../core/utils.js';
import {
    ENEMY_BULLET_SPEED_MULTIPLIER,
    bullet_template,
    cloneBulletTemplate,
    createGeneratorBullet,
    generateRateLimitedBullets,
    getEmitterPoint,
    randomSignedVelocity
} from './bullet.js';

function getEmitterState(container, emitterId) {
    if (!container.perEmitter) {
        container.perEmitter = {};
    }
    if (!container.perEmitter[emitterId]) {
        container.perEmitter[emitterId] = {};
    }
    return container.perEmitter[emitterId];
}

export const bullet_generator_template = {
    AimedRandomMix: {
        bullet_templates: [bullet_template.small, bullet_template.needle],
        state: {},
        tick: function(scene) {
            const newBullets = [];
            const emitterState = getEmitterState(this.state, scene.emitter?.id ?? 0);
            emitterState.cooldown = Math.max(0, (emitterState.cooldown || 0) - 1);
            if (emitterState.cooldown > 0) {
                return newBullets;
            }
            emitterState.cooldown = random_int(7, 9);

            const bullet = createGeneratorBullet(this, scene);
            if (Math.random() > 0.72) {
                bullet.dx = (scene.player.x - bullet.x) / 260 * ENEMY_BULLET_SPEED_MULTIPLIER;
                bullet.dy = (scene.player.y - bullet.y) / 260 * ENEMY_BULLET_SPEED_MULTIPLIER;
            } else {
                bullet.dx = randomSignedVelocity(1.55) * ENEMY_BULLET_SPEED_MULTIPLIER;
                bullet.dy = Math.random() * 3.1 * ENEMY_BULLET_SPEED_MULTIPLIER;
            }
            newBullets.push(bullet);

            return newBullets;
        }
    },

    Random: {
        bullet_limit: 200,
        bullets_per_frame: 4.67,
        bullet_templates: [bullet_template.small, bullet_template.big, bullet_template.petal],
        state: { accumulator: 0 },
        tick: function(scene) {
            return generateRateLimitedBullets(this, scene, (bullet) => {
                bullet.dx = randomSignedVelocity(1.55) * ENEMY_BULLET_SPEED_MULTIPLIER;
                bullet.dy = Math.random() * 3.1 * ENEMY_BULLET_SPEED_MULTIPLIER;
            });
        }
    },

    WideAngleAim: {
        bullet_templates: [bullet_template.needle, bullet_template.small],
        state: {},
        tick: function(scene) {
            const newBullets = [];
            const emitterState = getEmitterState(this.state, scene.emitter?.id ?? 0);
            emitterState.cooldown = Math.max(0, (emitterState.cooldown || 0) - 1);
            if (emitterState.cooldown > 0) {
                return newBullets;
            }
            emitterState.cooldown = random_int(11, 15);

            const bullet = createGeneratorBullet(this, scene);
            const qx = scene.player.x + randomSignedVelocity(55.5);
            const qy = scene.player.y + randomSignedVelocity(55.5);
            bullet.dx = (qx - bullet.x) / 220 * ENEMY_BULLET_SPEED_MULTIPLIER;
            bullet.dy = (qy - bullet.y) / 220 * ENEMY_BULLET_SPEED_MULTIPLIER;
            newBullets.push(bullet);

            return newBullets;
        }
    },

    Rain: {
        bullet_limit: 200,
        bullets_per_frame: 4.33,
        bullet_templates: [bullet_template.needle],
        state: { accumulator: 0 },
        tick: function(scene) {
            return generateRateLimitedBullets(this, scene, (bullet) => {
                bullet.dx = 0;
                bullet.dy = (Math.random() * 3.6 + 0.35) * ENEMY_BULLET_SPEED_MULTIPLIER;
            });
        }
    },

    Wave: {
        branch: 12,
        state: {
            angle: 0,
            angleSpeed: 0,
            angleAcceleration: 0.013,
            maxAngleSpeed: 0.19,
            angleDirection: 1,
            cooldown: 0,
            volley: 0
        },
        tick: function(scene) {
            const newBullets = [];
            this.state.cooldown = Math.max(0, this.state.cooldown - 1);
            if (this.state.cooldown > 0) {
                return newBullets;
            }
            this.state.cooldown = 7;
            this.state.volley++;
            this.state.angle += this.state.angleSpeed;
            this.state.angleSpeed += this.state.angleAcceleration * this.state.angleDirection;
            if (Math.abs(this.state.angleSpeed) > this.state.maxAngleSpeed) {
                this.state.angleSpeed = this.state.maxAngleSpeed * this.state.angleDirection;
                this.state.angleDirection *= -1;
            }
            while (this.state.angle > Math.PI) this.state.angle -= 2 * Math.PI;
            while (this.state.angle < -Math.PI) this.state.angle += 2 * Math.PI;

            const rings = this.state.volley % 3 === 0 ? 2 : 1;
            for (let ring = 0; ring < rings; ring++) {
                const emitter = getEmitterPoint(scene, 300, 300);
                for (let i = 0; i < this.branch; i++) {
                    const newBullet = cloneBulletTemplate(ring === 0 ? bullet_template.petal : bullet_template.needle);
                    newBullet.x = emitter.x;
                    newBullet.y = emitter.y;

                    const bulletAngle = this.state.angle + ((2 * Math.PI) / this.branch) * i + ring * (Math.PI / this.branch);
                    const speed = (ring === 0 ? 2.05 : 1.45) * ENEMY_BULLET_SPEED_MULTIPLIER;
                    newBullet.dx = speed * Math.cos(bulletAngle);
                    newBullet.dy = speed * Math.sin(bulletAngle);
                    newBullets.push(newBullet);
                }
            }

            return newBullets;
        },
        reset: function() {
            this.state.angle = 0;
            this.state.angleSpeed = 0;
            this.state.angleDirection = 1;
            this.state.cooldown = 0;
            this.state.volley = 0;
        }
    },

    Gravity: {
        bullet_limit: 500,
        bullets_per_frame: 4.33,
        bullet_templates: [bullet_template.gravity],
        state: { accumulator: 0 },
        tick: function(scene) {
            return generateRateLimitedBullets(this, scene, (bullet) => {
                bullet.dx = randomSignedVelocity(1.55) * ENEMY_BULLET_SPEED_MULTIPLIER;
                bullet.dy = -Math.random() * 3.1 * ENEMY_BULLET_SPEED_MULTIPLIER;
            }, { x: 300, y: 200 });
        }
    },

    Snowy: {
        bullet_limit: 200,
        bullets_per_frame: 0.43,
        bullet_templates: [bullet_template.colorful],
        state: { accumulator: 0 },
        tick: function(scene) {
            return generateRateLimitedBullets(this, scene, (bullet) => {
                bullet.dx = randomSignedVelocity(1.55) * ENEMY_BULLET_SPEED_MULTIPLIER;
                bullet.dy = Math.random() * 3.1 * ENEMY_BULLET_SPEED_MULTIPLIER;
            });
        }
    },

    DreamPetalFan: {
        state: {},
        tick: function(scene) {
            const newBullets = [];
            const emitterState = getEmitterState(this.state, scene.emitter?.id ?? 0);
            emitterState.cooldown = Math.max(0, (emitterState.cooldown || 0) - 1);
            if (emitterState.cooldown > 0) return newBullets;
            emitterState.cooldown = scene.stageFrame < 1200 ? 24 : 12;
            emitterState.volley = (emitterState.volley || 0) + 1;

            const emitter = getEmitterPoint(scene, 300, 120);
            const aimAngle = Math.atan2(scene.player.y - emitter.y, scene.player.x - emitter.x);
            const spread = scene.stageFrame < 1200 ? 0.16 : 0.19;
            const wing = emitterState.volley % 4 === 0 ? 3 : 2;
            for (let i = -wing; i <= wing; i++) {
                const bullet = cloneBulletTemplate(bullet_template.petal);
                const angle = aimAngle + i * spread;
                const speed = (1.72 + Math.abs(i) * 0.14 + (emitterState.volley % 4 === 0 ? 0.18 : 0)) * ENEMY_BULLET_SPEED_MULTIPLIER;
                bullet.x = emitter.x;
                bullet.y = emitter.y;
                bullet.dx = Math.cos(angle) * speed;
                bullet.dy = Math.sin(angle) * speed;
                newBullets.push(bullet);
            }
            return newBullets;
        }
    },

    DreamLattice: {
        state: {},
        tick: function(scene) {
            const newBullets = [];
            const emitterState = getEmitterState(this.state, scene.emitter?.id ?? 0);
            emitterState.cooldown = Math.max(0, (emitterState.cooldown || 0) - 1);
            if (emitterState.cooldown > 0) return newBullets;
            emitterState.cooldown = 24;
            emitterState.phase = (emitterState.phase || 0) + 1;

            const emitter = getEmitterPoint(scene, 300, 120);
            const accented = emitterState.phase % 4 === 0;
            const baseAngle = (emitterState.phase % 4) * Math.PI / 16;
            const branches = accented ? 32 : 16;
            for (let i = 0; i < branches; i++) {
                const bullet = cloneBulletTemplate(i % 2 ? bullet_template.small : bullet_template.needle);
                const angle = baseAngle + i * Math.PI * 2 / branches;
                const base_speed = (accented ? 2.18 : 1.68) * ENEMY_BULLET_SPEED_MULTIPLIER;
                const off_angle = (i % (branches / 4)) / (branches / 4) * (Math.PI / 2) - (Math.PI / 4);
                const speed = base_speed / Math.cos(off_angle);
                bullet.x = emitter.x;
                bullet.y = emitter.y;
                bullet.dx = Math.cos(angle) * speed;
                bullet.dy = Math.sin(angle) * speed;
                newBullets.push(bullet);
            }
            return newBullets;
        }
    },

    DreamOrbit: {
        state: {},
        tick: function(scene) {
            const newBullets = [];
            const emitterState = getEmitterState(this.state, scene.emitter?.id ?? 0);
            emitterState.cooldown = Math.max(0, (emitterState.cooldown || 0) - 1);
            emitterState.angle = (emitterState.angle || 0) + 0.83;
            if (emitterState.cooldown > 0) return newBullets;
            emitterState.cooldown = 8;
            emitterState.volley = (emitterState.volley || 0) + 1;

            const emitter = getEmitterPoint(scene, 300, 120);
            const branches = emitterState.volley % 8 === 0 ? 6 : 4;
            for (let i = 0; i < branches; i++) {
                const bullet = cloneBulletTemplate(i % 2 ? bullet_template.petal : bullet_template.big);
                const angle = emitterState.angle + i * Math.PI * 2 / branches;
                const speed = (1.16 + (i % 2) * 0.24) * ENEMY_BULLET_SPEED_MULTIPLIER;
                bullet.x = emitter.x + Math.cos(angle) * 18;
                bullet.y = emitter.y + Math.sin(angle) * 18;
                bullet.dx = Math.cos(angle + 0.42) * speed;
                bullet.dy = Math.sin(angle + 0.42) * speed;
                newBullets.push(bullet);
            }
            return newBullets;
        }
    },

    DreamBossBloom: {
        branch: 18,
        state: { cooldown: 0, angle: 0, volley: 0 },
        tick: function(scene) {
            const newBullets = [];
            this.state.cooldown = Math.max(0, this.state.cooldown - 1);
            this.state.angle += 0.024;
            if (this.state.cooldown > 0) return newBullets;
            const downbeat = this.state.volley % 8 === 7;
            this.state.cooldown = downbeat ? 24 : 12;
            this.state.volley++;

            const emitter = getEmitterPoint(scene, 300, 160);
            const aimed = Math.atan2(scene.player.y - emitter.y, scene.player.x - emitter.x);
            const branches = downbeat ? 24 : this.branch;
            for (let i = 0; i < branches; i++) {
                const template = i % 3 === 0 ? bullet_template.colorful : (i % 2 ? bullet_template.petal : bullet_template.small);
                const bullet = cloneBulletTemplate(template);
                const angle = this.state.angle + i * Math.PI * 2 / branches + Math.sin(this.state.volley * 0.2) * 0.1;
                const speed = (1.02 + (i % 3) * 0.18 + (downbeat ? 0.16 : 0)) * ENEMY_BULLET_SPEED_MULTIPLIER;
                bullet.x = emitter.x;
                bullet.y = emitter.y;
                bullet.dx = Math.cos(angle) * speed;
                bullet.dy = Math.sin(angle) * speed;
                newBullets.push(bullet);
            }

            if (this.state.volley % 4 === 0) {
                for (let i = -1; i <= 1; i++) {
                    const bullet = cloneBulletTemplate(bullet_template.needle);
                    const angle = aimed + i * 0.16;
                    const speed = 1.8 * ENEMY_BULLET_SPEED_MULTIPLIER;
                    bullet.x = emitter.x;
                    bullet.y = emitter.y;
                    bullet.dx = Math.cos(angle) * speed;
                    bullet.dy = Math.sin(angle) * speed;
                    newBullets.push(bullet);
                }
            }
            return newBullets;
        },
        reset: function() {
            this.state.cooldown = 0;
            this.state.angle = 0;
            this.state.volley = 0;
        }
    },

    Dream: {
        bullet_templates: [bullet_template.petal],
        state: {},
        tick: () => []
    }
};
