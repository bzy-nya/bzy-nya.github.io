class DinoGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // 游戏状态
        this.isRunning = false;
        this.isPaused = false;
        this.gameMode = 'AI'; // 'AI' 或 'MANUAL'
        this.aiMode = 'GA'; // 'GA' (遗传算法) 或 'RL' (强化学习)
        this.gameSpeed = 6;
        this.speedMultiplier = 1;
        this.frame = 0;

        // Fixed-timestep simulation (render FPS independent)
        this._fixedStepMs = 1000 / 60;
        this._accumulatorMs = 0;
        this._lastFrameTs = null;
        
        // 游戏尺寸
        this.groundY = this.canvas.height - 50;
        
        // 游戏对象
        this.dinos = [];
        this.obstacleManager = new ObstacleManager(this.groundY, this.canvas.width);
        // 训练模式（GA/RL）通过统一接口解耦；game.js 不包含算法专用逻辑
        this.trainer = (typeof createTrainerForMode === 'function') ? createTrainerForMode(this.aiMode) : null;
        
        // 手动游戏的恐龙
        this.manualDino = null;
        
        // 云朵装饰
        this.clouds = [];
        this.initClouds();
        
        // 地面装饰
        this.groundPattern = [];
        this.initGroundPattern();
        
        // 统计数据
        this.stats = {
            iteration: 0,
            aliveCount: 0,
            highScore: 0,
            averageScore: 0,
            bestIndividual: null
        };
        
        // 事件监听
        this.setupEventListeners();
        
        // 开始游戏循环
        this.gameLoop();
    }
    
    // 初始化云朵
    initClouds() {
        this.clouds = [];
        const sizes = ['small', 'medium', 'large'];
        for (let i = 0; i < 6; i++) {
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            const speed = (
                size === 'small' ? 0.7 : size === 'medium' ? 0.5 : 0.35
            ) + Math.random() * 0.2;
            // Dino 风格统一的浅灰色
            const shade = '#cfcfcf';
            const scale = (size === 'large' && Math.random() < 0.5) ? 2 : 1;
            this.clouds.push({
                x: Math.random() * this.canvas.width * 2,
                y: 20 + Math.random() * 80,
                speed,
                size,
                shade,
                scale
            });
        }
    }
    
    // 初始化地面图案
    initGroundPattern() {
        for (let i = 0; i < this.canvas.width / 20; i++) {
            this.groundPattern.push({
                x: i * 20,
                type: Math.random() > 0.7 ? 'rock' : 'none'
            });
        }
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.gameMode === 'MANUAL' && this.manualDino && !this.manualDino.isDead) {
                    this.manualDino.jump(this.obstacleManager.getObstacles());
                }
            }
        });
        
        // 鼠标点击事件
        this.canvas.addEventListener('click', () => {
            if (this.gameMode === 'MANUAL' && this.manualDino && !this.manualDino.isDead) {
                this.manualDino.jump(this.obstacleManager.getObstacles());
            }
        });
    }
    
    // 开始模拟（AI训练：GA 或 RL）
    startSimulation() {
        this.isRunning = true;
        this.isPaused = false;
        this.gameMode = 'AI';
        this.manualDino = null;
        
        if (!this.trainer) {
            this.trainer = createTrainerForMode(this.aiMode);
        }

        // 确保切换模式或从手动返回时环境是干净的
        this.resetEnvironment();
        this.dinos = this.trainer.start(this);
    }

    // 开始手动游戏
    startManualGame() {
        this.gameMode = 'MANUAL';
        this.isRunning = true;
        this.isPaused = false;
        this.trainer = null;

        this.manualDino = new Dino(80, this.groundY);
        this.dinos = [this.manualDino];
        this.resetEnvironment();
    }

    setAIMode(mode) {
        this.aiMode = mode;
        this.trainer = createTrainerForMode(this.aiMode);
    }
    
    // 游戏主循环
    gameLoop(ts) {
        const now = (typeof ts === 'number') ? ts : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
        if (this._lastFrameTs == null) this._lastFrameTs = now;

        // Real time delta (cap to avoid huge catch-up after tab is hidden)
        let deltaMs = now - this._lastFrameTs;
        this._lastFrameTs = now;
        if (!Number.isFinite(deltaMs) || deltaMs < 0) deltaMs = 0;
        deltaMs = Math.min(deltaMs, 250);

        if (this.isRunning && !this.isPaused) {
            // speedMultiplier accelerates simulated time (training speed), not render FPS.
            const simDeltaMs = deltaMs * Math.max(1, this.speedMultiplier | 0);
            this._accumulatorMs += simDeltaMs;

            // Avoid spiral-of-death in extreme cases
            const maxStepsPerFrame = 300;
            let steps = 0;
            while (this._accumulatorMs >= this._fixedStepMs && steps < maxStepsPerFrame) {
                this.update();
                this._accumulatorMs -= this._fixedStepMs;
                steps++;
            }
        }

        // Render once per RAF
        this.draw();
        requestAnimationFrame((nextTs) => this.gameLoop(nextTs));
    }
    
    // 更新游戏状态
    update() {
        this.frame++;
        
        // 更新游戏速度
        this.updateGameSpeed();
        
        // 更新障碍物
        this.obstacleManager.update(this.gameSpeed);
        this.obstacleManager.adjustDifficulty(this.gameSpeed);

        // 更新恐龙
        this.updateDinos();
        
        // 更新装饰
        this.updateClouds();
        this.updateGroundPattern();
        
        // 更新统计数据
        this.updateStats();
    }
    
    // 更新游戏速度
    updateGameSpeed() {
        // 随时间逐渐增加游戏速度，但需要保证可解：限制最高速度，并放缓增长。
        const baseSpeed = 6;
        const isRLTraining = this.aiMode === 'RL' && this.gameMode === 'AI';
        const speedIncrease = isRLTraining
            ? Math.floor(this.frame / 600) * 0.15 // RL：更慢的难度爬升
            : Math.floor(this.frame / 420) * 0.2;  // ~7秒 +0.2
        const maxSpeed = isRLTraining ? 10 : 12;
        this.gameSpeed = Math.min(baseSpeed + speedIncrease, maxSpeed);
    }
    
    // 更新恐龙
    updateDinos() {
        const obstacles = this.obstacleManager.getObstacles();
        
        for (let i = this.dinos.length - 1; i >= 0; i--) {
            const dino = this.dinos[i];

            // 训练模式：在物理更新前做一次决策/采样动作
            if (this.trainer && !dino.isDead) {
                this.trainer.beforeDinoUpdate(this, dino, obstacles);
            }
            
            dino.update(this.gameSpeed, obstacles);
            
            // 碰撞检测（只对活着的恐龙进行）
            if (!dino.isDead) {
                for (let obstacle of obstacles) {
                    if (dino.checkCollision(obstacle)) {
                        dino.die();

                        if (this.trainer) {
                            this.trainer.onDinoDeath(this, dino);
                        }
                        break;
                    }
                }
            }
            
            // 移除超出屏幕左侧的死亡恐龙
            if (dino.isDead && dino.x < -dino.width) {
                this.dinos.splice(i, 1);
            }
        }

        if (this.trainer) {
            this.trainer.postUpdate(this);
        }
    }
    
    // 更新云朵
    updateClouds() {
        for (let cloud of this.clouds) {
            cloud.x -= cloud.speed;
            if (cloud.x < -80) {
                cloud.x = this.canvas.width + 40 + Math.random() * 120;
                cloud.y = 20 + Math.random() * 80;
                // 随机更新风格，保持多样性
                const sizes = ['small', 'medium', 'large'];
                cloud.size = sizes[Math.floor(Math.random() * sizes.length)];
                cloud.scale = (cloud.size === 'large' && Math.random() < 0.5) ? 2 : 1;
                // Dino 风格统一的浅灰色
                cloud.shade = '#cfcfcf';
                cloud.speed = (cloud.size === 'small' ? 0.7 : cloud.size === 'medium' ? 0.5 : 0.35) + Math.random() * 0.2;
            }
        }
    }

    // 更新地面图案
    updateGroundPattern() {
        for (let pattern of this.groundPattern) {
            pattern.x -= this.gameSpeed * 0.5;
            if (pattern.x < -20) {
                pattern.x = this.canvas.width;
                pattern.type = Math.random() > 0.7 ? 'rock' : 'none';
            }
        }
    }
    
    // 重置游戏环境（保留遗传算法状态）
    resetEnvironment() {
        this.frame = 0;
        this.gameSpeed = 6;
        this.obstacleManager.reset();
    }
    
    // 完全重置游戏
    reset() {
        this.frame = 0;
        this.gameSpeed = 6;
        this.isRunning = false;
        this.isPaused = false;
        this.obstacleManager.reset();
        this.dinos = [];
        this.manualDino = null;

        // 重置 trainer（对应当前 aiMode）
        this.trainer = (typeof createTrainerForMode === 'function') ? createTrainerForMode(this.aiMode) : null;
        
        // 重置装饰
        this.initClouds();
        this.initGroundPattern();
    }
    
    // 更新统计数据
    updateStats() {
        if (this.gameMode === 'AI') {
            if (this.trainer) {
                this.stats.iteration = this.trainer.getProgressNumber();
            }
            
            this.stats.aliveCount = this.dinos.filter(d => !d.isDead).length;

            const scores = this.dinos.map(d => d.score);
            const totalScore = scores.reduce((a, b) => a + b, 0);
            this.stats.averageScore = scores.length ? totalScore / scores.length : 0;

            const currentHighScore = scores.length ? Math.max(...scores) : 0;
            if (currentHighScore > this.stats.highScore) {
                this.stats.highScore = currentHighScore;
            }
            
            if (this.dinos.length) {
                this.stats.bestIndividual = this.dinos.reduce((best, d) => 
                    d.score > best.score ? d : best
                ).getStateInfo();
            }
        } else if (this.manualDino) {
            this.stats.aliveCount = this.manualDino.isDead ? 0 : 1;
            this.stats.averageScore = this.manualDino.score;
            if (this.manualDino.score > this.stats.highScore) {
                this.stats.highScore = this.manualDino.score;
            }
            this.stats.bestIndividual = this.manualDino.getStateInfo();
        }
    }
    
    // 暂停/继续游戏
    togglePause() {
        this.isPaused = !this.isPaused;
    }
    
    // 设置速度倍数
    setSpeedMultiplier(multiplier) {
        this.speedMultiplier = multiplier;
    }
    
    // 绘制游戏
    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制背景
        this.drawBackground();
        
        // 绘制云朵
        this.drawClouds();
        
        // 绘制地面
        this.drawGround();
        
        // 绘制障碍物
        this.obstacleManager.draw(this.ctx);
        
        // 绘制恐龙
        this.drawDinos();
        
        // 绘制UI
        this.drawUI();
        
        // 绘制暂停状态
        if (this.isPaused) {
            this.drawPauseOverlay();
        }
    }
    
    // 绘制背景
    drawBackground() {
        if (document.body.classList.contains('rl-mode')) {
            this.ctx.fillStyle = '#1a1a1a';
        } else {
            this.ctx.fillStyle = '#f7f7f7';
        }
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 绘制云朵
    drawClouds() {
        if (document.body.classList.contains('rl-mode')) {
            this.ctx.fillStyle = '#666666';
        } else {
            this.ctx.fillStyle = '#d3d3d3';
        }
        for (let cloud of this.clouds) {
            this.drawCloud(cloud);
        }
    }
    
    // 绘制单个云朵
    drawCloud(cloud) {
        const { x, y, size, shade, scale = 1 } = cloud;
        const ctx = this.ctx;
        // 使用根据模式设置的颜色
        if (document.body.classList.contains('rl-mode')) {
            ctx.fillStyle = '#666666';
        } else {
            ctx.fillStyle = shade;
        }
        
        // 更加 Dino 风的像素云模板（2px 高的台阶形）
        let rects;
        if (size === 'small') {
            // 紧凑的小云
            rects = [
                [2, 0, 8, 2],
                [0, 2, 12, 2],
                [0, 4, 14, 2],
                [2, 6, 10, 2],
                [4, 8, 6, 2]
            ];
        } else if (size === 'medium') {
            // 经典 Dino 风中云
            rects = [
                [6, 0, 10, 2],
                [2, 2, 18, 2],
                [0, 4, 24, 2],
                [2, 6, 20, 2],
                [6, 8, 12, 2],
                [16, 10, 4, 2]
            ];
        } else { // large
            // 更宽、更分层的大云
            rects = [
                [8, 0, 12, 2],
                [4, 2, 22, 2],
                [0, 4, 30, 2],
                [2, 6, 26, 2],
                [6, 8, 18, 2],
                [10, 10, 10, 2]
            ];
        }
        
        // 计算高度以便使用 y 作为垂直居中的参考
        const height = rects.reduce((h, r) => Math.max(h, r[1] + r[3]), 0) * scale;
        const yTop = y - height / 2;
        
        // 绘制像素块
        for (const [dx, dy, w, h] of rects) {
            ctx.fillRect(
                Math.round(x + dx * scale),
                Math.round(yTop + dy * scale),
                Math.round(w * scale),
                Math.round(h * scale)
            );
        }
    }
    
    // 绘制地面
    drawGround() {
        const groundHeight = this.canvas.height - this.groundY;
        
        // 地面基色
        if (document.body.classList.contains('rl-mode')) {
            this.ctx.fillStyle = '#1a1a1a';
        } else {
            this.ctx.fillStyle = '#f7f7f7';
        }
        this.ctx.fillRect(0, this.groundY, this.canvas.width, groundHeight);
        
        // 地面线
        if (document.body.classList.contains('rl-mode')) {
            this.ctx.strokeStyle = '#f7f7f7';
        } else {
            this.ctx.strokeStyle = '#535353';
        }
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.groundY);
        this.ctx.lineTo(this.canvas.width, this.groundY);
        this.ctx.stroke();
        
        // 地面图案
        if (document.body.classList.contains('rl-mode')) {
            this.ctx.fillStyle = '#444444';
        } else {
            this.ctx.fillStyle = '#d3d3d3';
        }
        for (let pattern of this.groundPattern) {
            if (pattern.type === 'rock') {
                this.ctx.fillRect(pattern.x, this.groundY + 10, 3, 2);
                this.ctx.fillRect(pattern.x + 5, this.groundY + 8, 2, 3);
            }
        }
    }
    
    // 绘制恐龙
    drawDinos() {
        for (let dino of this.dinos) {
            dino.draw(this.ctx);
        }
    }
    
    // 绘制UI
    drawUI() {
        this.ctx.fillStyle = '#535353';
        this.ctx.font = '16px Courier New';
        this.ctx.textAlign = 'right';
        
        const rightX = this.canvas.width - 10;
        
        if (this.gameMode === 'AI') {
            // AI模式UI - 右上角
            this.ctx.fillText(`轮次: ${this.stats.iteration}`, rightX, 25);
            this.ctx.fillText(`存活: ${this.stats.aliveCount}`, rightX, 45);
            this.ctx.fillText(`最高分: ${Math.floor(this.stats.highScore)}`, rightX, 65);
            this.ctx.fillText(`速度: ${this.gameSpeed.toFixed(1)}m/s`, rightX, 85);
        } else {
            // 手动模式UI - 右上角
            if (this.manualDino) {
                this.ctx.fillText(`分数: ${Math.floor(this.manualDino.score)}`, rightX, 25);
                this.ctx.fillText(`最高分: ${Math.floor(this.stats.highScore)}`, rightX, 45);
                
                if (this.manualDino.isDead) {
                    this.ctx.textAlign = 'center';
                    this.ctx.font = '24px Courier New';
                    this.ctx.fillText('游戏结束！按R重新开始', this.canvas.width/2, this.canvas.height/2);
                }
            }
        }
        
        // 重置文本对齐
        this.ctx.textAlign = 'left';
    }
    
    // 绘制暂停覆盖层
    drawPauseOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '32px Courier New';
        this.ctx.fillText('已暂停', this.canvas.width/2 - 60, this.canvas.height/2);
    }
    
    getStats() {
        return this.stats;
    }
}
