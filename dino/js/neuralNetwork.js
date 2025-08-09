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
        
        // 输出层偏置特殊初始化 - 避免动作偏向
        this.biasOutput = this.createOutputBias(this.outputNodes);
    }
    
    // 创建随机矩阵
    randomMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                // 修正的Xavier初始化：考虑输入和输出节点数
                const limit = Math.sqrt(6 / (rows + cols));
                matrix[i][j] = (Math.random() * 2 - 1) * limit;
            }
        }
        return matrix;
    }
    
    // 创建输出层偏置 - 防止动作偏向
    createOutputBias(outputNodes) {
        const matrix = [];
        for (let i = 0; i < outputNodes; i++) {
            matrix[i] = [];
            if (outputNodes === 3) {
                // 对于三动作输出：jump, idle, crouch
                if (i === 1) {
                    // idle 动作稍微偏向（因为是默认安全动作）
                    matrix[i][0] = 0.1 + (Math.random() * 2 - 1) * 0.05;
                } else {
                    // jump 和 crouch 保持中性
                    matrix[i][0] = (Math.random() * 2 - 1) * 0.05;
                }
            } else {
                // 其他输出数量的情况，使用小随机值
                matrix[i][0] = (Math.random() * 2 - 1) * 0.05;
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
        
        // 如果只有一个输出，返回单个值（向后兼容）
        if (this.outputNodes === 1) {
            return output[0][0];
        }
        
        // 多个输出时，返回数组
        const result = [];
        for (let i = 0; i < this.outputNodes; i++) {
            result.push(output[i][0]);
        }
        return result;
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
                    
                    if (mutationType < 0.8) {
                        // 80% 概率：小幅调整（更保守）
                        matrix[i][j] += (Math.random() * 2 - 1) * 0.05;
                    } else if (mutationType < 0.95) {
                        // 15% 概率：中等调整
                        matrix[i][j] += (Math.random() * 2 - 1) * 0.15;
                    } else {
                        // 5% 概率：重新随机化
                        const limit = Math.sqrt(6 / (matrix.length + matrix[0].length));
                        matrix[i][j] = (Math.random() * 2 - 1) * limit;
                    }
                    
                    // 限制权重范围，防止梯度爆炸
                    matrix[i][j] = Math.max(-1.5, Math.min(1.5, matrix[i][j]));
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
        
        for (let i = 0; i < matrix1.length; i++) {
            result[i] = [];
            for (let j = 0; j < matrix1[0].length; j++) {
                // 每个权重位置独立随机选择父母之一
                result[i][j] = Math.random() < 0.5 ? matrix1[i][j] : matrix2[i][j];
            }
        }
        return result;
    }
    
    // 获取详细的激活值（用于可视化）
    getDetailedActivations(inputs) {
        // 输入层
        const inputMatrix = [];
        for (let i = 0; i < this.inputNodes; i++) {
            inputMatrix.push([inputs[i] || 0]);
        }
        
        // 隐藏层
        let hidden = this.matrixMultiply(this.weightsInputHidden, inputMatrix);
        hidden = this.matrixAdd(hidden, this.biasHidden);
        hidden = this.applyActivation(hidden);
        
        // 输出层
        let output = this.matrixMultiply(this.weightsHiddenOutput, hidden);
        output = this.matrixAdd(output, this.biasOutput);
        output = this.applyActivation(output);
        
        const result = {
            inputs: inputs,
            hidden: hidden.map(row => row[0]), // 转换为一维数组
            outputs: output.map(row => row[0])  // 转换为一维数组
        };
        
        return result;
    }
}
