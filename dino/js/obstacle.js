class Obstacle {
    constructor(x, groundY, type = 'cactus') {
        this.x = x;
        this.groundY = groundY;
        this.type = type;
        this.speed = 0;
        
        // 根据类型设置尺寸
        this.setupDimensions();
        
        // 设置位置
        if (this.isFlying && this.flyingHeight) {
            // 飞行障碍物根据指定高度设置位置
            this.y = this.groundY - this.flyingHeight;
        } else {
            // 地面障碍物
            this.y = this.groundY - this.height;
        }
        
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
            case 'cactus_double':
                this.width = 40; // 2个仙人掌并排
                this.height = 35;
                break;
            case 'cactus_triple':
                this.width = 60; // 3个仙人掌并排
                this.height = 40;
                break;
            case 'cactus_quad':
                this.width = 80; // 4个仙人掌并排
                this.height = 45;
                break;
            case 'bird_high':
                this.width = 46;
                this.height = 40;
                this.isFlying = true;
                this.flyingHeight = 150; // 高鸟，只能下蹲通过
                break;
            case 'bird_medium':
                this.width = 46;
                this.height = 40;
                this.isFlying = true;
                this.flyingHeight = 100; // 中鸟，可以跳跃或下蹲通过
                break;
            case 'bird_low':
                this.width = 46;
                this.height = 40;
                this.isFlying = true;
                this.flyingHeight = 50; // 低鸟，只能跳跃通过
                break;
            case 'bird': // 保持兼容性，默认为中等高度
                this.width = 46;
                this.height = 40;
                this.isFlying = true;
                this.flyingHeight = 60;
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
        if (this.isFlying && this.flyingHeight) {
            const time = Date.now() * 0.005;
            // 基于指定的flyingHeight进行上下飘动，幅度为±8像素
            this.y = this.groundY - this.flyingHeight + Math.sin(time + this.x * 0.01) * 8;
        } else if (this.type === 'bird') {
            // 兼容性：旧的鸟类类型
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
            case 'cactus_double':
                this.drawDoubleCactus(ctx);
                break;
            case 'cactus_triple':
                this.drawTripleCactus(ctx);
                break;
            case 'cactus_quad':
                this.drawQuadCactus(ctx);
                break;
            case 'bird_high':
            case 'bird_medium':
            case 'bird_low':
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
        
        // 根据鸟类类型选择颜色
        let birdColor = '#535353'; // 默认颜色
        switch (this.type) {
            case 'bird_high':
                birdColor = '#8B4513'; // 棕色 - 高鸟
                break;
            case 'bird_medium':
                birdColor = '#696969'; // 深灰色 - 中鸟
                break;
            case 'bird_low':
                birdColor = '#2F4F4F'; // 深蓝灰色 - 低鸟
                break;
            default:
                birdColor = '#535353'; // 默认灰色
        }
        
        ctx.fillStyle = birdColor;
        
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
        ctx.fillStyle = birdColor;
        
        // 喙
        ctx.fillRect(x + 8, y + 16, 3, 2);
    }
    
    // 绘制双仙人掌
    drawDoubleCactus(ctx) {
        // 绘制两个小仙人掌并排
        this.drawSingleCactus(ctx, this.x, this.y, 17, 35);
        this.drawSingleCactus(ctx, this.x + 20, this.y, 17, 35);
    }
    
    // 绘制三仙人掌
    drawTripleCactus(ctx) {
        // 绘制三个小仙人掌并排，中间稍高
        this.drawSingleCactus(ctx, this.x, this.y + 5, 17, 35);
        this.drawSingleCactus(ctx, this.x + 20, this.y, 17, 40);
        this.drawSingleCactus(ctx, this.x + 40, this.y + 5, 17, 35);
    }
    
    // 绘制四仙人掌
    drawQuadCactus(ctx) {
        // 绘制四个仙人掌并排，高度略有变化
        this.drawSingleCactus(ctx, this.x, this.y + 5, 17, 35);
        this.drawSingleCactus(ctx, this.x + 18, this.y, 17, 40);
        this.drawSingleCactus(ctx, this.x + 36, this.y + 3, 17, 37);
        this.drawSingleCactus(ctx, this.x + 54, this.y + 2, 17, 38);
    }
    
    // 绘制单个仙人掌（通用方法）
    drawSingleCactus(ctx, x, y, width, height) {
        const originalStyle = ctx.fillStyle;
        ctx.fillStyle = '#535353';
        
        // 主干
        ctx.fillRect(x + 6, y + 15, 4, Math.min(20, height - 15));
        
        // 左臂
        if (height > 25) {
            ctx.fillRect(x + 2, y + 20, 4, Math.min(8, height - 25));
            ctx.fillRect(x, y + 18, 2, Math.min(6, height - 27));
        }
        
        // 右臂
        if (height > 30) {
            ctx.fillRect(x + 10, y + 25, 4, Math.min(6, height - 30));
            ctx.fillRect(x + 14, y + 23, 2, Math.min(4, height - 32));
        }
        
        // 顶部
        ctx.fillRect(x + 4, y + 10, 8, 8);
        ctx.fillRect(x + 6, y + 8, 4, 4);
        
        // 简化的刺
        ctx.fillStyle = '#2d2d2d';
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(x + 2 + i * 5, y + 12 + i * 8, 1, 2);
        }
        
        ctx.fillStyle = originalStyle;
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
        this.minDistance = 400; // 增加最小距离，降低密度
        this.maxDistance = 700; // 增加最大距离
        
        // 障碍物类型权重 - 增加鸟类出现频率
        this.obstacleTypes = [
            { type: 'cactus_small', weight: 20 },
            { type: 'cactus_large', weight: 15 },
            { type: 'cactus_double', weight: 15 },
            { type: 'cactus_triple', weight: 12 },
            { type: 'cactus_quad', weight: 8 },
            { type: 'bird_high', weight: 10 },   // 高鸟：只能下蹲通过
            { type: 'bird_medium', weight: 12 }, // 中鸟：可跳跃或下蹲
            { type: 'bird_low', weight: 8 }      // 低鸟：只能跳跃通过
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
    
    // 获取随机距离 - 更随机的分布
    getRandomDistance() {
        // 使用更复杂的随机分布，包含偶尔出现的极短或极长距离
        const rand = Math.random();
        
        if (rand < 0.1) {
            // 10% 概率出现较短距离（紧张感）
            return this.minDistance * 0.6 + Math.random() * (this.minDistance * 0.4);
        } else if (rand < 0.2) {
            // 10% 概率出现较长距离（缓解时间）
            return this.maxDistance + Math.random() * (this.maxDistance * 0.5);
        } else {
            // 80% 概率正常范围，但使用非线性分布
            const normalizedRand = Math.pow(Math.random(), 1.5); // 偏向较短距离
            return this.minDistance + normalizedRand * (this.maxDistance - this.minDistance);
        }
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
        this.minDistance = Math.max(300, 400 - speedFactor * 40); // 允许更紧密的间距
        this.maxDistance = Math.max(450, 700 - speedFactor * 60); // 调整最大间距
        
        // 高速时进一步增加鸟类概率
        if (gameSpeed > 9) {
            this.obstacleTypes = [
                { type: 'cactus_small', weight: 12 },
                { type: 'cactus_large', weight: 10 },
                { type: 'cactus_double', weight: 12 },
                { type: 'cactus_triple', weight: 10 },
                { type: 'cactus_quad', weight: 8 },
                { type: 'bird_high', weight: 16 },   // 高速时更多高鸟
                { type: 'bird_medium', weight: 20 }, // 最常见的鸟类
                { type: 'bird_low', weight: 12 }
            ];
        } else if (gameSpeed > 7) {
            this.obstacleTypes = [
                { type: 'cactus_small', weight: 15 },
                { type: 'cactus_large', weight: 12 },
                { type: 'cactus_double', weight: 15 },
                { type: 'cactus_triple', weight: 12 },
                { type: 'cactus_quad', weight: 8 },
                { type: 'bird_high', weight: 12 },
                { type: 'bird_medium', weight: 16 },
                { type: 'bird_low', weight: 10 }
            ];
        } else {
            // 低速时也保持一定的鸟类频率
            this.obstacleTypes = [
                { type: 'cactus_small', weight: 22 },
                { type: 'cactus_large', weight: 18 },
                { type: 'cactus_double', weight: 18 },
                { type: 'cactus_triple', weight: 15 },
                { type: 'cactus_quad', weight: 5 },
                { type: 'bird_high', weight: 8 },
                { type: 'bird_medium', weight: 10 },
                { type: 'bird_low', weight: 4 }
            ];
        }
    }
}
