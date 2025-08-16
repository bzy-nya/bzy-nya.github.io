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
        
        // 初始化导航功能
        this.initNavigation();
    }

    /**
     * 初始化 Marked.js 配置
     */
    initMarked() {
        if (typeof marked !== 'undefined') {
            // 配置renderer来处理表格对齐
            const renderer = new marked.Renderer();
            
            // 重写table cell renderer来处理对齐
            const originalTablecell = renderer.tablecell;
            renderer.tablecell = function(content, flags) {
                let align = '';
                if (flags.align) {
                    align = ` align="${flags.align}"`;
                }
                const type = flags.header ? 'th' : 'td';
                return `<${type}${align}>${content}</${type}>\n`;
            };

            // 重写paragraph renderer来保护数学公式
            const originalParagraph = renderer.paragraph;
            renderer.paragraph = function(text) {
                // 如果段落只包含数学公式，直接返回不包装p标签
                if (/^\s*\$\$[\s\S]*\$\$\s*$/.test(text)) {
                    return text + '\n';
                }
                return originalParagraph.call(this, text);
            };

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

            marked.setOptions({
                renderer: renderer,
                highlight: function(code, lang) {
                    // 如果有 Prism.js，使用它来高亮代码
                    if (typeof Prism !== 'undefined' && lang && Prism.languages[lang]) {
                        return Prism.highlight(code, Prism.languages[lang], lang);
                    }
                    return code;
                },
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
     * 初始化导航功能
     */
    initNavigation() {
        // 监听浏览器的返回事件
        window.addEventListener('popstate', (event) => {
            // 检查当前状态
            if (event.state) {
                if (event.state.view === 'blog-list') {
                    this.showBlogList();
                } else if (event.state.view === 'blog-post' && event.state.postId) {
                    this.showPost(event.state.postId, false); // false表示不推送新的历史记录
                }
            } else {
                // 如果没有状态，默认显示博客列表
                this.showBlogList();
            }
        });

        // 初始化历史记录状态
        if (!history.state) {
            history.replaceState({ view: 'blog-list' }, '', '');
        }
    }

    /**
     * 加载博客文章列表
     */
    async loadPosts() {
        try {
            const response = await fetch('blogs/posts.json');
            const data = await response.json();
            this.posts = data.posts || [];
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
                        <a href="#" data-post-id="${post.id}">Read more</a>
                    </div>
                </div>
            `;
        }).join('');

        // 添加点击事件
        this.addBlogListEventListeners();
        
        // 渲染博客目录导航
        this.renderBlogNavigation();
    }

    /**
     * 添加博客列表事件监听器
     */
    addBlogListEventListeners() {
        const readMoreLinks = document.querySelectorAll('.read-more');
        readMoreLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const postId = link.getAttribute('data-post-id');
                this.showPost(postId);
            });
        });

        const postItems = document.querySelectorAll('.blog-post-item');
        postItems.forEach(item => {
            item.addEventListener('click', (e) => {
                // 如果点击的是链接，不触发整个item的点击
                if (e.target.tagName === 'A') return;
                
                const postId = item.getAttribute('data-post-id');
                this.showPost(postId);
            });
        });
    }

    /**
     * 显示单篇博客文章
     */
    async showPost(postId, pushHistory = true) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            console.error('Post not found:', postId);
            return;
        }

        this.isLoading = true;
        this.showLoading();

        try {
            // 推送历史记录（除非明确指定不推送）
            if (pushHistory) {
                history.pushState(
                    { view: 'blog-post', postId: postId }, 
                    post.title, 
                    `#blog-post-${postId}`
                );
            }

            // 隐藏博客导航
            this.removeBlogNavigation();

            // 加载 markdown 文件
            const response = await fetch(`blogs/posts/${post.file}`);
            let markdown = await response.text();

            // 先提取并渲染数学公式，替换为占位符
            const mathResult = this.preprocessAndRenderMath(markdown);
            markdown = mathResult.markdown;
            
            // 预处理扩展语法
            markdown = this.preprocessExtensions(markdown);

            // 转换为 HTML
            const html = marked ? marked.parse(markdown) : markdown;
            
            // 恢复渲染的数学公式
            const finalHtml = this.restoreMathInHTML(html, mathResult);
            
            // 生成目录
            const result = this.generateTableOfContents(finalHtml);

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

            // 移除滚动跟随效果，避免奇怪的距离问题
            // this.initContentScrollFollow();

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
                
                // 检查是否有 \tilde{x} 相关的内容
                const domHTML = contentElement.innerHTML;
                const tildeIndex = domHTML.indexOf('tilde');
                
                // 检查可见元素数量
                setTimeout(() => {
                    const visibleElements = contentElement.querySelectorAll('*');
                    
                    // 检查是否有元素被CSS隐藏或有错误
                    const hiddenElements = Array.from(visibleElements).filter(el => {
                        const style = window.getComputedStyle(el);
                        return style.display === 'none' || style.visibility === 'hidden';
                    });
                    
                    // 查找最后一个可见的文本节点
                    const walker = document.createTreeWalker(
                        contentElement,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    let lastTextNode;
                    let node;
                    while (node = walker.nextNode()) {
                        if (node.textContent.trim()) {
                            lastTextNode = node;
                        }
                    }
                }, 100);
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
                this.showBlogList();
            });
        }
    }

    /**
     * 显示博客列表
     */
    showBlogList() {
        const blogContainer = document.querySelector('#blog');
        if (!blogContainer) return;

        // 推送历史记录到博客列表状态
        if (history.state?.view !== 'blog-list') {
            history.pushState({ view: 'blog-list' }, 'Blog List', '#blog');
        }

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
        
        // 清理文章目录
        this.removeArticleTOC();
        
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
                    <button class="nav-btn" onclick="blogSystem.showBlogList()" style="margin-top: 20px;">Back to Blog List</button>
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
     * 预处理并渲染数学公式，先用KaTeX渲染再处理markdown
     */
    preprocessAndRenderMath(markdown) {
        console.log('preprocessAndRenderMath: Input length:', markdown.length);
        
        // 保护代码块，避免在代码块中处理数学公式
        const codeBlocks = [];
        let codeBlockIndex = 0;
        
        // 先提取所有代码块
        markdown = markdown.replace(/```[\s\S]*?```/g, (match) => {
            const placeholder = `<!--CODE_BLOCK_${codeBlockIndex}-->`;
            codeBlocks[codeBlockIndex] = match;
            codeBlockIndex++;
            return placeholder;
        });
        console.log('After code block extraction:', codeBlocks.length, 'blocks found');

        // 检查KaTeX是否可用
        if (typeof katex === 'undefined') {
            console.warn('KaTeX not loaded, falling back to original math processing');
            return this.preprocessMath(markdown);
        }

        // 存储渲染后的数学公式
        const mathBlocks = [];
        const inlineMathBlocks = [];
        let mathIndex = 0;
        let inlineMathIndex = 0;

        // 处理显示数学公式 $$...$$
        markdown = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (match, mathContent) => {
            try {
                console.log('Processing display math:', mathContent.trim());
                
                // 检测是否包含复杂的LaTeX环境，如果包含则使用更兼容的输出模式
                const hasComplexEnvironments = /\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|align|gather|split)\}/.test(mathContent);
                
                const rendered = katex.renderToString(mathContent.trim(), {
                    displayMode: true,
                    throwOnError: false,
                    trust: true,
                    output: 'html', // 使用HTML输出保证最佳兼容性
                    strict: false,
                    // 启用更多的宏和环境
                    macros: {
                        "\\RR": "\\mathbb{R}",
                        "\\NN": "\\mathbb{N}",
                        "\\ZZ": "\\mathbb{Z}",
                        "\\QQ": "\\mathbb{Q}",
                        "\\CC": "\\mathbb{C}",
                        "\\tilde": "\\widetilde"
                    },
                    // 改进字体和排版设置
                    fleqn: false,
                    leqno: false,
                    minRuleThickness: 0.04,
                    // 添加更好的错误处理和字体设置
                    errorColor: '#cc0000',
                    colorIsTextColor: false
                });
                console.log('Rendered display math HTML length:', rendered.length);
                if (hasComplexEnvironments) {
                    console.log('Complex environment detected, using htmlAndMathml output');
                    console.log('Array/matrix content:', mathContent);
                    console.log('Array rendered result:', rendered.substring(0, 200));
                }
                const placeholder = `<!--MATH_BLOCK_${mathIndex}-->`;
                mathBlocks[mathIndex] = rendered;
                mathIndex++;
                return placeholder;
            } catch (error) {
                console.warn('Failed to render math:', mathContent, error);
                return match; // 保留原始内容
            }
        });

        // 处理行内数学公式 $...$
        markdown = markdown.replace(/\$([^$\n]+)\$/g, (match, mathContent) => {
            try {
                console.log('Processing inline math:', mathContent);
                const rendered = katex.renderToString(mathContent.trim(), {
                    displayMode: false,
                    throwOnError: false,
                    trust: true,
                    output: 'html', // 行内公式使用HTML输出
                    strict: false,
                    // 添加与显示模式相同的宏定义
                    macros: {
                        "\\RR": "\\mathbb{R}",
                        "\\NN": "\\mathbb{N}",
                        "\\ZZ": "\\mathbb{Z}",
                        "\\QQ": "\\mathbb{Q}",
                        "\\CC": "\\mathbb{C}",
                        "\\tilde": "\\widetilde"
                    },
                    // 改进字体和排版设置
                    fleqn: false,
                    leqno: false,
                    minRuleThickness: 0.04,
                    // 添加更好的错误处理和字体设置
                    errorColor: '#cc0000',
                    colorIsTextColor: false
                });
                console.log('Rendered inline math HTML:', rendered);
                
                // 检查渲染结果是否包含问题字符
                if (rendered.includes('<del>') || rendered.includes('</del>')) {
                    console.warn('DEL tag found in KaTeX output!', rendered);
                }
                
                const placeholder = `<!--MATH_INLINE_${inlineMathIndex}-->`;
                inlineMathBlocks[inlineMathIndex] = rendered;
                inlineMathIndex++;
                return placeholder;
            } catch (error) {
                console.warn('Failed to render inline math:', mathContent, error);
                return match; // 保留原始内容
            }
        });

        // 恢复代码块
        codeBlocks.forEach((codeBlock, index) => {
            markdown = markdown.replace(`<!--CODE_BLOCK_${index}-->`, codeBlock);
        });
        console.log('After code block restoration, length:', markdown.length);

        // 恢复渲染后的数学公式
        mathBlocks.forEach((mathBlock, index) => {
            markdown = markdown.replace(`<!--MATH_BLOCK_${index}-->`, `<!--MATH_BLOCK_${index}-->`);
        });
        console.log('After display math restoration:', mathBlocks.length, 'blocks restored');
        
        // 恢复渲染后的行内数学公式
        inlineMathBlocks.forEach((mathBlock, index) => {
            const placeholder = `<!--MATH_INLINE_${index}-->`;
            console.log(`Keeping placeholder ${placeholder} for later restoration`);
        });
        console.log('After inline math restoration:', inlineMathBlocks.length, 'blocks prepared');
        console.log('Final preprocessAndRenderMath output length:', markdown.length);

        // 检查是否还有未替换的占位符
        const remainingPlaceholders = markdown.match(/<!--[A-Z_]+_\d+-->/g);
        if (remainingPlaceholders) {
            console.log('Remaining placeholders for later processing:', remainingPlaceholders.length);
        }

        return {
            markdown: markdown,
            mathBlocks: mathBlocks,
            inlineMathBlocks: inlineMathBlocks
        };
    }

    /**
     * 在HTML中恢复渲染的数学公式
     */
    restoreMathInHTML(html, mathResult) {
        console.log('Restoring math in final HTML');
        
        // 恢复显示数学公式
        mathResult.mathBlocks.forEach((mathBlock, index) => {
            const placeholder = `<!--MATH_BLOCK_${index}-->`;
            html = html.replace(placeholder, mathBlock);
        });
        
        // 恢复行内数学公式
        mathResult.inlineMathBlocks.forEach((mathBlock, index) => {
            const placeholder = `<!--MATH_INLINE_${index}-->`;
            html = html.replace(placeholder, mathBlock);
        });
        
        console.log('Math restoration complete, final HTML length:', html.length);
        return html;
    }

    /**
     * 备用数学公式预处理（当KaTeX不可用时）
     * 注意：这个函数只在KaTeX不可用时调用，不应该与preprocessAndRenderMath重复处理
     */
    preprocessMath(markdown) {
        // 保护代码块，避免在代码块中处理数学公式
        const codeBlocks = [];
        let codeBlockIndex = 0;
        
        // 先提取所有代码块
        markdown = markdown.replace(/```[\s\S]*?```/g, (match) => {
            const placeholder = `<!--CODE_BLOCK_${codeBlockIndex}-->`;
            codeBlocks[codeBlockIndex] = match;
            codeBlockIndex++;
            return placeholder;
        });

        // 处理跨行的$$数学公式 - 只是格式化，不渲染
        // 先规范化所有的$$公式格式
        markdown = markdown.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
            // 清理内容，去除多余的空行
            const cleanContent = content.trim();
            
            // 如果内容包含换行，使用display数学模式
            if (cleanContent.includes('\n')) {
                return `\n$$\n${cleanContent}\n$$\n`;
            } else {
                // 单行公式也使用display模式，确保正确渲染
                return `\n$$\n${cleanContent}\n$$\n`;
            }
        });

        // 恢复代码块
        codeBlocks.forEach((codeBlock, index) => {
            markdown = markdown.replace(`<!--CODE_BLOCK_${index}-->`, codeBlock);
        });

        return markdown;
    }

    /**
     * 预处理扩展的Markdown语法
     */
    preprocessExtensions(markdown) {
        // 处理脚注
        markdown = this.processFootnotes(markdown);
        
        // 处理定义列表
        markdown = this.processDefinitionLists(markdown);
        
        // 处理缩写
        markdown = this.processAbbreviations(markdown);
        
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
     * 处理定义列表语法
     */
    processDefinitionLists(markdown) {
        // 匹配定义列表模式
        const definitionPattern = /^([^\n:]+)\n:\s+(.+)/gm;
        
        return markdown.replace(definitionPattern, (match, term, definition) => {
            return `<dl><dt>${term.trim()}</dt><dd>${definition.trim()}</dd></dl>`;
        });
    }

    /**
     * 处理缩写语法
     */
    processAbbreviations(markdown) {
        // 收集缩写定义
        const abbreviations = {};
        const abbrPattern = /^\*\[([^\]]+)\]:\s*(.+)$/gm;
        let match;
        
        // 提取缩写定义
        while ((match = abbrPattern.exec(markdown)) !== null) {
            abbreviations[match[1]] = match[2];
        }
        
        // 移除原始的缩写定义
        markdown = markdown.replace(abbrPattern, '');
        
        // 替换缩写
        for (const [abbr, title] of Object.entries(abbreviations)) {
            const regex = new RegExp(`\\b${abbr}\\b`, 'g');
            markdown = markdown.replace(regex, `<abbr title="${title}">${abbr}</abbr>`);
        }
        
        return markdown;
    }

    /**
     * 渲染博客导航栏
     */
    renderBlogNavigation() {
        // 检查是否在博客页面
        const blogPage = document.querySelector('#blog');
        if (!blogPage || !blogPage.classList.contains('active')) return;

        // 查找或创建导航栏容器
        let navContainer = document.querySelector('.blog-navigation-card');
        if (!navContainer) {
            const sidebar = document.querySelector('.sidebar');
            if (!sidebar) return;

            navContainer = document.createElement('section');
            navContainer.className = 'card blog-navigation-card';
            sidebar.appendChild(navContainer);
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

        navContainer.innerHTML = `
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
    removeBlogNavigation() {
        const navContainer = document.querySelector('.blog-navigation-card');
        if (navContainer) {
            // 添加淡出动画
            navContainer.classList.add('fade-out');
            // 等待动画完成后移除元素
            setTimeout(() => {
                if (navContainer.parentNode) {
                    navContainer.remove();
                }
            }, 300);
        }
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
        if (!toc || toc.length === 0) return;
        
        // 检查是否在文章页面
        const blogPage = document.querySelector('#blog');
        if (!blogPage || !blogPage.classList.contains('active')) return;

        // 查找或创建目录容器
        let tocContainer = document.querySelector('.article-toc-card');
        if (!tocContainer) {
            const sidebar = document.querySelector('.sidebar');
            if (!sidebar) return;

            tocContainer = document.createElement('section');
            tocContainer.className = 'card article-toc-card';
            sidebar.appendChild(tocContainer);
        }

        // 生成目录HTML
        const tocHTML = this.buildTOCHTML(toc);
        
        tocContainer.innerHTML = `
            <div class="toc-title">
                <svg class="icon small" aria-hidden="true"><use href="#px-sparkle"/></svg>
                Contents
            </div>
            <div class="toc-content">
                ${tocHTML}
            </div>
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
     * 移除文章目录
     */
    removeArticleTOC() {
        const tocContainer = document.querySelector('.article-toc-card');
        if (tocContainer) {
            // 添加淡出动画
            tocContainer.classList.add('fade-out');
            // 等待动画完成后移除元素
            setTimeout(() => {
                if (tocContainer.parentNode) {
                    tocContainer.remove();
                }
            }, 300);
        }
        
        // 清理滚动监听器
        if (this.tocObserver) {
            this.tocObserver.disconnect();
            this.tocObserver = null;
        }

        // 清理目录位置调整
        this.cleanupTOCPositionAdjustment();
    }

    /**
     * 初始化目录位置调整
     */
    initTOCPositionAdjustment() {
        const tocCard = document.querySelector('.article-toc-card');
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
     * 清理目录位置调整
     */
    cleanupTOCPositionAdjustment() {
        if (this.tocPositionHandler) {
            window.removeEventListener('scroll', this.tocPositionHandler);
            this.tocPositionHandler = null;
        }
    }

    /**
     * 初始化文章内容滚动跟随效果
     */
    initContentScrollFollow() {
        const contentElement = document.getElementById('blog-post-content');
        if (!contentElement) return;

        // 设置初始状态
        contentElement.style.transform = 'translateY(100px)';
        contentElement.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)';

        // 创建滚动监听器
        this.contentScrollHandler = () => {
            const scrollY = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;

            // 计算滚动进度 (0-1)
            const scrollProgress = Math.min(scrollY / (documentHeight - windowHeight), 1);
            
            // 计算变换值：从 100px 向下偏移开始，随着滚动逐渐移动到正常位置
            const translateY = Math.max(100 - (scrollProgress * 150), 0);
            
            contentElement.style.transform = `translateY(${translateY}px)`;
        };

        // 添加滚动事件监听器
        window.addEventListener('scroll', this.contentScrollHandler);
        
        // 触发一次初始计算
        this.contentScrollHandler();
    }

    /**
     * 清理内容滚动跟随效果
     */
    cleanupContentScrollFollow() {
        if (this.contentScrollHandler) {
            window.removeEventListener('scroll', this.contentScrollHandler);
            this.contentScrollHandler = null;
        }
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
        this.showBlogList();
    }
}

// 全局博客系统实例
let blogSystem = null;

// 初始化函数
function initBlogSystem() {
    blogSystem = new BlogSystem();
    return blogSystem.init();
}
