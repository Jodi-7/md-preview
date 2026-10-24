// 把 Electron runtime 和我们的界面打成一个可直接双击的文件夹。
// 不依赖 electron-builder：Electron 只要求 exe 同级有 resources/app。
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtime = path.join(root, 'node_modules', 'electron', 'dist')
const outDir = path.join(root, 'release', 'MarkdownPreview')
const appDir = path.join(outDir, 'resources', 'app')

async function exists(target) {
  try {
    await stat(target)
    return true
  } catch {
    return false
  }
}

if (!(await exists(path.join(runtime, 'electron.exe')))) {
  console.error('找不到 Electron 运行时，请先执行：node node_modules/electron/install.js')
  process.exit(1)
}

if (!(await exists(path.join(root, 'dist', 'index.html')))) {
  console.error('找不到 dist/，请先执行 pnpm build')
  process.exit(1)
}

console.log('· 复制 Electron 运行时…')
await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
await cp(runtime, outDir, { recursive: true })

// 我们自己的应用放进 resources/app（会优先于默认的 default_app.asar）
await mkdir(appDir, { recursive: true })
await cp(path.join(root, 'dist'), path.join(appDir, 'dist'), { recursive: true })
await cp(path.join(root, 'electron'), path.join(appDir, 'electron'), { recursive: true })

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
await writeFile(
  path.join(appDir, 'package.json'),
  `${JSON.stringify(
    {
      name: 'md-preview',
      productName: 'Markdown 预览器',
      version: pkg.version,
      description: pkg.description,
      main: 'electron/main.cjs',
    },
    null,
    2,
  )}\n`,
  'utf8',
)

// exe 改名后，任务栏与窗口标题就用这个名字
const renamed = path.join(outDir, 'MarkdownPreview.exe')
await rm(renamed, { force: true })
await rename(path.join(outDir, 'electron.exe'), renamed)

// 顺手放一份说明，双击文件夹的人知道该点哪个
await writeFile(
  path.join(outDir, '使用说明.txt'),
  [
    '双击 MarkdownPreview.exe 启动。',
    '',
    '· 文件 → 打开文件 / 打开文件夹，或直接把 .md 拖进窗口',
    '· 关联 .md 之后可以直接双击文档打开（见 README 的「双击打开」一节）',
    '· 整个文件夹可以拷贝到任意位置使用，不需要安装',
    '',
  ].join('\r\n'),
  'utf8',
)

const size = await totalSize(outDir)
console.log(`· 完成：${renamed}`)
console.log(`· 体积：${(size / 1024 / 1024).toFixed(0)} MB`)

async function totalSize(dir) {
  let sum = 0
  const { readdir } = await import('node:fs/promises')
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sum += await totalSize(full)
    else sum += (await stat(full)).size
  }
  return sum
}
