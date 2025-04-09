// Bullet templates and generator templates for the game
// "Danmark" - A reference to the Danmaku (bullet curtain) style gameplay

function bullet_move(bullet, deltaTime) {
    bullet.x += bullet.dx * deltaTime; 
    bullet.y += bullet.dy * deltaTime;
    return bullet;
}

// Bullet templates
const bullet_template = {
    small:   {r: 3 , color:"Cyan", transform: bullet_move, lastGrazed: 0},
    big:     {r: 15, color:"Cyan", transform: bullet_move, lastGrazed: 0},
    gravity: {r: 3 , color:"Cyan", lastGrazed: 0,
        transform: (bullet, deltaTime) => {
            bullet.dy += 168 * deltaTime;
            return bullet_move(bullet, deltaTime);
        } 
    },
    colorful: {r:15, color:"Cyan", real_color: {r:0, g:255, b:255}, lastGrazed: 0,
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
            if( bullet.r >= 5 && random_int(0, 100) < 9 ) bullet.r -= 0.25;
            bullet.color = `rgb(${bullet.real_color.r},${bullet.real_color.g},${bullet.real_color.g})`;
            return bullet_move(bullet, deltaTime);
        }
    }
};

// Bullet templates and generators with English names
const bullet_generator_template = {
  'AimedRandomMix': {
    bullet_per_second: 40,
    bullet_templates: [bullet_template.small],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second * deltaTime);
      
      for(let i = 0; i < bulletsToGenerate; i++) {        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = { ...this.bullet_templates[template_index] };
        
        // Generate bullet using the old generate logic
        new_bullet.x = Math.random() * GAME_CONSTANTS.SCREEN.WIDTH;
        new_bullet.y = Math.random() * 10;
        
        if(Math.random() > 0.6) {
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
    bullet_per_second: 240,
    bullet_templates: [bullet_template.small, bullet_template.big],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second * deltaTime);
      
      for(let i = 0; i < bulletsToGenerate; i++) {
        if(scene.bullets.length + newBullets.length >= this.bullet_limit) break;
        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = { ...this.bullet_templates[template_index] };
        
        new_bullet.x = Math.random() * GAME_CONSTANTS.SCREEN.WIDTH;
        new_bullet.y = Math.random() * 10;
        
        new_bullet.dx = (Math.random() > 0.5 ? 1 : -1 ) * Math.random() * 168;
        new_bullet.dy = Math.random() * 336;
        
        newBullets.push(new_bullet);
      }
      
      return newBullets;
    }
  },
  
  'WideAngleAim': {
    bullet_per_second: 30,
    bullet_templates: [bullet_template.small],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second * deltaTime);
      
      for(let i = 0; i < bulletsToGenerate; i++) {        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = { ...this.bullet_templates[template_index] };
        
        new_bullet.x = Math.random() * GAME_CONSTANTS.SCREEN.WIDTH;
        new_bullet.y = Math.random() * 10;
        
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
    bullet_per_second: 240,
    bullet_templates: [bullet_template.small],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second * deltaTime);
      
      for(let i = 0; i < bulletsToGenerate; i++) {
        if(scene.bullets.length + newBullets.length >= this.bullet_limit) break;
        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = { ...this.bullet_templates[template_index] };
        
        new_bullet.x = Math.random() * GAME_CONSTANTS.SCREEN.WIDTH;
        new_bullet.y = Math.random() * 10;
        
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
            angleAcceleration: Math.PI / 3,
        },
        tick: function(scene, deltaTime) {
            console.log(this.state.angleSpeed * deltaTime);
            // Remove the console.log that was causing clutter
            const newBullets = [];

            // Use accumulated angle for consistency
            this.state.angle += this.state.angleSpeed * deltaTime;
            this.state.angleSpeed += this.state.angleAcceleration * deltaTime;
            
            // Normalize angles to prevent floating-point errors from accumulating
            while (this.state.angle > Math.PI) this.state.angle -= 2 * Math.PI;
            while (this.state.angleSpeed * deltaTime > 2 * Math.PI / this.branch) {
              this.state.angleSpeed -= 2 * Math.PI / this.branch / deltaTime;
            }

            for(let i = 0; i < this.branch; i++) {
                const new_bullet = { ...bullet_template.small };
                
                new_bullet.x = 300;
                new_bullet.y = 300;
                
                // Calculate the angle for this branch bullet
                // Use a fixed angular spacing between branches
                const bulletAngle = this.state.angle + ((2 * Math.PI) / this.branch) * i;
                
                // Set velocity based on angle
                new_bullet.dx = 180 * Math.cos(bulletAngle);
                new_bullet.dy = 180 * Math.sin(bulletAngle);
                
                newBullets.push(new_bullet);
            }
            
            return newBullets;
        },
        // Add a reset function to initialize state when switching patterns
        reset: function() {
            this.state.angle = 0;
            this.state.angleSpeed = 0;
        }
    },
  
  'Gravity': {
    bullet_limit: 500,
    bullet_per_second: 240,
    bullet_templates: [bullet_template.gravity],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second * deltaTime);
      
      for(let i = 0; i < bulletsToGenerate; i++) {
        if(scene.bullets.length + newBullets.length >= this.bullet_limit) break;
        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = { ...this.bullet_templates[template_index] };
        
        new_bullet.x = 300;
        new_bullet.y = 200;
        new_bullet.dx = (Math.random() > 0.5 ? 1 : -1 ) * Math.random() * 168;
        new_bullet.dy = -Math.random() * 336;
        
        newBullets.push(new_bullet);
      }
      
      return newBullets;
    }
  },
  
  'Snowy': {
    bullet_limit: 200,
    bullet_per_second: 120,
    bullet_templates: [bullet_template.colorful],
    state: {},
    tick: function(scene, deltaTime) {
      const newBullets = [];
      const bulletsToGenerate = Math.ceil(this.bullet_per_second / GAME_CONSTANTS.TICK_RATE);
      
      for(let i = 0; i < bulletsToGenerate; i++) {
        if(scene.bullets.length + newBullets.length >= this.bullet_limit) break;
        
        const template_index = random_int(0, this.bullet_templates.length - 1);
        const new_bullet = { ...this.bullet_templates[template_index] };
        
        new_bullet.x = Math.random() * GAME_CONSTANTS.SCREEN.WIDTH;
        new_bullet.y = Math.random() * 10;
        
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
