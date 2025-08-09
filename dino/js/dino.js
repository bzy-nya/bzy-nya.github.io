class Dino {
    constructor(x, groundY, brain = null, yOffset = 0) {
        this.x = x;
        this.groundY = groundY + yOffset;
        this.width = 44;
        this.height = 47;
        
        // 恐龙站在地面上，Y坐标是地面减去身高
        this.y = this.groundY - this.height;
        
        // 物理属性
        this.velocityY = 0;
        this.gravity = 0.6;
        this.jumpPower = -12;
        this.isJumping = false;
        this.isDead = false;
        
        // AI属性
        this.brain = brain;
        this.isAI = brain !== null;
        
        // 统计数据
        this.score = 0;
        this.jumpCount = 0;
        this.aliveTime = 0;
        this.fitness = 0;
        
        // 动画属性
        this.animationFrame = 0;
        this.animationSpeed = 0.2;
        this.runAnimation = true;
        
        // 碰撞检测偏移
        this.collisionOffsetX = 8;
        this.collisionOffsetY = 8;
        this.collisionWidth = this.width - this.collisionOffsetX * 2;
        this.collisionHeight = this.height - this.collisionOffsetY;
        
        // 绘制颜色（用于区分AI）
        this.color = this.isAI ? '#666' : '#535353';
        this.alpha = this.isAI ? 0.7 : 1.0;
    }
    
    // 更新恐龙状态
    update(gameSpeed, obstacles) {
        // 死亡的恐龙跟随地面移动
        if (this.isDead) {
            this.x -= gameSpeed;
            return;
        }
        
        this.aliveTime += 1/60; // 假设60FPS
        this.score += gameSpeed * 0.1;
        
        // AI决策
        if (this.isAI && this.brain) {
            const shouldJump = this.makeDecision(gameSpeed, obstacles);
            if (shouldJump && !this.isJumping) {
                this.jump();
            }
        }
        
        // 物理更新
        this.updatePhysics();
        
        // 动画更新
        if (!this.isJumping) {
            this.animationFrame += this.animationSpeed * gameSpeed;
        }
    }
    
    // AI决策
    makeDecision(gameSpeed, obstacles) {
        if (!this.brain) return false;
        
        // 获取最近的障碍物
        let nearestObstacle = null;
        let minDistance = Infinity;
        
        for (let obstacle of obstacles) {
            // 使用恐龙前沿与障碍物的左侧距离
            const frontDistance = (obstacle.x) - (this.x + this.width);
            if (frontDistance > 0 && frontDistance < minDistance) {
                minDistance = frontDistance;
                nearestObstacle = obstacle;
            }
        }
        
        // 准备神经网络输入
        const inputs = [];
        
        // 输入1: 距地面的高度（归一化，0=地面，1=最大跳高）
        const maxJumpHeight = 90;
        const heightAboveGround = Math.max(0, this.groundY - (this.y + this.height));
        const normalizedY = Math.max(0, Math.min(1, heightAboveGround / maxJumpHeight));
        inputs.push(normalizedY);
        
        // 输入2: 垂直速度（-15..15 映射到 0..1）
        const normalizedVelocity = Math.max(0, Math.min(1, (this.velocityY + 15) / 30));
        inputs.push(normalizedVelocity);
        
        // 输入3: 最近障碍物距离（使用前缘距离归一化）
        if (nearestObstacle) {
            const normalizedDistance = Math.max(0, Math.min(1, minDistance / 400));
            inputs.push(normalizedDistance);
        } else {
            inputs.push(1); // 没有障碍物，距离最远
        }
        
        // 输入4: 最近障碍物高度（归一化）
        if (nearestObstacle) {
            const normalizedHeight = Math.max(0, Math.min(1, nearestObstacle.height / 70));
            inputs.push(normalizedHeight);
        } else {
            inputs.push(0);
        }
        
        // 输入5: 恐龙在地面状态（0=跳跃中，1=在地面）
        inputs.push(this.isJumping ? 0 : 1);
        
        const output = this.brain.predict(inputs);
        
        // 距离门槛随速度增加（速度越快越早起跳）
        const dynamicDistance = Math.max(160, Math.min(280, 140 + gameSpeed * 12));
        const shouldConsiderJump = !!nearestObstacle && minDistance < dynamicDistance;
        const jumpThreshold = 0.5;
        
        return output > jumpThreshold && !this.isJumping && shouldConsiderJump;
    }
    
    // 物理更新
    updatePhysics() {
        // 重力
        this.velocityY += this.gravity;
        
        // 更新位置
        this.y += this.velocityY;
        
        // 着地检查 - 恐龙的底部接触地面
        const dinoBottom = this.y + this.height;
        if (dinoBottom >= this.groundY) {
            this.y = this.groundY - this.height;
            this.velocityY = 0;
            this.isJumping = false;
        }
        
        // 边界检查：确保恐龙不会超出画布顶部
        if (this.y < 0) {
            this.y = 0;
            this.velocityY = Math.max(0, this.velocityY); // 防止向上穿越
        }
    }
    
    // 跳跃
    jump() {
        if (!this.isJumping && !this.isDead) {
            this.velocityY = this.jumpPower;
            this.isJumping = true;
            this.jumpCount++;
            this.runAnimation = false;
        }
    }
    
    // 碰撞检测
    checkCollision(obstacle) {
        const dinoLeft = this.x + this.collisionOffsetX;
        const dinoRight = this.x + this.width - this.collisionOffsetX;
        const dinoTop = this.y + this.collisionOffsetY;
        const dinoBottom = this.y + this.height;
        
        const obstacleLeft = obstacle.x;
        const obstacleRight = obstacle.x + obstacle.width;
        const obstacleTop = obstacle.y;
        const obstacleBottom = obstacle.y + obstacle.height;
        
        return (dinoLeft < obstacleRight &&
                dinoRight > obstacleLeft &&
                dinoTop < obstacleBottom &&
                dinoBottom > obstacleTop);
    }
    
    // 死亡
    die() {
        this.isDead = true;
        this.runAnimation = false;
    }
    
    // 重置
    reset() {
        this.y = this.groundY - this.height;
        this.velocityY = 0;
        this.isJumping = false;
        this.isDead = false;
        this.score = 0;
        this.jumpCount = 0;
        this.aliveTime = 0;
        this.fitness = 0;
        this.animationFrame = 0;
        this.runAnimation = true;
    }
    
    // 绘制恐龙
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        
        // 绘制恐龙身体
        this.drawDinoBody(ctx);
        
        ctx.restore();
        
        // 如果是死亡状态，绘制X眼睛
        if (this.isDead) {
            this.drawDeadEyes(ctx);
        }
    }
    
    // 绘制恐龙身体
    drawDinoBody(ctx) {
        const x = this.x;
        const y = this.y;
        
        // 恐龙的基本形状（类似Google Dino）
        ctx.fillStyle = this.color;
        
        // 头部
        ctx.fillRect(x + 22, y, 22, 22);
        
        // 眼睛
        if (!this.isDead) {
            ctx.fillStyle = 'white';
            ctx.fillRect(x + 30, y + 6, 6, 6);
            ctx.fillStyle = 'black';
            ctx.fillRect(x + 32, y + 8, 2, 2);
        }
        
        // 嘴部
        ctx.fillStyle = this.color;
        ctx.fillRect(x + 44, y + 10, 2, 4);
        
        // 身体
        ctx.fillRect(x + 6, y + 22, 30, 25);
        
        // 尾巴
        ctx.fillRect(x, y + 25, 8, 8);
        
        // 腿部动画
        if (this.runAnimation && !this.isJumping && !this.isDead) {
            const legFrame = Math.floor(this.animationFrame) % 2;
            if (legFrame === 0) {
                // 左腿前，右腿后
                ctx.fillRect(x + 14, y + 40, 6, 7);
                ctx.fillRect(x + 26, y + 42, 6, 5);
            } else {
                // 右腿前，左腿后
                ctx.fillRect(x + 14, y + 42, 6, 5);
                ctx.fillRect(x + 26, y + 40, 6, 7);
            }
        } else {
            // 静态腿部
            ctx.fillRect(x + 14, y + 40, 6, 7);
            ctx.fillRect(x + 26, y + 40, 6, 7);
        }
        
        // 手臂
        if (this.isJumping) {
            // 跳跃时手臂向上
            ctx.fillRect(x + 8, y + 26, 4, 8);
            ctx.fillRect(x + 32, y + 26, 4, 8);
        } else {
            // 正常手臂
            ctx.fillRect(x + 8, y + 30, 4, 6);
            ctx.fillRect(x + 32, y + 30, 4, 6);
        }
    }
    
    // 绘制死亡眼睛
    drawDeadEyes(ctx) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        
        const eyeX = this.x + 30;
        const eyeY = this.y + 6;
        
        // 绘制X
        ctx.beginPath();
        ctx.moveTo(eyeX, eyeY);
        ctx.lineTo(eyeX + 6, eyeY + 6);
        ctx.moveTo(eyeX + 6, eyeY);
        ctx.lineTo(eyeX, eyeY + 6);
        ctx.stroke();
    }
    
    // 获取状态信息
    getStateInfo() {
        return {
            x: this.x,
            y: this.y,
            velocityY: this.velocityY,
            isJumping: this.isJumping,
            isDead: this.isDead,
            score: Math.floor(this.score),
            jumpCount: this.jumpCount,
            aliveTime: this.aliveTime,
            fitness: this.fitness
        };
    }
    
    // 计算适应度
    calculateFitness() {
        // 基础分数
        this.fitness = this.score;
        
        // 存活时间奖励
        this.fitness += this.aliveTime * 10;
        
        // 跳跃效率奖励（避免无意义的跳跃）
        if (this.jumpCount > 0) {
            const jumpEfficiency = this.score / this.jumpCount;
            this.fitness += jumpEfficiency;
        }
        
        return this.fitness;
    }
}
