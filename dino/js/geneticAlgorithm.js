class GeneticAlgorithm {
    constructor(populationSize, mutationRate = 0.1, crossoverRate = 0.8, elitismCount = 2) {
        this.populationSize = populationSize;
        this.mutationRate = mutationRate;
        this.crossoverRate = crossoverRate;
        // 尊重传入的 elitismCount；UI 滑动条也会直接更新该值
        this.elitismCount = Math.max(1, Math.min(populationSize, Math.floor(elitismCount)));
        
        this.generation = 0;
        this.population = [];
        this.fitnessScores = [];
        this.bestIndividual = null;
        this.bestFitness = 0;
        this.averageFitness = 0;
        
        // 统计数据
        this.stats = {
            generationHistory: [],
            bestScoreHistory: [],
            avgScoreHistory: []
        };
        
        this.stagnantGenerations = 0;
        this.lastBest = 0;
        this.lineageHistory = []; // 每代的溯源信息
        this.savedElites = []; // 保存的精英个体

        // 当种群大小变更时，通知 game.js 重建 dinos
        this._needsDinoRebuild = false;
    }
    
    // 创建初始种群
    createInitialPopulation() {
        this.population = [];
        for (let i = 0; i < this.populationSize; i++) {
            // 神经网络输入(6个):
            // 1. 恐龙当前高度（距地面）
            // 2. 恐龙垂直速度
            // 3. 到下一个障碍物的水平距离
            // 4. 下一个障碍物的高度
            // 5. 下一个障碍物的宽度
            // 6. 当前游戏速度
            // 隐藏层: 12个神经元（增加以处理更复杂的决策）
            // 输出: 3个动作 [跳跃, 不动, 蹲下]
            const individual = new NeuralNetwork(7, 12, 3);
            // GA 初始化不应默认偏向 idle（否则容易全体早死、适应度信号极弱）
            individual.neutralizeOutputBias();
            this.population.push(individual);
        }
        this.fitnessScores = new Array(this.populationSize).fill(0);
        
        // 记录初代谱系（随机初始化）
        this.lineageHistory = [Array.from({ length: this.populationSize }, () => ({ from: [null, null], method: 'random' }))];
    }
    
    // 计算适应度
    calculateFitness(scores, times, jumps, obstaclesPassed, invalidJumps, crouchCounts, crouchAvoids = [], invalidCrouches = []) {
        this.fitnessScores = [];
        let totalFitness = 0;
        let maxScore = Math.max(...scores);
        
        for (let i = 0; i < this.populationSize; i++) {
            // 确保所有参数都是有效数值
            const safeScore = scores[i] || 0;
            const safeTime = (times[i] !== undefined && times[i] !== null) ? times[i] : 0;
            const safeJumps = jumps[i] || 0;
            const safeObstacles = obstaclesPassed[i] || 0;
            const safeInvalidJumps = invalidJumps[i] || 0;
            const safeCrouches = crouchCounts[i] || 0;
            const safeCrouchAvoids = crouchAvoids[i] || 0;
            const safeInvalidCrouches = invalidCrouches[i] || 0;
            
            let fitness = this.computeFitness({
                score: safeScore,
                aliveTime: safeTime,
                obstaclesPassed: safeObstacles,
                jumpCount: safeJumps,
                crouchCount: safeCrouches,
                invalidJumps: safeInvalidJumps,
                crouchAvoids: safeCrouchAvoids,
                invalidCrouches: safeInvalidCrouches
            });
            
            // 最佳个体额外奖励
            if (safeScore === maxScore && safeScore > 0) {
                fitness *= 1.1;
            }
            
            this.fitnessScores[i] = Math.max(1, fitness); // 最小适应度为1，避免0值
            totalFitness += this.fitnessScores[i];
            
            // 调试适应度计算
            if (Math.random() < 0.05) {
                console.log(`恐龙${i} 适应度: 分数=${safeScore}, 存活=${safeTime.toFixed(1)}s, 障碍=${safeObstacles}, 跳跃=${safeJumps}, 蹲下=${safeCrouches}(有效${safeCrouchAvoids}/无效${safeInvalidCrouches}), 最终=${this.fitnessScores[i].toFixed(1)}`);
            }
        }
        
        this.averageFitness = totalFitness / this.populationSize;
        
        // 更新最佳个体
        const bestIndex = this.fitnessScores.indexOf(Math.max(...this.fitnessScores));
        if (this.fitnessScores[bestIndex] > this.bestFitness) {
            this.bestFitness = this.fitnessScores[bestIndex];
            this.bestIndividual = this.population[bestIndex].copy();
        }
        
        // 停滞检测 - 使用更稳定的标准
        const currentBestScore = Math.max(...scores);
        const previousBest = this.lastBest;

        // 初次/基线：避免 previousBest=0 导致 Infinity.toFixed() 抛异常
        if (!(Number.isFinite(previousBest) && previousBest > 0)) {
            this.stagnantGenerations = 0;
            this.lastBest = currentBestScore;
            console.log(`🆕 基线记录: ${currentBestScore.toFixed(1)}`);
        } else if (currentBestScore > previousBest * 1.01) {
            // 有明显改进（>1%），重置停滞计数
            const improvement = (((currentBestScore - previousBest) / previousBest) * 100).toFixed(1);
            this.stagnantGenerations = 0;
            this.lastBest = currentBestScore;
            console.log(`📈 性能提升 +${improvement}%: ${currentBestScore.toFixed(1)} (上次: ${previousBest.toFixed(1)})`);
        } else if (currentBestScore < previousBest * 0.95) {
            // 明显退化（<95%），增加停滞计数
            const decline = (((previousBest - currentBestScore) / previousBest) * 100).toFixed(1);
            this.stagnantGenerations += 2;
            console.log(`📉 性能退化 -${decline}%: ${currentBestScore.toFixed(1)} (上次: ${previousBest.toFixed(1)}) [停滞+2]`);
        } else {
            // 微小变化，缓慢增加停滞计数
            this.stagnantGenerations++;
            console.log(`➡️  性能持平 (停滞: ${this.stagnantGenerations}代)`);
        }
        
        // 记录统计数据
        this.stats.generationHistory.push(this.generation);
        this.stats.bestScoreHistory.push(Math.max(...scores));
        this.stats.avgScoreHistory.push(scores.reduce((a, b) => a + b, 0) / scores.length);
        
        // 保存当前的精英个体（在 createNextGeneration 之前）
        this.savedElites = this.getElites();
        
        // 格式化输出当前代统计
        const sortedIndices = this.fitnessScores
            .map((fitness, index) => ({ fitness, index }))
            .sort((a, b) => b.fitness - a.fitness);
        
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`🧬 第 ${this.generation} 代完成`);
        console.log(`${'─'.repeat(60)}`);
        console.log(`📊 统计: 最高=${Math.max(...scores).toFixed(1)}, 平均=${(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)}, 障碍=${Math.max(...obstaclesPassed)}`);
        console.log(`🏆 适应度: 最佳=${this.bestFitness.toFixed(1)}, 平均=${this.averageFitness.toFixed(1)}`);
        
        // 输出精英个体信息
        const eliteInfo = sortedIndices.slice(0, this.elitismCount)
            .map(({fitness, index}) => `#${index}(分=${scores[index].toFixed(0)}, 适=${fitness.toFixed(0)})`)
            .join(', ');
        console.log(`⭐ 保存精英: ${eliteInfo}`);
    }

    // GA 专属适应度函数（统一入口，避免散落在 Dino/game 中）
    computeFitness({ score, aliveTime, obstaclesPassed, jumpCount, crouchCount, invalidJumps, crouchAvoids = 0, invalidCrouches = 0 }) {
        const safeScore = Number.isFinite(score) ? score : 0;
        const safeTime = Number.isFinite(aliveTime) ? aliveTime : 0;
        const safeObstacles = Number.isFinite(obstaclesPassed) ? obstaclesPassed : 0;
        const safeJumps = Number.isFinite(jumpCount) ? jumpCount : 0;
        const safeCrouches = Number.isFinite(crouchCount) ? crouchCount : 0;
        const safeInvalid = Number.isFinite(invalidJumps) ? invalidJumps : 0;
        const safeCrouchAvoids = Number.isFinite(crouchAvoids) ? crouchAvoids : 0;
        const safeInvalidCrouches = Number.isFinite(invalidCrouches) ? invalidCrouches : 0;

        // 基础分数（score 本身已包含存活时间/速度收益）
        let fitness = safeScore;

        // 无效跳跃重度惩罚
        fitness -= safeInvalid * 50;

        // 下蹲信号：
        // - 无效下蹲要扣分（避免无脑蹲/乱蹲）
        // - 有效下蹲（成功躲避飞行障碍）要加分
        fitness -= safeInvalidCrouches * 10;
        fitness += safeCrouchAvoids * 25;

        // 轻微动作成本，防止刷动作（有效动作仍然可以靠 avoid reward 抵消）
        fitness -= safeJumps * 1;
        fitness -= safeCrouches * 0.5;

        return Math.max(1, fitness);
    }

    computeFitnessForDino(dino) {
        if (!dino) return 1;
        return this.computeFitness({
            score: dino.score || 0,
            aliveTime: dino.aliveTime || 0,
            obstaclesPassed: dino.obstaclesPassed || 0,
            jumpCount: dino.jumpCount || 0,
            crouchCount: dino.crouchCount || 0,
            invalidJumps: dino.invalidJumps || 0,
            crouchAvoids: dino.crouchAvoids || 0,
            invalidCrouches: dino.invalidCrouches || 0
        });
    }
    
    // 选择父母（混合选择策略）
    selectParent() {
        // 70%概率选择前20%的精英个体，30%概率使用锦标赛选择
        if (Math.random() < 0.7) {
            // 精英选择：从前20%中随机选择（加权概率）
            const eliteCount = Math.max(2, Math.floor(this.populationSize * 0.2));
            const sortedIndices = this.fitnessScores
                .map((fitness, index) => ({ fitness, index }))
                .sort((a, b) => b.fitness - a.fitness)
                .slice(0, eliteCount);
            // 使用平方根加权，让更优秀的个体被选中概率更高
            const weights = sortedIndices.map((_, i) => Math.sqrt(eliteCount - i));
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let rand = Math.random() * totalWeight;
            for (let i = 0; i < sortedIndices.length; i++) {
                rand -= weights[i];
                if (rand <= 0) {
                    return this.population[sortedIndices[i].index];
                }
            }
            return this.population[sortedIndices[0].index];
        } else {
            // 锦标赛选择
            return this.tournamentSelection(3);
        }
    }
    
    // 锦标赛选择（备用选择方法）
    tournamentSelection(tournamentSize = 3) {
        let best = null;
        let bestFitness = -1;
        
        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * this.populationSize);
            if (this.fitnessScores[randomIndex] > bestFitness) {
                bestFitness = this.fitnessScores[randomIndex];
                best = this.population[randomIndex];
            }
        }
        
        return best || this.population[0];
    }
    
    // 创建下一代
    createNextGeneration() {
        const newPopulation = [];
        const prevPop = this.population.slice();
        const newLineage = [];
        
        // 创建索引映射
        const indexMap = new Map();
        for (let i = 0; i < prevPop.length; i++) {
            indexMap.set(prevPop[i], i);
        }
        
        // 🔴 关键修复：使用保存的精英而不是重新计算
        if (this.savedElites && this.savedElites.length > 0) {
            console.log(`✅ 使用保存的 ${this.savedElites.length} 个精英个体`);
            for (let i = 0; i < this.savedElites.length; i++) {
                newPopulation.push(this.savedElites[i]);
                newLineage.push({ from: [i, null], method: 'elite' });
            }
        } else {
            console.warn(`⚠️  savedElites 为空，回退到重新计算精英`);
            const sortedIndices = this.fitnessScores
                .map((fitness, index) => ({ fitness, index }))
                .sort((a, b) => b.fitness - a.fitness)
                .slice(0, this.elitismCount);
            for (const item of sortedIndices) {
                newPopulation.push(prevPop[item.index].copy());
                newLineage.push({ from: [item.index, null], method: 'elite' });
            }
        }

        // 注意：UI 可能在两次 generation 之间改了 elitismCount。
        // 这里以“本次实际塞入 newPopulation 的精英数量”为准，避免后续多样性注入覆盖精英。
        const eliteProtectedCount = newPopulation.length;
        
        // 生成剩余个体（统计操作数量）
        let crossoverCount = 0, copyCount = 0;
        while (newPopulation.length < this.populationSize) {
            const parent1 = this.selectParent();
            const parent2 = this.selectParent();
            const p1Index = indexMap.get(parent1) ?? -1;
            const p2Index = indexMap.get(parent2) ?? -1;
            
            let child;
            let method;
            
            // 使用正确的交叉概率
            if (Math.random() < this.crossoverRate) {
                child = parent1.crossover(parent2);
                method = 'crossover';
                crossoverCount++;
            } else {
                // 优先复制更优秀的父母
                const p1Fitness = this.fitnessScores[indexMap.get(parent1)] || 0;
                const p2Fitness = this.fitnessScores[indexMap.get(parent2)] || 0;
                child = (p1Fitness >= p2Fitness ? parent1 : parent2).copy();
                method = 'copy';
                copyCount++;
            }
            
            // 变异
            child.mutate(this.mutationRate);
            newPopulation.push(child);
            newLineage.push({ from: [p1Index, method === 'crossover' ? p2Index : null], method });
        }
        
        console.log(`🧪 遗传操作: 交叉=${crossoverCount}, 复制=${copyCount}, 精英=${eliteProtectedCount}`);
        
        
        // 多样性注入：若连续停滞>=8代，随机重启5%个体（非精英）
        if (this.stagnantGenerations >= 8) {
            const replaceCount = Math.max(1, Math.floor(this.populationSize * 0.05));
            console.log(`🔄 停滞${this.stagnantGenerations}代，注入${replaceCount}个随机个体`);
            for (let i = 0; i < replaceCount; i++) {
                // 只替换非精英个体
                const idx = eliteProtectedCount + Math.floor(Math.random() * (newPopulation.length - eliteProtectedCount));
                newPopulation[idx] = new NeuralNetwork(7, 12, 3);
                newPopulation[idx].neutralizeOutputBias();
                newLineage[idx] = { from: [null, null], method: 'random' };
            }
        }
        
        // 确保种群大小正确
        while (newPopulation.length > this.populationSize) {
            newPopulation.pop();
            newLineage.pop();
        }
        
        this.population = newPopulation;
        this.generation++;
        this.lineageHistory.push(newLineage);
        
        console.log(`${'═'.repeat(60)}\n`);
    }
    
    // 获取精英个体
    getElites() {
        const elites = [];
        const sortedIndices = this.fitnessScores
            .map((fitness, index) => ({ fitness, index }))
            .sort((a, b) => b.fitness - a.fitness)
            .slice(0, this.elitismCount);
            
        for (const item of sortedIndices) {
            elites.push(this.population[item.index].copy());
        }
        
        return elites;
    }
    
    // 获取当前种群的最佳个体
    getBestIndividual() {
        if (this.fitnessScores.length === 0) return null;
        
        const bestIndex = this.fitnessScores.indexOf(Math.max(...this.fitnessScores));
        return this.population[bestIndex];
    }
    
    // 重置算法
    reset() {
        this.generation = 0;
        this.population = [];
        this.fitnessScores = [];
        this.bestIndividual = null;
        this.bestFitness = 0;
        this.averageFitness = 0;
        this.stagnantGenerations = 0; // 重置停滞代数
        this.lastBest = 0; // 重置最佳分数记录
        this.lineageHistory = []; // 重置谱系历史
        this.stats = {
            generationHistory: [],
            bestScoreHistory: [],
            avgScoreHistory: []
        };
    }
    
    // 获取统计信息
    getStats() {
        return {
            generation: this.generation,
            bestFitness: this.bestFitness,
            averageFitness: this.averageFitness,
            populationSize: this.populationSize,
            mutationRate: this.mutationRate,
            crossoverRate: this.crossoverRate,
            elitismCount: this.elitismCount,
            history: this.stats,
            lineageHistory: this.lineageHistory
        };
    }

    // 参数更新（提供统一入口，避免 UI 直接改字段导致 size/数组不同步）
    setPopulationSize(value) {
        const newSize = Math.max(2, Math.min(200, Math.floor(value)));
        if (newSize === this.populationSize && this.population.length === newSize) return;

        this.populationSize = newSize;
        this.elitismCount = Math.max(1, Math.min(this.elitismCount, newSize));

        // 变更 size 时直接重建种群（运行时热切换没有意义，且会导致 GA 内部数组不一致）
        this.reset();
        this.createInitialPopulation();
        this._needsDinoRebuild = true;
    }

    setMutationRate(value) {
        const v = Number(value);
        if (!Number.isFinite(v)) return;
        this.mutationRate = Math.max(0.001, Math.min(0.5, v));
    }

    setCrossoverRate(value) {
        const v = Number(value);
        if (!Number.isFinite(v)) return;
        this.crossoverRate = Math.max(0.0, Math.min(1.0, v));
    }

    setElitismCount(value) {
        const v = Math.floor(value);
        if (!Number.isFinite(v)) return;
        this.elitismCount = Math.max(1, Math.min(this.populationSize, v));
    }
    
    // 动态调整参数（简化版，避免过度调整）
    adaptParameters() {
        // 检查最近10代是否有显著改进
        const recentGenerations = this.stats.bestScoreHistory.slice(-10);
        if (recentGenerations.length >= 10) {
            const currentBest = recentGenerations[recentGenerations.length - 1];
            const earlyBest = Math.max(...recentGenerations.slice(0, 5));
            
            // 如果最近5代没有超过前5代，适度增加变异率增强探索
            if (currentBest < earlyBest * 1.05 && this.stagnantGenerations >= 5) {
                this.mutationRate = Math.min(0.2, this.mutationRate * 1.1);
                console.log(`增强探索: mutation=${this.mutationRate.toFixed(3)}`);
            }
            
            // 如果有显著改进（>10%），降低变异率以稳定收敛
            if (currentBest > earlyBest * 1.1) {
                this.mutationRate = Math.max(0.05, this.mutationRate * 0.95);
                console.log(`稳定收敛: mutation=${this.mutationRate.toFixed(3)}`);
                this.stagnantGenerations = 0;
            }
        }
        
        // 长期停滞时重置变异率（但不改变其他参数）
        if (this.stagnantGenerations >= 15) {
            console.log(`长期停滞(${this.stagnantGenerations}代)，重置变异率`);
            this.mutationRate = 0.12;
            this.stagnantGenerations = 0;
        }
    }
}

// GA 控制器：GA 专属的“网络输出->动作”决策逻辑集中在这里
