class Dino {
    constructor(x, groundY, brain = null, yOffset = 0) {
        this.x = x;
        this.standardGroundY = groundY; // 保存标准地面高度（用于神经网络计算）
        this.groundY = groundY + yOffset; // 实际渲染位置
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
        this.isCrouching = false; // 蹲下状态
        this.crouchHeight = 25; // 蹲下时的高度
        this.normalHeight = 47; // 正常高度
        
        // AI属性
        this.brain = brain;
        this.isAI = brain !== null;
        
        // 统计数据
        this.score = 0;
        this.jumpCount = 0;
        this.crouchCount = 0; // 蹲下次数
        this.aliveTime = 0;
        this.fitness = 0;
        this.obstaclesPassed = 0; // 成功跳过的障碍物数量
        this.invalidJumps = 0; // 无效跳跃数量（没有障碍物时跳跃）
        this.crouchAvoids = 0; // 成功蹲下躲避（主要针对飞行障碍）
        this.invalidCrouches = 0; // 无效下蹲数量（附近没有需要下蹲的飞行障碍）
        
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

        // 为通过障碍计数提供稳定ID（避免把对象引用塞进障碍物上导致潜在内存问题）
        Dino._nextUid = (Dino._nextUid || 1);
        this.uid = Dino._nextUid++;
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
        
        // AI 决策由 game.js 调度：
        // - GA: GeneticAlgorithmController
        // - RL: ReinforcementLearning/RLDinoController
        
        // 检测跳过的障碍物
        this.checkPassedObstacles(obstacles);
        
        // 物理更新
        this.updatePhysics();
        
        // 动画更新
        if (!this.isJumping) {
            this.animationFrame += this.animationSpeed * gameSpeed;
        }
    }
    
    // 统一的“状态特征提取”：GA 和 RL 共用
    getNetworkInputs(gameSpeed, obstacles) {
        // 获取最近的障碍物
        let nearestObstacle = null;
        let minDistance = Infinity;

        for (let obstacle of obstacles) {
            const frontDistance = obstacle.x - (this.x + this.width);
            if (frontDistance > 0 && frontDistance < minDistance) {
                minDistance = frontDistance;
                nearestObstacle = obstacle;
            }
        }

        const inputs = [];

        // 输入1: 恐龙当前高度（相对于标准地面，归一化）
        const maxJumpHeight = 120;
        const heightAboveGround = Math.max(0, this.standardGroundY - (this.y + this.height));
        inputs.push(Math.max(0, Math.min(1, heightAboveGround / maxJumpHeight)));

        // 输入2: 垂直速度
        inputs.push(Math.max(0, Math.min(1, (this.velocityY + 15) / 30)));

        // 输入3: 到最近障碍物的水平距离
        inputs.push(nearestObstacle ? Math.max(0, Math.min(1, minDistance / 600)) : 1);

        // 输入4: 最近障碍物高度
        inputs.push(nearestObstacle ? Math.max(0, Math.min(1, nearestObstacle.height / 80)) : 0);

        // 输入5: 最近障碍物宽度
        inputs.push(nearestObstacle ? Math.max(0, Math.min(1, nearestObstacle.width / 100)) : 0);

        // 输入6: 最近障碍物下边缘高度
        if (nearestObstacle && nearestObstacle.isFlying) {
            const obstacleBottom = nearestObstacle.y + nearestObstacle.height;
            const bottomHeightAboveGround = Math.max(0, this.standardGroundY - obstacleBottom);
            inputs.push(Math.max(0, Math.min(1, bottomHeightAboveGround / 80)));
        } else {
            inputs.push(nearestObstacle ? Math.max(0, Math.min(1, nearestObstacle.height / 50)) : 0);
        }

        // 输入7: 游戏速度
        inputs.push(Math.max(0, Math.min(1, (gameSpeed - 6) / 7)));

        if (inputs.length !== 7) {
            console.error(`错误：神经网络期望7个输入，但收到${inputs.length}个:`, inputs);
        }

        return { inputs, nearestObstacle, minDistance };
    }

    isCrouchRelevantFlyingObstacle(obstacle) {
        if (!obstacle || !obstacle.isFlying) return false;

        // Prefer explicit obstacle types when available.
        if (obstacle.type === 'bird_medium' || obstacle.type === 'bird') return true;
        if (obstacle.type === 'bird_high' || obstacle.type === 'bird_low') return false;

        // Fallback: infer by bottom height above ground (standing would collide, crouch would pass).
        const obstacleBottom = obstacle.y + obstacle.height;
        const bottomHeightAboveGround = Math.max(0, this.standardGroundY - obstacleBottom);
        return bottomHeightAboveGround >= 22 && bottomHeightAboveGround <= 40;
    }
    
    // 执行AI决策的动作
    executeAction(action, obstacles) {
        // Return a structured result so trainers (especially RL) can shape rewards.
        // For non-jump actions, wasInvalid is always false.
        switch (action) {
            case 'jump':
                if (!this.isJumping) {
                    const result = this.jump(obstacles);
                    this.stopCrouch(); // 停止蹲下
                    return result;
                }
                this.stopCrouch(); // 停止蹲下
                return { didJump: false, wasInvalid: false };
            case 'crouch':
                if (!this.isJumping) { // 只有在地面时才能蹲下
                    // 判定“无效下蹲”：前方一段距离内没有“确实需要蹲”的飞行障碍
                    const hasNearbyCrouchRelevantBird = (obstacles || []).some(obstacle => {
                        if (!this.isCrouchRelevantFlyingObstacle(obstacle)) return false;
                        const distance = obstacle.x - (this.x + this.width);
                        if (!(distance > -50 && distance < 400)) return false;
                        return true;
                    });
                    this.crouch();
                    if (!hasNearbyCrouchRelevantBird) {
                        this.invalidCrouches++;
                    }
                    this.lastCrouchWasInvalid = !hasNearbyCrouchRelevantBird;
                    return { didCrouch: true, wasInvalid: false, wasInvalidCrouch: !hasNearbyCrouchRelevantBird };
                }
                this.lastCrouchWasInvalid = false;
                return { didCrouch: false, wasInvalid: false, wasInvalidCrouch: false };
            case 'idle':
            default:
                this.stopCrouch(); // 停止蹲下，回到正常状态
                this.lastCrouchWasInvalid = false;
                return { didJump: false, wasInvalid: false, wasInvalidCrouch: false };
        }
    }
    
    // 检测跳过的障碍物
    checkPassedObstacles(obstacles) {
        for (let obstacle of obstacles) {
            // 如果障碍物已经完全被恐龙超越，且之前没有计数过
            if (obstacle.x + obstacle.width < this.x) {
                // 以 uid 标记“这只恐龙是否已经对这个障碍计数过”
                if (!obstacle.passedByDinos) obstacle.passedByDinos = new Set();
                if (!obstacle.passedByDinos.has(this.uid)) {
                    obstacle.passedByDinos.add(this.uid);
                    this.obstaclesPassed++;

                    // 额外统计：只在“确实需要蹲下”的飞行障碍上计为有效躲避。
                    if (this.isCrouching && this.isCrouchRelevantFlyingObstacle(obstacle)) {
                        this.crouchAvoids++;
                    }
                }
            }
        }
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
    jump(obstacles = []) {
        if (!this.isJumping && !this.isDead) {
            this.velocityY = this.jumpPower;
            this.isJumping = true;
            this.jumpCount++;
            this.runAnimation = false;
            this.stopCrouch(); // 跳跃时停止蹲下
            
            // 检测是否为无效跳跃（前方400像素内没有障碍物）- 放宽检测范围
            const hasNearbyObstacle = obstacles.some(obstacle => {
                const distance = obstacle.x - (this.x + this.width);
                return distance > -50 && distance < 400; // 允许障碍物稍微在身后，扩大前方检测范围
            });
            
            if (!hasNearbyObstacle) {
                this.invalidJumps++;
            }

            // 供 RL 奖励函数使用
            this.lastJumpWasInvalid = !hasNearbyObstacle;

            return { didJump: true, wasInvalid: !hasNearbyObstacle };
        }

        // 没有执行 jump（例如正在空中）
        this.lastJumpWasInvalid = false;
        return { didJump: false, wasInvalid: false };
    }
    
    // 蹲下
    crouch() {
        if (!this.isDead && !this.isJumping && !this.isCrouching) {
            this.isCrouching = true;
            this.height = this.crouchHeight;
            // 调整Y位置保持底部在地面
            this.y = this.groundY - this.height;
            this.crouchCount++; // 增加蹲下计数
        }
    }
    
    // 停止蹲下
    stopCrouch() {
        if (this.isCrouching) {
            this.isCrouching = false;
            this.height = this.normalHeight;
            // 调整Y位置保持底部在地面
            this.y = this.groundY - this.height;
        }
    }
    
    // 站立（用于RL，确保不蹲下）
    stand() {
        this.stopCrouch();
    }
    
    // 碰撞检测
    checkCollision(obstacle) {
        const dinoLeft = this.x + this.collisionOffsetX;
        const dinoRight = this.x + this.width - this.collisionOffsetX;
        
        // 蹲下时调整顶部偏移量
        const topOffset = this.isCrouching ? 3 : this.collisionOffsetY; // 蹲下时减少顶部偏移
        const bottomOffset = this.isCrouching ? 2 : this.collisionOffsetY; // 蹲下时减少底部偏移
        
        const dinoTop = this.y + topOffset;
        const dinoBottom = this.y + this.height - bottomOffset;
        
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
        this.height = this.normalHeight; // 重置为正常高度
        this.y = this.groundY - this.height;
        this.velocityY = 0;
        this.isJumping = false;
        this.isCrouching = false;
        this.isDead = false;
        this.score = 0;
        this.jumpCount = 0;
        this.crouchCount = 0;
        this.aliveTime = 0;
        this.fitness = 0;
        this.obstaclesPassed = 0;
        this.invalidJumps = 0;
        this.crouchAvoids = 0;
        this.invalidCrouches = 0;
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
        
        if (this.isCrouching) {
            // 蹲下状态 - 更扁平的形状
            // 头部（向前伸）
            ctx.fillRect(x + 25, y + 5, 22, 15);
            
            // 眼睛
            if (!this.isDead) {
                ctx.fillStyle = 'white';
                ctx.fillRect(x + 33, y + 8, 6, 4);
                ctx.fillStyle = 'black';
                ctx.fillRect(x + 35, y + 9, 2, 2);
            }
            
            // 嘴部
            ctx.fillStyle = this.color;
            ctx.fillRect(x + 47, y + 12, 2, 3);
            
            // 身体（压扁）
            ctx.fillRect(x + 6, y + 15, 35, 10);
            
            // 腿部（贴地）
            ctx.fillRect(x + 10, y + 20, 8, 5);
            ctx.fillRect(x + 25, y + 20, 8, 5);
            
            // 手臂（向前）
            ctx.fillRect(x + 5, y + 17, 6, 4);
            ctx.fillRect(x + 35, y + 17, 6, 4);
            
        } else {
            // 正常状态
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
            fitness: this.fitness,
            obstaclesPassed: this.obstaclesPassed,
            invalidJumps: this.invalidJumps
        };
    }
    
}
