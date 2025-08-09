class Obstacle {
    constructor(x, groundY, type = 'cactus') {
        this.x = x;
        this.groundY = groundY;
        this.type = type;
        this.speed = 0;
        
        // 根据类型设置尺寸
        this.setupDimensions();
        
        // 设置位置
        this.y = this.groundY - this.height;
        
        // 碰撞检测偏移
        this.collisionOffsetX = 2;
        this.collisionOffsetY = 2;
    }
    
    // 设置障碍物尺寸
    setupDimensions() {
        switch (this.type) {
            case 'cactus_small':
                this.width = 17;
                this.height = 35;
                break;
            case 'cactus_large':
                this.width = 25;
                this.height = 50;
                break;
            case 'bird':
                this.width = 46;
                this.height = 40;
                this.isFlying = true;
                break;
            default: // 'cactus'
                this.width = 17;
                this.height = 35;
                this.type = 'cactus_small';
        }
    }
    
    // 更新障碍物位置
    update(gameSpeed) {
        this.speed = gameSpeed;
        this.x -= this.speed;
        
        // 飞行障碍物的上下飘动效果
        if (this.type === 'bird') {
            const time = Date.now() * 0.005;
            this.y = this.groundY - this.height - 20 + Math.sin(time + this.x * 0.01) * 10;
        }
    }
    
    // 检查是否超出屏幕
    isOffScreen() {
        return this.x + this.width < 0;
    }
    
    // 绘制障碍物
    draw(ctx) {
        ctx.fillStyle = '#535353';
        
        switch (this.type) {
            case 'cactus_small':
                this.drawSmallCactus(ctx);
                break;
            case 'cactus_large':
                this.drawLargeCactus(ctx);
                break;
            case 'bird':
                this.drawBird(ctx);
                break;
        }
    }
    
    // 绘制小仙人掌
    drawSmallCactus(ctx) {
        const x = this.x;
        const y = this.y;
        
        // 主干
        ctx.fillRect(x + 6, y + 15, 4, 20);
        
        // 左臂
        ctx.fillRect(x + 2, y + 20, 4, 8);
        ctx.fillRect(x, y + 18, 2, 6);
        
        // 右臂
        ctx.fillRect(x + 10, y + 25, 4, 6);
        ctx.fillRect(x + 14, y + 23, 2, 4);
        
        // 顶部
        ctx.fillRect(x + 4, y + 10, 8, 8);
        ctx.fillRect(x + 6, y + 8, 4, 4);
        
        // 刺
        this.drawSpikes(ctx, x, y, this.width, this.height);
    }
    
    // 绘制大仙人掌
    drawLargeCactus(ctx) {
        const x = this.x;
        const y = this.y;
        
        // 主干
        ctx.fillRect(x + 8, y + 20, 8, 30);
        
        // 左臂
        ctx.fillRect(x + 2, y + 25, 6, 12);
        ctx.fillRect(x, y + 22, 2, 8);
        
        // 右臂
        ctx.fillRect(x + 16, y + 30, 6, 10);
        ctx.fillRect(x + 22, y + 28, 2, 6);
        
        // 顶部
        ctx.fillRect(x + 6, y + 15, 12, 10);
        ctx.fillRect(x + 8, y + 12, 8, 6);
        
        // 刺
        this.drawSpikes(ctx, x, y, this.width, this.height);
    }
    
    // 绘制鸟类
    drawBird(ctx) {
        const x = this.x;
        const y = this.y;
        const time = Date.now() * 0.01;
        const wingFlap = Math.sin(time) > 0;
        
        // 身体
        ctx.fillRect(x + 15, y + 15, 16, 10);
        
        // 头部
        ctx.fillRect(x + 10, y + 12, 8, 8);
        
        // 尾巴
        ctx.fillRect(x + 30, y + 16, 8, 6);
        
        // 翅膀动画
        if (wingFlap) {
            // 翅膀向上
            ctx.fillRect(x + 12, y + 8, 12, 4);
            ctx.fillRect(x + 16, y + 4, 8, 4);
        } else {
            // 翅膀向下
            ctx.fillRect(x + 12, y + 25, 12, 4);
            ctx.fillRect(x + 16, y + 29, 8, 4);
        }
        
        // 眼睛
        ctx.fillStyle = 'white';
        ctx.fillRect(x + 12, y + 14, 2, 2);
        ctx.fillStyle = '#535353';
        
        // 喙
        ctx.fillRect(x + 8, y + 16, 3, 2);
    }
    
    // 绘制仙人掌刺
    drawSpikes(ctx, x, y, width, height) {
        ctx.fillStyle = '#2d2d2d';
        
        // 随机分布的小刺
        const spikePositions = [
            {x: 2, y: 5}, {x: width-3, y: 8}, {x: 1, y: 15},
            {x: width-2, y: 18}, {x: 3, y: 25}, {x: width-4, y: 28}
        ];
        
        for (let spike of spikePositions) {
            if (spike.y < height - 5) {
                ctx.fillRect(x + spike.x, y + spike.y, 1, 2);
            }
        }
    }
    
    // 获取碰撞盒
    getCollisionBox() {
        return {
            x: this.x + this.collisionOffsetX,
            y: this.y + this.collisionOffsetY,
            width: this.width - this.collisionOffsetX * 2,
            height: this.height - this.collisionOffsetY * 2
        };
    }
}

// 障碍物生成器
class ObstacleManager {
    constructor(groundY, canvasWidth) {
        this.groundY = groundY;
        this.canvasWidth = canvasWidth;
        this.obstacles = [];
        this.lastObstacleX = canvasWidth;
        this.minDistance = 300; // 增加最小距离
        this.maxDistance = 500; // 增加最大距离
        
        // 障碍物类型权重
        this.obstacleTypes = [
            { type: 'cactus_small', weight: 40 },
            { type: 'cactus_large', weight: 30 },
            { type: 'bird', weight: 20 }
        ];
    }
    
    // 更新所有障碍物
    update(gameSpeed) {
        // 移动现有障碍物
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            this.obstacles[i].update(gameSpeed);
            
            // 移除超出屏幕的障碍物
            if (this.obstacles[i].isOffScreen()) {
                this.obstacles.splice(i, 1);
            }
        }
        
        // 生成新障碍物
        this.spawnObstacles();
    }
    
    // 生成新障碍物
    spawnObstacles() {
        if (this.obstacles.length === 0 || 
            this.obstacles[this.obstacles.length - 1].x < this.canvasWidth - this.getRandomDistance()) {
            
            const obstacleType = this.getRandomObstacleType();
            const x = this.canvasWidth + 50;
            const obstacle = new Obstacle(x, this.groundY, obstacleType);
            
            this.obstacles.push(obstacle);
            this.lastObstacleX = x;
        }
    }
    
    // 获取随机障碍物类型
    getRandomObstacleType() {
        const totalWeight = this.obstacleTypes.reduce((sum, type) => sum + type.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let type of this.obstacleTypes) {
            random -= type.weight;
            if (random <= 0) {
                return type.type;
            }
        }
        
        return 'cactus_small'; // 默认类型
    }
    
    // 获取随机距离
    getRandomDistance() {
        return this.minDistance + Math.random() * (this.maxDistance - this.minDistance);
    }
    
    // 绘制所有障碍物
    draw(ctx) {
        for (let obstacle of this.obstacles) {
            obstacle.draw(ctx);
        }
    }
    
    // 获取所有障碍物
    getObstacles() {
        return this.obstacles;
    }
    
    // 重置
    reset() {
        this.obstacles = [];
        this.lastObstacleX = this.canvasWidth;
    }
    
    // 调整难度
    adjustDifficulty(gameSpeed) {
        // 根据游戏速度调整障碍物间距
        const speedFactor = gameSpeed / 6; // 基础速度6
        this.minDistance = Math.max(250, 300 - speedFactor * 30); // 增加基础间距
        this.maxDistance = Math.max(350, 500 - speedFactor * 50); // 增加基础间距
        
        // 高速时增加鸟类概率
        if (gameSpeed > 8) {
            this.obstacleTypes = [
                { type: 'cactus_small', weight: 30 },
                { type: 'cactus_large', weight: 25 },
                { type: 'bird', weight: 35 }
            ];
        } else {
            this.obstacleTypes = [
                { type: 'cactus_small', weight: 40 },
                { type: 'cactus_large', weight: 30 },
                { type: 'bird', weight: 20 }
            ];
        }
    }
}
