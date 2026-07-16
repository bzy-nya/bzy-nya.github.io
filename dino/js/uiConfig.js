(function exposeDinoUIConfig() {
    const MODE_CONFIG = {
        GA: {
            toggleText: 'GA → RL',
            bodyClass: '',
            title: ' Dino Game - 进化算法演示',
            evolutionTitle: '进化统计',
            evolutionIcon: 'evolution',
            startBtnText: '开始进化',
            individualText: '最佳个体',
            generationLabel: '当前世代:',
            avgScoreLabel: '平均分数:',
            params: ['种群大小:', '变异率:', '交叉率:', '精英保留:'],
            sliderRanges: {
                population: { min: 10, max: 50, step: 1, defaultValue: 20 },
                mutation: { min: 0.01, max: 0.5, step: 0.01, defaultValue: 0.1 },
                crossover: { min: 0.1, max: 1.0, step: 0.1, defaultValue: 0.8 },
                elitism: { min: 1, max: 10, step: 1, defaultValue: 2 }
            },
            sliders: {
                population: {
                    display: (v) => Math.round(v),
                    trainerValue: (v) => Math.round(v),
                    format: (v) => Math.round(v).toString(),
                    apply: (t, v) => t.setPopulationSize(v),
                    fromTrainer: (s) => s.populationSize
                },
                mutation: {
                    display: (v) => v,
                    trainerValue: (v) => v,
                    format: (v) => v.toFixed(3),
                    apply: (t, v) => t.setMutationRate(v),
                    fromTrainer: (s) => s.mutationRate
                },
                crossover: {
                    display: (v) => v,
                    trainerValue: (v) => v,
                    format: (v) => v.toFixed(2),
                    apply: (t, v) => t.setCrossoverRate(v),
                    fromTrainer: (s) => s.crossoverRate
                },
                elitism: {
                    display: (v) => Math.round(v),
                    trainerValue: (v) => Math.round(v),
                    format: (v) => Math.round(v).toString(),
                    apply: (t, v) => t.setElitismCount(v),
                    fromTrainer: (s) => s.elitismCount
                }
            }
        },
        RL: {
            toggleText: 'RL → GA',
            bodyClass: 'rl-mode',
            title: ' Dino Game - 强化学习演示',
            evolutionTitle: '学习统计',
            evolutionIcon: 'trophy',
            startBtnText: '开始学习',
            individualText: '当前个体',
            generationLabel: '回合数:',
            avgScoreLabel: '当前分数:',
            params: ['Agent数量:', '学习速度:', '奖励系数:', '折扣因子γ:'],
            sliderRanges: {
                population: { min: 1, max: 20, step: 1, defaultValue: 8 },
                mutation: { min: 0.01, max: 0.5, step: 0.01, defaultValue: 0.15 },
                crossover: { min: 0.1, max: 1.0, step: 0.1, defaultValue: 1.0 },
                elitism: { min: 1, max: 10, step: 1, defaultValue: 9 }
            },
            sliders: {
                population: {
                    display: (v) => Math.round(v),
                    trainerValue: (v) => Math.round(v),
                    format: (v) => Math.round(v).toString(),
                    apply: (t, v) => t.setPopulationSize(v),
                    fromTrainer: (s) => s.populationSize
                },
                mutation: {
                    display: (v) => v * 0.2,
                    trainerValue: (v) => v * 0.2,
                    format: (v) => v.toFixed(4),
                    apply: (t, v) => t.setLearningRate(v),
                    fromTrainer: (s) => (s.learningRate || 0) / 0.2
                },
                crossover: {
                    display: (v) => v * 0.2,
                    trainerValue: (v) => v * 0.2,
                    format: (v) => v.toFixed(3),
                    apply: (t, v) => t.setRewardScale(v),
                    fromTrainer: (s) => (s.rewardScale || 0) / 0.2
                },
                elitism: {
                    display: (v) => 0.9 + (v - 1) * 0.01,
                    trainerValue: (v) => 0.9 + (v - 1) * 0.01,
                    format: (v) => v.toFixed(2),
                    apply: (t, v) => t.setGamma(v),
                    fromTrainer: (s) => 1 + ((s.gamma || 0.9) - 0.9) / 0.01
                }
            }
        }
    };

    window.DinoUIConfig = Object.freeze({
        MODE_CONFIG,
        SLIDER_VALUE_FIELDS: Object.freeze({
            population: 'populationSize',
            mutation: 'mutationRate',
            crossover: 'crossoverRate',
            elitism: 'elitismCount'
        }),
        SLIDER_INPUT_FIELDS: Object.freeze({
            population: 'populationSlider',
            mutation: 'mutationSlider',
            crossover: 'crossoverSlider',
            elitism: 'elitismSlider'
        })
    });
})();
