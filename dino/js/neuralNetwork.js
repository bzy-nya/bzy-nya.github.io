class NeuralNetwork {
    constructor(inputNodes, hiddenNodes, outputNodes) {
        this.inputNodes = inputNodes;
        this.hiddenNodes = hiddenNodes;
        this.outputNodes = outputNodes;
        
        // 初始化权重矩阵
        this.weightsInputHidden = this.randomMatrix(this.hiddenNodes, this.inputNodes);
        this.weightsHiddenOutput = this.randomMatrix(this.outputNodes, this.hiddenNodes);
        
        // 偏置
        this.biasHidden = this.randomMatrix(this.hiddenNodes, 1);
        this.biasOutput = this.randomMatrix(this.outputNodes, 1);
    }
    
    // 创建随机矩阵
    randomMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                // 使用Xavier初始化，提供更好的权重分布
                const limit = Math.sqrt(6 / (rows + cols));
                matrix[i][j] = (Math.random() * 2 - 1) * limit;
            }
        }
        return matrix;
    }
    
    // 矩阵乘法
    matrixMultiply(a, b) {
        const result = [];
        for (let i = 0; i < a.length; i++) {
            result[i] = [];
            for (let j = 0; j < b[0].length; j++) {
                let sum = 0;
                for (let k = 0; k < b.length; k++) {
                    sum += a[i][k] * b[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }
    
    // 矩阵加法
    matrixAdd(a, b) {
        const result = [];
        for (let i = 0; i < a.length; i++) {
            result[i] = [];
            for (let j = 0; j < a[0].length; j++) {
                result[i][j] = a[i][j] + b[i][j];
            }
        }
        return result;
    }
    
    // Sigmoid激活函数
    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }
    
    // 应用激活函数到矩阵
    applyActivation(matrix) {
        const result = [];
        for (let i = 0; i < matrix.length; i++) {
            result[i] = [];
            for (let j = 0; j < matrix[0].length; j++) {
                result[i][j] = this.sigmoid(matrix[i][j]);
            }
        }
        return result;
    }
    
    // 前向传播
    predict(inputs) {
        // 转换输入为列向量
        const inputMatrix = [];
        for (let i = 0; i < inputs.length; i++) {
            inputMatrix[i] = [inputs[i]];
        }
        
        // 隐藏层计算
        let hidden = this.matrixMultiply(this.weightsInputHidden, inputMatrix);
        hidden = this.matrixAdd(hidden, this.biasHidden);
        hidden = this.applyActivation(hidden);
        
        // 输出层计算
        let output = this.matrixMultiply(this.weightsHiddenOutput, hidden);
        output = this.matrixAdd(output, this.biasOutput);
        output = this.applyActivation(output);
        
        return output[0][0]; // 返回单个输出值
    }
    
    // 复制神经网络
    copy() {
        const copy = new NeuralNetwork(this.inputNodes, this.hiddenNodes, this.outputNodes);
        copy.weightsInputHidden = this.copyMatrix(this.weightsInputHidden);
        copy.weightsHiddenOutput = this.copyMatrix(this.weightsHiddenOutput);
        copy.biasHidden = this.copyMatrix(this.biasHidden);
        copy.biasOutput = this.copyMatrix(this.biasOutput);
        return copy;
    }
    
    // 复制矩阵
    copyMatrix(matrix) {
        const copy = [];
        for (let i = 0; i < matrix.length; i++) {
            copy[i] = [];
            for (let j = 0; j < matrix[0].length; j++) {
                copy[i][j] = matrix[i][j];
            }
        }
        return copy;
    }
    
    // 变异
    mutate(mutationRate) {
        this.mutateMatrix(this.weightsInputHidden, mutationRate);
        this.mutateMatrix(this.weightsHiddenOutput, mutationRate);
        this.mutateMatrix(this.biasHidden, mutationRate);
        this.mutateMatrix(this.biasOutput, mutationRate);
    }
    
    // 变异矩阵
    mutateMatrix(matrix, mutationRate) {
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix[0].length; j++) {
                if (Math.random() < mutationRate) {
                    const mutationType = Math.random();
                    
                    if (mutationType < 0.7) {
                        // 70% 概率：小幅调整
                        matrix[i][j] += (Math.random() * 2 - 1) * 0.1;
                    } else if (mutationType < 0.9) {
                        // 20% 概率：中等调整
                        matrix[i][j] += (Math.random() * 2 - 1) * 0.3;
                    } else {
                        // 10% 概率：重新随机化
                        matrix[i][j] = (Math.random() * 2 - 1) * 0.5;
                    }
                    
                    // 限制权重范围
                    matrix[i][j] = Math.max(-2, Math.min(2, matrix[i][j]));
                }
            }
        }
    }
    
    // 交叉（单点交叉）
    crossover(partner) {
        const child = new NeuralNetwork(this.inputNodes, this.hiddenNodes, this.outputNodes);
        
        // 对每个权重矩阵进行交叉
        child.weightsInputHidden = this.crossoverMatrix(this.weightsInputHidden, partner.weightsInputHidden);
        child.weightsHiddenOutput = this.crossoverMatrix(this.weightsHiddenOutput, partner.weightsHiddenOutput);
        child.biasHidden = this.crossoverMatrix(this.biasHidden, partner.biasHidden);
        child.biasOutput = this.crossoverMatrix(this.biasOutput, partner.biasOutput);
        
        return child;
    }
    
    // 矩阵交叉
    crossoverMatrix(matrix1, matrix2) {
        const result = [];
        const crossoverPoint = Math.random();
        
        for (let i = 0; i < matrix1.length; i++) {
            result[i] = [];
            for (let j = 0; j < matrix1[0].length; j++) {
                // 随机选择父母之一的基因
                result[i][j] = Math.random() < crossoverPoint ? matrix1[i][j] : matrix2[i][j];
            }
        }
        return result;
    }
}
