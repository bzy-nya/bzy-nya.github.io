# Dino 模块与函数速览

面向维护的索引文档，按文件列出核心模块与主要函数。用于快速定位修改点与职责边界。

## UI 与入口
`index.html`
- 入口页面与 UI 结构，脚本加载顺序决定依赖关系（SVG → NN → GA/RL → 实体 → 训练 → 游戏 → UI）。

`js/main.js`
- `MODE_CONFIG`：GA/RL 的文案、滑动条范围、参数映射。
- `applyModeConfig(mode)`：切换模式 UI/主题，并同步滑动条范围与数值。
- `handleSliderChange(key, rawValue, applyToTrainer)`：滑动条值显示与写入 trainer。
- `refreshParameterDisplay(applyToTrainer)`：批量刷新滑动条对应数值。
- `syncSlidersFromTrainer(trainerStats)`：trainer 变化时同步滑动条与显示。
- `syncSpeedDisplay()`：速度倍率显示与实际倍率对齐。
- `setupControls()`：按钮/键盘事件绑定。
- `setupParameterControls()`：滑动条事件绑定与状态跟踪。
- `updateStatsDisplay()`：UI 数据刷新与个体预览驱动。
- `drawIndividualPreview()`/`drawDinoStyleNetwork()`：个体与网络可视化。

## 游戏循环与渲染
`js/game.js`
- `class DinoGame`
  - 生命周期：`startSimulation()`/`startManualGame()`/`resetEnvironment()`/`reset()`
  - 循环：`gameLoop()`/`update()`/`draw()`
  - 逻辑：`updateDinos()`/`updateStats()`/`updateGameSpeed()`
  - 渲染：`drawBackground()`/`drawClouds()`/`drawGround()`/`drawUI()` 等

## 实体与物理
`js/dino.js`
- `class Dino`
  - 行为：`update()`/`updatePhysics()`/`jump()`/`crouch()`/`stopCrouch()`/`executeAction()`
  - 感知：`getNetworkInputs()`/`isCrouchRelevantFlyingObstacle()`
  - 统计：`checkPassedObstacles()`/`getStateInfo()`
  - 碰撞/渲染：`checkCollision()`/`draw()`/`drawDinoBody()`/`drawDeadEyes()`

`js/obstacle.js`
- `class Obstacle`
  - 初始化尺寸：`setupDimensions()`
  - 更新与绘制：`update()`/`draw()`（含 cactus/bird 子绘制）
- `class ObstacleManager`
  - 生成：`spawnObstacles()`/`getRandomObstacleType()`/`getRandomDistance()`
  - 难度：`adjustDifficulty()`
  - 生命周期：`update()`/`reset()`/`getObstacles()`

## 神经网络与算法
`js/neuralNetwork.js`
- `class NeuralNetwork`
  - 前向：`predict()`/`matrixMultiply()`/`applyActivation()`
  - 进化：`mutate()`/`crossover()`/`crossoverMatrix()`/`mutateMatrix()`
  - 工具：`copy()`/`neutralizeOutputBias()`/`getDetailedActivations()`

`js/geneticAlgorithm.js`
- `class GeneticAlgorithm`
  - 初始化：`createInitialPopulation()`/`reset()`
  - 评估：`calculateFitness()`/`computeFitness()`/`computeFitnessForDino()`
  - 选择/繁殖：`selectParent()`/`tournamentSelection()`/`createNextGeneration()`
  - 统计：`getStats()`/`getElites()`/`getBestIndividual()`/`adaptParameters()`

`js/reinforcementLearning.js`
- `class ReinforcementLearning`（REINFORCE）
  - 采样：`makeDecision()`/`softmax()`/`forwardLogits()`
  - 训练：`update()`/`endEpisode()`/`updatePolicyGradient()`
  - 配置：`setPopulationSize()`/`setLearningRate()`/`setRewardScale()`/`setGamma()`/`reset()`/`getStats()`

## 训练接口层
`js/training.js`
- `class BaseTrainer`：统一钩子接口。
- `class GATrainer`
  - `start()`：构建 GA dinos
  - `beforeDinoUpdate()`：最大输出动作选择
  - `onDinoDeath()`/`postUpdate()`：记录统计并触发 GA 迭代
- `class RLTrainer`
  - `start()`：创建并行 agent
  - `beforeDinoUpdate()`：采样动作与奖励塑形
  - `onDinoDeath()`/`postUpdate()`：收集轨迹并推进 episode
- `createTrainerForMode(mode)`：工厂函数。

## 图标
`js/svgIcons.js`
- `SVGIcons`：内联 SVG 模板集合。
- `createSVGIcon()`：生成 SVG HTML。
- `insertSVGIcon()`：注入指定 DOM。
