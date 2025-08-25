class ComponentRouter {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.activeComponents = new Set();
        this.isTransitioning = false;
        
        this.init();
    }

    init() {
        console.log("[router] Starting initialization...");
        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('load', () => this.handleRouteChange());
    }

    /**
     * 注册路由配置
     * @param {string|RegExp} pattern - 路由模式
     * @param {Object} config - 路由配置
     */
    register(pattern, config) {
        console.log(`[router] Registering new pattern "${pattern}"`);

        const routeConfig = {
            pattern,
            components: config.components || [],
            handler: config.handler || null,
            beforeEnter: config.beforeEnter || null,
            afterEnter: config.afterEnter || null,
            beforeLeave: config.beforeLeave || null,
            ...config
        };

        // 如果是字符串，转换为正则表达式以支持参数
        if (typeof pattern === 'string') {
            const paramNames = [];
            const regexPattern = pattern.replace(/:([^/]+)/g, (match, paramName) => {
                paramNames.push(paramName);
                return '([^/]+)';
            });
            
            routeConfig.regex = new RegExp(`^${regexPattern}$`);
            routeConfig.paramNames = paramNames;
        }

        this.routes.set(pattern, routeConfig);
        return this;
    }

    /**
     * 解析当前路由
     */
    parseCurrentHash() {
        var path = window.location.hash.slice(1) || '';

        if (!path.startsWith('/')) path = '/' + path;
        
        return path;
    }

    /**
     * 匹配路由配置
     */
    matchRoute(path) {
        for (const [pattern, config] of this.routes) {
            let match = null;
            let params = {};
            
            if (typeof pattern === 'string') {
                if (config.regex) {
                    match = path.match(config.regex);
                    if (match && config.paramNames) {
                        config.paramNames.forEach((paramName, index) => {
                            params[paramName] = match[index + 1];
                        });
                    }
                } else {
                    match = path === pattern;
                }
            } else if (pattern instanceof RegExp) {
                match = path.match(pattern);
            }
            
            if (match) {
                return { config, params, path };
            }
        }
        
        return null;
    }

    /**
     * 处理路由变化
     */
    async handleRouteChange() {
        if (this.isTransitioning) return;
        
        const path = this.parseCurrentHash();
        const match = this.matchRoute(path);
        
        if (!match) {
            console.warn('[router] No route match for:', path);
            return;
        }
        
        const { config, params } = match;
        
        // 检查是否需要组件切换
        const newComponents = new Set(config.components);
        
        console.log('[router] Route to', path, {
            components: config.components,
            params
        });
        
        await this.performTransition(config, params, path);
        
        this.currentRoute = { path, config, params };
    }

    /**
     * 执行组件切换和路由处理
     */
    async performTransition(config, params, path) {
        this.isTransitioning = true;
        
        try {
            // 1. 执行离开前钩子
            if (this.currentRoute?.config.beforeLeave) {
                await this.currentRoute.config.beforeLeave({
                    from: this.currentRoute,
                    to: { config, params, path }
                });
            }

            // 2. 并行执行：组件切换动画 + 内容更新
            async function Hooks() {
                if (config.beforeEnter) {
                    await config.beforeEnter({ params, path, router: this });
                }
                await config.handler({ params, path, router: this })
                if (config.afterEnter) {
                    await config.afterEnter({ params, path, router: this });
                }
            }
            
            const componentTransition = this.switchComponents(config.components);
            const handler = Hooks();

            await Promise.all([componentTransition, handler]);
            
        } catch (error) {
            console.error('[router] Transition error:', error);
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * 切换组件显示状态 - 统一动画管理
     */
    async switchComponents(targetComponents) {
        // 找出需要隐藏和显示的组件
        const toHide = Array.from(this.activeComponents).filter(c => !targetComponents.includes(c));
        const toShow = targetComponents.filter(c => !this.activeComponents.has(c));
        
        // 隐藏组件 - 统一淡出动画
        if (toHide.length > 0) {
            console.log('[router] Hiding components:', toHide);
            await this.hideComponents(toHide);
        }
        
        // 显示组件 - 统一淡入动画
        if (toShow.length > 0) {
            console.log('[router] Showing components:', toShow);
            await this.showComponents(toShow);
        }
        
        // 更新活跃组件集合
        this.activeComponents = new Set(targetComponents);
    }

    /**
     * 隐藏组件（淡出动画）
     */
    async hideComponents(componentIds) {
        const promises = componentIds.map(componentId => {
            return new Promise(resolve => {
                const element = document.getElementById(componentId);
                if (!element) {
                    resolve();
                    return;
                }

                // 添加淡出动画类
                element.classList.add('fade-out');
                
                // 等待动画完成后隐藏
                setTimeout(() => {
                    element.classList.remove('active', 'fade-out');
                    element.style.display = 'none';
                    resolve();
                }, 200); // 与CSS动画时间一致
            });
        });
        
        await Promise.all(promises);
    }

    /**
     * 显示组件（淡入动画）
     */
    async showComponents(componentIds) {
        const promises = componentIds.map(componentId => {
            return new Promise(resolve => {
                const element = document.getElementById(componentId);
                if (!element) {
                    resolve();
                    return;
                }

                // 先显示元素
                element.style.display = 'block';
                
                // 强制重绘确保display生效
                element.offsetHeight;
                
                // 添加激活类触发淡入动画
                element.classList.add('active');
                
                // 等待动画完成
                setTimeout(() => {
                    resolve();
                }, 200); // 与CSS动画时间一致
            });
        });
        
        await Promise.all(promises);
    }

    /**
     * 比较两个集合是否相等
     */
    setsEqual(set1, set2) {
        if (set1.size !== set2.size) return false;
        for (const item of set1) {
            if (!set2.has(item)) return false;
        }
        return true;
    }

    /**
     * 导航到指定路由
     */
    navigate(path, replace = false) {
        var fullPath = path.startsWith('#') ? path : '#' + path;

        if (replace) {
            window.location.replace(fullPath);
        } else {
            window.location.hash = fullPath;
        }
    }

    /**
     * 获取当前状态
     */
    getCurrentState() {
        return {
            route: this.currentRoute,
            activeComponents: Array.from(this.activeComponents),
            isTransitioning: this.isTransitioning
        };
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.ComponentRouter = ComponentRouter;
}
