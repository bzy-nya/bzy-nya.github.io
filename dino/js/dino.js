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
        this.lastObstaclePassedX = -1; // 最后跳过的障碍物X位置，避免重复计数
        
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
        
        // 计算初始适应度
        this.calculateFitness();
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
            const action = this.makeDecision(gameSpeed, obstacles);
            this.executeAction(action, obstacles);
        }
        
        // 检测跳过的障碍物
        this.checkPassedObstacles(obstacles);
        
        // 物理更新
        this.updatePhysics();
        
        // 实时更新适应度
        this.calculateFitness();
        
        // 动画更新
        if (!this.isJumping) {
            this.animationFrame += this.animationSpeed * gameSpeed;
        }
    }
    
    // AI决策
    makeDecision(gameSpeed, obstacles) {
        if (!this.brain) return 'idle';
        
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
        
        // 输入1: 恐龙当前高度（归一化，0=地面，1=最大跳高）
        const maxJumpHeight = 120; // 增加范围以覆盖所有可能高度
        const heightAboveGround = Math.max(0, this.groundY - (this.y + this.height));
        const normalizedY = Math.max(0, Math.min(1, heightAboveGround / maxJumpHeight));
        inputs.push(normalizedY);
        
        // 输入2: 垂直速度（-15..15 映射到 0..1）
        const normalizedVelocity = Math.max(0, Math.min(1, (this.velocityY + 15) / 30));
        inputs.push(normalizedVelocity);
        
        // 输入3: 到最近障碍物的水平距离（归一化）
        if (nearestObstacle) {
            const normalizedDistance = Math.max(0, Math.min(1, minDistance / 600)); // 增加距离范围以适应新的障碍物间距
            inputs.push(normalizedDistance);
        } else {
            inputs.push(1); // 没有障碍物，距离最远
        }
        
        // 输入4: 最近障碍物高度（归一化）
        if (nearestObstacle) {
            const normalizedHeight = Math.max(0, Math.min(1, nearestObstacle.height / 80)); // 增加高度范围
            inputs.push(normalizedHeight);
        } else {
            inputs.push(0); // 没有障碍物
        }
        
        // 输入5: 最近障碍物宽度（归一化）
        if (nearestObstacle) {
            const normalizedWidth = Math.max(0, Math.min(1, nearestObstacle.width / 100)); // 宽度范围0-100像素
            inputs.push(normalizedWidth);
        } else {
            inputs.push(0); // 没有障碍物
        }
        
        // 输入6: 最近障碍物下边缘高度（归一化）- 改进计算！
        if (nearestObstacle) {
            if (nearestObstacle.isFlying) {
                // 飞行障碍物：计算下边缘距地面的高度
                const obstacleBottom = nearestObstacle.y + nearestObstacle.height;
                const groundLevel = this.groundY;
                const bottomHeightAboveGround = Math.max(0, groundLevel - obstacleBottom);
                const normalizedBottomHeight = Math.max(0, Math.min(1, bottomHeightAboveGround / 80));
                inputs.push(normalizedBottomHeight);
            } else {
                // 地面障碍物：使用障碍物高度作为特征
                const normalizedObstacleHeight = Math.max(0, Math.min(1, nearestObstacle.height / 50));
                inputs.push(normalizedObstacleHeight);
            }
        } else {
            inputs.push(0); // 没有障碍物
        }
        
        // 输入7: 游戏速度（归一化，6-13映射到0-1）
        const normalizedSpeed = Math.max(0, Math.min(1, (gameSpeed - 6) / 7));
        inputs.push(normalizedSpeed);
        
        // 验证输入长度
        if (inputs.length !== 7) {
            console.error(`错误：神经网络期望7个输入，但收到${inputs.length}个:`, inputs);
            return 'idle';
        }
        
        const outputs = this.brain.predict(inputs);
        
        // 验证输出长度
        if (!Array.isArray(outputs) || outputs.length !== 3) {
            console.error(`错误：神经网络期望3个输出，但收到:`, outputs);
            return 'idle';
        }
        
        // 选择输出值最大的动作
        const actions = ['jump', 'idle', 'crouch'];
        const maxIndex = outputs.indexOf(Math.max(...outputs));
        const selectedAction = actions[maxIndex];
        
        // 检查是否应该考虑采取行动（基于距离）
        const baseDistance = 160;
        const speedBonus = gameSpeed * 12;
        const widthBonus = nearestObstacle ? nearestObstacle.width * 2 : 0;
        const dynamicDistance = Math.max(180, Math.min(350, baseDistance + speedBonus + widthBonus));
        const shouldConsiderAction = !!nearestObstacle && minDistance < dynamicDistance;
        
        // 调试输出和决策
        if (Math.random() < 0.01) {
            console.log(`AI[恐龙${this.dinoId || 0}]: 输入=[${inputs.map(x => x.toFixed(2)).join(',')}]`);
            console.log(`  输出=[${outputs.map(x => x.toFixed(3)).join(',')}] -> ${selectedAction}`);
            console.log(`  距离=${minDistance.toFixed(1)}, 阈值=${dynamicDistance.toFixed(1)}, 考虑行动=${shouldConsiderAction}`);
            if (nearestObstacle) {
                console.log(`  障碍物: x=${nearestObstacle.x}, w=${nearestObstacle.width}, h=${nearestObstacle.height}, type=${nearestObstacle.type}`);
                console.log(`  障碍物位置: y=${nearestObstacle.y}, bottom=${nearestObstacle.y + nearestObstacle.height}, groundY=${this.groundY}`);
                console.log(`  下边缘高度: ${Math.max(0, this.groundY - (nearestObstacle.y + nearestObstacle.height))}`);
            }
            console.log(`  游戏速度: ${gameSpeed}, 归一化: ${inputs[6]}`);
        }
        
        // 如果太远就保持idle，避免无效动作
        if (!shouldConsiderAction) {
            return 'idle';
        }
        
        return selectedAction;
    }
    
    // 执行AI决策的动作
    executeAction(action, obstacles) {
        switch (action) {
            case 'jump':
                if (!this.isJumping) {
                    this.jump(obstacles);
                }
                this.stopCrouch(); // 停止蹲下
                break;
            case 'crouch':
                if (!this.isJumping) { // 只有在地面时才能蹲下
                    this.crouch();
                }
                break;
            case 'idle':
            default:
                this.stopCrouch(); // 停止蹲下，回到正常状态
                break;
        }
    }
    
    // 检测跳过的障碍物
    checkPassedObstacles(obstacles) {
        for (let obstacle of obstacles) {
            // 如果障碍物已经完全被恐龙超越，且之前没有计数过
            if (obstacle.x + obstacle.width < this.x && 
                obstacle.x > this.lastObstaclePassedX) {
                this.obstaclesPassed++;
                this.lastObstaclePassedX = obstacle.x;
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
                // 调试无效跳跃
                if (Math.random() < 0.1) {
                    console.log(`恐龙${this.dinoId || 0} 无效跳跃! 附近没有障碍物`);
                }
            }
        }
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
        this.lastObstaclePassedX = -1;
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
    
    // 计算适应度
    calculateFitness() {
        // 基础分数：游戏得分和存活时间
        this.fitness = this.score + this.aliveTime * 10;
        
        // 障碍物通过奖励
        this.fitness += this.obstaclesPassed * 50;
        
        // 动作效率惩罚（轻微惩罚，鼓励精准行动）
        const jumpPenalty = this.jumpCount * 2; // 每次跳跃-2分
        const crouchPenalty = this.crouchCount * 1; // 每次蹲下-1分
        this.fitness -= jumpPenalty + crouchPenalty;
        
        // 无效跳跃重度惩罚
        this.fitness -= this.invalidJumps * 20;
        
        this.fitness = Math.max(1, this.fitness); // 最小适应度为1，避免0值
        
        return this.fitness;
    }
}
