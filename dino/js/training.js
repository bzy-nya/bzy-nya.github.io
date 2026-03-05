// Training modes: unify GA/RL integration behind a common interface.
// The game loop should not contain algorithm-specific logic.

class BaseTrainer {
    start(game) {
        // Return an array of dinos
        return [];
    }

    beforeDinoUpdate(game, dino, obstacles) {}

    onDinoDeath(game, dino) {}

    postUpdate(game) {}

    getProgressNumber() {
        return 0;
    }

    getStats() {
        return null;
    }

    // Optional: allow UI to set params without knowing internals
    setPopulationSize(value) {}
    setLearningRate(value) {}
    setRewardScale(value) {}
    setGamma(value) {}
    setMutationRate(value) {}
    setCrossoverRate(value) {}
    setElitismCount(value) {}
}

class GATrainer extends BaseTrainer {
    constructor() {
        super();
        this.ga = new GeneticAlgorithm(20);
        this._latestSnapshot = [];
    }

    start(game) {
        // IMPORTANT: do not recreate population every time start() is called.
        // start() is called every generation to rebuild dinos; GA evolution lives in this.ga.population.
        if (!this.ga.population || this.ga.population.length === 0) {
            this.ga.createInitialPopulation();
        }
        if (!this._latestSnapshot || this._latestSnapshot.length !== this.ga.population.length) {
            this._latestSnapshot = new Array(this.ga.population.length);
        }

        const dinos = [];
        for (let i = 0; i < this.ga.population.length; i++) {
            const offsetX = 80 + (i % 5) * 15;
            const offsetY = Math.floor(i / 5) * 3;
            const dino = new Dino(offsetX, game.groundY, this.ga.population[i], offsetY);

            const hue = (i * 360 / this.ga.population.length) % 360;
            dino.color = `hsl(${hue}, 60%, 40%)`;
            dino.alpha = 0.8;
            dino.dinoId = i;
            dino.isAI = true;

            dinos.push(dino);
        }
        return dinos;
    }

    beforeDinoUpdate(game, dino, obstacles) {
        if (!dino || dino.isDead || !dino.brain) return;
        
        // 直接实现 GA 决策逻辑：选择最大输出
        const { inputs } = dino.getNetworkInputs(game.gameSpeed, obstacles);
        const outputs = dino.brain.predict(inputs);
        const actions = ['jump', 'idle', 'crouch'];
        const action = actions[outputs.indexOf(Math.max(...outputs))] || 'idle';
        
        dino.executeAction(action, obstacles);
    }

    onDinoDeath(game, dino) {
        // Record final snapshot immediately on death so early-dead dinos still contribute
        // even if the game later removes them from game.dinos.
        if (!dino || !this.ga) return;

        const id = dino.dinoId;
        if (!Number.isInteger(id) || id < 0) return;

        if (!this._latestSnapshot || this._latestSnapshot.length !== this.ga.population.length) {
            this._latestSnapshot = new Array(this.ga.population.length);
        }
        if (id >= this._latestSnapshot.length) return;

        dino.fitness = this.ga.computeFitnessForDino(dino);
        this._latestSnapshot[id] = {
            score: dino.score || 0,
            aliveTime: dino.aliveTime || 0,
            jumpCount: dino.jumpCount || 0,
            obstaclesPassed: dino.obstaclesPassed || 0,
            invalidJumps: dino.invalidJumps || 0,
            crouchCount: dino.crouchCount || 0,
            crouchAvoids: dino.crouchAvoids || 0,
            invalidCrouches: dino.invalidCrouches || 0
        };
    }

    postUpdate(game) {
        // If UI changed GA population size, the GA instance sets a rebuild flag.
        if (this.ga && this.ga._needsDinoRebuild) {
            game.resetEnvironment();
            game.dinos = this.start(game);
            this.ga._needsDinoRebuild = false;
            return;
        }

        // Update snapshot after physics/collision updates (postUpdate is called after updateDinos loop).
        if (!this._latestSnapshot || this._latestSnapshot.length !== this.ga.population.length) {
            this._latestSnapshot = new Array(this.ga.population.length);
        }
        for (const dino of game.dinos) {
            if (!dino) continue;
            const id = dino.dinoId;
            if (!Number.isInteger(id) || id < 0 || id >= this._latestSnapshot.length) continue;

            dino.fitness = this.ga.computeFitnessForDino(dino);
            this._latestSnapshot[id] = {
                score: dino.score || 0,
                aliveTime: dino.aliveTime || 0,
                jumpCount: dino.jumpCount || 0,
                obstaclesPassed: dino.obstaclesPassed || 0,
                invalidJumps: dino.invalidJumps || 0,
                crouchCount: dino.crouchCount || 0,
                crouchAvoids: dino.crouchAvoids || 0,
                invalidCrouches: dino.invalidCrouches || 0
            };
        }

        const aliveCount = game.dinos.filter(d => !d.isDead).length;
        if (aliveCount !== 0) return;

        // Generation finished
        const size = this.ga.populationSize;
        const snapshot = this._latestSnapshot;

        // If snapshot has holes, selection pressure collapses (everyone looks similar).
        // This should rarely happen; warn so we can trace the missing IDs.
        let missing = 0;
        for (let i = 0; i < size; i++) {
            if (!snapshot[i]) missing++;
        }
        if (missing > 0) {
            console.warn(`GA snapshot missing ${missing}/${size} entries (some dinos may not be recorded)`);
        }

        const scores = new Array(size).fill(0);
        const times = new Array(size).fill(0);
        const jumps = new Array(size).fill(0);
        const obstaclesPassed = new Array(size).fill(0);
        const invalidJumps = new Array(size).fill(0);
        const crouchCounts = new Array(size).fill(0);
        const crouchAvoids = new Array(size).fill(0);
        const invalidCrouches = new Array(size).fill(0);

        for (let i = 0; i < size; i++) {
            const s = snapshot[i];
            if (!s) continue;
            scores[i] = s.score;
            times[i] = s.aliveTime;
            jumps[i] = s.jumpCount;
            obstaclesPassed[i] = s.obstaclesPassed;
            invalidJumps[i] = s.invalidJumps;
            crouchCounts[i] = s.crouchCount;
            crouchAvoids[i] = s.crouchAvoids || 0;
            invalidCrouches[i] = s.invalidCrouches || 0;
        }

        this.ga.calculateFitness(scores, times, jumps, obstaclesPassed, invalidJumps, crouchCounts, crouchAvoids, invalidCrouches);
        this.ga.adaptParameters();
        this.ga.createNextGeneration();

        // reset per-generation snapshot
        this._latestSnapshot = new Array(this.ga.population.length);

        game.resetEnvironment();
        game.dinos = this.start(game);

        console.log(`第 ${this.ga.generation} 代完成`);
    }

    getProgressNumber() {
        return this.ga.generation;
    }

    getStats() {
        return this.ga.getStats();
    }

    setPopulationSize(value) { this.ga.setPopulationSize(value); }
    setMutationRate(value) { this.ga.setMutationRate(value); }
    setCrossoverRate(value) { this.ga.setCrossoverRate(value); }
    setElitismCount(value) { this.ga.setElitismCount(value); }
}

class RLTrainer extends BaseTrainer {
    constructor() {
        super();
        this.rl = new ReinforcementLearning();
        this._pendingRestart = false;
        this._restartAtMs = 0;
        this._forceRebuild = false;
    }

    start(game) {
        // Fresh environment, reset RL stats
        game.resetEnvironment();
        this.rl.reset();
        this._pendingRestart = false;
        this._restartAtMs = 0;
        return this._createAgents(game);
    }

    _createAgents(game) {
        const dinos = [];
        for (let i = 0; i < this.rl.populationSize; i++) {
            const offsetX = 80 + (i % 3) * 15;
            const offsetY = Math.floor(i / 3) * 3;
            const dino = new Dino(offsetX, game.groundY, this.rl.sharedBrain, offsetY);

            const hue = (i * 360 / this.rl.populationSize) % 360;
            dino.color = `hsl(${hue}, 70%, 50%)`;
            dino.alpha = 0.8;
            dino.isRL = true;
            dino.agentId = i;

            dinos.push(dino);
        }
        return dinos;
    }

    beforeDinoUpdate(game, dino, obstacles) {
        if (!dino || dino.isDead || !dino.isRL) return;

        const agentId = dino.agentId;
        dino.brain = this.rl.policyBrain || this.rl.sharedBrain;

        // 直接调用 Dino 接口
        const inputs = dino.getNetworkInputs(game.gameSpeed, obstacles).inputs;
        const action = this.rl.makeDecision(agentId, inputs);
        const result = dino.executeAction(action, obstacles);

        // 内联奖励计算（原 RLDinoController.getReward）
        // 目标：避免“只要不跳就不扣分→躺平送死”的局部最优。
        let reward = 0;

        // 生存奖励：每帧一点点，鼓励活得更久并学习规避
        reward += 0.01;

        const currentPassed = dino.obstaclesPassed;
        if (currentPassed > (dino.lastPassedCount || 0)) {
            reward += 10;
            dino.lastPassedCount = currentPassed;
        }

        // 蹲下成功躲避飞行障碍物额外奖励
        const currentCrouchAvoids = dino.crouchAvoids || 0;
        if (currentCrouchAvoids > (dino.lastCrouchAvoidCount || 0)) {
            reward += 6;
            dino.lastCrouchAvoidCount = currentCrouchAvoids;
        }

        if (result && result.wasInvalid) {
            const jumpPenalty = Math.min(2, game.frame / 180);
            reward -= jumpPenalty;
        }
        if (result && result.didJump && !result.wasInvalid) {
            reward += 0.3;
        }
        if (result && result.didCrouch && !result.wasInvalidCrouch) {
            reward += 0.2;
        }
        if (result && result.wasInvalidCrouch) {
            reward -= 0.5;
        }

        this.rl.update(agentId, reward, false);

        const agent = this.rl.population && this.rl.population[agentId];
        if (agent) agent.score = dino.score;
    }

    onDinoDeath(game, dino) {
        if (!dino || !dino.isRL) return;
        const agentId = dino.agentId;

        // 死亡惩罚：必须存在，否则“完全不动”可能比探索动作更优
        this.rl.update(agentId, -12, true);
        this.rl.endEpisode(agentId);

        const allDead = game.dinos.every(dd => dd.isDead);
        if (allDead) {
            // small delay lets death render for one frame
            this._pendingRestart = true;
            this._restartAtMs = Date.now() + 100;
        }
    }

    postUpdate(game) {
        if (this._forceRebuild) {
            this._forceRebuild = false;
            this._pendingRestart = false;
            this._restartAtMs = 0;
            game.resetEnvironment();
            game.dinos = this._createAgents(game);
            return;
        }
        if (!this._pendingRestart) return;
        if (Date.now() < this._restartAtMs) return;

        this._pendingRestart = false;
        this._restartAtMs = 0;

        // Next episode: keep RL stats, reset env and recreate agents with updated sharedBrain
        game.resetEnvironment();
        game.dinos = this._createAgents(game);
    }

    getProgressNumber() {
        return this.rl.episode;
    }

    getStats() {
        return this.rl.getStats();
    }

    setPopulationSize(value) {
        this.rl.setPopulationSize(value);
        this._forceRebuild = true;
    }
    setLearningRate(value) { this.rl.setLearningRate(value); }
    setRewardScale(value) { this.rl.setRewardScale(value); }
    setGamma(value) { this.rl.setGamma(value); }
}

function createTrainerForMode(aiMode) {
    if (aiMode === 'RL') return new RLTrainer();
    return new GATrainer();
}
