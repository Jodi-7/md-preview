// 用 Chrome DevTools Protocol 打开页面、检查 DOM、截图。
// 只用于开发期验证，不参与应用构建。
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * 自动找本机的 Chrome / Edge；找不到就用 CHROME_PATH 指定。
 * 桌面版可以改用 --bin= 指向打包出来的 exe，这时不需要浏览器。
 */
const CHROME =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((candidate) => existsSync(candidate))

const PORT = 9333

const [, , url, outPath, widthArg, heightArg, evalExpr, ...flags] = process.argv
if (!url || !outPath) {
  console.error('usage: node tools/shot.mjs <url> <out.png> [width] [height] [js-expression] [--dark] [--scroll=1200]')
  process.exit(1)
}

const dark = flags.includes('--dark')
const scrollFlag = flags.find((flag) => flag.startsWith('--scroll='))
const profileFlag = flags.find((flag) => flag.startsWith('--profile='))
const binFlag = flags.find((flag) => flag.startsWith('--bin='))
const openFlag = flags.find((flag) => flag.startsWith('--open='))

const customBin = binFlag ? binFlag.slice('--bin='.length) : null
const openTarget = openFlag ? openFlag.slice('--open='.length) : null

if (!customBin && !CHROME) {
  console.error('找不到 Chrome / Edge，请先设置环境变量 CHROME_PATH，或用 --bin= 指定可执行文件')
  process.exit(1)
}

const width = Number(widthArg ?? 1440)
const height = Number(heightArg ?? 960)
const profile = profileFlag
  ? profileFlag.slice('--profile='.length)
  : path.join(os.tmpdir(), `mdp-shot-${Date.now()}`)

// 某些环境会把 ELECTRON_RUN_AS_NODE 设成 1，那样 Electron 会退化成纯 Node 运行
const childEnv = { ...process.env }
delete childEnv.ELECTRON_RUN_AS_NODE

const chrome = customBin
  ? spawn(
      customBin,
      [`--remote-debugging-port=${PORT}`, ...(openTarget ? [openTarget] : [])],
      { stdio: 'ignore', env: childEnv },
    )
  : spawn(
      CHROME,
      [
        '--headless=new',
        `--remote-debugging-port=${PORT}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { stdio: 'ignore' },
    )

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(fn, timeoutMs = 15000, label = 'condition') {
  const started = Date.now()
  for (;;) {
    try {
      const value = await fn()
      if (value) return value
    } catch {
      /* 还没起来，继续等 */
    }
    if (Date.now() - started > timeoutMs) throw new Error(`timeout waiting for ${label}`)
    await sleep(100)
  }
}

let ws
let nextId = 1
const pending = new Map()
const consoleErrors = []
const pageErrors = []

function send(method, params = {}) {
  const id = nextId++
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`CDP timeout: ${method}`))
    }, 30000)
    pending.set(id, { resolve, reject, timer })
  })
}

function finish(code) {
  try {
    ws?.close()
  } catch {
    /* ignore */
  }
  try {
    if (process.platform === 'win32' && chrome.pid) {
      // Electron 会拉子进程，只 kill 主 pid 有时杀不干净，用 taskkill 连树一起收掉
      spawnSync('taskkill', ['/pid', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      chrome.kill()
    }
  } catch {
    /* ignore */
  }
  try {
    if (!profileFlag) rmSync(profile, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  process.exit(code)
}

try {
  const target = await waitFor(
    async () => {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await response.json()
      return list.find((item) => item.type === 'page' && item.webSocketDebuggerUrl)
    },
    20000,
    'chrome devtools',
  )

  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id)
      pending.delete(msg.id)
      clearTimeout(entry.timer)
      if (msg.error) entry.reject(new Error(`${msg.error.message} (${msg.error.code})`))
      else entry.resolve(msg.result)
      return
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.description)
    }
  })

  await send('Page.enable')
  await send('Runtime.enable')

  if (!customBin) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: false,
    })
  }

  if (dark) {
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'dark' }],
    })
  }

  const loaded = new Promise((resolve) => {
    const timer = setTimeout(resolve, 12000)
    const onMessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.method === 'Page.loadEventFired') {
        clearTimeout(timer)
        ws.removeEventListener('message', onMessage)
        resolve()
      }
    }
    ws.addEventListener('message', onMessage)
  })

  if (customBin) {
    // Electron 自己已经加载完成，不再导航
    await sleep(2200)
  } else {
    await send('Page.navigate', { url })
    await loaded
    await sleep(1400)
  }

  if (scrollFlag) {
    const y = Number(scrollFlag.split('=')[1] ?? 0)
    // 正文现在由 .content 自己滚动，窗口滚动已经不起作用
    await send('Runtime.evaluate', {
      expression: `(()=>{const el=document.querySelector('.content');if(el)el.scrollTop=${y};window.scrollTo(0,${y})})()`,
    })
    await sleep(500)
  }

  let result = null
  if (evalExpr) {
    const evaluated = await send('Runtime.evaluate', {
      expression: evalExpr,
      returnByValue: true,
      awaitPromise: true,
    })
    result = evaluated.result?.value ?? null
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
  writeFileSync(path.resolve(outPath), Buffer.from(shot.data, 'base64'))

  console.log(
    JSON.stringify(
      { url, out: outPath, result, consoleErrors, pageErrors, ok: consoleErrors.length === 0 && pageErrors.length === 0 },
      null,
      2,
    ),
  )
  finish(0)
} catch (error) {
  console.error(JSON.stringify({ url, error: String(error), consoleErrors, pageErrors }, null, 2))
  finish(1)
}
