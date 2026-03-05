// 基于策略梯度的强化学习算法（REINFORCE）
class ReinforcementLearning {
    constructor() {
        // 并行训练的agent数量
        this.populationSize = 8;
        this.population = [];
        
        // 训练用网络（episode 结束后更新）
        this.sharedBrain = new NeuralNetwork(7, 12, 3);
        // RL 不应该带“默认偏向 idle”这种先验（那是给 GA/监督式启发用的）
        this.sharedBrain.neutralizeOutputBias();
        // 行为策略网络（episode 内冻结，避免“边跑边改策略”导致轨迹无效）
        this.policyBrain = this.sharedBrain.copy();
        
        // 创建初始种群（所有agent共享网络）
        for (let i = 0; i < this.populationSize; i++) {
            this.population.push({
                trajectory: [], // 存储轨迹 [{state, action, reward}]
                totalReward: 0,
                episodeReward: 0,
                score: 0, // 游戏分数
                isDead: false // 标记是否已死亡
            });
        }
        
        // 学习参数（更稳定的默认值）
        this.learningRate = 0.03;
        this.gamma = 0.98;
        this.rewardScale = 0.2;
        this.entropyCoef = 0.01; // 鼓励探索
        this.advantageClip = 5;  // 限制优势值，避免梯度爆炸
        this.weightClip = 2.0;   // 限制权重范围

        // 调试开关：用于确认“确实在学习”（权重变化/动作分布）
        this.debug = false;
        
        this.episode = 0;
        this.episodeRewards = [];
        this.averageReward = 0;

        // 基线（降低方差）
        this.baseline = 0;
        this.baselineMomentum = 0.9;
        
        // 统计数据
        this.stats = {
            episodeHistory: [],
            rewardHistory: [],
            avgRewardHistory: []
        };
    }

    getWeightAbsSum(brain) {
        const sumAbsMatrix = (m) => {
            let s = 0;
            for (let i = 0; i < m.length; i++) {
                for (let j = 0; j < m[i].length; j++) {
                    s += Math.abs(m[i][j]);
                }
            }
            return s;
        };

        return (
            sumAbsMatrix(brain.weightsInputHidden) +
            sumAbsMatrix(brain.weightsHiddenOutput) +
            sumAbsMatrix(brain.biasHidden) +
            sumAbsMatrix(brain.biasOutput)
        );
    }
    
    
    // 前向传播：隐藏层 sigmoid，输出层 logits（不做 sigmoid）
    forwardLogits(brain, inputs) {
        const inputMatrix = [];
        for (let i = 0; i < inputs.length; i++) {
            inputMatrix[i] = [inputs[i]];
        }

        let hiddenRaw = brain.matrixMultiply(brain.weightsInputHidden, inputMatrix);
        hiddenRaw = brain.matrixAdd(hiddenRaw, brain.biasHidden);
        const hidden = brain.applyActivation(hiddenRaw);

        let logitsRaw = brain.matrixMultiply(brain.weightsHiddenOutput, hidden);
        logitsRaw = brain.matrixAdd(logitsRaw, brain.biasOutput);

        const logits = [];
        for (let i = 0; i < brain.outputNodes; i++) {
            logits.push(logitsRaw[i][0]);
        }

        return { inputMatrix, hidden, logits };
    }

    softmax(logits) {
        // 数值稳定 softmax
        const maxLogit = Math.max(...logits);
        const exps = logits.map(v => Math.exp(v - maxLogit));
        const sum = exps.reduce((a, b) => a + b, 0) || 1;
        return exps.map(v => v / sum);
    }

    // 决策 - 使用策略网络进行概率采样
    makeDecision(agentIndex, inputs) {
        if (agentIndex >= this.population.length) return 'idle';
        
        const agent = this.population[agentIndex];
        // 注意：用冻结的 policyBrain 采样动作，确保同一 episode 内策略不变
        const { logits } = this.forwardLogits(this.policyBrain, inputs);
        const probs = this.softmax(logits);
        
        // 根据概率分布采样动作
        const actions = ['jump', 'idle', 'crouch'];
        const rand = Math.random();
        let cumProb = 0;
        let selectedAction = 'idle';
        let actionIndex = 1;
        
        for (let i = 0; i < probs.length; i++) {
            cumProb += probs[i];
            if (rand < cumProb) {
                selectedAction = actions[i];
                actionIndex = i;
                break;
            }
        }
        
        // 存储状态-动作对用于梯度更新
        agent.trajectory.push({
            state: inputs.slice(),
            action: actionIndex,
            actionProb: probs[actionIndex],
            reward: 0 // 稍后更新
        });
        
        return selectedAction;
    }
    
    // 更新 - 记录即时奖励
    update(agentIndex, reward, isDone) {
        if (agentIndex >= this.population.length) return;

        if (!Number.isFinite(reward)) return;
        
        const agent = this.population[agentIndex];
        agent.totalReward += reward;
        
        // 将奖励记录到轨迹的最后一步
        if (agent.trajectory.length > 0) {
            agent.trajectory[agent.trajectory.length - 1].reward += reward;
        }
    }
    
    // 回合结束 - 使用REINFORCE算法更新网络
    endEpisode(agentIndex) {
        if (agentIndex >= this.population.length) return;
        
        const agent = this.population[agentIndex];
        agent.episodeReward = agent.totalReward;
        
        // 标记该 agent 已死亡
        agent.isDead = true;
        
        // 检查是否所有agent都结束了
        const allDead = this.population.every(a => a.isDead);
        
        if (allDead) {
            const weightAbsBefore = this.debug ? this.getWeightAbsSum(this.sharedBrain) : 0;
            const actionCounts = this.debug ? [0, 0, 0] : null; // jump/idle/crouch

            // 统一在 episode 结束后做一次更新（避免并行 agent 还在跑时策略改变）
            for (const a of this.population) {
                if (!a.trajectory || a.trajectory.length === 0) continue;

                if (this.debug && actionCounts) {
                    for (const step of a.trajectory) {
                        if (step && Number.isInteger(step.action) && step.action >= 0 && step.action < 3) {
                            actionCounts[step.action]++;
                        }
                    }
                }

                // 计算每一步的折扣回报（从后往前）
                const returns = [];
                let G = 0;
                for (let t = a.trajectory.length - 1; t >= 0; t--) {
                    const r = a.trajectory[t].reward;
                    G = (Number.isFinite(r) ? r : 0) + this.gamma * G;
                    returns.unshift(G);
                }

                // 基线更新（降低方差）
                if (returns.length > 0) {
                    const meanReturn = returns.reduce((x, y) => x + y, 0) / returns.length;
                    this.baseline = this.baselineMomentum * this.baseline + (1 - this.baselineMomentum) * meanReturn;
                    for (let i = 0; i < returns.length; i++) {
                        returns[i] -= this.baseline;
                    }
                }

                // 标准化回报（减少方差）
                if (returns.length > 1) {
                    const mean = returns.reduce((x, y) => x + y, 0) / returns.length;
                    const std = Math.sqrt(returns.reduce((x, y) => x + Math.pow(y - mean, 2), 0) / returns.length);
                    for (let i = 0; i < returns.length; i++) {
                        returns[i] = (returns[i] - mean) / (std + 1e-8);
                    }
                }

                // 对该 agent 的整条轨迹做 REINFORCE 更新
                for (let t = 0; t < a.trajectory.length; t++) {
                    const step = a.trajectory[t];
                    const advantage = returns[t] * this.rewardScale;
                    if (!Number.isFinite(advantage)) continue;
                    this.updatePolicyGradient(this.sharedBrain, step.state, step.action, advantage);
                }

                // 清空轨迹
                a.trajectory = [];
            }

            // 计算本回合统计
            const rewards = this.population.map(a => a.episodeReward);
            const scores = this.population.map(a => a.score);
            const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
            const maxScore = Math.max(...scores);
            
            this.episodeRewards.push(avgReward);
            this.averageReward = this.episodeRewards.slice(-100).reduce((a, b) => a + b, 0) / 
                                Math.min(100, this.episodeRewards.length);
            
            // 递增 episode
            this.episode++;
            
            console.log(`Episode ${this.episode} completed: Avg Reward = ${avgReward.toFixed(2)}, Max Score = ${maxScore}`);
            
            // 记录历史
            this.stats.episodeHistory.push(this.episode);
            this.stats.rewardHistory.push(avgReward);
            this.stats.avgRewardHistory.push(this.averageReward);
            
            // 重置所有agent
            for (let agent of this.population) {
                agent.totalReward = 0;
                agent.episodeReward = 0;
                agent.score = 0;
                agent.isDead = false; // 清除死亡标志
            }

            // 刷新冻结策略：下一局使用更新后的网络
            this.policyBrain = this.sharedBrain.copy();

            if (this.debug) {
                const weightAbsAfter = this.getWeightAbsSum(this.sharedBrain);
                const delta = weightAbsAfter - weightAbsBefore;
                const totalActions = (actionCounts ? (actionCounts[0] + actionCounts[1] + actionCounts[2]) : 0) || 1;
                const pJump = actionCounts ? (actionCounts[0] / totalActions) : 0;
                const pIdle = actionCounts ? (actionCounts[1] / totalActions) : 0;
                const pCrouch = actionCounts ? (actionCounts[2] / totalActions) : 0;
                console.log(
                    `[RL debug] episode=${this.episode} | |w|Δ=${delta.toFixed(6)} | action% jump=${(pJump*100).toFixed(1)} idle=${(pIdle*100).toFixed(1)} crouch=${(pCrouch*100).toFixed(1)}`
                );
            }
            
                // UI 由主循环统一刷新；避免在算法模块里触发 UI 更新
        }
    }
    
    // 使用策略梯度更新网络权重
    updatePolicyGradient(brain, state, actionIndex, advantage) {
        const { inputMatrix, hidden, logits } = this.forwardLogits(brain, state);
        const probs = this.softmax(logits);

        const safeAdvantage = Math.max(-this.advantageClip, Math.min(this.advantageClip, advantage));

        // 计算输出层梯度（对 logits）：(indicator - prob) * advantage + 正确的 entropy 正则
        const logp = probs.map(p => Math.log(p + 1e-8));
        let entropySum = 0;
        for (let i = 0; i < probs.length; i++) {
            entropySum += probs[i] * (logp[i] + 1);
        }

        const outputGradients = [];
        for (let i = 0; i < brain.outputNodes; i++) {
            const indicator = (i === actionIndex) ? 1 : 0;
            const policyGrad = (indicator - probs[i]) * safeAdvantage;
            const entropyGrad = probs[i] * (entropySum - (logp[i] + 1));
            outputGradients[i] = policyGrad + this.entropyCoef * entropyGrad;
        }
        
        // 为了计算隐藏层梯度，先保存更新前的 W2
        const w2Before = brain.weightsHiddenOutput.map(row => row.slice());

        // 反向传播更新输出层权重（梯度上升）
        for (let i = 0; i < brain.weightsHiddenOutput.length; i++) {
            for (let j = 0; j < brain.weightsHiddenOutput[i].length; j++) {
                // 使用实际的隐藏层激活值
                const hiddenActivation = hidden[j][0];
                const gradient = outputGradients[i] * hiddenActivation * this.learningRate;
                brain.weightsHiddenOutput[i][j] = Math.max(-this.weightClip, Math.min(this.weightClip, brain.weightsHiddenOutput[i][j] + gradient));
            }
            // 更新偏置
            brain.biasOutput[i][0] = Math.max(-this.weightClip, Math.min(this.weightClip, brain.biasOutput[i][0] + outputGradients[i] * this.learningRate));
        }
        
        // 计算隐藏层梯度
        const hiddenGradients = [];
        for (let j = 0; j < brain.hiddenNodes; j++) {
            let gradient = 0;
            for (let i = 0; i < brain.outputNodes; i++) {
                gradient += outputGradients[i] * w2Before[i][j];
            }
            // sigmoid 导数: f'(x) = f(x) * (1 - f(x))
            const hiddenActivation = hidden[j][0];
            gradient *= hiddenActivation * (1 - hiddenActivation);
            hiddenGradients[j] = gradient;
        }
        
        // 反向传播更新隐藏层权重
        for (let j = 0; j < brain.weightsInputHidden.length; j++) {
            for (let k = 0; k < brain.weightsInputHidden[j].length; k++) {
                const inputValue = inputMatrix[k][0];
                const gradient = hiddenGradients[j] * inputValue * this.learningRate;
                brain.weightsInputHidden[j][k] = Math.max(-this.weightClip, Math.min(this.weightClip, brain.weightsInputHidden[j][k] + gradient));
            }
            // 更新偏置
            brain.biasHidden[j][0] = Math.max(-this.weightClip, Math.min(this.weightClip, brain.biasHidden[j][0] + hiddenGradients[j] * this.learningRate));
        }
    }
    
    // 重置算法
    reset() {
        this.sharedBrain = new NeuralNetwork(7, 12, 3);
        this.sharedBrain.neutralizeOutputBias();
        this.policyBrain = this.sharedBrain.copy();
        this.population = [];
        for (let i = 0; i < this.populationSize; i++) {
            this.population.push({
                trajectory: [],
                totalReward: 0,
                episodeReward: 0,
                score: 0,
                isDead: false
            });
        }
        this.episode = 0;
        this.episodeRewards = [];
        this.averageReward = 0;
        this.baseline = 0;
        this.stats = {
            episodeHistory: [],
            rewardHistory: [],
            avgRewardHistory: []
        };
    }
    
    // 获取统计信息
    getStats() {
        const totalReward = this.population.reduce((sum, a) => sum + a.totalReward, 0);
        const currentMaxScore = this.population.length > 0 ? Math.max(...this.population.map(a => a.score)) : 0;
        return {
            episode: this.episode,
            populationSize: this.populationSize,
            totalReward: totalReward,
            averageReward: this.averageReward,
            currentMaxScore: currentMaxScore,
            learningRate: this.learningRate,
            gamma: this.gamma,
            rewardScale: this.rewardScale,
            networkSize: `7-12-3`,
            history: this.stats
        };
    }
    
    // 调整参数
    setPopulationSize(value) {
        const newSize = Math.max(1, Math.min(20, value));
        if (newSize === this.populationSize && this.population.length === newSize) return;

        this.populationSize = newSize;

        // 调整 population 大小，避免 game.js 创建的 dinos 数量与 RL 内部 population 不一致
        const nextPopulation = [];
        for (let i = 0; i < newSize; i++) {
            nextPopulation.push(
                this.population[i] || {
                    trajectory: [],
                    totalReward: 0,
                    episodeReward: 0,
                    score: 0,
                    isDead: false
                }
            );
        }

        // 清理状态：改变 agent 数量相当于开启一个新的并行批次
        for (const agent of nextPopulation) {
            agent.trajectory = [];
            agent.totalReward = 0;
            agent.episodeReward = 0;
            agent.score = 0;
            agent.isDead = false;
        }

        this.population = nextPopulation;
        // 确保行为策略网络与训练网络同步（下一局重新采样）
        this.policyBrain = this.sharedBrain.copy();
    }
    
    setLearningRate(value) {
        this.learningRate = Math.max(0.0001, Math.min(0.1, value));
    }

    setGamma(value) {
        // 经验上取 (0, 1)；允许 UI 映射到 0.9~0.99
        this.gamma = Math.max(0.0, Math.min(0.999, value));
    }
    
    setRewardScale(value) {
        this.rewardScale = Math.max(0.001, Math.min(0.2, value));
    }
}

// RL 控制器：把 RL 特有的“状态输入/动作执行/奖励计算”从 game.js 中抽离
// 仍保持全局 class（与当前项目的脚本加载方式一致）
