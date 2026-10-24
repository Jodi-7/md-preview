// 生成 v1.1 候选功能说明图
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SANS = `'Segoe UI','Microsoft YaHei UI','Microsoft YaHei',system-ui,sans-serif`
const MONO = `'Cascadia Code',Consolas,ui-monospace,monospace`
const SERIF = `Georgia,'Times New Roman',serif`

const C = {
  ink: '#0E1626', body: '#475467', muted: '#8A93A5', faint: '#B4BCCB',
  line: '#E4E7EC', bg: '#F4F5F9', white: '#FFFFFF',
  cyan: '#0E7490', cyanSoft: '#E6F6FA',
  indigo: '#4F46E5', indigoSoft: '#EEF1FF',
  amber: '#B54708', amberSoft: '#FDF3E4',
  green: '#0E9F6E',
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function T(x, y, s, o = {}) {
  const { size = 13, weight = 400, fill = C.ink, anchor = 'start', font = SANS, style = '' } = o
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`
}

function R(x, y, w, h, o = {}) {
  const { fill = C.white, stroke = C.line, rx = 14, sw = 1, dash = '', shadow = false } = o
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}${shadow ? ' filter="url(#soft)"' : ''}/>`
}

/** 按估算字宽折行：中文按 1em，其余按 0.55em，避免把词切断 */
function wrap(text, maxWidth, size) {
  const lines = []
  let line = ''
  let width = 0
  for (const ch of text) {
    const w = /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? size : size * 0.55
    if (width + w > maxWidth && line) {
      lines.push(line)
      line = ch
      width = w
    } else {
      line += ch
      width += w
    }
  }
  if (line) lines.push(line)
  return lines
}

const DEFS = `<defs>
  <filter id="soft" x="-25%" y="-25%" width="150%" height="170%">
    <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#101828" flood-opacity="0.07"/>
  </filter>
  <marker id="arrow" markerWidth="9" markerHeight="9" refX="6.2" refY="3" orient="auto">
    <path d="M0.6,0.4 L6,3 L0.6,5.6" fill="none" stroke="#B4BCCB" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
  </marker>
</defs>`

const W = 1240
const H = 742
const p = []

p.push(R(0, 0, W, H, { fill: C.bg, stroke: 'none', rx: 0 }))
p.push(T(70, 66, '这三个功能分别是干什么的', { size: 23, weight: 700 }))
p.push(T(70, 94, '它们不在同一层：一个省操作、一个补语法、一个换产品形态', { size: 13, fill: C.body }))

const cols = [
  {
    x: 70, no: '01', tag: 'INPUT', accent: C.cyan, soft: C.cyanSoft,
    title: '文件监听',
    lead: '你在 VS Code 里改文档，预览自己跟着变，不用再拖一次。',
    nowLabel: '现在',
    now: ['改完保存 → 回到预览器', '手动重新拖入或点一下文件'],
    nextLabel: '之后',
    next: ['保存 → 预览自动更新', '滚动位置和阅读状态都保留'],
    cost: '需要目录访问权限；Chrome / Edge 可用，Safari 与 Firefox 只能降级轮询。',
    save: '每次改文档省 3 秒，一天几十次',
  },
  {
    x: 443, no: '02', tag: 'RENDER', accent: C.indigo, soft: C.indigoSoft,
    title: 'KaTeX 公式',
    lead: '把 $…$ 和 $$…$$ 之间的 LaTeX 排成真正的数学公式。',
    nowLabel: '现在',
    now: ['公式显示成原文：'],
    nowSample: '$a^2 + b^2 = c^2$',
    nextLabel: '之后',
    next: ['公式排成正常版式：'],
    nextSample: true,
    cost: '约 78 KB gzip，动态加载不进首屏；只对写论文 / 算法笔记的文档有意义。',
    save: '没有公式的文档：零影响',
  },
  {
    x: 816, no: '03', tag: 'UI', accent: C.amber, soft: C.amberSoft,
    title: '双栏同步滚动',
    lead: '左边改、右边看，两边滚动互相对齐 —— 这已经是编辑器形态。',
    nowLabel: '现在',
    now: ['只能看。要改就切回编辑器，', '改完再回来重新打开'],
    nextLabel: '之后',
    next: ['左边编辑 / 右边实时预览', '滚一边，另一边跟着走'],
    mini: true,
    cost: '范围最大：要引入编辑器内核、行号与滚动映射、脏状态管理。',
    save: '等于把「阅读器」换成「编辑器」',
  },
]

const CW = 354
const CY = 126
const CH = 508

cols.forEach((c) => {
  p.push(R(c.x, CY, CW, CH, { fill: C.white, stroke: C.line, rx: 18, shadow: true }))
  p.push(R(c.x + 20, CY + 22, 30, 22, { fill: c.soft, stroke: 'none', rx: 7 }))
  p.push(T(c.x + 35, CY + 37, c.no, { size: 11, weight: 700, fill: c.accent, font: MONO, anchor: 'middle' }))
  p.push(T(c.x + CW - 20, CY + 37, c.tag, { size: 9.5, weight: 700, fill: C.faint, anchor: 'end', font: MONO }))

  p.push(T(c.x + 20, CY + 78, c.title, { size: 19, weight: 700 }))
  p.push(T(c.x + 20, CY + 104, c.lead, { size: 12, fill: C.body }))

  // 现在
  const nowY = CY + 132
  p.push(T(c.x + 20, nowY, c.nowLabel, { size: 10, weight: 700, fill: C.faint, }));
  p.push(R(c.x + 20, nowY + 12, CW - 40, 76, { fill: '#FAFBFC', stroke: '#ECEEF3', rx: 10 }))
  c.now.forEach((line, i) => {
    p.push(T(c.x + 34, nowY + 38 + i * 20, line, { size: 11.5, fill: C.muted }))
  })
  if (c.nowSample) {
    p.push(T(c.x + 34, nowY + 62, c.nowSample, { size: 12, fill: C.muted, font: MONO }))
  }

  // 箭头
  const arrowY = nowY + 100
  p.push(`<line x1="${c.x + CW / 2}" y1="${arrowY}" x2="${c.x + CW / 2}" y2="${arrowY + 22}" stroke="#C3CAD6" stroke-width="1.4" marker-end="url(#arrow)"/>`)

  // 之后
  const nextY = arrowY + 36
  p.push(T(c.x + 20, nextY, c.nextLabel, { size: 10, weight: 700, fill: c.accent }))
  const nextH = c.mini ? 122 : 100
  p.push(R(c.x + 20, nextY + 12, CW - 40, nextH, { fill: c.soft, stroke: 'none', rx: 10 }))
  c.next.forEach((line, i) => {
    p.push(T(c.x + 34, nextY + 38 + i * 20, line, { size: 11.5, weight: 600, fill: C.ink }))
  })
  if (c.nextSample) {
    p.push(
      `<text x="${c.x + 34}" y="${nextY + 88}" font-family="${SERIF}" font-size="21" font-style="italic" fill="${C.ink}">` +
        `<tspan>a</tspan><tspan baseline-shift="super" font-size="13">2</tspan>` +
        `<tspan> + b</tspan><tspan baseline-shift="super" font-size="13">2</tspan>` +
        `<tspan> = c</tspan><tspan baseline-shift="super" font-size="13">2</tspan>` +
        `</text>`,
    )
  } else if (c.mini) {
    // 双栏迷你示意
    p.push(R(c.x + 34, nextY + 100, 128, 32, { fill: C.white, stroke: '#E6D3B5', rx: 7 }))
    p.push(R(c.x + 172, nextY + 100, 128, 32, { fill: C.white, stroke: '#E6D3B5', rx: 7 }))
    p.push(T(c.x + 98, nextY + 121, '编辑', { size: 11, fill: C.muted, anchor: 'middle' }))
    p.push(T(c.x + 236, nextY + 121, '预览', { size: 11, fill: C.muted, anchor: 'middle' }))
    p.push(T(c.x + 167, nextY + 121, '⇅', { size: 13, fill: C.amber, anchor: 'middle' }))
  }

  // 代价
  p.push(`<line x1="${c.x + 20}" y1="${CY + CH - 96}" x2="${c.x + CW - 20}" y2="${CY + CH - 96}" stroke="#F0F2F6" stroke-width="1"/>`)
  p.push(T(c.x + 20, CY + CH - 72, '代价', { size: 10, weight: 700, fill: C.faint }))
  wrap(c.cost, CW - 46, 10.5)
    .slice(0, 3)
    .forEach((line, i) => {
      p.push(T(c.x + 20, CY + CH - 52 + i * 17, line, { size: 10.5, fill: C.muted }))
    })
})

// 底部建议
p.push(R(70, 662, W - 140, 52, { fill: C.white, stroke: '#ECEEF3', rx: 12, shadow: true }))
p.push(T(90, 693, '建议顺序', { size: 11, weight: 700, fill: C.faint }))
p.push(T(160, 693, '① 文件监听（收益最大、改动最小）', { size: 12, weight: 600, fill: C.ink }))
p.push(T(390, 693, '② KaTeX（独立可插拔，做不做都不影响别的）', { size: 12, weight: 600, fill: C.ink }))
p.push(T(730, 693, '③ 双栏同步（等于换产品形态，最后再考虑）', { size: 12, weight: 600, fill: C.ink }))

const body = p.join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${DEFS}${body}</svg>`
writeFileSync(path.join(DIR, '04-v11-options.svg'), svg, 'utf8')
writeFileSync(
  path.join(DIR, '04-v11-options.html'),
  `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>html,body{margin:0;background:${C.bg}}svg{display:block}</style><body>${svg}</body></html>`,
  'utf8',
)
console.log('written')
