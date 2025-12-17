/**
 * 博客系统核心功能
 */
class BlogSystem {
    constructor() {
        this.posts = [];
        this.currentPost = null;
        this.isLoading = false;
        
        // 初始化 marked.js 配置
        this.initMarked();
    }
    /**
     * 初始化 Marked.js 配置
     */
    initMarked() {
        if (typeof marked !== 'undefined') {
            // 配置renderer来处理表格对齐
            const renderer = new marked.Renderer();

            // 重写image renderer来处理图片标题和居中
            const originalImage = renderer.image;
            renderer.image = function(href, title, text) {
                const img = originalImage.call(this, href, title, text);
                
                // 如果有标题，包装在figure元素中并添加figcaption
                if (title) {
                    return `<figure class="blog-image">
                        ${img}
                        <figcaption class="blog-image-caption">${title}</figcaption>
                    </figure>`;
                } else {
                    // 即使没有标题也要居中
                    return `<figure class="blog-image">${img}</figure>`;
                }
            };

            renderer.listitem = (text, task, checked) => {
                if (task) {
                    return `<li class="task-list-item">${text}</li>`;
                }
                return `<li>${text}</li>`;
            }

            renderer.checkbox = (checked) => {
                return `<input class="task-list-item-checkbox" type="checkbox" ${checked ? 'checked' : ''} disabled>`;
            };

            /*
            renderer.code = (code, infoString) => {
                const lang = (infoString || '').trim();
                const grammar = Prism.languages[lang] || Prism.languages.markup;
                const html =    (code, grammar, lang);
                const cls = lang ? `class="language-${lang}"` : '';
                return `<pre><code ${cls}>${html}</code></pre>`;
            };
            */

            if (typeof katex !== 'undefined') {
                const mathBlock = {
                    name: 'mathBlock',
                    level: 'block',
                    start(src) { return src.indexOf('$$'); },
                    tokenizer(src) {
                        const m = /^\$\$([\s\S]+?)\$\$(?:\n+|$)/.exec(src);
                        if (m) return { type: 'mathBlock', raw: m[0], text: m[1].trim() };
                    },
                    renderer(tok) {
                        return katex.renderToString(tok.text, {
                        displayMode: true,
                        throwOnError: false,
                        output: 'html' // 避免 MathML 在后续被清洗
                        });
                    }
                };

                const mathInline = {
                    name: 'mathInline',
                    level: 'inline',
                    start(src) { return src.indexOf('$'); },
                    tokenizer(src) {
                        // 简单版：不支持嵌套 $，但够用且稳定
                        const m = /^\$([^$\n]+?)\$(?!\d)/.exec(src);
                        if (m) return { type: 'mathInline', raw: m[0], text: m[1] };
                    },
                    renderer(tok) {
                        return katex.renderToString(tok.text, {
                        displayMode: false,
                        throwOnError: false,
                        output: 'html'
                        });
                    }
                };

                marked.use({ extensions: [mathBlock, mathInline] });
            }

            marked.setOptions({
                renderer: renderer,
                breaks: false, // 改为false，避免不必要的换行影响数学公式
                gfm: true,
                // 启用更多扩展
                headerIds: true,
                mangle: false,
                tables: true
            });
        }
    }

    /**
     * 显示博客首页 - 供组件路由器调用
     */
    async showHome() {        
        // 如果数据没有加载，先加载
        if (!this.posts || this.posts.length === 0) {
            await this.loadPosts();
        }
        
        // 显示博客列表
        this.showBlogList();
    }

    /**
     * 加载博客文章列表
     */
    async loadPosts() {
        console.log("[Blog] Loading posts...");

        try {
            const response = await fetch('blogs/posts.json');
            const data = await response.json();
            this.posts = data.posts || [];
            this.tags = data.tags || {};

            console.log(`[Blog] Loaded ${this.posts.length} posts`);
            return this.posts;  
        } catch (error) {
            console.error('Failed to load blog posts:', error);
            return [];
        }
    }

    /**
     * 渲染博客列表
     */
    renderBlogList() {
        const blogContainer = document.querySelector('#blog .list');
        if (!blogContainer) return;

        if (this.posts.length === 0) {
            blogContainer.innerHTML = `
                <div class="item">
                    <div class="item-title">No posts yet :(</div>
                    <div class="item-desc">
                        Blog posts are coming soon! Stay tuned for exciting content about algorithms, research, and more.
                    </div>
                </div>
            `;
            return;
        }

        // 排序文章：置顶的在前，然后按日期排序
        const sortedPosts = [...this.posts].sort((a, b) => {
            // 首先按置顶排序
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            // 然后按日期排序
            return new Date(b.date) - new Date(a.date);
        });

        blogContainer.innerHTML = sortedPosts.map(post => {
            const tags = post.tags ? post.tags.map(tag => 
                `<span class="pixel-badge" style="background: ${this.tags[tag]?.color || 'var(--secondary)'}">${this.tags[tag]?.name || tag}</span>`
            ).join('') : '';

            // 处理 featured 标签 - 可以是字符串或布尔值
            let featuredBadge = '';
            if (post.featured) {
                const featuredText = typeof post.featured === 'string' ? post.featured : 'Featured';
                featuredBadge = `<span class="pixel-badge featured-badge">${featuredText}</span>`;
            }

            // 处理置顶标签
            const pinnedBadge = post.pinned ? '<span class="pixel-badge pinned-badge">📌 Pinned</span>' : '';

            return `
                <div class="item blog-post-item ${post.pinned ? 'pinned-post' : ''}" data-post-id="${post.id}">
                    <div class="item-title">${post.title} ${pinnedBadge} ${featuredBadge}</div>
                    <div class="item-desc">${post.description}</div>
                    <div class="item-meta">
                        ${this.formatDate(post.date)} 
                        ${tags}
                        <a href="#/post/${post.id}" data-post-id="${post.id}">Read more</a>
                    </div>
                </div>
            `;
        }).join('');
        
        // 渲染博客目录导航
        this.renderBlogNavigation();
    }

    /**
     * 显示单篇博客文章
     */
    async showPost(postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            console.error('Post not found:', postId);
            console.error('Available post IDs:', this.posts.map(p => p.id));
            return;
        }

        this.isLoading = true;
        this.showLoading();

        try {
            // 加载 markdown 文件
            const response = await fetch(`blogs/posts/${post.file}`);
            let markdown = await response.text();

            markdown = this.preprocessExtensions(markdown);

            const Html = marked ? marked.parse(markdown) : markdown;
            
            // 生成目录
            const result = this.generateTableOfContents(Html);

            // 显示文章
            this.renderPostView(post, result.html, result.toc);
            this.currentPost = post;

            // 确保DOM已经更新，然后进行渲染
            setTimeout(() => {
                // 重新高亮代码
                this.highlightCode();
            }, 10);

            // 渲染文章目录导航
            this.renderArticleTOC(result.toc);

        } catch (error) {
            console.error('Failed to load post:', error);
            this.showError('Failed to load the blog post. Please try again.');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 渲染文章视图
     */
    renderPostView(post, content, toc) {
        const blogContainer = document.querySelector('#blog');
        if (!blogContainer) {
            console.error('[Blog] Blog container not found!');
            return;
        }
        
        const tags = post.tags ? post.tags.map(tag => 
            `<span class="pixel-badge" style="background: ${this.tags[tag]?.color || 'var(--secondary)'}">${this.tags[tag]?.name || tag}</span>`
        ).join('') : '';

        // 先创建框架结构
        blogContainer.innerHTML = `
            <section class="section">
                <div class="blog-nav">
                    <button class="nav-btn back-to-list" id="back-to-blog-list">
                        <svg class="icon small" aria-hidden="true" style="margin-right: 8px;"><use href="#px-triangle"/></svg>
                        Back to Blog
                    </button>
                </div>
                <div class="blog-post-header">
                    <h1 class="blog-post-title">${post.title}</h1>
                    <div class="blog-post-meta">
                        <span class="blog-date">${this.formatDate(post.date)}</span>
                        ${tags}
                    </div>
                </div>
                <div class="pixel-divider"></div>
                <article class="blog-post-content" id="blog-post-content">
                </article>
            </section>
        `;

        // 单独插入内容，避免innerHTML解析问题
        const contentElement = document.getElementById('blog-post-content');
        if (contentElement) {
            
            // 尝试创建一个临时元素来验证HTML
            try {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = content;
                
                contentElement.innerHTML = content;                
            } catch (error) {
                console.error('Error inserting content:', error);
                // 作为备用，尝试使用textContent
                contentElement.textContent = content;
            }
        }

        // 添加返回按钮事件
        const backButton = document.getElementById('back-to-blog-list');
        if (backButton) {
            backButton.addEventListener('click', () => {
                Router.navigate('#blog')
            });
        }
    }

    /**
     * 显示博客列表
     */
    showBlogList() {
        const blogContainer = document.querySelector('#blog');
        if (!blogContainer) return;

        // 不再推送历史记录，因为组件路由器会管理 URL 状态

        blogContainer.innerHTML = `
            <section class="section">
                <h2 class="section-title">
                    <svg class="icon small deco" aria-hidden="true"><use href="#px-sparkle"/></svg> 
                    Blog Posts 
                    <svg class="icon small deco" aria-hidden="true"><use href="#px-sparkle"/></svg>
                </h2>
                <div class="pixel-divider"></div>
                <div class="list"></div>
            </section>
        `;

        this.renderBlogList();
        this.currentPost = null;
        
        // 重新显示博客导航
        this.renderBlogNavigation();
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        const blogContainer = document.querySelector('#blog');
        if (!blogContainer) return;

        blogContainer.innerHTML = `
            <section class="section">
                <div class="loading-container" style="text-align: center; padding: 40px;">
                    <svg class="icon large" aria-hidden="true" style="animation: gentleFloat 2s ease-in-out infinite;"><use href="#px-cat"/></svg>
                    <p style="margin-top: 16px; font-family: 'Press Start 2P', monospace; font-size: 12px;">Loading post...</p>
                </div>
            </section>
        `;
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const blogContainer = document.querySelector('#blog');
        if (!blogContainer) return;

        blogContainer.innerHTML = `
            <section class="section">
                <div class="error-container" style="text-align: center; padding: 40px;">
                    <p style="color: var(--accent); font-family: 'Press Start 2P', monospace; font-size: 12px; margin-bottom: 16px;">Error!</p>
                    <p>${message}</p>
                    <button class="nav-btn" onclick="window.router.navigate('/')" style="margin-top: 20px;">Back to Blog List</button>
                </div>
            </section>
        `;
    }

    /**
     * 重新渲染数学公式
     */
    renderMath() {
        if (typeof renderMathInElement !== 'undefined') {
            const blogContent = document.querySelector('.blog-post-content');
            if (blogContent) {
                renderMathInElement(blogContent, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false,
                    errorColor: '#cc0000',
                    strict: false,
                    ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
                    ignoredClasses: ['no-katex'],
                    fleqn: false,
                    macros: {
                        "\\Pr": "\\operatorname{Pr}"
                    }
                });
            }
        }
    }

    /**
     * 重新高亮代码
     */
    highlightCode() {
        if (typeof Prism !== 'undefined') {
            const blogContent = document.querySelector('.blog-post-content');
            if (blogContent) {
                // 手动高亮所有代码块
                Prism.highlightAllUnder(blogContent);
            }
        }
    }

    /**
     * 预处理扩展的Markdown语法
     */
    preprocessExtensions(markdown) {
        // 处理脚注
        markdown = this.processFootnotes(markdown);
        
        return markdown;
    }

    /**
     * 处理脚注语法
     */
    processFootnotes(markdown) {
        // 收集所有脚注定义
        const footnotes = {};
        const footnotePattern = /^\[(\^[^\]]+)\]:\s*(.+)$/gm;
        let match;
        
        // 提取脚注定义
        while ((match = footnotePattern.exec(markdown)) !== null) {
            footnotes[match[1]] = match[2];
        }
        
        // 移除原始的脚注定义
        markdown = markdown.replace(footnotePattern, '');
        
        // 替换脚注引用
        markdown = markdown.replace(/\[(\^[^\]]+)\]/g, (match, id) => {
            if (footnotes[id]) {
                return `<sup><a href="#footnote-${id.substring(1)}" id="ref-${id.substring(1)}">${id.substring(1)}</a></sup>`;
            }
            return match;
        });
        
        // 在文档末尾添加脚注列表
        if (Object.keys(footnotes).length > 0) {
            markdown += "\n---\n";
            for (const [id, content] of Object.entries(footnotes)) {
                const numId = id.substring(1);
                markdown += `<div id="footnote-${numId}"><sup>${numId}</sup> ${content} <a href="#ref-${numId}">↩</a></div>\n\n`;
            }
        }
        
        return markdown;
    }

    /**
     * 渲染博客导航栏
     */
    renderBlogNavigation() {
        // 直接渲染，由路由器控制组件可见性
        this._doRenderBlogNavigation();
    }

    /**
     * 实际渲染博客导航栏
     */
    _doRenderBlogNavigation() {
        // 查找博客导航组件容器
        const navComponent = document.getElementById('blog-navigation');
        if (!navComponent) {
            console.warn('[Blog] Blog navigation component not found');
            return;
        }

        // 获取所有标签和统计信息
        const allTags = new Set();
        const tagCounts = {};
        this.posts.forEach(post => {
            if (post.tags) {
                post.tags.forEach(tag => {
                    allTags.add(tag);
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        // 统计信息
        const totalPosts = this.posts.length;
        const pinnedPosts = this.posts.filter(post => post.pinned).length;
        const featuredPosts = this.posts.filter(post => post.featured).length;

        // 直接在组件容器内渲染内容
        navComponent.innerHTML = `
            <section class="card blog-navigation-card">
                <div class="blog-nav-title">
                    <svg class="icon small" aria-hidden="true"><use href="#px-sparkle"/></svg>
                    Blog Navigation
                </div>
                
                <div class="blog-stats">
                    <div class="stat-item">
                        <span class="stat-number">${totalPosts}</span>
                        <span class="stat-label">Total Posts</span>
                    </div>
                    ${pinnedPosts > 0 ? `
                    <div class="stat-item">
                        <span class="stat-number">${pinnedPosts}</span>
                        <span class="stat-label">Pinned</span>
                    </div>
                    ` : ''}
                    ${featuredPosts > 0 ? `
                    <div class="stat-item">
                        <span class="stat-number">${featuredPosts}</span>
                        <span class="stat-label">Featured</span>
                    </div>
                    ` : ''}
                </div>

                <div class="blog-filter-section">
                    <div class="filter-title">Filter by Tags</div>
                    <div class="tag-filters">
                        <button class="tag-filter active" data-tag="all">
                            All (${totalPosts})
                        </button>
                        ${Array.from(allTags).map(tag => {
                            const tagInfo = this.tags[tag] || { name: tag, color: 'var(--secondary)' };
                            return `
                                <button class="tag-filter" data-tag="${tag}" style="--tag-color: ${tagInfo.color}">
                                    ${tagInfo.name} (${tagCounts[tag]})
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
            </section>
        `;

        // 添加过滤事件监听器
        this.addNavigationEventListeners();
    }

    /**
     * 添加导航事件监听器
     */
    addNavigationEventListeners() {
        // 标签过滤器
        const tagFilters = document.querySelectorAll('.tag-filter');
        tagFilters.forEach(filter => {
            filter.addEventListener('click', (e) => {
                const tag = e.target.getAttribute('data-tag');
                this.filterPostsByTag(tag);
                
                // 更新激活状态
                tagFilters.forEach(f => f.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    /**
     * 按标签过滤文章
     */
    filterPostsByTag(tag) {
        const postItems = document.querySelectorAll('.blog-post-item');
        
        postItems.forEach(item => {
            const postId = item.getAttribute('data-post-id');
            const post = this.posts.find(p => p.id === postId);
            
            if (tag === 'all' || (post && post.tags && post.tags.includes(tag))) {
                item.style.display = 'block';
                item.style.opacity = '1';
            } else {
                item.style.display = 'none';
                item.style.opacity = '0';
            }
        });
    }

    /**
     * 移除博客导航栏
     */

    /**
     * 生成文章目录
     */
    generateTableOfContents(html) {
        // 创建临时DOM来解析HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const headings = tempDiv.querySelectorAll('h2, h3, h4, h5, h6');
        const toc = [];
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1));
            const text = heading.textContent.trim();
            const id = `toc-${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            
            // 为标题添加ID，用于锚点跳转
            heading.id = id;
            
            toc.push({
                level,
                text,
                id,
                element: heading
            });
        });
                
        // 返回更新后的HTML和目录数据
        return {
            html: tempDiv.innerHTML,
            toc: toc
        };
    }

    /**
     * 渲染文章目录导航
     */
    renderArticleTOC(toc) {
        if (!toc || toc.length === 0) {
            console.log('[Blog] No TOC to render');
            return;
        }
        
        // 查找文章TOC组件容器
        const tocComponent = document.getElementById('article-toc-card');
        if (!tocComponent) {
            console.warn('[Blog] Article TOC component not found');
            return;
        }

        // 生成目录HTML
        const tocHTML = this.buildTOCHTML(toc);
        
        // 直接在组件容器内渲染内容
        tocComponent.innerHTML = `
            <section class="card article-toc-card">
                <div class="toc-title">
                    <svg class="icon small" aria-hidden="true"><use href="#px-sparkle"/></svg>
                    Contents
                </div>
                <div class="toc-content">
                    ${tocHTML}
                </div>
            </section>
        `;

        // 添加目录点击事件
        this.addTOCEventListeners();
        
        // 添加滚动监听来高亮当前章节
        this.initTOCScrollSpy(toc);
        
        // 初始化目录位置调整
        this.initTOCPositionAdjustment();
    }

    /**
     * 构建目录HTML
     */
    buildTOCHTML(toc) {
        if (toc.length === 0) return '<p class="no-toc">No headings found</p>';
        
        let html = '<ul class="toc-list">';
        let currentLevel = 2; // 从h2开始
        
        toc.forEach((item, index) => {
            const { level, text, id } = item;
            
            // 处理层级变化
            if (level > currentLevel) {
                // 开启新的嵌套列表
                for (let i = currentLevel; i < level; i++) {
                    html += '<ul class="toc-nested">';
                }
            } else if (level < currentLevel) {
                // 关闭嵌套列表
                for (let i = level; i < currentLevel; i++) {
                    html += '</ul>';
                }
            }
            
            html += `<li class="toc-item toc-level-${level}">
                        <a href="#${id}" class="toc-link" data-target="${id}">
                            ${text}
                        </a>
                     </li>`;
            
            currentLevel = level;
        });
        
        // 关闭所有未关闭的列表
        for (let i = 2; i < currentLevel; i++) {
            html += '</ul>';
        }
        html += '</ul>';
        
        return html;
    }

    /**
     * 添加目录事件监听器
     */
    addTOCEventListeners() {
        const tocLinks = document.querySelectorAll('.toc-link');
        
        tocLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('data-target');
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    // 平滑滚动到目标位置
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    // 更新激活状态
                    tocLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        });
    }

    /**
     * 初始化目录滚动监听
     */
    initTOCScrollSpy(toc) {
        if (toc.length === 0) return;
        
        const tocLinks = document.querySelectorAll('.toc-link');
        const headings = toc.map(item => document.getElementById(item.id)).filter(Boolean);
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const tocLink = document.querySelector(`[data-target="${entry.target.id}"]`);
                if (entry.isIntersecting) {
                    // 移除所有激活状态
                    tocLinks.forEach(link => link.classList.remove('active'));
                    // 激活当前项
                    if (tocLink) {
                        tocLink.classList.add('active');
                    }
                }
            });
        }, {
            rootMargin: '-20% 0px -70% 0px',
            threshold: 0
        });
        
        // 观察所有标题
        headings.forEach(heading => {
            if (heading) observer.observe(heading);
        });
        
        // 存储observer以便后续清理
        this.tocObserver = observer;
    }

    /**
     * 初始化目录位置调整
     */
    initTOCPositionAdjustment() {
        // 直接使用组件容器，因为它本身就是TOC卡片
        const tocCard = document.getElementById('article-toc-card');
        if (!tocCard) return;

        this.tocPositionHandler = () => {
            const header = document.querySelector('.topbar');
            if (!header) return;

            const headerRect = header.getBoundingClientRect();
            const headerHeight = headerRect.height;
            const headerBottom = headerRect.bottom;

            // 如果header完全移出视野，将目录顶到最上面
            if (headerBottom <= 0) {
                tocCard.style.top = '10px';
                tocCard.style.maxHeight = 'calc(100vh - 40px)';
                // 同时更新toc-content的高度
                const tocContent = tocCard.querySelector('.toc-content');
                if (tocContent) {
                    tocContent.style.maxHeight = 'calc(100vh - 100px)';
                }
            } else {
                // 否则保持在header下方
                tocCard.style.top = '80px';
                tocCard.style.maxHeight = 'calc(100vh - 160px)';
                // 同时更新toc-content的高度
                const tocContent = tocCard.querySelector('.toc-content');
                if (tocContent) {
                    tocContent.style.maxHeight = 'calc(100vh - 240px)';
                }
            }
        };

        // 添加滚动事件监听器
        window.addEventListener('scroll', this.tocPositionHandler);
        
        // 触发一次初始计算
        this.tocPositionHandler();
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    /**
     * 初始化博客系统
     */
    async init() {
        console.log('[Blog] Initializing blog system...');
        await this.loadPosts();
        
        console.log('[Blog] Blog system ready');
    }
}

// 全局博客系统实例
let blogSystem = null;
let blogSystemInitializing = false;

// 初始化函数
async function tryInitBlogSystem() {
    if (blogSystem) return blogSystem;
    
    if (blogSystemInitializing) return;

    blogSystemInitializing = true;
    
    try {
        blogSystem = new BlogSystem();
        await blogSystem.init();
    } catch (error) {
        console.error('[Blog] Failed to initialize blog system:', error);
        blogSystem = null;
    } 

    window.blogSystem = blogSystem;
    blogSystemInitializing = false;
}
