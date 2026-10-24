// 生成方案图（SVG），再由 Chrome 截图成 PNG
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(DIR, { recursive: true });

const SANS = `'Segoe UI','Microsoft YaHei UI','Microsoft YaHei',system-ui,-apple-system,sans-serif`;
const MONO = `'Cascadia Code',Consolas,'SF Mono',ui-monospace,monospace`;

const C = {
  ink: '#0E1626',
  body: '#475467',
  muted: '#8A93A5',
  faint: '#B4BCCB',
  line: '#E4E7EC',
  bg: '#F4F5F9',
  white: '#FFFFFF',
  indigo: '#4F46E5',
  indigoSoft: '#EEF1FF',
  cyan: '#0E7490',
  cyanSoft: '#E6F6FA',
  green: '#0E9F6E',
  greenSoft: '#E4F7EF',
  amber: '#B54708',
  amberSoft: '#FDF3E4',
  violet: '#6D46E0',
  violetSoft: '#F2EDFF',
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function T(x, y, s, o = {}) {
  const { size = 13, weight = 400, fill = C.ink, anchor = 'start', font = SANS, ls = 0 } = o;
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${esc(s)}</text>`;
}

function R(x, y, w, h, o = {}) {
  const { fill = C.white, stroke = C.line, rx = 14, sw = 1, dash = '', shadow = false } = o;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}${shadow ? ' filter="url(#soft)"' : ''}/>`;
}

function L(x1, y1, x2, y2, o = {}) {
  const { stroke = '#C3CAD6', sw = 1.4, arrow = true, dash = '' } = o;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${arrow ? ' marker-end="url(#arrow)"' : ''}${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round"/>`;
}

function dot(cx, cy, r, fill) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
}

const DEFS = `<defs>
  <filter id="soft" x="-25%" y="-25%" width="150%" height="170%">
    <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#101828" flood-opacity="0.07"/>
  </filter>
  <filter id="softs" x="-25%" y="-25%" width="150%" height="170%">
    <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#101828" flood-opacity="0.05"/>
  </filter>
  <marker id="arrow" markerWidth="9" markerHeight="9" refX="6.2" refY="3" orient="auto">
    <path d="M0.6,0.4 L6,3 L0.6,5.6" fill="none" stroke="#A9B2C2" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
</defs>`;

function svgDoc(W, H, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}<rect width="${W}" height="${H}" fill="${C.bg}"/>${body}</svg>`;
}

function write(name, W, H, body) {
  const svg = svgDoc(W, H, body);
  writeFileSync(path.join(DIR, `${name}.svg`), svg, 'utf8');
  writeFileSync(
    path.join(DIR, `${name}.html`),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:${C.bg}}svg{display:block}</style><body>${svg}</body></html>`,
    'utf8',
  );
}

/* ------------------------------------------------------------------ */
/* 图 1：架构总览                                                       */
/* ------------------------------------------------------------------ */
function architecture() {
  const W = 1240, H = 878;
  const p = [];
  p.push(T(64, 64, 'Markdown 预览器 · 架构总览', { size: 23, weight: 700 }));
  p.push(T(64, 92, '四层单向数据流：文件进来，HTML 出去；每一层都能单独替换或测试', { size: 13, fill: C.body }));

  const bands = [
    {
      y: 120, label: '输入', tag: 'INPUT', accent: C.cyan, soft: C.cyanSoft,
      cards: [
        ['拖拽 / 粘贴', ['拖进窗口，或直接粘贴文本']],
        ['打开文件与文件夹', ['所选目录整棵读入，本地只读']],
        ['最近打开', ['记住上次文件与阅读位置']],
        ['URL 参数', ['?file= 直接定位到某篇文档']],
      ],
    },
    {
      y: 300, label: '解析', tag: 'PARSE', accent: C.indigo, soft: C.indigoSoft,
      cards: [
        ['markdown-it 引擎', ['严格对齐 CommonMark 0.31']],
        ['GFM 插件链', ['表格 / 任务列表 / 脚注 / 自动链接']],
        ['DOMPurify 净化', ['白名单过滤，脚本与事件属性剥离']],
      ],
    },
    {
      y: 480, label: '渲染', tag: 'RENDER', accent: C.violet, soft: C.violetSoft,
      cards: [
        ['React 预览面板', ['分块提交，长文档边滚边出']],
        ['代码高亮 + 复制', ['常用语言随首屏，其余按需']],
        ['Mermaid · KaTeX', ['图表与公式命中才 import']],
        ['大纲 / 搜索 / 锚点', ['TOC 与滚动位置双向联动']],
      ],
    },
    {
      y: 660, label: '支撑', tag: 'SUPPORT', accent: C.amber, soft: C.amberSoft, dashed: true,
      cards: [
        ['主题 & 字号', ['深浅色一键切换，偏好本地保存']],
        ['目录监听', ['文件改动 300ms 内自动重渲染']],
        ['异常兜底', ['解析失败降级为纯文本视图']],
        ['规范回归测试', ['CommonMark + GFM 用例快照比对']],
      ],
    },
  ];

  const BX = 64, BW = 1112, BH = 148;

  bands.forEach((b, bi) => {
    p.push(
      R(BX, b.y, BW, BH, {
        fill: b.dashed ? '#FCFCFE' : C.white,
        stroke: b.dashed ? '#DDE1EA' : C.line,
        rx: 18,
        dash: b.dashed ? '6 6' : '',
        shadow: !b.dashed,
      }),
    );
    p.push(dot(82, b.y + 30, 4.5, b.accent));
    p.push(T(96, b.y + 35, b.label, { size: 15.5, weight: 700 }));
    p.push(T(BX + BW - 24, b.y + 35, b.tag, { size: 10.5, weight: 700, fill: C.faint, anchor: 'end', font: MONO, ls: 1.4 }));

    const n = b.cards.length;
    const gap = 16;
    const w = (BW - 48 - gap * (n - 1)) / n;
    b.cards.forEach((c, i) => {
      const x = BX + 24 + i * (w + gap);
      const y = b.y + 56;
      p.push(R(x, y, w, 72, { fill: b.dashed ? C.white : '#FCFCFD', stroke: '#EDEFF4', rx: 12, shadow: true }));
      p.push(R(x, y + 14, 3, 20, { fill: b.accent, stroke: 'none', rx: 1.5 }));
      p.push(T(x + 16, y + 29, c[0], { size: 13.5, weight: 600 }));
      p.push(T(x + 16, y + 50, c[1][0], { size: 11.5, fill: C.muted }));
    });

    if (bi < 2) {
      const y1 = b.y + BH + 4;
      const y2 = bands[bi + 1].y - 8;
      p.push(L(620, y1, 620, y2, { stroke: '#C3CAD6' }));
    }
  });

  // 支撑层与主流程的连接（虚线说明“横切”、“非下游”）
  p.push(L(620, bands[2].y + BH + 4, 620, bands[3].y - 8, { stroke: '#C3CAD6', dash: '4 4', arrow: false }));
  p.push(T(634, bands[3].y - 14, '横切关注点', { size: 10.5, fill: C.faint }));

  write('01-architecture', W, H, p.join(''));
}

/* ------------------------------------------------------------------ */
/* 图 2：渲染管线                                                       */
/* ------------------------------------------------------------------ */
function pipeline() {
  const W = 1240, H = 726;
  const p = [];
  p.push(T(64, 64, '渲染管线 · 准确性从哪来', { size: 23, weight: 700 }));
  p.push(T(64, 92, '读 → 解析 → 扩展 → 净化 → 渲染。每道关卡都有可执行的回归用例，坏掉立刻被发现', { size: 13, fill: C.body }));

  const stages = [
    {
      n: '01', t: '读取源', sub: ['File System Access / 拖拽', '只读、不上传、不落盘'], accent: C.cyan, soft: C.cyanSoft,
      why: ['浏览器原生能力', '不需要后台进程', '打开即用，零安装'],
    },
    {
      n: '02', t: 'CommonMark 解析', sub: ['markdown-it 词法 + AST', '对齐 CommonMark 0.31.2'], accent: C.indigo, soft: C.indigoSoft,
      why: ['652 条官方用例', '全量纳入回归测试', '规范漂移当场失败'],
    },
    {
      n: '03', t: 'GFM 扩展', sub: ['表格 / 任务 / 脚注', '删除线 / 自动链接'], accent: C.indigo, soft: C.indigoSoft,
      why: ['插件顺序固定', '扩展只加能力', '不改写基础语义'],
    },
    {
      n: '04', t: '安全净化', sub: ['DOMPurify 白名单', '剥离 script 与 on* 属性'], accent: C.amber, soft: C.amberSoft,
      why: ['默认不放行内联 HTML', '危险 URL 协议拦截', '文档里的脚本跑不起来'],
    },
    {
      n: '05', t: '渲染成页面', sub: ['React + 高亮 + TOC', '分块提交，滚动不阻塞'], accent: C.violet, soft: C.violetSoft,
      why: ['渲染是纯函数', '同输入必得同输出', '快照测试比对 HTML'],
    },
  ];

  const BW = 200, step = 232, X0 = 70, BY = 178, BH = 112;

  stages.forEach((s, i) => {
    const x = X0 + i * step;
    p.push(T(x + 2, 156, s.n, { size: 11, weight: 700, fill: s.accent, font: MONO, ls: 1.5 }));
    p.push(R(x, BY, BW, BH, { fill: C.white, stroke: C.line, rx: 14, shadow: true }));
    p.push(R(x + 14, BY + 1.5, BW - 28, 3, { fill: s.accent, stroke: 'none', rx: 1.5 }));
    p.push(T(x + 18, BY + 36, s.t, { size: 14, weight: 700 }));
    p.push(T(x + 18, BY + 62, s.sub[0], { size: 11.5, fill: C.body }));
    p.push(T(x + 18, BY + 82, s.sub[1], { size: 11.5, fill: C.body }));

    // 向下连线到“保障”卡片
    p.push(L(x + BW / 2, BY + BH + 4, x + BW / 2, 344, { stroke: '#D3D9E3', sw: 1.2, arrow: false }));

    p.push(R(x, 352, BW, 132, { fill: s.soft, stroke: 'none', rx: 14 }));
    p.push(T(x + 18, 382, '为什么可靠', { size: 10.5, weight: 700, fill: s.accent, ls: 0.6 }));
    s.why.forEach((w, k) => {
      p.push(T(x + 18, 410 + k * 22, w, { size: 11.5, fill: '#3B4657' }));
    });

    if (i < stages.length - 1) {
      p.push(L(x + BW + 5, BY + BH / 2, x + step - 6, BY + BH / 2, { stroke: '#C3CAD6', sw: 1.5 }));
    }
  });

  // 底部：按需加载
  p.push(R(70, 524, 1100, 128, { fill: C.white, stroke: '#EDEFF4', rx: 16, shadow: true }));
  p.push(T(94, 570, '首屏之外：按需加载', { size: 14, weight: 700 }));
  p.push(T(94, 596, '重依赖不进首屏，命中时才动态 import', { size: 11.5, fill: C.muted }));

  const pills = [
    ['Mermaid 图表', '60 KB'],
    ['KaTeX 公式', '45 KB'],
    ['额外语法高亮', '分包'],
  ];
  pills.forEach((pl, i) => {
    const x = 548 + i * 200;
    p.push(R(x, 570, 190, 38, { fill: '#FCFCFD', stroke: '#DDE1EA', rx: 9, dash: '5 4' }));
    p.push(T(x + 14, 594, pl[0], { size: 11.5, weight: 600, fill: C.body }));
    p.push(T(x + 176, 594, pl[1], { size: 10, fill: C.faint, anchor: 'end', font: MONO }));
  });
  write('02-pipeline', W, H, p.join(''));
}

/* ------------------------------------------------------------------ */
/* 图 3：界面草图                                                       */
/* ------------------------------------------------------------------ */
function uiMock() {
  const W = 1240, H = 800;
  const p = [];
  p.push(T(64, 64, '界面草图 · 左边找文件，右边看结果', { size: 23, weight: 700 }));
  p.push(T(64, 92, '不做多余的编辑器：一个文件树、一个大纲、一块干净的阅读区，加上拖拽即开', { size: 13, fill: C.body }));

  const WX = 64, WY = 132, WW = 1112, WH = 588;
  p.push(R(WX, WY, WW, WH, { fill: C.white, stroke: '#DDE1EA', rx: 18, shadow: true }));

  // 标题栏
  p.push(dot(90, 154, 5, '#FF5F57'), dot(108, 154, 5, '#FEBC2E'), dot(126, 154, 5, '#28C840'));
  p.push(T(150, 159, 'README.md — Markdown 预览器', { size: 12.5, weight: 600, fill: C.body }));
  p.push(R(1008, 142, 148, 26, { fill: C.indigoSoft, stroke: 'none', rx: 7 }));
  p.push(T(1082, 159, '拖入文件即可预览', { size: 10.5, weight: 600, fill: C.indigo, anchor: 'middle' }));
  p.push(`<line x1="${WX}" y1="180" x2="${WX + WW}" y2="180" stroke="${C.line}" stroke-width="1"/>`);

  // 左侧栏
  const RX = 320;
  p.push(`<rect x="${WX}" y="181" width="${RX - WX}" height="${WH - 49}" fill="#FAFBFD"/>`);
  p.push(`<line x1="${RX}" y1="181" x2="${RX}" y2="${WY + WH}" stroke="${C.line}" stroke-width="1"/>`);

  // 搜索框
  p.push(R(84, 198, 216, 30, { fill: '#EEF1F6', stroke: 'none', rx: 8 }));
  p.push(`<circle cx="101" cy="213" r="4.6" fill="none" stroke="#98A2B3" stroke-width="1.5"/>`);
  p.push(`<line x1="104.6" y1="216.6" x2="108.2" y2="220.2" stroke="#98A2B3" stroke-width="1.5" stroke-linecap="round"/>`);
  p.push(T(116, 217, '搜索文件…', { size: 11.5, fill: '#98A2B3' }));

  // 文件树
  p.push(T(84, 254, '文档', { size: 10, weight: 700, fill: C.faint, ls: 1.2 }));
  const files = [
    { name: 'docs', indent: 0, kind: 'folder' },
    { name: 'README.md', indent: 12, kind: 'md', active: true },
    { name: 'guide', indent: 12, kind: 'folder' },
    { name: 'install.md', indent: 30, kind: 'md' },
    { name: 'api.md', indent: 30, kind: 'md' },
    { name: 'CHANGELOG.md', indent: 0, kind: 'md' },
  ];
  files.forEach((f, i) => {
    const y = 266 + i * 30;
    const x = 84 + f.indent;
    if (f.active) p.push(R(76, y, 232, 28, { fill: C.indigoSoft, stroke: 'none', rx: 8 }));
    if (f.kind === 'folder') {
      p.push(`<path d="M${x} ${y + 9} h5.5 l2 2.4 h6.5 v7.6 h-14 z" fill="#F2C879" stroke="none" rx="2"/>`);
    } else {
      p.push(`<rect x="${x + 1}" y="${y + 8}" width="11" height="13" rx="2.5" fill="${f.active ? '#B9C4FF' : '#CBD3E0'}"/>`);
      p.push(`<rect x="${x + 3.6}" y="${y + 11.4}" width="6" height="1.6" rx="0.8" fill="#FFFFFF"/>`);
      p.push(`<rect x="${x + 3.6}" y="${y + 14.4}" width="6" height="1.6" rx="0.8" fill="#FFFFFF"/>`);
    }
    p.push(T(x + 22, y + 18, f.name, { size: 12.5, weight: f.active ? 600 : 400, fill: f.active ? C.indigo : C.body }));
  });

  // 大纲
  p.push(T(84, 466, '大纲', { size: 10, weight: 700, fill: C.faint, ls: 1.2 }));
  const toc = ['快速开始', '支持的语法', '安全与边界', '常见问题'];
  toc.forEach((t, i) => {
    const y = 486 + i * 26;
    if (i === 0) {
      p.push(R(84, y - 14, 3, 16, { fill: C.indigo, stroke: 'none', rx: 1.5 }));
    }
    p.push(T(96, y, t, { size: 12, weight: i === 0 ? 600 : 400, fill: i === 0 ? C.indigo : C.muted }));
  });

  p.push(R(84, 636, 216, 56, { fill: C.white, stroke: '#EDEFF4', rx: 10, dash: '5 4' }));
  p.push(T(102, 658, '拖入 .md 文件', { size: 11.5, weight: 600, fill: C.body }));
  p.push(T(102, 676, '或整个文件夹', { size: 10.5, fill: C.faint }));

  // 右侧内容
  const CX = 372;
  p.push(T(CX, 200, 'docs / README.md', { size: 11, fill: C.faint, font: MONO }));
  ['主题', '字号', '刷新'].forEach((s, i) => {
    const x = 1024 + i * 46;
    p.push(R(x, 186, 40, 24, { fill: '#F4F5F8', stroke: 'none', rx: 7 }));
    p.push(T(x + 20, 202, s, { size: 10, fill: C.muted, anchor: 'middle' }));
  });

  p.push(T(CX, 262, 'Markdown 预览器', { size: 26, weight: 700, ls: -0.3 }));
  p.push(T(CX, 288, '最后修改 3 分钟前 · 4.2 KB · GFM', { size: 11.5, fill: C.faint }));
  p.push(`<line x1="${CX}" y1="306" x2="1140" y2="306" stroke="${C.line}" stroke-width="1"/>`);

  p.push(T(CX, 340, '快速开始', { size: 17, weight: 700 }));
  [[704, 9], [676, 9], [402, 9]].forEach((b, i) => {
    p.push(R(CX, 356 + i * 20, b[0], b[1], { fill: '#E8ECF3', stroke: 'none', rx: 4.5 }));
  });

  // 代码块
  p.push(R(CX, 412, 748, 96, { fill: '#0F172A', stroke: 'none', rx: 10 }));
  p.push(T(CX + 724, 430, 'bash', { size: 9.5, fill: '#64748B', anchor: 'end', font: MONO }));
  p.push(T(CX + 20, 442, '$ pnpm dev', { size: 11.5, fill: '#A5B4FC', font: MONO }));
  p.push(T(CX + 20, 466, 'VITE ready in 214 ms', { size: 11.5, fill: '#7DD3FC', font: MONO }));
  p.push(T(CX + 20, 490, '# 然后把 .md 拖进窗口', { size: 11.5, fill: '#64748B', font: MONO }));

  p.push(T(CX, 542, '支持的语法', { size: 17, weight: 700 }));

  // 表格
  const TX = CX, TY = 558, TW = 748, RH = 28;
  p.push(R(TX, TY, TW, RH * 4, { fill: C.white, stroke: '#E7EAF0', rx: 8 }));
  p.push(`<rect x="${TX}" y="${TY}" width="${TW}" height="${RH}" rx="8" fill="#F7F8FB"/>`);
  p.push(`<rect x="${TX}" y="${TY + RH - 8}" width="${TW}" height="8" fill="#F7F8FB"/>`);
  p.push(`<line x1="${TX}" y1="${TY + RH}" x2="${TX + TW}" y2="${TY + RH}" stroke="#E7EAF0"/>`);
  p.push(`<line x1="${TX}" y1="${TY + RH * 2}" x2="${TX + TW}" y2="${TY + RH * 2}" stroke="#E7EAF0"/>`);
  const cols = [TX + 16, TX + 300, TX + 420];
  ['语法', '支持', '说明'].forEach((h, i) => p.push(T(cols[i], TY + 18, h, { size: 11, weight: 700, fill: C.muted })));
  const rows = [
    ['GFM 表格', '完整', '含对齐、行内代码'],
    ['任务列表', '完整', '可勾选并回写'],
    ['脚注 / 自动链接', '完整', '标题自动生成锚点'],
  ];
  rows.forEach((r, i) => {
    const y = TY + RH * (i + 1) + 18;
    p.push(T(cols[0], y, r[0], { size: 11.5, weight: 600, fill: C.body }));
    p.push(T(cols[1], y, r[1], { size: 11.5, fill: C.green }));
    p.push(T(cols[2], y, r[2], { size: 11.5, fill: C.muted }));
  });

  p.push(T(64, 762, '图例：蓝色 = 当前文件 / 当前小节；虚线 = 空状态提示', { size: 11, fill: C.faint }));

  write('03-interface', W, H, p.join(''));
}

architecture();
pipeline();
uiMock();
console.log('svg written');
