class DinoGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // 游戏状态
        this.isRunning = false;
        this.isPaused = false;
        this.gameMode = 'AI'; // 'AI' 或 'MANUAL'
        this.gameSpeed = 6;
        this.speedMultiplier = 1;
        this.frame = 0;
        
        // 游戏尺寸
        this.groundY = this.canvas.height - 50;
        
        // 游戏对象
        this.dinos = [];
        this.obstacleManager = new ObstacleManager(this.groundY, this.canvas.width);
        this.geneticAlgorithm = new GeneticAlgorithm(20); // 20个个体的种群
        
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
            currentGeneration: 0,
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
        for (let i = 0; i < 6; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width * 2,
                y: 20 + Math.random() * 80,
                speed: 0.5 + Math.random() * 0.5
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
                    this.manualDino.jump();
                }
            }
        });
        
        // 鼠标点击事件
        this.canvas.addEventListener('click', () => {
            if (this.gameMode === 'MANUAL' && this.manualDino && !this.manualDino.isDead) {
                this.manualDino.jump();
            }
        });
    }
    
    // 开始AI进化
    startEvolution() {
        this.gameMode = 'AI';
        this.isRunning = true;
        this.isPaused = false;
        
        // 创建初始种群
        this.geneticAlgorithm.createInitialPopulation();
        this.createDinosFromPopulation();
        
        console.log('开始进化算法，种群大小:', this.geneticAlgorithm.populationSize);
    }
    
    // 开始手动游戏
    startManualGame() {
        this.gameMode = 'MANUAL';
        this.isRunning = true;
        this.isPaused = false;
        
        // 创建手动控制的恐龙
        this.manualDino = new Dino(80, this.groundY);
        this.dinos = [this.manualDino];
        
        // 重置游戏环境
        this.resetEnvironment();
        
        console.log('开始手动游戏');
    }
    
    // 从种群创建恐龙
    createDinosFromPopulation() {
        this.dinos = [];
        for (let i = 0; i < this.geneticAlgorithm.population.length; i++) {
            // 让恐龙在X轴上有不同的起始位置，避免重叠
            const offsetX = 80 + (i % 5) * 15; // 每5个恐龙一组，组内水平间距15像素
            const offsetY = Math.floor(i / 5) * 3; // 不同组有轻微的垂直偏移
            
            const dino = new Dino(offsetX, this.groundY, this.geneticAlgorithm.population[i], offsetY);
            
            // 给每个恐龙分配不同的颜色/透明度
            const hue = (i * 360 / this.geneticAlgorithm.population.length) % 360;
            dino.color = `hsl(${hue}, 60%, 40%)`;
            dino.alpha = 0.8;
            dino.dinoId = i; // 添加ID用于追踪
            
            this.dinos.push(dino);
        }
    }
    
    // 游戏主循环
    gameLoop() {
        if (this.isRunning && !this.isPaused) {
            this.update();
        }
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    // 更新游戏状态
    update() {
        this.frame++;
        
        // 更新游戏速度
        this.updateGameSpeed();
        
        // 更新障碍物
        this.obstacleManager.update(this.gameSpeed * this.speedMultiplier);
        this.obstacleManager.adjustDifficulty(this.gameSpeed * this.speedMultiplier);
        
        // 更新恐龙
        this.updateDinos();
        
        // 更新装饰
        this.updateClouds();
        this.updateGroundPattern();
        
        // 检查是否需要创建新一代
        if (this.gameMode === 'AI') {
            this.checkGenerationComplete();
        }
        
        // 更新统计数据
        this.updateStats();
    }
    
    // 更新游戏速度
    updateGameSpeed() {
        // 随时间逐渐增加游戏速度
        const baseSpeed = 6;
        const speedIncrease = Math.floor(this.frame / 600) * 0.5; // 每10秒增加0.5
        this.gameSpeed = Math.min(baseSpeed + speedIncrease, 13); // 最大速度13
    }
    
    // 更新恐龙
    updateDinos() {
        const obstacles = this.obstacleManager.getObstacles();
        
        for (let i = this.dinos.length - 1; i >= 0; i--) {
            const dino = this.dinos[i];
            
            dino.update(this.gameSpeed * this.speedMultiplier, obstacles);
            
            // 碰撞检测（只对活着的恐龙进行）
            if (!dino.isDead) {
                for (let obstacle of obstacles) {
                    if (dino.checkCollision(obstacle)) {
                        dino.die();
                        break;
                    }
                }
            }
            
            // 移除超出屏幕左侧的死亡恐龙
            if (dino.isDead && dino.x < -dino.width) {
                this.dinos.splice(i, 1);
            }
        }
    }
    
    // 更新云朵
    updateClouds() {
        for (let cloud of this.clouds) {
            cloud.x -= cloud.speed * this.speedMultiplier;
            if (cloud.x < -50) {
                cloud.x = this.canvas.width + Math.random() * 100;
                cloud.y = 20 + Math.random() * 80;
            }
        }
    }
    
    // 更新地面图案
    updateGroundPattern() {
        for (let pattern of this.groundPattern) {
            pattern.x -= this.gameSpeed * this.speedMultiplier * 0.5;
            if (pattern.x < -20) {
                pattern.x = this.canvas.width;
                pattern.type = Math.random() > 0.7 ? 'rock' : 'none';
            }
        }
    }
    
    // 检查世代是否完成
    checkGenerationComplete() {
        const aliveCount = this.dinos.filter(dino => !dino.isDead).length;
        
        if (aliveCount === 0) {
            // 所有恐龙都死了，创建新一代
            this.createNextGeneration();
        }
    }
    
    // 创建下一代
    createNextGeneration() {
        // 收集适应度数据
        const scores = this.dinos.map(dino => dino.score);
        const times = this.dinos.map(dino => dino.aliveTime);
        const jumps = this.dinos.map(dino => dino.jumpCount);
        
        // 计算适应度
        this.geneticAlgorithm.calculateFitness(scores, times, jumps);
        
        // 自适应参数调整
        this.geneticAlgorithm.adaptParameters();
        
        // 创建新一代
        this.geneticAlgorithm.createNextGeneration();
        
        // 创建新的恐龙
        this.createDinosFromPopulation();
        
        // 重置游戏环境
        this.resetEnvironment();
        
        console.log(`第 ${this.geneticAlgorithm.generation} 代完成`);
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
        this.geneticAlgorithm.reset();
        this.dinos = [];
        this.manualDino = null;
        
        // 重置装饰
        this.initClouds();
        this.initGroundPattern();
    }
    
    // 更新统计数据
    updateStats() {
        if (this.gameMode === 'AI') {
            this.stats.currentGeneration = this.geneticAlgorithm.generation;
            this.stats.aliveCount = this.dinos.filter(dino => !dino.isDead).length;
            
            const scores = this.dinos.map(dino => dino.score);
            this.stats.averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
            
            const currentHighScore = Math.max(...scores);
            if (currentHighScore > this.stats.highScore) {
                this.stats.highScore = currentHighScore;
            }
            
            // 更新最佳个体信息
            const bestDino = this.dinos.reduce((best, current) => 
                current.score > best.score ? current : best
            );
            this.stats.bestIndividual = bestDino.getStateInfo();
        } else {
            // 手动游戏统计
            if (this.manualDino) {
                this.stats.aliveCount = this.manualDino.isDead ? 0 : 1;
                this.stats.averageScore = this.manualDino.score;
                if (this.manualDino.score > this.stats.highScore) {
                    this.stats.highScore = this.manualDino.score;
                }
                this.stats.bestIndividual = this.manualDino.getStateInfo();
            }
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
        this.ctx.fillStyle = '#f7f7f7';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 绘制云朵
    drawClouds() {
        this.ctx.fillStyle = '#d3d3d3';
        for (let cloud of this.clouds) {
            this.drawCloud(cloud.x, cloud.y);
        }
    }
    
    // 绘制单个云朵
    drawCloud(x, y) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 15, 0, Math.PI * 2);
        this.ctx.arc(x + 15, y, 20, 0, Math.PI * 2);
        this.ctx.arc(x + 35, y, 15, 0, Math.PI * 2);
        this.ctx.arc(x + 25, y - 10, 12, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    // 绘制地面
    drawGround() {
        const groundHeight = this.canvas.height - this.groundY;
        
        // 地面基色
        this.ctx.fillStyle = '#f7f7f7';
        this.ctx.fillRect(0, this.groundY, this.canvas.width, groundHeight);
        
        // 地面线
        this.ctx.strokeStyle = '#535353';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.groundY);
        this.ctx.lineTo(this.canvas.width, this.groundY);
        this.ctx.stroke();
        
        // 地面图案
        this.ctx.fillStyle = '#d3d3d3';
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
            this.ctx.fillText(`世代: ${this.stats.currentGeneration}`, rightX, 25);
            this.ctx.fillText(`存活: ${this.stats.aliveCount}`, rightX, 45);
            this.ctx.fillText(`最高分: ${Math.floor(this.stats.highScore)}`, rightX, 65);
            this.ctx.fillText(`速度: ${this.gameSpeed.toFixed(1)}x`, rightX, 85);
        } else {
            // 手动模式UI - 右上角
            if (this.manualDino) {
                this.ctx.fillText(`分数: ${Math.floor(this.manualDino.score)}`, rightX, 25);
                this.ctx.fillText(`最高分: ${Math.floor(this.stats.highScore)}`, rightX, 45);
                this.ctx.fillText(`跳跃: ${this.manualDino.jumpCount}`, rightX, 65);
                
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
    
    // 获取统计数据
    getStats() {
        return this.stats;
    }
    
    // 获取遗传算法统计
    getGeneticStats() {
        return this.geneticAlgorithm.getStats();
    }
}
