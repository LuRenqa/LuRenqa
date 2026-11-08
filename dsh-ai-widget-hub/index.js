/**
 * dsh-ai-widget-hub —— Host 半。
 *
 * 职责（SPEC §5）：
 *   GET  /dsh-ai-hub/state        —— 8 只挂件的目录 + 运行期开关状态（来自 pluginManager）
 *   POST /dsh-ai-hub/toggle       —— { id, enabled } 热开关一只挂件
 *   GET  /dsh-ai-hub/icon/<id>.png —— 卡片头像（本包 assets/icons/）
 *
 * 安全：三条路由统一走「回环 Host + 同源 + 委托 connection.requestRejection」的
 * fail-closed 栅栏（与 dsh 自带的 /open-in-app/* 做法一致）。
 *
 * 不写任何状态文件：开关的持久化就是 profile 的 cordis.patch.yml（由 pluginManager 维护）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { WIDGETS, findWidget } from './catalog.js'

/** 包根目录（由本文件位置推导，不写死绝对路径）。 */
const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const ICON_DIR = path.join(PKG_ROOT, 'assets', 'icons')

const STATE_PATH = '/dsh-ai-hub/state'
const TOGGLE_PATH = '/dsh-ai-hub/toggle'
/** 前缀路由：只用于未知图标 id 的 404 兜底（exact 路由优先，见 dsh-host-webserver 的 match()）。 */
const ICON_PREFIX = '/dsh-ai-hub/icon'

const MAX_BODY_BYTES = 16 * 1024

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

/** 405 + Allow 头。 */
function sendMethodNotAllowed(res, allow) {
  try {
    res.setHeader('Allow', allow)
  } catch (err) {
    /* ignore */
  }
  sendText(res, 405, 'method not allowed')
}

/** 收集有界请求体（UTF-8）；超限 / 空体 / 非法 JSON 都抛带 code 的 Error。 */
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
// 信任栅栏（fail-closed）
// ---------------------------------------------------------------------------

/** 回环 hostname：localhost / *.localhost / 127.0.0.0/8 / ::1（逐段校验，防相似域名）。 */
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

/** 供外部单测/自检使用的 Host 头判定（含端口）。 */
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

/**
 * 返回应拒绝的 HTTP 状态码，放行返回 null。
 *   ① Host 必须是回环（缺失/畸形/非回环 → 403）
 *   ② sec-fetch-site: cross-site → 403
 *   ③ 带 Origin 时必须与 Host 同源（"null" 也拒）→ 否则 403
 *   ④ 有 connection.requestRejection 就**也**委托它（返回非空即拒；它抛异常 → 403）
 * 任何一步自身出错 → 403（fail-closed）。
 */
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
// pluginManager 读取（对返回值形状做容错）
// ---------------------------------------------------------------------------

/** 兼容「直接返回数组」与「返回 { entries: [...] }」两种形状。 */
function asList(value, key) {
  if (Array.isArray(value)) return value
  if (value !== null && typeof value === 'object' && Array.isArray(value[key])) return value[key]
  return []
}

export default {
  name: 'ai-widget-hub',

  apply(ctx) {
    // 可选服务缺失时保持不激活（不抛错，不阻塞宿主启动）。
    try {
      if (typeof ctx.inject !== 'function') return
      ctx.inject(['webServer', 'pluginManager'], (svc) => {
        const disposers = []
        const logger = (() => {
          try {
            return svc.logger
          } catch (err) {
            return undefined
          }
        })()
        const warn = (message) => {
          try {
            logger?.warn?.(message)
          } catch (err) {
            /* ignore */
          }
        }

        /** 注册一条路由并收集清理函数；重复注册等异常只告警，不影响其它路由。 */
        function register(kind, pathname, handler) {
          try {
            const dispose = svc.webServer.register({ kind, path: pathname, handler })
            if (typeof dispose === 'function') disposers.push(dispose)
          } catch (err) {
            warn('[ai-widget-hub] 路由注册失败 ' + kind + ' ' + pathname + ': ' + String((err && err.message) || err))
          }
        }

        // ---- 统一带栅栏的包装 ----
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

        // ---- 状态快照 ----
        async function listEntries() {
          const raw = await svc.pluginManager.listPlugins()
          return asList(raw, 'entries').filter(
            (entry) => entry !== null && typeof entry === 'object' && typeof entry.moduleName === 'string',
          )
        }

        async function buildState() {
          const [entries, bundles] = await Promise.all([
            listEntries(),
            (async () => asList(await svc.pluginManager.listBundles(), 'bundles'))(),
          ])
          const entryByModule = new Map()
          for (const entry of entries) {
            if (!entryByModule.has(entry.moduleName)) entryByModule.set(entry.moduleName, entry)
          }
          const versionByModule = new Map()
          for (const bundle of bundles) {
            if (bundle === null || typeof bundle !== 'object' || typeof bundle.name !== 'string') continue
            const version = typeof bundle.version === 'string' && bundle.version !== '' ? bundle.version : '0.0.0'
            if (!versionByModule.has(bundle.name)) versionByModule.set(bundle.name, version)
          }
          return {
            ok: true,
            widgets: WIDGETS.map((widget) => {
              const entry = entryByModule.get(widget.moduleName)
              const installed = entry !== undefined
              return {
                id: widget.id,
                title: widget.title,
                subtitle: widget.subtitle,
                description: widget.description,
                accent: widget.accent,
                route: widget.route,
                script: widget.script,
                rootClass: widget.rootClass,
                iconUrl: ICON_PREFIX + '/' + widget.id + '.png',
                installed,
                enabled: installed ? entry.enabled === true : false,
                fiberPhase: installed ? (entry.fiberPhase ?? null) : null,
                entryId: installed ? entry.entryId : null,
                version: versionByModule.get(widget.moduleName) || '0.0.0',
                readOnlyReason: installed && typeof entry.readOnlyReason === 'string' ? entry.readOnlyReason : null,
              }
            }),
          }
        }

        // ---- 图标字节（按文件名缓存；文件不存在时抛错 → 404） ----
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

        // ---- GET /dsh-ai-hub/state ----
        register(
          'exact',
          STATE_PATH,
          routed(async (req, res) => {
            const method = String((req && req.method) || 'GET').toUpperCase()
            if (method !== 'GET' && method !== 'HEAD') {
              sendMethodNotAllowed(res, 'GET, HEAD')
              return
            }
            try {
              const state = await buildState()
              if (method === 'HEAD') {
                try {
                  res.statusCode = 200
                  res.setHeader('Cache-Control', 'no-store')
                  res.end()
                } catch (err) {
                  /* ignore */
                }
                return
              }
              sendJson(res, 200, state)
            } catch (err) {
              sendJson(res, 500, {
                ok: false,
                error: { code: 'state-failed', message: String((err && err.message) || err) },
              })
            }
          }),
        )

        // ---- POST /dsh-ai-hub/toggle ----
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

            // 1) 按 moduleName 找当前运行期条目（entryId 不写死）
            let entry
            try {
              const entries = await listEntries()
              entry = entries.find((candidate) => candidate.moduleName === widget.moduleName)
            } catch (err) {
              sendJson(res, 200, {
                ok: false,
                id: widget.id,
                error: { code: 'state-failed', message: String((err && err.message) || err) },
              })
              return
            }
            if (entry === undefined) {
              sendJson(res, 200, {
                ok: false,
                id: widget.id,
                error: { code: 'not-installed', message: widget.title + ' 对应的挂件插件未安装或未启用' },
              })
              return
            }

            // 2) 热开关（ChangeResult 可能在 body 里报告 failed，也可能直接抛）
            let result
            try {
              result = await svc.pluginManager.setPluginEnabled(entry.entryId, payload.enabled)
            } catch (err) {
              const code = err && typeof err.code === 'string' ? err.code : 'toggle-failed'
              sendJson(res, 200, {
                ok: false,
                id: widget.id,
                changed: false,
                application: 'failed',
                enabled: payload.enabled,
                error: { code, message: String((err && err.message) || err) },
              })
              return
            }

            const changed = !!(result && result.changed === true)
            const application = result && typeof result.application === 'string' ? result.application : 'failed'
            const warnings = result && Array.isArray(result.warnings) ? result.warnings : []
            if (application === 'failed' || (result && result.error !== undefined && result.error !== null)) {
              const failure = (result && result.error) || {}
              sendJson(res, 200, {
                ok: false,
                id: widget.id,
                changed,
                application,
                enabled: payload.enabled,
                warnings,
                error: {
                  code: typeof failure.code === 'string' ? failure.code : 'toggle-failed',
                  message:
                    typeof failure.diagnostic === 'string' && failure.diagnostic !== ''
                      ? failure.diagnostic
                      : 'pluginManager 未能应用这次开关改动',
                },
              })
              return
            }

            // 3) 回读一次实际状态（application 可能是 overridden / restart-required）
            let effectiveEnabled = payload.enabled
            let effectivePhase = null
            try {
              const entries = await listEntries()
              const refreshed = entries.find((candidate) => candidate.moduleName === widget.moduleName)
              if (refreshed !== undefined) {
                effectiveEnabled = refreshed.enabled === true
                effectivePhase = refreshed.fiberPhase ?? null
              }
            } catch (err) {
              /* 回读失败不影响结果：用请求值 */
            }

            sendJson(res, 200, {
              ok: true,
              id: widget.id,
              changed,
              application,
              enabled: effectiveEnabled,
              warnings,
              fiberPhase: effectivePhase,
            })
          }),
        )

        // ---- GET /dsh-ai-hub/icon/<id>.png（每个目录项一条 exact 路由） ----
        for (const widget of WIDGETS) {
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

        // ---- 未知图标 id 的 404 兜底（prefix 只在 exact 未命中时生效） ----
        register(
          'prefix',
          ICON_PREFIX,
          routed((req, res) => {
            sendText(res, 404, 'icon not found')
          }),
        )

        // 插件卸载/热重载时撤销全部路由
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
      // 兜底：插件初始化异常不应拖垮宿主（路由可能没注册，UI 会显示错误条）
      try {
        ctx.logger?.warn?.('[ai-widget-hub] 初始化失败：' + String((err && err.message) || err))
      } catch (err2) {
        /* ignore */
      }
    }
  },
}
