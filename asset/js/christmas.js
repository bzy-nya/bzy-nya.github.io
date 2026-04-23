(function () {
    class ChristmasEffectsManager {
        constructor() {
            this.isActive = false;
            this.christmasInterval = null;
            this.lightAnimationFrame = null;
            this.gridCanvas = null;
            this.gridCtx = null;
            this.mouseX = window.innerWidth / 2;
            this.mouseY = window.innerHeight / 2;
            this.clickCount = 0;
            this.nextFireworkClick = this.getNextFireworkClick();

            this.updateMouseLight = this.updateMouseLight.bind(this);
            this.handleResize = this.handleResize.bind(this);
            this.handleDocumentClick = this.handleDocumentClick.bind(this);
            this.animateGridLight = this.animateGridLight.bind(this);
        }

        start() {
            if (this.isActive) {
                return;
            }

            this.isActive = true;
            this.clickCount = 0;
            this.nextFireworkClick = this.getNextFireworkClick();
            this.applyDecorations();

            document.addEventListener('click', this.handleDocumentClick);
            document.addEventListener('mousemove', this.updateMouseLight);

            this.startSnowfall();
            this.initGridLightEffect();
        }

        stop() {
            if (!this.isActive && !this.gridCanvas && !this.christmasInterval) {
                return;
            }

            this.isActive = false;
            this.resetDecorations();

            if (this.christmasInterval) {
                clearInterval(this.christmasInterval);
                this.christmasInterval = null;
            }

            if (this.lightAnimationFrame) {
                cancelAnimationFrame(this.lightAnimationFrame);
                this.lightAnimationFrame = null;
            }

            document.removeEventListener('click', this.handleDocumentClick);
            document.removeEventListener('mousemove', this.updateMouseLight);
            window.removeEventListener('resize', this.handleResize);

            if (this.gridCanvas) {
                this.gridCanvas.remove();
                this.gridCanvas = null;
                this.gridCtx = null;
            }

            document.querySelectorAll('.christmas-snowflake').forEach((el) => el.remove());
            document.querySelectorAll('.christmas-sparkle').forEach((el) => el.remove());
            document.querySelectorAll('.christmas-message').forEach((el) => el.remove());
        }

        applyDecorations() {
            const bgIcons = ['#px-snowflake', '#px-bell', '#px-gift', '#px-tree'];
            const catBgs = document.querySelectorAll('.cat-bg use');
            catBgs.forEach((use, index) => {
                use.setAttribute('href', bgIcons[index % bgIcons.length]);
            });
        }

        resetDecorations() {
            const catBgs = document.querySelectorAll('.cat-bg use');
            catBgs.forEach((use) => {
                use.setAttribute('href', '#px-cat');
            });
        }

        startSnowfall() {
            this.christmasInterval = setInterval(() => {
                this.createFallingSnowflake();
            }, 2000 + Math.random() * 2000);
        }

        updateMouseLight(event) {
            this.mouseX = event.clientX;
            this.mouseY = event.clientY;
        }

        getNextFireworkClick() {
            return Math.floor(Math.random() * 5) + 3;
        }

        initGridLightEffect() {
            if (!this.gridCanvas) {
                this.gridCanvas = document.createElement('canvas');
                this.gridCanvas.className = 'bg-grid-canvas';
                this.gridCanvas.style.imageRendering = 'pixelated';
                document.body.appendChild(this.gridCanvas);
                this.gridCtx = this.gridCanvas.getContext('2d');
            }

            this.handleResize();
            window.addEventListener('resize', this.handleResize);
            this.animateGridLight();
        }

        handleResize() {
            if (!this.gridCanvas) {
                return;
            }

            const pixelSize = 8;
            this.gridCanvas.width = Math.ceil(window.innerWidth / pixelSize);
            this.gridCanvas.height = Math.ceil(window.innerHeight / pixelSize);
            this.gridCanvas.style.width = window.innerWidth + 'px';
            this.gridCanvas.style.height = window.innerHeight + 'px';
        }

        animateGridLight() {
            if (!this.gridCanvas || !this.gridCtx || !this.isActive) {
                return;
            }

            const time = Date.now() / 1000;
            const width = this.gridCanvas.width;
            const height = this.gridCanvas.height;
            const pixelSize = window.innerWidth / width;

            this.gridCtx.clearRect(0, 0, width, height);

            const mouseGridX = this.mouseX / pixelSize;
            const mouseGridY = this.mouseY / pixelSize;

            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    const dx = x - mouseGridX;
                    const dy = y - mouseGridY;
                    const distance = Math.pow(Math.abs(dx * dx * dx) + Math.abs(dy * dy * dy), 1 / 3);
                    const distanceFactor = 1 / (1 + distance / 15);

                    const noiseA = this.perlinNoise(x * 0.1 + time * 0.5, y * 0.1 + time * 0.3, 12345);
                    const noiseB = this.perlinNoise(x * 0.05 + time * 0.8, y * 0.05 + time * 0.6, 54321);

                    let brightness = distanceFactor * (0.8 + noiseA * 0.1 + noiseB * 0.1);
                    brightness = Math.max(0, Math.min(1, brightness));
                    brightness = Math.floor(brightness * 20) / 20;

                    if (brightness <= 0.01) {
                        continue;
                    }

                    const normalizedDist = distance / 40;
                    let r;
                    let g;
                    let b;

                    if (normalizedDist < 0.4) {
                        r = 244;
                        g = 162;
                        b = 97;
                    } else if (normalizedDist < 0.7) {
                        const t = (normalizedDist - 0.4) / 0.3;
                        r = Math.floor(244 + (230 - 244) * t);
                        g = Math.floor(162 + (57 - 162) * t);
                        b = Math.floor(97 + (70 - 97) * t);
                    } else {
                        r = 230;
                        g = 57;
                        b = 70;
                    }

                    this.gridCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
                    this.gridCtx.fillRect(x, y, 1, 1);
                }
            }

            this.lightAnimationFrame = requestAnimationFrame(this.animateGridLight);
        }

        perlinNoise(x, y, seed) {
            const xFloor = Math.floor(x) & 255;
            const yFloor = Math.floor(y) & 255;
            const xf = x - Math.floor(x);
            const yf = y - Math.floor(y);

            const hash = (gridX, gridY) => {
                let h = seed + gridX * 374761393 + gridY * 668265263;
                h = (h ^ (h >> 13)) * 1274126177;
                return (h ^ (h >> 16)) & 255;
            };

            const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
            const lerp = (a, b, t) => a + t * (b - a);

            const u = fade(xf);
            const v = fade(yf);

            const a = hash(xFloor, yFloor);
            const b = hash(xFloor + 1, yFloor);
            const c = hash(xFloor, yFloor + 1);
            const d = hash(xFloor + 1, yFloor + 1);

            return lerp(lerp(a, b, u), lerp(c, d, u), v) / 255;
        }

        createFallingSnowflake() {
            const snowflake = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            snowflake.setAttribute('class', 'christmas-snowflake');
            snowflake.setAttribute('width', '24');
            snowflake.setAttribute('height', '24');
            snowflake.setAttribute('viewBox', '0 0 16 16');
            snowflake.setAttribute('fill', 'currentColor');
            snowflake.style.left = Math.random() * (window.innerWidth - 24) + 'px';

            const duration = 8 + Math.random() * 7;
            snowflake.style.animationDuration = duration + 's';

            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#px-snowflake');
            snowflake.appendChild(use);

            document.body.appendChild(snowflake);

            window.setTimeout(() => {
                snowflake.remove();
            }, duration * 1000);
        }

        handleDocumentClick(event) {
            if (!this.isActive) {
                return;
            }

            if (event.target.closest('a, button')) {
                return;
            }

            this.clickCount += 1;

            if (this.clickCount % 10 === 0) {
                this.showChristmasMessage();
            }

            if (this.clickCount === this.nextFireworkClick) {
                this.createFireworkExplosion(event.clientX, event.clientY);
                this.nextFireworkClick += this.getNextFireworkClick();
                return;
            }

            this.createSparkles(event.clientX, event.clientY);
        }

        showChristmasMessage() {
            const messages = [
                'Merry Christmas!',
                'Let it snow!',
                'Ho Ho Ho!',
                'Season\'s Greetings!',
                'Joy to the world!',
                'Jingle all the way!',
                'Magic is in the air!',
                'Peace on Earth!',
                'Happy Holidays!',
                'Believe in the magic!'
            ];

            const message = messages[Math.floor(Math.random() * messages.length)];
            const messageEl = document.createElement('div');
            messageEl.className = 'christmas-message';
            messageEl.textContent = message;
            document.body.appendChild(messageEl);

            window.setTimeout(() => {
                messageEl.remove();
            }, 4000);
        }

        createSparkles(x, y) {
            for (let i = 0; i < 8; i++) {
                const sparkle = document.createElement('div');
                sparkle.className = 'christmas-sparkle';

                const angle = (i / 8) * 2 * Math.PI;
                const distance = 40 + Math.random() * 30;

                sparkle.style.left = x + 'px';
                sparkle.style.top = y + 'px';
                sparkle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
                sparkle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');

                if (Math.random() > 0.5) {
                    sparkle.style.background = 'var(--secondary)';
                    sparkle.style.boxShadow = '0 0 10px var(--secondary), 0 0 20px var(--accent)';
                }

                document.body.appendChild(sparkle);

                window.setTimeout(() => {
                    sparkle.remove();
                }, 800);
            }
        }

        createFireworkExplosion(x, y) {
            const particleCount = 30;
            const colors = ['#e63946', '#f4a261', '#fef6e4', '#2a9d8f', '#e76f51'];

            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.style.position = 'fixed';
                particle.style.left = x + 'px';
                particle.style.top = y + 'px';
                particle.style.width = '6px';
                particle.style.height = '6px';
                particle.style.background = colors[Math.floor(Math.random() * colors.length)];
                particle.style.pointerEvents = 'none';
                particle.style.zIndex = '9999';
                particle.style.borderRadius = '50%';
                particle.style.boxShadow = '0 0 8px currentColor';
                document.body.appendChild(particle);

                const angle = (i / particleCount) * 2 * Math.PI;
                const velocity = 150 + Math.random() * 100;
                const gravity = 300;
                const duration = 1.5 + Math.random() * 0.5;
                const velocityX = Math.cos(angle) * velocity;
                const velocityY = Math.sin(angle) * velocity;
                const startTime = performance.now();

                const animate = (currentTime) => {
                    const elapsed = (currentTime - startTime) / 1000;

                    if (elapsed >= duration) {
                        particle.remove();
                        return;
                    }

                    const deltaX = velocityX * elapsed;
                    const deltaY = velocityY * elapsed + 0.5 * gravity * elapsed * elapsed;
                    particle.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                    particle.style.opacity = 1 - elapsed / duration;
                    requestAnimationFrame(animate);
                };

                requestAnimationFrame(animate);
            }
        }
    }

    window.createChristmasEffectsManager = function () {
        return new ChristmasEffectsManager();
    };
})();
