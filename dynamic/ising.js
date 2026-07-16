const clampIsing = (value, min, max) => Math.min(max, Math.max(min, value));

class IsingSimulation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.offscreen = document.createElement('canvas');
        this.offscreenCtx = this.offscreen.getContext('2d', { alpha: false });
        this.config = {
            size: 192,
            coupling: 1,
            beta: 0.45,
            field: 0,
            sweepsPerSecond: 18
        };
        this.accumulator = 0;
        this.randomize();
    }

    resize(width, height, dpr) {
        const scale = Math.min(dpr || 1, 2);
        this.canvas.width = Math.max(1, Math.floor(width * scale));
        this.canvas.height = Math.max(1, Math.floor(height * scale));
        this.needsRender = true;
    }

    randomize() {
        const size = this.config.size;
        this.spins = new Int8Array(size * size);
        for (let i = 0; i < this.spins.length; i += 1) {
            this.spins[i] = Math.random() < 0.5 ? -1 : 1;
        }
        this.ensureOffscreen();
        this.needsRender = true;
    }

    ensureOffscreen() {
        const size = this.config.size;
        if (this.offscreen.width !== size || this.offscreen.height !== size) {
            this.offscreen.width = size;
            this.offscreen.height = size;
            this.imageData = this.offscreenCtx.createImageData(size, size);
        }
    }

    setSize(nextSize) {
        if (nextSize === this.config.size) {
            return;
        }
        this.config.size = nextSize;
        this.accumulator = 0;
        this.randomize();
    }

    flipAll() {
        for (let i = 0; i < this.spins.length; i += 1) {
            this.spins[i] = -this.spins[i];
        }
        this.needsRender = true;
    }

    getViewport() {
        const side = Math.min(this.canvas.width, this.canvas.height);
        return {
            side,
            offsetX: (this.canvas.width - side) * 0.5,
            offsetY: (this.canvas.height - side) * 0.5
        };
    }

    metropolisSweep() {
        const size = this.config.size;
        const attempts = size * size;
        const spins = this.spins;
        const beta = this.config.beta;
        const coupling = this.config.coupling;
        const field = this.config.field;

        for (let i = 0; i < attempts; i += 1) {
            const x = (Math.random() * size) | 0;
            const y = (Math.random() * size) | 0;
            const index = y * size + x;
            const spin = spins[index];

            const left = spins[y * size + ((x - 1 + size) % size)];
            const right = spins[y * size + ((x + 1) % size)];
            const up = spins[((y - 1 + size) % size) * size + x];
            const down = spins[((y + 1) % size) * size + x];
            const neighborSum = left + right + up + down;
            const deltaE = 2 * spin * (coupling * neighborSum + field);

            if (deltaE <= 0 || Math.random() < Math.exp(-beta * deltaE)) {
                spins[index] = -spin;
            }
        }

        this.needsRender = true;
    }

    poke(x, y) {
        const size = this.config.size;
        const { side, offsetX, offsetY } = this.getViewport();
        const px = x * this.canvas.width;
        const py = (1 - y) * this.canvas.height;

        if (px < offsetX || px > offsetX + side || py < offsetY || py > offsetY + side) {
            return;
        }

        const localX = (px - offsetX) / side;
        const localY = (py - offsetY) / side;
        const ix = clampIsing(Math.floor(localX * size), 0, size - 1);
        const iy = clampIsing(Math.floor(localY * size), 0, size - 1);
        const index = iy * size + ix;
        this.spins[index] = -this.spins[index];
        this.needsRender = true;
    }

    update(dt) {
        this.accumulator += dt * this.config.sweepsPerSecond;
        while (this.accumulator >= 1) {
            this.metropolisSweep();
            this.accumulator -= 1;
        }

        if (!this.needsRender) {
            return;
        }

        this.render();
    }

    render() {
        this.ensureOffscreen();

        const size = this.config.size;
        const pixels = this.imageData.data;
        const spins = this.spins;

        for (let i = 0; i < spins.length; i += 1) {
            const pixelIndex = i * 4;
            if (spins[i] > 0) {
                pixels[pixelIndex] = 247;
                pixels[pixelIndex + 1] = 182;
                pixels[pixelIndex + 2] = 103;
            } else {
                pixels[pixelIndex] = 53;
                pixels[pixelIndex + 1] = 110;
                pixels[pixelIndex + 2] = 196;
            }
            pixels[pixelIndex + 3] = 255;
        }

        this.offscreenCtx.putImageData(this.imageData, 0, 0);

        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#05070b';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const { side, offsetX, offsetY } = this.getViewport();
        ctx.drawImage(this.offscreen, offsetX, offsetY, side, side);

        if (size <= 128) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            const step = side / size;
            ctx.beginPath();
            for (let i = 1; i < size; i += 1) {
                const x = offsetX + i * step;
                const y = offsetY + i * step;
                ctx.moveTo(x, offsetY);
                ctx.lineTo(x, offsetY + side);
                ctx.moveTo(offsetX, y);
                ctx.lineTo(offsetX + side, y);
            }
            ctx.stroke();
        }

        this.needsRender = false;
    }
}
