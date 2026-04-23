// Bullet templates and generator templates for the game
// "Danmark" - A reference to the Danmaku (bullet curtain) style gameplay

function bullet_move(bullet, deltaTime) {
    bullet.prevX = bullet.x;
    bullet.prevY = bullet.y;
    bullet.x += bullet.dx * deltaTime; 
    bullet.y += bullet.dy * deltaTime;
    bullet.rotation = Math.atan2(bullet.dy || 0, bullet.dx || 0);
    return bullet;
}

function cloneBulletTemplate(template) {
    const bullet = { ...template };
    if (template.real_color) {
        bullet.real_color = { ...template.real_color };
    }
    return bullet;
}

function getEmitterPoint(scene, fallbackX, fallbackY) {
    if (scene?.emitter) {
        return { x: scene.emitter.x, y: scene.emitter.y };
    }
    if (scene?.emitters && scene.emitters.length > 0) {
        const emitter = scene.emitters[random_int(0, scene.emitters.length - 1)];
        return { x: emitter.x, y: emitter.y };
    }
    return { x: fallbackX, y: fallbackY };
}

function getEmitterState(container, emitterId) {
    if (!container.perEmitter) {
        container.perEmitter = {};
    }
    if (!container.perEmitter[emitterId]) {
        container.perEmitter[emitterId] = {};
    }
    return container.perEmitter[emitterId];
}

// Bullet templates
const bullet_template = {
    small:   {
        r: 4,
        color: "rgba(109, 233, 255, 0.95)",
        glowColor: "rgba(109, 233, 255, 0.35)",
        coreColor: "#ffffff",
        trailColor: "rgba(109, 233, 255, 0.28)",
        sprite: "orb",
        transform: bullet_move,
        lastGrazed: 0
    },
    needle: {
        r: 7,
        color: "rgba(255, 157, 207, 0.95)",
        glowColor: "rgba(255, 157, 207, 0.35)",
        coreColor: "#fff7fd",
        trailColor: "rgba(255, 157, 207, 0.3)",
        sprite: "needle",
        transform: bullet_move,
        lastGrazed: 0
    },
    big:     {
        r: 15,
        color: "rgba(125, 245, 255, 0.92)",
        glowColor: "rgba(125, 245, 255, 0.28)",
        coreColor: "#ffffff",
        trailColor: "rgba(125, 245, 255, 0.22)",
        sprite: "orb",
        transform: bullet_move,
        lastGrazed: 0
    },
    petal: {
        r: 10,
        color: "rgba(255, 197, 228, 0.95)",
        glowColor: "rgba(255, 197, 228, 0.34)",
        coreColor: "#fff7fb",
        trailColor: "rgba(255, 197, 228, 0.26)",
        sprite: "petal",
        transform: bullet_move,
        lastGrazed: 0
    },
    gravity: {r: 4 , color:"rgba(167, 214, 255, 0.95)", glowColor: "rgba(167, 214, 255, 0.34)", coreColor: "#ffffff", trailColor: "rgba(167, 214, 255, 0.26)", sprite: "orb", lastGrazed: 0,
        transform: (bullet, deltaTime) => {
            bullet.dy += 168 * deltaTime;
            return bullet_move(bullet, deltaTime);
        } 
    },
    colorful: {r:15, minRadius: 9, color:"rgba(0,255,255,0.92)", glowColor: "rgba(0,255,255,0.32)", coreColor: "#ffffff", trailColor: "rgba(0,255,255,0.24)", sprite: "orb", real_color: {r:0, g:255, b:255}, lastGrazed: 0,
        transform: (bullet, deltaTime) => {
			if ( random_int(0, 100) < 80 ) {	
				const dr = random_int(-10, 10);
				const dg = random_int(-10, 10);
				const db = random_int(-10, 10);
				bullet.real_color = {
					r: check_range(bullet.real_color.r + dr, 0, 255),
					g: check_range(bullet.real_color.g + dg, 0, 255),
					b: check_range(bullet.real_color.b + db, 0, 255)
				}
			}
            if (bullet.r > (bullet.minRadius || 9) && random_int(0, 100) < 9) {
                bullet.r = Math.max(bullet.minRadius || 9, bullet.r - 0.25);
            }
            bullet.color = `rgba(${bullet.real_color.r},${bullet.real_color.g},${bullet.real_color.b},0.92)`;
            bullet.glowColor = `rgba(${bullet.real_color.r},${bullet.real_color.g},${bullet.real_color.b},0.32)`;
            bullet.trailColor = `rgba(${bullet.real_color.r},${bullet.real_color.g},${bullet.real_color.b},0.24)`;
            return bullet_move(bullet, deltaTime);
        }
    }
};

// Bullet templates and generators with English names
const bullet_generator_template = {
  'AimedRandomMix': {
    bullet_templates: [bullet_template.small, bullet_template.needle],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const emitterState = getEmitterState(this.state, scene.emitter?.id ?? 0);
      emitterState.cooldown = Math.max(0, (emitterState.cooldown || 0) - deltaTime);
      if (emitterState.cooldown > 0) {
        return newBullets;
      }
      emitterState.cooldown = 0.12 + Math.random() * 0.04;

      for(let i = 0; i < 1; i++) {        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = cloneBulletTemplate(this.bullet_templates[template_index]);

        const emitter = getEmitterPoint(scene, Math.random() * GAME_CONSTANTS.SCREEN.WIDTH, 10);
        new_bullet.x = emitter.x;
        new_bullet.y = emitter.y;
        
        if(Math.random() > 0.72) {
          new_bullet.dx = (scene.player.x - new_bullet.x) / 2.0;
          new_bullet.dy = (scene.player.y - new_bullet.y) / 2.0 ;
        } else {
          new_bullet.dx = (Math.random() > 0.5 ? 1 : -1) * Math.random() * 168;
          new_bullet.dy = Math.random() * 336;
        }
        
        newBullets.push(new_bullet);
      }
      
      return newBullets;
    }
  },
  
  'Random': {
    bullet_limit: 200,
    bullet_per_second: 280,
    bullet_templates: [bullet_template.small, bullet_template.big, bullet_template.petal],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second * deltaTime);
      
      for(let i = 0; i < bulletsToGenerate; i++) {
        if(scene.bullets.length + newBullets.length >= this.bullet_limit) break;
        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = cloneBulletTemplate(this.bullet_templates[template_index]);

        const emitter = getEmitterPoint(scene, Math.random() * GAME_CONSTANTS.SCREEN.WIDTH, 10);
        new_bullet.x = emitter.x;
        new_bullet.y = emitter.y;
        
        new_bullet.dx = (Math.random() > 0.5 ? 1 : -1 ) * Math.random() * 168;
        new_bullet.dy = Math.random() * 336;
        
        newBullets.push(new_bullet);
      }
      
      return newBullets;
    }
  },
  
  'WideAngleAim': {
    bullet_templates: [bullet_template.needle, bullet_template.small],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const emitterState = getEmitterState(this.state, scene.emitter?.id ?? 0);
      emitterState.cooldown = Math.max(0, (emitterState.cooldown || 0) - deltaTime);
      if (emitterState.cooldown > 0) {
        return newBullets;
      }
      emitterState.cooldown = 0.2 + Math.random() * 0.06;

      for(let i = 0; i < 1; i++) {        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = cloneBulletTemplate(this.bullet_templates[template_index]);

        const emitter = getEmitterPoint(scene, Math.random() * GAME_CONSTANTS.SCREEN.WIDTH, 10);
        new_bullet.x = emitter.x;
        new_bullet.y = emitter.y;
        
        const qx = scene.player.x + (Math.random() > 0.5 ? 1 : -1) * Math.random() * 55.5;
        const qy = scene.player.y + (Math.random() > 0.5 ? 1 : -1) * Math.random() * 55.5;
        new_bullet.dx = (qx - new_bullet.x) / 2.5;
        new_bullet.dy = (qy - new_bullet.y) / 2.5;
        
        newBullets.push(new_bullet);
      }
      
      return newBullets;
    }
  },
  
  'Rain': {
    bullet_limit: 200,
    bullet_per_second: 260,
    bullet_templates: [bullet_template.needle],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second * deltaTime);
      
      for(let i = 0; i < bulletsToGenerate; i++) {
        if(scene.bullets.length + newBullets.length >= this.bullet_limit) break;
        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = cloneBulletTemplate(this.bullet_templates[template_index]);

        const emitter = getEmitterPoint(scene, Math.random() * GAME_CONSTANTS.SCREEN.WIDTH, 10);
        new_bullet.x = emitter.x;
        new_bullet.y = emitter.y;
        
        new_bullet.dx = 0;
        new_bullet.dy = Math.random() * 400 + 32;
        
        newBullets.push(new_bullet);
      }
      
      return newBullets;
    }
  },
  
    'Wave': {
        branch: 8,
        state: {
            angle: 0,
            angleSpeed: 0,
            angleAcceleration: Math.PI * 15,
            maxAngleSpeed: Math.PI * 2.8,
            angleDirection: 1,
            accumulator: 0
        },
    tick: function(scene, deltaTime) {
            const newBullets = [];
            this.state.accumulator += deltaTime * 6;
            if (this.state.accumulator < 1) {
                return newBullets;
            }
            this.state.accumulator -= 1;
            this.state.angle += this.state.angleSpeed * deltaTime;
            this.state.angleSpeed += this.state.angleAcceleration * this.state.angleDirection * deltaTime;
            if (Math.abs(this.state.angleSpeed) > this.state.maxAngleSpeed) {
                this.state.angleSpeed = this.state.maxAngleSpeed * this.state.angleDirection;
                this.state.angleDirection *= -1;
            }
            while (this.state.angle > Math.PI) this.state.angle -= 2 * Math.PI;
            while (this.state.angle < -Math.PI) this.state.angle += 2 * Math.PI;

            for(let i = 0; i < this.branch; i++) {
                const new_bullet = cloneBulletTemplate(bullet_template.petal);
                
                const emitter = getEmitterPoint(scene, 300, 300);
                new_bullet.x = emitter.x;
                new_bullet.y = emitter.y;
                
                // Calculate the angle for this branch bullet
                // Use a fixed angular spacing between branches
                const bulletAngle = this.state.angle + ((2 * Math.PI) / this.branch) * i;
                const speed = 180;
                new_bullet.dx = speed * Math.cos(bulletAngle);
                new_bullet.dy = speed * Math.sin(bulletAngle);
                
                newBullets.push(new_bullet);
            }
            
            return newBullets;
        },
        // Add a reset function to initialize state when switching patterns
        reset: function() {
            this.state.angle = 0;
            this.state.angleSpeed = 0;
            this.state.angleDirection = 1;
            this.state.accumulator = 0;
        }
    },
  
  'Gravity': {
    bullet_limit: 500,
    bullet_per_second: 260,
    bullet_templates: [bullet_template.gravity],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second * deltaTime);
      
      for(let i = 0; i < bulletsToGenerate; i++) {
        if(scene.bullets.length + newBullets.length >= this.bullet_limit) break;
        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = cloneBulletTemplate(this.bullet_templates[template_index]);

        const emitter = getEmitterPoint(scene, 300, 200);
        new_bullet.x = emitter.x;
        new_bullet.y = emitter.y;
        new_bullet.dx = (Math.random() > 0.5 ? 1 : -1 ) * Math.random() * 168;
        new_bullet.dy = -Math.random() * 336;
        
        newBullets.push(new_bullet);
      }
      
      return newBullets;
    }
  },
  
  'Snowy': {
    bullet_limit: 200,
    bullet_per_second: 26,
    bullet_templates: [bullet_template.colorful],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second * deltaTime);
      
      for(let i = 0; i < bulletsToGenerate; i++) {
        if(scene.bullets.length + newBullets.length >= this.bullet_limit) break;
        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = cloneBulletTemplate(this.bullet_templates[template_index]);

        const emitter = getEmitterPoint(scene, Math.random() * GAME_CONSTANTS.SCREEN.WIDTH, 10);
        new_bullet.x = emitter.x;
        new_bullet.y = emitter.y;
        
        new_bullet.dx = (Math.random() > 0.5 ? 1 : -1 ) * Math.random() * 168;
        new_bullet.dy = Math.random() * 336;
        
        newBullets.push(new_bullet);
      }
      
      return newBullets;
    }
  }
};

// Export the templates to the global scope
window.bullet_template = bullet_template;
window.bullet_generator_template = bullet_generator_template;
