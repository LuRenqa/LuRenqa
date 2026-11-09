/**
 * dsh-ai-widget-hub —— Host 半（v0.2：自包含版）
 * ============================================================================
 * 一个插件内置全部 8 只余额桌宠挂件（Gemini娘 / Kimi娘 / GLM娘 / 千问娘 / Grok娘 /
 * DeepSeek娘 / Claude娘 / GPT娘），安装本插件即可，不需要再单独安装
 * dsh-neko-widget / dsh-kimi-widget / dsh-glm-widget / dsh-qwen-widget /
 * dsh-grok-widget / dsh-whale-widget / dsh-xiaoke-widget / dsh-gpt-niang-widget。
 *
 * 做法：
 *   - 8 只挂件的 Host 实现与浏览器脚本原样内嵌在 ./widgets/<id>/ 下；
 *   - 本文件按用户开关状态，用 Cordis 的 child plugin 机制「挂载/卸载」它们：
 *       开启 = ctx.plugin(widgetPlugin)（挂件自己的路由 + 注入行随之注册）
 *       关闭 = fiber.dispose()（路由与监听全部撤销）
 *   - 开关状态存在 $DSH_HOME/dsh-ai-widget-hub.json（唯一状态文件）；
 *   - 不再依赖 profile 里的 pluginManager 行开关，也不再依赖 8 个独立插件包。
 *
 * HTTP API（Client 半使用）：
 *   GET  /dsh-ai-hub/state    -> 8 只挂件的目录 + 开关状态
 *   POST /dsh-ai-hub/toggle   -> { id, enabled } 挂载/卸载并持久化
 *   GET  /dsh-ai-hub/icon/<id>.png
 */

import fs from 'node:fs'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { WIDGETS as CATALOG, findWidget } from './catalog.js'

// —— 内嵌的 9 只挂件（Host 半，默认导出 { name, apply }）——
import nekoPlugin from './widgets/neko/lib/neko-index.js'
import kimiPlugin from './widgets/kimi/lib/kimi-index.js'
import glmPlugin from './widgets/glm/lib/glm-index.js'
import qwenPlugin from './widgets/qwen/lib/qwen-index.js'
import grokPlugin from './widgets/grok/lib/grok-index.js'
import whalePlugin from './widgets/whale/lib/index.js'
import xiaokePlugin from './widgets/xiaoke/lib/xiaoke-index.js'
import gptniangPlugin from './widgets/gptniang/lib/gptniang-index.js'
import mimoPlugin from './widgets/mimo/lib/mimo-index.js'

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const WIDGETS_DIR = path.join(PKG_ROOT, 'widgets')
const ICON_DIR = path.join(PKG_ROOT, 'assets', 'icons')

const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const STATE_FILE = path.join(DSH_HOME, 'dsh-ai-widget-hub.json')
const RUNTIME_DIAG_FILE = path.join(DSH_HOME, 'dsh-ai-widget-hub.runtime.json')
const DESKTOP_CONFIG_FILE = path.join(DSH_HOME, 'dsh-ai-widget-hub.desktop.json')
const DESKTOP_POS_FILE = path.join(DSH_HOME, 'dsh-ai-widget-hub.desktop.pos.json')
const DESKTOP_HELPER = path.join(PKG_ROOT, 'assets', 'desktop-pet.ps1')
const DESKTOP_PS = 'powershell.exe'
/** 每只挂件在桌面上使用的两张角色图（相对 widgets/<id>/assets/）。 */
const DESKTOP_ASSETS = {
  neko: ['neko1.png', 'neko2.png'],
  kimi: ['kimi1.png', 'kimi2.png'],
  glm: ['glm1.png', 'glm2.png'],
  qwen: ['qwen1.png', 'qwen2.png'],
  grok: ['grok1.png', 'grok2.png'],
  xiaoke: ['xiaoke1.png', 'xiaoke2.png'],
  whale: ['DSniang1.png', 'whale2.png'],
  gptniang: ['gptniang1.png', 'gptniang2.png'],
  mimo: ['mimo1.png', 'mimo2.png'],
}

const STATE_PATH = '/dsh-ai-hub/state'
const TOGGLE_PATH = '/dsh-ai-hub/toggle'
const TOGGLE_ALL_PATH = '/dsh-ai-hub/toggle-all'
const DESKTOP_PAGE_PATH = '/dsh-ai-hub/desktop'
const ICON_PREFIX = '/dsh-ai-hub/icon'

const MAX_BODY_BYTES = 16 * 1024

/** id -> 内嵌挂件插件对象（默认导出）。 */
const CHILD_PLUGINS = {
  neko: nekoPlugin,
  kimi: kimiPlugin,
  glm: glmPlugin,
  qwen: qwenPlugin,
  grok: grokPlugin,
  whale: whalePlugin,
  xiaoke: xiaokePlugin,
  gptniang: gptniangPlugin,
  mimo: mimoPlugin,
}

// ---------------------------------------------------------------------------
// 响应工具
// ---------------------------------------------------------------------------

/** 写一个 JSON 响应；任何写入异常都被吞掉（路由绝不能把宿主带崩）。 */
function sendJson(res, status, payload) {
  try {
    const body = JSON.stringify(payload)
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Length', String(Buffer.byteLength(body)))
    res.end(body)
  } catch (err) {
    try {
      res.destroy()
    } catch (err2) {
      /* ignore */
    }
  }
}

/** 写一个纯文本响应。 */
function sendText(res, status, body) {
  try {
    const text = String(body)
    res.statusCode = status
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Length', String(Buffer.byteLength(text)))
    res.end(text)
  } catch (err) {
    try {
      res.destroy()
    } catch (err2) {
      /* ignore */
    }
  }
}

function sendMethodNotAllowed(res, allow) {
  try {
    res.setHeader('Allow', allow)
  } catch (err) {
    /* ignore */
  }
  sendText(res, 405, 'method not allowed')
}

async function readJsonBody(req, limitBytes) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limitBytes) {
      const tooLarge = new Error('request body too large')
      tooLarge.code = 'body-too-large'
      throw tooLarge
    }
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') {
    const empty = new Error('empty request body')
    empty.code = 'bad-json'
    throw empty
  }
  try {
    return JSON.parse(text)
  } catch (err) {
    const badJson = new Error('request body is not valid JSON')
    badJson.code = 'bad-json'
    throw badJson
  }
}

// ---------------------------------------------------------------------------
// 信任栅栏（fail-closed，沿用 v0.1 的实现）
// ---------------------------------------------------------------------------

function isLoopbackHostname(hostname) {
  const h = String(hostname || '')
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
  if (h === '') return false
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h === '::1') return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (m === null) return false
  if (Number(m[1]) !== 127) return false
  return [m[2], m[3], m[4]].every((part) => Number(part) <= 255)
}

export function isLoopbackHost(hostHeader) {
  const raw = String(hostHeader || '').trim()
  if (raw === '') return false
  try {
    return isLoopbackHostname(new URL('http://' + raw).hostname)
  } catch (err) {
    return false
  }
}

/** 取 connection 服务（可选；不同版本可能挂成属性或只能 ctx.get）。 */
function connectionOf(ctx) {
  try {
    if (typeof ctx.get === 'function') {
      const viaGet = ctx.get('connection')
      if (viaGet !== undefined && viaGet !== null) return viaGet
    }
  } catch (err) {
    /* ignore */
  }
  try {
    return Reflect.get(ctx, 'connection')
  } catch (err) {
    return undefined
  }
}

function rejectionFor(ctx, req) {
  try {
    const headers = (req && req.headers) || {}
    const hostHeader = typeof headers.host === 'string' ? headers.host : ''
    let authority = ''
    let hostname = ''
    try {
      const parsed = new URL('http://' + hostHeader)
      authority = parsed.host.toLowerCase()
      hostname = parsed.hostname
    } catch (err) {
      return 403
    }
    if (!isLoopbackHostname(hostname)) return 403

    const site = String(headers['sec-fetch-site'] || '').toLowerCase()
    if (site === 'cross-site') return 403

    const origin = headers.origin
    if (typeof origin === 'string' && origin !== '') {
      if (origin === 'null') return 403
      let originAuthority = ''
      try {
        originAuthority = new URL(origin).host.toLowerCase()
      } catch (err) {
        return 403
      }
      if (originAuthority !== authority) return 403
    }

    const connection = connectionOf(ctx)
    if (connection !== undefined && connection !== null && typeof connection.requestRejection === 'function') {
      let rejection
      try {
        rejection = connection.requestRejection(req)
      } catch (err) {
        return 403
      }
      if (rejection !== undefined && rejection !== null && rejection !== false) {
        return typeof rejection === 'number' ? rejection : 403
      }
    }
    return null
  } catch (err) {
    return 403
  }
}

// ---------------------------------------------------------------------------
// 开关状态（唯一状态文件 $DSH_HOME/dsh-ai-widget-hub.json）
// ---------------------------------------------------------------------------

/** 默认：8 只全部开启（与 v0.1 管理 8 个独立插件时的默认观感一致）。 */
function defaultState() {
  const enabled = {}
  const desktop = {}
  for (const widget of CATALOG) { enabled[widget.id] = true; desktop[widget.id] = false }
  return { version: 1, enabled, desktop }
}

function sanitizeState(raw) {
  const out = defaultState()
  if (raw === null || typeof raw !== 'object') return out
  const enabled = raw.enabled
  if (enabled !== null && typeof enabled === 'object' && !Array.isArray(enabled)) {
    for (const widget of CATALOG) {
      if (typeof enabled[widget.id] === 'boolean') out.enabled[widget.id] = enabled[widget.id]
    }
  }
  const desktop = raw.desktop
  if (desktop !== null && typeof desktop === 'object' && !Array.isArray(desktop)) {
    for (const widget of CATALOG) {
      if (typeof desktop[widget.id] === 'boolean') out.desktop[widget.id] = desktop[widget.id]
    }
  }
  return out
}

function loadState() {
  try {
    const text = fs.readFileSync(STATE_FILE, 'utf8')
    return sanitizeState(JSON.parse(text))
  } catch (err) {
    return defaultState()
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    const tmp = STATE_FILE + '.tmp-' + process.pid + '-' + Date.now()
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8')
    fs.renameSync(tmp, STATE_FILE)
  } catch (err) {
    throw new Error('无法写入开关状态文件：' + String((err && err.message) || err))
  }
}

/** 每只挂件的版本（内嵌副本的 package.json）。 */
function readVersions() {
  const versions = {}
  for (const widget of CATALOG) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(WIDGETS_DIR, widget.id, 'package.json'), 'utf8'))
      versions[widget.id] = typeof pkg.version === 'string' ? pkg.version : '0.0.0'
    } catch (err) {
      versions[widget.id] = '0.0.0'
    }
  }
  return versions
}

// ---------------------------------------------------------------------------
// 运行期诊断（便于排障：每次挂载/卸载把当前挂载表写一份到 $DSH_HOME）
// ---------------------------------------------------------------------------

function writeRuntimeDiag(mounted, errors) {
  try {
    const payload = {
      at: new Date().toISOString(),
      pid: process.pid,
      mounted: Array.from(mounted.keys()),
      errors: errors || {},
    }
    fs.mkdirSync(path.dirname(RUNTIME_DIAG_FILE), { recursive: true })
    fs.writeFileSync(RUNTIME_DIAG_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  } catch (err) {
    /* 诊断写盘失败不影响功能 */
  }
}

// ---------------------------------------------------------------------------
// Host 插件
// ---------------------------------------------------------------------------

export default {
  name: 'ai-widget-hub',

  apply(ctx) {
    // 内嵌挂件的挂载表：id -> fiber
    const mounted = new Map()
    const state = loadState()
    const versions = readVersions()

    // —— 桌面宠物：启动/停止随插件分发的 PowerShell 助手（透明置顶窗口）——
    // —— 桌面舞台：单独的无边框浏览器窗口，加载「真实挂件页面」（气泡/菜单与 DSH 内完全一致）——
    let desktopChild = null
    function desktopPets() {
      const pets = []
      for (const widget of CATALOG) {
        if (state.desktop[widget.id] !== true) continue
        if (!mounted.has(widget.id)) continue
        pets.push({ id: widget.id, title: widget.title })
      }
      return pets
    }
    function DESKTOP_ROUTE_BASE() {
      try {
        const webServer = ctx.get('webServer')
        const origin = webServer && typeof webServer.getOrigin === 'function' ? String(webServer.getOrigin()) : ''
        return origin.replace(/\/+$/, '')
      } catch (err) { return 'http://127.0.0.1' }
    }
    function desktopAuthUrl() {
      try {
        const base = DESKTOP_ROUTE_BASE() + '/'
        const connection = ctx.get('connection')
        if (connection && typeof connection.authenticatedUrl === 'function') {
          return String(connection.authenticatedUrl(base))
        }
        return base
      } catch (err) { return DESKTOP_ROUTE_BASE() + '/' }
    }
    function findDesktopBrowser() {
      const candidates = [
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ]
      for (const p of candidates) {
        try { if (fs.existsSync(p)) return p } catch (err) {}
      }
      return null
    }
    function stopDesktopHelper() {
      if (desktopChild === null) return
      const pid = desktopChild.pid
      desktopChild = null
      try {
        const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
        killer.on('error', () => {})
      } catch (err) {}
    }
    function syncDesktopHelper() {
      try {
        const pets = desktopPets().length
        if (pets === 0) { stopDesktopHelper(); return }
        if (desktopChild !== null && desktopChild.exitCode === null) return
        const exe = findDesktopBrowser()
        if (!exe) {
          try { ctx.logger?.warn?.('[ai-widget-hub] 未找到 Edge/Chrome，无法打开桌面舞台') } catch (err) {}
          return
        }
        const profile = path.join(DSH_HOME, 'dsh-ai-hub-desktop-profile')
        try { fs.mkdirSync(profile, { recursive: true }) } catch (err) {}
        let launchUrl = desktopAuthUrl()
        if (launchUrl.indexOf('?') >= 0) launchUrl += '&dsh-desktop-stage=1'
        else launchUrl += '?dsh-desktop-stage=1'
        const args = [
          '--app=' + launchUrl,
          '--window-size=1120,720',
          '--no-first-run',
          '--no-default-browser-check',
          '--user-data-dir=' + profile,
          '--disable-features=Translate,MediaRouter',
        ]
        desktopChild = spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: false })
        try { desktopChild.unref() } catch (err) {}
        desktopChild.on('exit', () => { desktopChild = null })
        desktopChild.on('error', () => { desktopChild = null })
      } catch (err) {
        try { ctx.logger?.warn?.('[ai-widget-hub] 启动桌面舞台失败：' + String((err && err.message) || err)) } catch (err2) {}
      }
    }

    /** 桌面舞台页面：加载所有「开启桌面显示」的真实挂件脚本，气泡/菜单与 DSH 内一致。 */
    function desktopPageHtml() {
      return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>AI娘桌面</title>
<style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:radial-gradient(1200px 600px at 80% 100%,#1b2130 0%,#0f1115 60%,#0b0d12 100%);}
body{color:#e5e7eb;font-family:system-ui,"Microsoft YaHei",sans-serif}
#dsh-desktop-hint{position:absolute;left:12px;top:10px;font-size:12px;color:#9aa4b2;opacity:.85;pointer-events:none}
</style></head>
<body>
<div id="dsh-desktop-hint">AI娘桌面 · 拖动可移动 · 右键/点击使用挂件菜单</div>
<script>
(function () {
  var seq = '';
  function want() {
    return fetch('/dsh-ai-hub/state', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json() })
      .then(function (d) {
        var list = (d && d.widgets) || [];
        return list.filter(function (w) { return w && w.enabled === true && w.desktop === true }).map(function (w) { return w.id })
      });
  }
  function mount(ids) {
    var left = ids.length;
    if (!ids.length) { document.getElementById('dsh-desktop-hint').textContent = '没有开启「桌面显示」的 AI娘'; return }
    ids.forEach(function (id, i) {
      var s = document.createElement('script');
      s.src = '/dsh-' + id + '/widget.js';
      s.onload = function () {
        left -= 1;
        if (left === 0) layout();
      };
      s.onerror = function () { left -= 1; if (left === 0) layout(); };
      document.body.appendChild(s);
    });
    setTimeout(layout, 1200);
  }
  function layout() {
    var roots = [].slice.call(document.querySelectorAll('[data-dsh-widget-root]'));
    roots.forEach(function (r, i) {
      var col = i % 5;
      var row = Math.floor(i / 5);
      r.style.translate = (-(col * 200)) + 'px ' + (-(row * 210)) + 'px';
    });
  }
  want().then(function (ids) {
    seq = ids.join(',');
    mount(ids);
    setInterval(function () {
      want().then(function (next) {
        if (next.join(',') !== seq) location.reload();
      }).catch(function () {});
    }, 2500);
  }).catch(function () {
    document.getElementById('dsh-desktop-hint').textContent = '读取状态失败，请从 DSH 面板重新开启桌面显示';
  });
})();
</script>
</body></html>`
    }

    /** 挂载一只内嵌挂件，返回 { ok, fiber?, error? }。 */
    function mountWidget(id) {
      if (mounted.has(id)) return { ok: true, fiber: mounted.get(id) }
      const plugin = CHILD_PLUGINS[id]
      if (plugin === undefined || plugin === null) {
        return { ok: false, error: 'unknown widget: ' + id }
      }
      try {
        const fiber = ctx.plugin(plugin)
        mounted.set(id, fiber)
        return { ok: true, fiber }
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err) }
      }
    }

    /** 卸载一只内嵌挂件（撤销它注册的路由、注入行、定时器）。 */
    async function unmountWidget(id) {
      const fiber = mounted.get(id)
      if (fiber === undefined) return true
      mounted.delete(id)
      try {
        const result = typeof fiber.dispose === 'function' ? fiber.dispose() : undefined
        if (result && typeof result.then === 'function') await result
      } catch (err) {
        try {
          ctx.logger?.warn?.('[ai-widget-hub] 卸载 ' + id + ' 失败：' + String((err && err.message) || err))
        } catch (err2) {
          /* ignore */
        }
        return false
      }
      return true
    }

    // ① 按状态挂载全部启用的挂件（apply 一开始就做，保证宿主启动时它们能注册注入行）
    const mountErrors = {}
    for (const widget of CATALOG) {
      if (state.enabled[widget.id] !== true) continue
      const result = mountWidget(widget.id)
      if (!result.ok) mountErrors[widget.id] = result.error
    }
    writeRuntimeDiag(mounted, mountErrors)

    // ② 本插件自己的路由：需要 webServer
    try {
      if (typeof ctx.inject !== 'function') return
      ctx.inject(['webServer'], (svc) => {
        const disposers = []
        const warn = (message) => {
          try {
            svc.logger?.warn?.(message)
          } catch (err) {
            /* ignore */
          }
        }

        function register(kind, pathname, handler) {
          try {
            const dispose = svc.webServer.register({ kind, path: pathname, handler })
            if (typeof dispose === 'function') disposers.push(dispose)
          } catch (err) {
            warn('[ai-widget-hub] 路由注册失败 ' + kind + ' ' + pathname + ': ' + String((err && err.message) || err))
          }
        }

        const routed = (handler) => (req, res) => {
          const rejection = rejectionFor(svc, req)
          if (rejection !== null) {
            try {
              res.statusCode = rejection
              res.end()
            } catch (err) {
              try {
                res.destroy()
              } catch (err2) {
                /* ignore */
              }
            }
            return
          }
          return handler(req, res)
        }

        /** 组装 state 响应：目录 + 已挂载状态 + 版本。 */
        function buildState() {
          return {
            ok: true,
            bundled: true,
            widgets: CATALOG.map((widget) => ({
              id: widget.id,
              title: widget.title,
              subtitle: widget.subtitle,
              description: widget.description,
              accent: widget.accent,
              route: widget.route,
              script: widget.script,
              rootClass: widget.rootClass,
              iconUrl: ICON_PREFIX + '/' + widget.id + '.png',
              installed: true,
              enabled: mounted.has(widget.id),
              desktop: state.desktop[widget.id] === true,
              fiberPhase: mounted.has(widget.id) ? 'active' : null,
              entryId: null,
              version: versions[widget.id] || '0.0.0',
              readOnlyReason: null,
            })),
          }
        }

        // GET /dsh-ai-hub/state
        register(
          'exact',
          STATE_PATH,
          routed((req, res) => {
            const method = String((req && req.method) || 'GET').toUpperCase()
            if (method !== 'GET' && method !== 'HEAD') {
              sendMethodNotAllowed(res, 'GET, HEAD')
              return
            }
            try {
              sendJson(res, 200, buildState())
            } catch (err) {
              sendJson(res, 500, {
                ok: false,
                error: { code: 'state-failed', message: String((err && err.message) || err) },
              })
            }
          }),
        )

        // POST /dsh-ai-hub/toggle
        register(
          'exact',
          TOGGLE_PATH,
          routed(async (req, res) => {
            const method = String((req && req.method) || 'GET').toUpperCase()
            if (method !== 'POST') {
              sendMethodNotAllowed(res, 'POST')
              return
            }
            let payload
            try {
              payload = await readJsonBody(req, MAX_BODY_BYTES)
            } catch (err) {
              const code = (err && err.code) || 'bad-request'
              sendJson(res, code === 'body-too-large' ? 413 : 400, {
                ok: false,
                id: null,
                error: { code, message: String((err && err.message) || err) },
              })
              return
            }
            if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
              sendJson(res, 400, {
                ok: false,
                id: null,
                error: { code: 'bad-json', message: 'request body must be a JSON object' },
              })
              return
            }
            const widget = findWidget(payload.id)
            if (widget === undefined) {
              sendJson(res, 400, {
                ok: false,
                id: typeof payload.id === 'string' ? payload.id : null,
                error: { code: 'unknown-id', message: 'unknown widget id' },
              })
              return
            }
            if (typeof payload.enabled !== 'boolean') {
              sendJson(res, 400, {
                ok: false,
                id: widget.id,
                error: { code: 'invalid-enabled', message: '"enabled" must be a boolean' },
              })
              return
            }

            const target = payload.enabled
            const before = mounted.has(widget.id)
            let changed = false
            try {
              if (target) {
                if (!before) {
                  const result = mountWidget(widget.id)
                  if (!result.ok) throw new Error(result.error)
                  // 等挂件完成加载（路由 / 注入行就绪），浏览器半随后补脚本
                  try {
                    if (result.fiber && typeof result.fiber.then === 'function') await result.fiber
                  } catch (err) {
                    /* 加载失败也让状态如实反映 */
                  }
                  changed = true
                }
              } else if (before) {
                const ok = await unmountWidget(widget.id)
                if (!ok) throw new Error('卸载失败')
                changed = true
              }

              state.enabled[widget.id] = target
              if (!target) state.desktop[widget.id] = false
              saveState(state)
              try { syncDesktopHelper() } catch (err) {}
              writeRuntimeDiag(mounted, {})

              sendJson(res, 200, {
                ok: true,
                id: widget.id,
                changed,
                application: 'applied',
                enabled: mounted.has(widget.id),
                fiberPhase: mounted.has(widget.id) ? 'active' : null,
                warnings: [],
                version: versions[widget.id] || '0.0.0',
              })
            } catch (err) {
              // 回滚内存状态（文件未被改动）
              state.enabled[widget.id] = before
              sendJson(res, 200, {
                ok: false,
                id: widget.id,
                changed,
                application: 'failed',
                enabled: mounted.has(widget.id),
                error: { code: 'toggle-failed', message: String((err && err.message) || err) },
              })
            }
          }),
        )


        // POST /dsh-ai-hub/toggle-all —— 一键开/关全部（一次请求，挂载/卸载并行）
        register(
          'exact',
          TOGGLE_ALL_PATH,
          routed(async (req, res) => {
            const method = String((req && req.method) || 'GET').toUpperCase()
            if (method !== 'POST') {
              sendMethodNotAllowed(res, 'POST')
              return
            }
            let payload
            try {
              payload = await readJsonBody(req, MAX_BODY_BYTES)
            } catch (err) {
              const code = (err && err.code) || 'bad-request'
              sendJson(res, code === 'body-too-large' ? 413 : 400, {
                ok: false,
                error: { code, message: String((err && err.message) || err) },
              })
              return
            }
            if (payload === null || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.enabled !== 'boolean') {
              sendJson(res, 400, { ok: false, error: { code: 'bad-json', message: 'body must be { enabled: boolean }' } })
              return
            }
            const target = payload.enabled
            const failures = {}
            const changed = []
            try {
              if (target) {
                const waits = []
                for (const widget of CATALOG) {
                  if (mounted.has(widget.id)) continue
                  const result = mountWidget(widget.id)
                  if (!result.ok) { failures[widget.id] = result.error; continue }
                  changed.push(widget.id)
                  if (result.fiber && typeof result.fiber.then === 'function') waits.push(Promise.resolve(result.fiber).catch(() => {}))
                }
                if (waits.length) await Promise.all(waits)
              } else {
                const jobs = []
                for (const widget of CATALOG) {
                  if (!mounted.has(widget.id)) continue
                  changed.push(widget.id)
                  jobs.push({ id: widget.id, p: unmountWidget(widget.id) })
                }
                const results = await Promise.all(jobs.map((job) => job.p))
                for (let i = 0; i < results.length; i++) {
                  if (!results[i]) failures[jobs[i].id] = "unmount failed"
                }
              }
              for (const widget of CATALOG) {
                if (failures[widget.id] !== undefined) continue
                state.enabled[widget.id] = target
              }
              if (!target) { for (const widget of CATALOG) state.desktop[widget.id] = false }
              saveState(state)
              try { syncDesktopHelper() } catch (err) {}
              writeRuntimeDiag(mounted, failures)
              sendJson(res, 200, {
                ok: true,
                enabled: target,
                changed,
                application: 'applied',
                widgets: CATALOG.map((widget) => ({ id: widget.id, enabled: mounted.has(widget.id) })),
                failures,
              })
            } catch (err) {
              sendJson(res, 200, {
                ok: false,
                enabled: target,
                changed,
                application: 'failed',
                widgets: CATALOG.map((widget) => ({ id: widget.id, enabled: mounted.has(widget.id) })),
                error: { code: 'toggle-all-failed', message: String((err && err.message) || err) },
              })
            }
          }),
        )

        // POST /dsh-ai-hub/desktop/toggle —— 单只 / 全部 桌面显示开关
        register(
          'exact',
          '/dsh-ai-hub/desktop/toggle',
          routed(async (req, res) => {
            const method = String((req && req.method) || 'GET').toUpperCase()
            if (method !== 'POST') { sendMethodNotAllowed(res, 'POST'); return }
            let payload
            try { payload = await readJsonBody(req, MAX_BODY_BYTES) } catch (err) {
              const code = (err && err.code) || 'bad-request'
              sendJson(res, code === 'body-too-large' ? 413 : 400, { ok: false, error: { code, message: String((err && err.message) || err) } })
              return
            }
            if (payload === null || typeof payload !== 'object' || typeof payload.enabled !== 'boolean') {
              sendJson(res, 400, { ok: false, error: { code: 'bad-json', message: 'body must be { enabled: boolean, id?: string, all?: boolean }' } })
              return
            }
            const target = payload.enabled
            try {
              if (payload.all === true) {
                for (const widget of CATALOG) state.desktop[widget.id] = target
              } else {
                const widget = findWidget(payload.id)
                if (widget === undefined) {
                  sendJson(res, 400, { ok: false, error: { code: 'unknown-id', message: 'unknown widget id' } })
                  return
                }
                if (target && !mounted.has(widget.id)) {
                  sendJson(res, 400, { ok: false, id: widget.id, error: { code: 'widget-disabled', message: '请先开启该 AI娘' } })
                  return
                }
                state.desktop[widget.id] = target
              }
              saveState(state)
              syncDesktopHelper()
              sendJson(res, 200, {
                ok: true,
                enabled: target,
                widgets: CATALOG.map((widget) => ({ id: widget.id, desktop: state.desktop[widget.id] === true })),
              })
            } catch (err) {
              sendJson(res, 500, { ok: false, error: { code: 'desktop-toggle-failed', message: String((err && err.message) || err) } })
            }
          }),
        )

        // GET /dsh-ai-hub/desktop —— 桌面舞台页面（浏览器窗口加载真实挂件）
        register(
          'exact',
          DESKTOP_PAGE_PATH,
          routed((req, res) => {
            const method = String((req && req.method) || 'GET').toUpperCase()
            if (method !== 'GET' && method !== 'HEAD') { sendMethodNotAllowed(res, 'GET, HEAD'); return }
            try {
              const html = desktopPageHtml()
              res.statusCode = 200
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.setHeader('Cache-Control', 'no-store')
              res.end(method === 'HEAD' ? undefined : html)
            } catch (err) {
              sendText(res, 500, 'desktop page failed')
            }
          }),
        )
        // 图标：每个 id 一条 exact 路由
        const iconCache = new Map()
        function iconBytes(iconFile) {
          if (typeof iconFile !== 'string' || iconFile === '' || path.basename(iconFile) !== iconFile) {
            throw new Error('invalid icon file name')
          }
          const cached = iconCache.get(iconFile)
          if (cached !== undefined) return cached
          const bytes = fs.readFileSync(path.join(ICON_DIR, iconFile))
          if (bytes.length === 0) throw new Error('empty icon file')
          iconCache.set(iconFile, bytes)
          return bytes
        }
        for (const widget of CATALOG) {
          register(
            'exact',
            ICON_PREFIX + '/' + widget.id + '.png',
            routed((req, res) => {
              const method = String((req && req.method) || 'GET').toUpperCase()
              if (method !== 'GET' && method !== 'HEAD') {
                sendMethodNotAllowed(res, 'GET, HEAD')
                return
              }
              let bytes
              try {
                bytes = iconBytes(widget.iconFile)
              } catch (err) {
                sendText(res, 404, 'icon not found: ' + widget.id)
                return
              }
              try {
                res.statusCode = 200
                res.setHeader('Content-Type', 'image/png')
                res.setHeader('Cache-Control', 'max-age=3600')
                res.setHeader('Content-Length', String(bytes.length))
                res.setHeader('X-Content-Type-Options', 'nosniff')
                res.end(method === 'HEAD' ? undefined : bytes)
              } catch (err) {
                try {
                  res.destroy()
                } catch (err2) {
                  /* ignore */
                }
              }
            }),
          )
        }

        register('prefix', ICON_PREFIX, routed((req, res) => {
          sendText(res, 404, 'icon not found')
        }))

        // 启动时恢复桌面显示（在 webServer 注入完成后，保证 origin 正确）
        try { syncDesktopHelper() } catch (err) {}

        svc.effect(() => () => {
          for (const dispose of disposers) {
            try {
              dispose()
            } catch (err) {
              /* ignore */
            }
          }
          disposers.length = 0
        })
      })
    } catch (err) {
      try {
        ctx.logger?.warn?.('[ai-widget-hub] 初始化失败：' + String((err && err.message) || err))
      } catch (err2) {
        /* ignore */
      }
    }

    // 启动时按保存的桌面开关恢复 helper（若已有开启项）
    try { syncDesktopHelper() } catch (err) {}

    // ③ 插件卸载时把内嵌挂件全部卸载
    try {
      ctx.effect(() => () => {
        for (const id of Array.from(mounted.keys())) {
          try {
            const fiber = mounted.get(id)
            if (fiber && typeof fiber.dispose === 'function') fiber.dispose()
          } catch (err) {
            /* ignore */
          }
        }
        mounted.clear()
        try { stopDesktopHelper() } catch (err3) {}
      })
    } catch (err) {
      /* ignore */
    }
  },
}
