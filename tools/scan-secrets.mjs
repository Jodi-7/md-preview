// 开源前敏感信息自查：扫描仓库里可能泄露本机信息或凭据的文本。
// 用法：node tools/scan-secrets.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SKIP_DIRS = new Set(['node_modules', 'dist', 'release', '.git', '.cache'])
// 扫描器自身的规则里就写着这些样例，跳过自己
const SKIP_FILES = new Set(['tools/scan-secrets.mjs'])
const SKIP_EXT = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|exe|dll|pak|node|pdf|zip)$/i
const MAX_BYTES = 2 * 1024 * 1024

const RULES = [
  // 源码里的路径可能被转义成 C:\\Users\\，所以允许 1~2 个反斜杠
  { label: '本机用户目录', re: /[A-Za-z]:\\{1,2}Users\\{1,2}/i },
  { label: '开发机路径', re: /[A-Za-z]:\\{1,2}(dsh|dev|work|projects|code)\\{1,2}/i },
  { label: 'macOS 用户目录', re: /\/Users\/[a-z0-9._-]+/i },
  { label: 'Linux 家目录', re: /\/home\/[a-z0-9._-]+/i },
  { label: 'Windows 安装路径', re: /[A-Za-z]:\\{1,2}Program Files/i },
  { label: '环境变量泄露', re: /\b(USERPROFILE|HOMEPATH|APPDATA)\b\s*=\s*\S/i },
  { label: '凭据赋值', re: /(password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*['"][^'"]{4,}/i },
  { label: '令牌格式', re: /(ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})/ },
  { label: 'Bearer 头', re: /Bearer\s+[A-Za-z0-9._-]{10,}/ },
  { label: '私钥区块', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: '邮箱地址', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
]

const findings = []

function scanFile(file) {
  if (SKIP_EXT.test(file)) return
  if (SKIP_FILES.has(path.relative(ROOT, file).split(path.sep).join('/'))) return
  let size = 0
  try {
    size = statSync(file).size
  } catch {
    return
  }
  if (size > MAX_BYTES) return

  // 锁文件里的 "包名@版本" 会被邮箱规则误判，单独跳过
  const ignoreEmail = file.endsWith('pnpm-lock.yaml') || file.endsWith('package-lock.json')

  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    for (const rule of RULES) {
      if (ignoreEmail && rule.label === '邮箱地址') continue
      rule.re.lastIndex = 0
      const match = line.match(rule.re)
      if (!match) continue
      findings.push({
        file: path.relative(ROOT, file),
        line: index + 1,
        rule: rule.label,
        text: match[0].slice(0, 80),
      })
    }
  })
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else scanFile(full)
  }
}

walk(ROOT)

if (findings.length === 0) {
  console.log('CLEAN：没有发现疑似敏感信息')
  process.exit(0)
}

console.log(`发现 ${findings.length} 处疑似命中：`)
for (const item of findings) {
  console.log(`  [${item.rule}] ${item.file}:${item.line}  ${item.text}`)
}
process.exit(1)
