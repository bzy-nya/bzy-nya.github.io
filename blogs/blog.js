/**
 * 博客系统核心功能
 */
class BlogSystem {
    constructor() {
        this.posts = [];
        this.postsById = new Map();
        this.currentPost = null;
        this.isLoading = false;
        this.tocObserver = null;
        this.tocPositionHandler = null;
        
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
        this.cleanupArticleUI({ clearMarkup: true });

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
        try {
            const response = await fetch('blogs/posts.json');
            const data = await response.json();
            this.posts = data.posts || [];
            this.postsById = new Map(this.posts.map((post) => [post.id, post]));
            this.tags = data.tags || {};
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
        const blogContainer = document.querySelector('#blog .blog-list');
        if (!blogContainer) return;

        if (this.posts.length === 0) {
            blogContainer.innerHTML = `
                <div class="blog-list-card blog-post-item">
                    <div class="blog-list-title">No posts yet :(</div>
                    <div class="blog-list-desc">
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
                <div class="blog-list-card blog-post-item ${post.pinned ? 'pinned-post' : ''}" data-post-id="${post.id}">
                    <div class="blog-list-title">${post.title} ${pinnedBadge} ${featuredBadge}</div>
                    <div class="blog-list-desc">${post.description}</div>
                    <div class="blog-list-meta">
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
        const post = this.postsById.get(postId);
        if (!post) {
            console.error('Post not found:', postId);
            this.redirectToNotFound();
            return false;
        }

        this.isLoading = true;
        this.showLoading();

        try {
            const response = await fetch(`blogs/posts/${post.file}`);
            if (response.status === 404) {
                this.redirectToNotFound();
                return false;
            }

            if (!response.ok) {
                throw new Error(`Failed to load post: ${response.status}`);
            }

            let markdown = await response.text();

            markdown = this.preprocessExtensions(markdown);

            const html = marked ? marked.parse(markdown) : markdown;
            const result = this.generateTableOfContents(html);

            this.renderPostView(post, result.html);
            this.currentPost = post;

            setTimeout(() => {
                this.highlightCode();
            }, 10);

            this.renderArticleTOC(result.toc);
            return true;

        } catch (error) {
            console.error('Failed to load post:', error);
            this.showError('Failed to load the blog post. Please try again.');
            return false;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 渲染文章视图
     */
    renderPostView(post, content) {
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

        this.cleanupArticleUI();

        const contentElement = document.getElementById('blog-post-content');
        if (contentElement) {
            contentElement.innerHTML = content;
        }

        // 添加返回按钮事件
        const backButton = document.getElementById('back-to-blog-list');
        if (backButton) {
            backButton.addEventListener('click', () => {
                Router.navigate('blog');
            });
        }
    }

    /**
     * 显示博客列表
     */
    showBlogList() {
        const blogContainer = document.querySelector('#blog');
        if (!blogContainer) return;

        blogContainer.innerHTML = `
            <section class="section">
                <h2 class="section-title">
                    <svg class="icon small deco" aria-hidden="true"><use href="#px-sparkle"/></svg> 
                    Blog Posts 
                    <svg class="icon small deco" aria-hidden="true"><use href="#px-sparkle"/></svg>
                </h2>
                <div class="pixel-divider"></div>
                <div class="blog-list"></div>
            </section>
        `;

        this.renderBlogList();
        this.currentPost = null;
    }

    /**
     * 显示加载状态
     */
    showLoading() {
        this.cleanupArticleUI({ clearMarkup: true });

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
        this.cleanupArticleUI({ clearMarkup: true });

        const blogContainer = document.querySelector('#blog');
        if (!blogContainer) return;

        blogContainer.innerHTML = `
            <section class="section">
                <div class="error-container" style="text-align: center; padding: 40px;">
                    <p style="color: var(--accent); font-family: 'Press Start 2P', monospace; font-size: 12px; margin-bottom: 16px;">Error!</p>
                    <p>${message}</p>
                    <button class="nav-btn" id="back-to-blog-home" style="margin-top: 20px;">Back to Blog List</button>
                </div>
            </section>
        `;

        const backButton = document.getElementById('back-to-blog-home');
        if (backButton) {
            backButton.addEventListener('click', () => {
                Router.navigate('blog');
            });
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
            const post = this.postsById.get(postId);
            
            if (tag === 'all' || (post && post.tags && post.tags.includes(tag))) {
                item.classList.remove('is-filtered-out');
            } else {
                item.classList.add('is-filtered-out');
            }
        });
    }

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
                id
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
            this.cleanupArticleUI({ clearMarkup: true });
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

        const { list } = this.buildTOCList(toc, 0, toc[0].level, true);
        return list.outerHTML;
    }

    buildTOCList(items, startIndex, level, isRoot = false) {
        const list = document.createElement('ul');
        list.className = isRoot ? 'toc-list' : 'toc-nested';

        let index = startIndex;
        let lastItem = null;

        while (index < items.length) {
            const item = items[index];

            if (item.level < level) {
                break;
            }

            if (item.level > level) {
                if (!lastItem) {
                    index += 1;
                    continue;
                }

                const nested = this.buildTOCList(items, index, item.level);
                lastItem.appendChild(nested.list);
                index = nested.nextIndex;
                continue;
            }

            const listItem = document.createElement('li');
            listItem.className = `toc-item toc-level-${item.level}`;

            const link = document.createElement('a');
            link.href = `#${item.id}`;
            link.className = 'toc-link';
            link.dataset.target = item.id;
            link.textContent = item.text;

            listItem.appendChild(link);
            list.appendChild(listItem);

            lastItem = listItem;
            index += 1;
        }

        return { list, nextIndex: index };
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

        this.cleanupTOCObservers();
        
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

        this.cleanupTOCPositionHandler();

        this.tocPositionHandler = () => {
            const header = document.querySelector('.topbar');
            const tocContent = tocCard.querySelector('.toc-content');
            if (!header || window.innerWidth <= 980) {
                tocCard.style.top = '';
                tocCard.style.maxHeight = '';
                if (tocContent) {
                    tocContent.style.maxHeight = '';
                }
                return;
            }

            if (header.classList.contains('is-collapsed')) {
                tocCard.style.top = '10px';
                tocCard.style.maxHeight = 'calc(100vh - 40px)';
                if (tocContent) {
                    tocContent.style.maxHeight = 'calc(100vh - 100px)';
                }
                return;
            }

            if (header.classList.contains('is-compact')) {
                tocCard.style.top = '52px';
                tocCard.style.maxHeight = 'calc(100vh - 116px)';
                if (tocContent) {
                    tocContent.style.maxHeight = 'calc(100vh - 176px)';
                }
                return;
            }

            tocCard.style.top = '80px';
            tocCard.style.maxHeight = 'calc(100vh - 160px)';
            if (tocContent) {
                tocContent.style.maxHeight = 'calc(100vh - 240px)';
            }
        };

        // 添加滚动和尺寸变化监听器
        window.addEventListener('scroll', this.tocPositionHandler);
        window.addEventListener('resize', this.tocPositionHandler);
        
        // 触发一次初始计算
        this.tocPositionHandler();
    }

    cleanupArticleUI({ clearMarkup = false } = {}) {
        this.cleanupTOCObservers();
        this.cleanupTOCPositionHandler();

        if (!clearMarkup) {
            return;
        }

        const tocCard = document.getElementById('article-toc-card');
        if (tocCard) {
            tocCard.innerHTML = '';
            tocCard.style.top = '';
            tocCard.style.maxHeight = '';
        }
    }

    cleanupTOCObservers() {
        if (this.tocObserver) {
            this.tocObserver.disconnect();
            this.tocObserver = null;
        }
    }

    cleanupTOCPositionHandler() {
        if (this.tocPositionHandler) {
            window.removeEventListener('scroll', this.tocPositionHandler);
            window.removeEventListener('resize', this.tocPositionHandler);
            this.tocPositionHandler = null;
        }
    }

    redirectToNotFound() {
        window.location.replace('/404.html');
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
        await this.loadPosts();
    }
}

// 全局博客系统实例
let blogSystem = null;
let blogSystemInitPromise = null;

// 初始化函数
async function tryInitBlogSystem() {
    if (blogSystem) return blogSystem;
    
    if (!blogSystemInitPromise) {
        blogSystemInitPromise = (async () => {
            try {
                blogSystem = new BlogSystem();
                await blogSystem.init();
            } catch (error) {
                console.error('[Blog] Failed to initialize blog system:', error);
                blogSystem = null;
            }

            window.blogSystem = blogSystem;
            return blogSystem;
        })().finally(() => {
            blogSystemInitPromise = null;
        });
    }

    return blogSystemInitPromise;
}
