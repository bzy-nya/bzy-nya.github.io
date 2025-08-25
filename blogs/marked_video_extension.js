function buildAllowAttr() {
  const ua = navigator.userAgent || '';
  const isFirefox = /Firefox\//.test(ua);

  // 在 Firefox：不返回任何 token（避免日志）
  if (isFirefox) return '';

  // 其他浏览器保留常见需求（YouTube 官方 embed 的集合）
  return 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
}

function parseOptions(str) {
  if (!str) return {};
  const out = {};
  const re = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,}]*))\s*(?:,|$)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    out[m[1]] = (m[2] ?? m[3] ?? m[4] ?? '').trim();
  }
  return out;
}
function isYouTube(url) { return /(youtube\.com|youtu\.be)/i.test(url); }
function youTubeEmbed(url, opts = {}) {
  let id = null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) id = u.pathname.replace(/^\/+/, '');
    else id = u.searchParams.get('v') || (u.pathname.startsWith('/embed/') ? u.pathname.split('/').pop() : '');
  } catch {}
  if (!id) return null;

  const p = new URLSearchParams();
  if (opts.start)   p.set('start', String(parseInt(opts.start, 10) || 0));
  if (opts.controls != null) p.set('controls', String(+opts.controls));
  if (opts.loop)    { p.set('loop', '1'); p.set('playlist', id); }
  p.set('enablejsapi', '1');                  // 便于监听 onError
  p.set('rel', '0');                          // 减少推荐干扰
  const host = opts.nocookie ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
  const src = `${host}/embed/${encodeURIComponent(id)}${p.toString() ? '?' + p.toString() : ''}`;
  const iframeId = `yt_${id}_${Math.random().toString(36).slice(2)}`;
  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  return { id, src, iframeId, watchUrl };
}

function isBilibili(url) {
  return /(bilibili\.com\/video\/|player\.bilibili\.com\/player\.html)/i.test(url);
}
function biliEmbed(url, opts = {}) {
  let bvid = null, aid = null, page = parseInt(opts.page, 10) || 1;
  try {
    const u = new URL(url);
    if (u.hostname.includes('player.bilibili.com')) {
      bvid = u.searchParams.get('bvid');
      aid  = u.searchParams.get('aid');
      page = parseInt(u.searchParams.get('page'), 10) || page;
    } else {
      const m = u.pathname.match(/\/video\/(BV[0-9A-Za-z]+)|\/video\/av(\d+)/i);
      if (m) { if (m[1]) bvid = m[1]; else aid = m[2]; }
    }
  } catch {}
  if (!bvid && !aid) return null;

  const p = new URLSearchParams();
  if (bvid) p.set('bvid', bvid); else p.set('aid', aid);
  p.set('page', String(page));

  // ✅ 默认禁止自动播放
  const autoplay =
    opts.autoplay === 1 || opts.autoplay === '1' || opts.autoplay === true;
  p.set('autoplay', autoplay ? '1' : '0');

  // 其他可选
  if (opts.high_quality) p.set('high_quality', '1');
  if (opts.as_wide)      p.set('as_wide', '1');
  if (opts.danmaku != null) p.set('danmaku', String(+opts.danmaku));

  const src = `https://player.bilibili.com/player.html?${p.toString()}`;
  const iframeId = `bili_${(bvid || aid)}_${Math.random().toString(36).slice(2)}`;
  const watchUrl = bvid ? `https://www.bilibili.com/video/${bvid}` : `https://www.bilibili.com/video/av${aid}`;
  return { src, iframeId, watchUrl };
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* ---------- 渲染函数 ---------- */
function renderYouTubeFigure({ yt, caption, width, height }) {
  const figId = `cap_${yt.iframeId}`;
  const wh = [];
  if (width)  wh.push(`width="${escapeHtml(width)}"`);
  if (height) wh.push(`height="${escapeHtml(height)}"`);

  const allowStr = buildAllowAttr();
  const allowAttr = allowStr ? ` allow="${escapeHtml(allowStr)}"` : '';  // 关键：没有就别输出属性


  return `
    <figure class="md-video" role="group" aria-describedby="${figId}">
        <div class="md-video__box">
            <iframe
            id="${escapeHtml(yt.iframeId)}"
            src="${escapeHtml(yt.src)}"
            title="${escapeHtml(caption || 'YouTube 视频')}"
            ${wh.join(' ')}${allowAttr}
            allowfullscreen
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin">
            </iframe>
        </div>
        <figcaption id="${figId}" class="blog-image-caption">
            ${escapeHtml(caption)}
        </figcaption>
    </figure>`;
}

function renderBiliFigure({ bili, caption, width, height }) {
  const figId = `cap_${bili.iframeId}`;
  const wh = [];
  if (width)  wh.push(`width="${escapeHtml(width)}"`);
  if (height) wh.push(`height="${escapeHtml(height)}"`);
  const allowStr = buildAllowAttr();
  const allowAttr = allowStr ? ` allow="${escapeHtml(allowStr)}"` : '';

  return `
<figure class="md-video" role="group" aria-describedby="${figId}">
  <div class="md-video__box">
    <iframe
      id="${escapeHtml(bili.iframeId)}"
      src="${escapeHtml(bili.src)}"
      title="${escapeHtml(caption || '哔哩哔哩视频')}"
      ${wh.join(' ')}${allowAttr}
      allowfullscreen
      loading="lazy">
    </iframe>
  </div>
  <figcaption id="${figId}" class="blog-image-caption">
    ${escapeHtml(caption || '哔哩哔哩视频')}
  </figcaption>
</figure>`;
}

function renderHtml5Figure({ src, caption, width, height, controls = 1, loop = 0 }) {
  const figId = `cap_${Math.random().toString(36).slice(2)}`;
  const attrs = [];
  if (controls) attrs.push('controls');
  if (loop) attrs.push('loop');
  // 尊重减少动态效果
  attrs.push('playsinline'); // 移动端更友好
  if (width)  attrs.push(`width="${escapeHtml(width)}"`);
  if (height) attrs.push(`height="${escapeHtml(height)}"`);

  return `
<figure class="md-video" role="group" aria-describedby="${figId}">
  <div class="md-video__box">
    <video ${attrs.join(' ')}>
      <source src="${escapeHtml(src)}">
      您的浏览器不支持 HTML5 视频：<a href="${escapeHtml(src)}">下载/打开原视频</a>
    </video>
  </div>
  <figcaption id="${figId}" class="blog-image-caption">
    ${escapeHtml(caption)}
  </figcaption>
</figure>`;
}

/* ---------- Marked 扩展：::video[...](...){...} ---------- */
const videoExtension = {
  name: 'video',
  level: 'block',
  start(src) { return src.indexOf('::video['); },
  tokenizer(src) {
    const m = /^::video\[(.*?)\]\((.*?)\)(?:\{(.*?)\})?/s.exec(src);
    if (!m) return;
    return { type: 'video', raw: m[0], text: m[1] || '', href: (m[2] || '').trim(), optsRaw: m[3] || '' };
  },
  renderer(tk) {
    const caption = tk.text;
    const opts = parseOptions(tk.optsRaw);
    const width  = opts.width;
    const height = opts.height;

    // HTML5 视频
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(tk.href)) {
      return renderHtml5Figure({
        src: tk.href, caption, width, height,
        controls: (opts.controls ?? 1), loop: +opts.loop || 0
      });
    }

    
    // YouTube
    if (isYouTube(tk.href)) {
        const yt = youTubeEmbed(tk.href, opts);
        if (!yt) return `<p><a href="${escapeHtml(tk.href)}">${escapeHtml(caption || tk.href)}</a></p>`;
        return renderYouTubeFigure({ yt, caption, width, height });
    } else if(isBilibili(tk.href)) {
        const bili = biliEmbed(tk.href, opts);
        if (!bili) return `<p><a href="${escapeHtml(tk.href)}">${escapeHtml(caption || tk.href)}</a></p>`;
        return renderBiliFigure({ bili, caption, width, height });
    } else {
        // 其他视频源，直接当 HTML5 视频处理
        return renderHtml5Figure({
            src: tk.href, caption, width, height,
            controls: (opts.controls ?? 1), loop: +opts.loop || 0
        });
    }
  }
};

marked.use({ extensions: [videoExtension] });