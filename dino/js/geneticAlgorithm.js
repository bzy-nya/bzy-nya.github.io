class GeneticAlgorithm {
    constructor(populationSize, mutationRate = 0.1, crossoverRate = 0.8, elitismCount = 2) {
        this.populationSize = populationSize;
        this.mutationRate = mutationRate;
        this.crossoverRate = crossoverRate;
        this.elitismCount = elitismCount;
        
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
            // 输入: 恐龙Y位置, 恐龙速度, 下一个障碍物距离, 下一个障碍物高度, 游戏速度
            // 隐藏层: 8个神经元
            // 输出: 是否跳跃 (0-1)
            const individual = new NeuralNetwork(5, 8, 1);
            this.population.push(individual);
        }
        this.fitnessScores = new Array(this.populationSize).fill(0);
        
        // 记录初代谱系（随机初始化）
        this.lineageHistory = [Array.from({ length: this.populationSize }, () => ({ from: [null, null], method: 'random' }))];
    }
    
    // 计算适应度
    calculateFitness(scores, times, jumps) {
        this.fitnessScores = [];
        let totalFitness = 0;
        let maxScore = Math.max(...scores);
        
        for (let i = 0; i < this.populationSize; i++) {
            // 基础适应度 = 分数
            let fitness = scores[i];
            
            // 存活时间奖励（每秒+8分）
            fitness += times[i] * 8;
            
            // 跳跃效率奖励 - 惩罚过度跳跃
            if (jumps[i] > 0) {
                const jumpRatio = jumps[i] / Math.max(1, times[i] * 60); // 每秒跳跃次数
                if (jumpRatio > 2) {
                    // 如果跳跃过于频繁（每秒超过2次），给予惩罚
                    fitness *= 0.7;
                } else if (jumpRatio < 0.5 && scores[i] > 50) {
                    // 如果跳跃适度且分数较高，给予奖励
                    fitness *= 1.2;
                }
            }
            
            // 距离奖励：鼓励跑得更远
            fitness += scores[i] * 0.5;
            
            // 如果是当前最佳，给予额外奖励
            if (scores[i] === maxScore && scores[i] > 0) {
                fitness *= 1.3;
            }
            
            this.fitnessScores[i] = Math.max(0, fitness);
            totalFitness += this.fitnessScores[i];
        }
        
        this.averageFitness = totalFitness / this.populationSize;
        
        // 更新最佳个体
        const bestIndex = this.fitnessScores.indexOf(Math.max(...this.fitnessScores));
        if (this.fitnessScores[bestIndex] > this.bestFitness) {
            this.bestFitness = this.fitnessScores[bestIndex];
            this.bestIndividual = this.population[bestIndex].copy();
        }
        
        // 停滞检测
        const currentBestScore = Math.max(...scores);
        if (currentBestScore <= this.lastBest) {
            this.stagnantGenerations++;
        } else {
            this.stagnantGenerations = 0;
            this.lastBest = currentBestScore;
        }
        
        // 记录统计数据
        this.stats.generationHistory.push(this.generation);
        this.stats.bestScoreHistory.push(Math.max(...scores));
        this.stats.avgScoreHistory.push(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
    
    // 选择父母（轮盘赌选择）
    selectParent() {
        // 若总适应度为0，使用锦标赛选择以避免全随机漂移
        const totalFitness = this.fitnessScores.reduce((s, f) => s + f, 0);
        if (totalFitness === 0) {
            return this.tournamentSelection(3);
        }
        
        let random = Math.random() * totalFitness;
        let sum = 0;
        
        for (let i = 0; i < this.populationSize; i++) {
            sum += this.fitnessScores[i];
            if (random <= sum) {
                return this.population[i];
            }
        }
        
        return this.population[this.population.length - 1];
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
            const p1Index = prevPop.indexOf(parent1);
            const p2Index = prevPop.indexOf(parent2);
            
            let child;
            let method;
            if (Math.random() < this.crossoverRate) {
                child = parent1.crossover(parent2);
                method = 'crossover';
            } else {
                child = parent1.copy();
                method = 'copy';
            }
            
            child.mutate(this.mutationRate);
            newPopulation.push(child);
            newLineage.push({ from: [p1Index, method === 'crossover' ? p2Index : null], method });
        }
        
        // 多样性注入：若连续停滞>=5代，随机重启10%个体
        if (this.stagnantGenerations >= 5) {
            const replaceCount = Math.max(1, Math.floor(this.populationSize * 0.1));
            for (let i = 0; i < replaceCount; i++) {
                const idx = Math.floor(Math.random() * newPopulation.length);
                newPopulation[idx] = new NeuralNetwork(5, 8, 1); // 全新个体
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
        // 如果多代没有改进，增加变异率
        const recentGenerations = this.stats.bestScoreHistory.slice(-5);
        if (recentGenerations.length >= 5) {
            const hasImprovement = recentGenerations.some((score, index) => 
                index > 0 && score > recentGenerations[index - 1]
            );
            
            if (!hasImprovement && this.mutationRate < 0.3) {
                this.mutationRate = Math.min(0.3, this.mutationRate + 0.01);
                console.log(`Increased mutation rate to ${this.mutationRate.toFixed(3)}`);
            } else if (hasImprovement && this.mutationRate > 0.05) {
                this.mutationRate = Math.max(0.05, this.mutationRate - 0.005);
                console.log(`Decreased mutation rate to ${this.mutationRate.toFixed(3)}`);
            }
        }
        
        // 发生退化时，临时提高交叉率并小幅增加变异率
        if (this.stagnantGenerations >= 3) {
            this.crossoverRate = Math.min(1.0, this.crossoverRate + 0.05);
            this.mutationRate = Math.min(0.35, this.mutationRate + 0.01);
        }
    }
}
