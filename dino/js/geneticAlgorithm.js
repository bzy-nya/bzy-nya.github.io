class GeneticAlgorithm {
    constructor(populationSize, mutationRate = 0.1, crossoverRate = 0.8, elitismCount = 4) {
        this.populationSize = populationSize;
        this.mutationRate = mutationRate;
        this.crossoverRate = crossoverRate;
        this.elitismCount = Math.max(4, Math.floor(populationSize * 0.2)); // 至少保留20%的精英
        
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
            this.population.push(individual);
        }
        this.fitnessScores = new Array(this.populationSize).fill(0);
        
        // 记录初代谱系（随机初始化）
        this.lineageHistory = [Array.from({ length: this.populationSize }, () => ({ from: [null, null], method: 'random' }))];
    }
    
    // 计算适应度
    calculateFitness(scores, times, jumps, obstaclesPassed, invalidJumps, crouchCounts) {
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
            
            // 综合适应度计算
            let fitness = safeScore + safeTime * 10; // 基础分数 + 存活时间奖励
            
            // 障碍物通过奖励
            fitness += safeObstacles * 50;
            
            // 动作效率惩罚（轻微）
            fitness -= safeJumps * 2; // 跳跃惩罚
            fitness -= safeCrouches * 1; // 蹲下惩罚
            
            // 无效跳跃重度惩罚
            fitness -= safeInvalidJumps * 20;
            
            // 最佳个体额外奖励
            if (safeScore === maxScore && safeScore > 0) {
                fitness *= 1.1;
            }
            
            this.fitnessScores[i] = Math.max(1, fitness); // 最小适应度为1，避免0值
            totalFitness += this.fitnessScores[i];
            
            // 调试适应度计算
            if (Math.random() < 0.05) {
                console.log(`恐龙${i} 适应度: 分数=${safeScore}, 存活=${safeTime.toFixed(1)}s, 障碍=${safeObstacles}, 跳跃=${safeJumps}, 蹲下=${safeCrouches}, 最终=${this.fitnessScores[i].toFixed(1)}`);
            }
        }
        
        this.averageFitness = totalFitness / this.populationSize;
        
        // 更新最佳个体
        const bestIndex = this.fitnessScores.indexOf(Math.max(...this.fitnessScores));
        if (this.fitnessScores[bestIndex] > this.bestFitness) {
            this.bestFitness = this.fitnessScores[bestIndex];
            this.bestIndividual = this.population[bestIndex].copy();
        }
        
        // 停滞检测 - 更敏感的退化检测
        const currentBestScore = Math.max(...scores);
        if (currentBestScore < this.lastBest * 0.95) {
            // 如果当前最佳比历史最佳差5%以上，认为是退化
            this.stagnantGenerations += 2; // 退化时加重惩罚
            console.log(`性能退化检测: ${currentBestScore.toFixed(1)} vs ${this.lastBest.toFixed(1)}`);
        } else if (currentBestScore <= this.lastBest) {
            this.stagnantGenerations++;
        } else {
            this.stagnantGenerations = Math.max(0, this.stagnantGenerations - 1); // 有改进时减少停滞计数
            this.lastBest = currentBestScore;
        }
        
        // 记录统计数据
        this.stats.generationHistory.push(this.generation);
        this.stats.bestScoreHistory.push(Math.max(...scores));
        this.stats.avgScoreHistory.push(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
    
    // 选择父母（混合选择策略）
    selectParent() {
        // 40%概率选择前30%的精英个体，60%概率使用锦标赛选择（增加多样性）
        if (Math.random() < 0.4) {
            // 精英选择：从前30%中随机选择
            const eliteCount = Math.max(1, Math.floor(this.populationSize * 0.3));
            const sortedIndices = this.fitnessScores
                .map((fitness, index) => ({ fitness, index }))
                .sort((a, b) => b.fitness - a.fitness)
                .slice(0, eliteCount);
            const randomElite = sortedIndices[Math.floor(Math.random() * sortedIndices.length)];
            return this.population[randomElite.index];
        } else {
            // 锦标赛选择，适度竞争强度
            return this.tournamentSelection(4); // 降低从5到4，减少选择压力
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
        const prevPop = this.population.slice(); // 保存上一代引用用于索引
        const newLineage = [];
        
        // 创建索引映射，避免indexOf的重复个体问题
        const indexMap = new Map();
        for (let i = 0; i < prevPop.length; i++) {
            indexMap.set(prevPop[i], i);
        }
        
        // 精英保留：选择前elitismCount个，并记录谱系
        const sortedIndices = this.fitnessScores
            .map((fitness, index) => ({ fitness, index }))
            .sort((a, b) => b.fitness - a.fitness)
            .slice(0, this.elitismCount);
        for (const item of sortedIndices) {
            newPopulation.push(prevPop[item.index].copy());
            newLineage.push({ from: [item.index, null], method: 'elite' });
        }
        
        // 生成剩余个体
        while (newPopulation.length < this.populationSize) {
            const parent1 = this.selectParent();
            const parent2 = this.selectParent();
            const p1Index = indexMap.get(parent1) ?? -1;
            const p2Index = indexMap.get(parent2) ?? -1;
            
            let child;
            let method;
            
            // 提高交叉概率，增加基因多样性
            if (Math.random() < this.crossoverRate * 0.85) { // 提高实际交叉概率
                child = parent1.crossover(parent2);
                method = 'crossover';
            } else {
                // 优先复制更优秀的父母
                const p1Fitness = this.fitnessScores[indexMap.get(parent1)] || 0;
                const p2Fitness = this.fitnessScores[indexMap.get(parent2)] || 0;
                child = (p1Fitness >= p2Fitness ? parent1 : parent2).copy();
                method = 'copy';
            }
            
            // 适度的变异概率，保持探索性
            const actualMutationRate = this.mutationRate * 1.0;
            child.mutate(actualMutationRate);
            newPopulation.push(child);
            newLineage.push({ from: [p1Index, method === 'crossover' ? p2Index : null], method });
        }
        
        // 多样性注入：若连续停滞>=5代，随机重启10%个体
        if (this.stagnantGenerations >= 5) {
            const replaceCount = Math.max(1, Math.floor(this.populationSize * 0.1));
            for (let i = 0; i < replaceCount; i++) {
                const idx = Math.floor(Math.random() * newPopulation.length);
                newPopulation[idx] = new NeuralNetwork(7, 12, 3); // 更新为7输入12隐藏3输出
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
        
        console.log(`Generation ${this.generation}: Best Fitness = ${this.bestFitness.toFixed(2)}, Avg Fitness = ${this.averageFitness.toFixed(2)}`);
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
    
    // 动态调整参数
    adaptParameters() {
        // 检查最近5代是否有改进
        const recentGenerations = this.stats.bestScoreHistory.slice(-5);
        if (recentGenerations.length >= 5) {
            const currentBest = recentGenerations[recentGenerations.length - 1];
            const previousBest = Math.max(...recentGenerations.slice(0, -1));
            
            // 如果当前代比之前几代都差，说明出现退化
            if (currentBest < previousBest * 0.9) {
                console.log(`检测到性能退化: ${currentBest.toFixed(1)} < ${previousBest.toFixed(1)}`);
                // 降低交叉率和变异率，保护优秀基因
                this.crossoverRate = Math.max(0.3, this.crossoverRate * 0.9);
                this.mutationRate = Math.max(0.02, this.mutationRate * 0.8);
                // 增加精英保留
                this.elitismCount = Math.min(Math.floor(this.populationSize * 0.4), this.elitismCount + 1);
                console.log(`调整参数: crossover=${this.crossoverRate.toFixed(2)}, mutation=${this.mutationRate.toFixed(3)}, elite=${this.elitismCount}`);
            }
            
            const hasImprovement = recentGenerations.some((score, index) => 
                index > 0 && score > recentGenerations[index - 1] * 1.05
            );
            
            if (!hasImprovement && this.mutationRate < 0.15) {
                this.mutationRate = Math.min(0.15, this.mutationRate + 0.005);
                console.log(`增加探索: mutation rate = ${this.mutationRate.toFixed(3)}`);
            }
        }
        
        // 长期停滞时的激进调整
        if (this.stagnantGenerations >= 8) {
            console.log(`长期停滞(${this.stagnantGenerations}代)，重置参数`);
            this.crossoverRate = 0.6;
            this.mutationRate = 0.12;
            this.elitismCount = Math.max(4, Math.floor(this.populationSize * 0.25));
        }
    }
}
