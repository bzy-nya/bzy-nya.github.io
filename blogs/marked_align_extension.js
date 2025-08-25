function parseOptions(str){ if(!str) return {}; const out={}; const re=/([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,}]*))\s*(?:,|$)/g; let m; while((m=re.exec(str))!==null){ out[m[1]]=(m[2]??m[3]??m[4]??'').trim(); } return out; }
function toCssSize(v){ return /^\d+$/.test(String(v)) ? `${v}px` : String(v); }
function alignClassFromName(name){ const a=String(name||'').toLowerCase(); if(a==='center'||a==='middle') return 'md-align--center'; if(a==='right'||a==='end') return 'md-align--right'; return ''; }
function writingModeFromOpts(opts){
  const v = String(opts.writing || opts.vertical || '').toLowerCase();
  if (v==='vertical-rl'||v==='rl') return 'vertical-rl';
  if (v==='vertical-lr'||v==='lr') return 'vertical-lr';
  if (v==='sideways-rl'||v==='sideways-lr') return v;
  return '';
}
function dirAttrFromOpts(opts){ const d=String(opts.dir||opts.direction||'').toLowerCase(); if(d==='rtl'||d==='ltr'||d==='auto') return d; if(String(opts.rtl).toLowerCase()==='1' || String(opts.rtl).toLowerCase()==='true') return 'rtl'; return ''; }
function buildBoxStyle(opts){
  const style = [];

  // ✅ 如果提供 width，就当“严格宽度”用
  if (opts.width){
    const w = toCssSize(opts.width);
    style.push(`width:${w}`);               // 物理宽度
    style.push(`inline-size:${w}`);         // 逻辑宽度（竖排更稳）
    style.push(`flex-basis:${w}`);          // 在 flex 容器里占位刚好这个宽度
  } else if (opts.max || opts['max-width']){
    const mw = toCssSize(opts.max || opts['max-width']);
    style.push(`max-width:${mw}`);
    style.push(`max-inline-size:${mw}`);
  }

  if (opts.height){
    const h = toCssSize(opts.height);
    style.push(`height:${h}`);
    style.push(`block-size:${h}`);
  }
  const wm = writingModeFromOpts(opts);
  if (wm){
    style.push(`writing-mode:${wm}`);
    const orient = String(opts.orient || opts.orientation || 'mixed').toLowerCase();
    style.push(`text-orientation:${orient==='upright' ? 'upright' : 'mixed'}`);
  }
  return style.length ? ` style="${style.join(';')}"` : '';
}


const alignContainer = {
  name: 'align',
  level: 'block',
  start(src){ const m = src.match(/^::(?:center|right|align\()/m); return m ? m.index : -1; },
  tokenizer(src){
    const rule = /^::(?:(center|right)|align\((center|right|left)\))(?:\{([^\n}]*)\})?\s*\n([\s\S]+?)\n::\s*(?:\n|$)/;
    const m = rule.exec(src);
    if (!m) return;
    const align = m[1] || m[2] || 'left';
    const optsRaw = m[3] || '';
    const body = m[4] || '';
    const tokens = [];
    this.lexer.blockTokens(body, tokens);
    return { type:'align', raw:m[0], align, optsRaw, tokens };
  },
  renderer(token){
    const opts = parseOptions(token.optsRaw);
    const outerAlignCls = alignClassFromName(token.align);
    const dir = dirAttrFromOpts(opts);
    const dirAttr = dir ? ` dir="${dir}"` : '';
    const boxStyle = buildBoxStyle(opts);

    // 可选：文本也随对齐
    const textAlign = (opts.text==='1'||opts.text==='true') ? token.align : '';
    const textStyle = textAlign ? ` style="text-align:${textAlign};"` : '';

    // 额外语义类：RTL / Vertical
    const extra = [];
    if (dir === 'rtl') extra.push('md-align--rtl');
    if (writingModeFromOpts(opts)) extra.push('md-align--vertical');

    return `<div class="md-align ${outerAlignCls} ${extra.join(' ')}">
  <div class="md-align__box"${dirAttr}${boxStyle}${textStyle}>
    ${this.parser.parse(token.tokens)}
  </div>
</div>`;
  }
};

marked.use({ extensions: [alignContainer] });