/**
 * dsh-ai-widget-hub —— 浏览器半侧（Client）
 * ============================================================================
 * 在 DSH Web UI 左侧栏注册一个「AI娘」入口，打开后是一页「AI娘挂件中心」：
 * 把全部余额桌宠（AI娘）列成卡片，每张卡片一个开关，开关即时生效。
 *
 * 数据全部来自 Host 半（index.js）提供的 HTTP API：
 *   GET  /dsh-ai-hub/state   -> { ok:true, widgets:[...] }
 *   POST /dsh-ai-hub/toggle  -> { ok:true, id, changed, application, enabled, warnings }
 *
 * 实时隐藏/显示的做法：
 *   Host 热开关插件行后，页面里已存在的桌宠 DOM 不会自己消失。所以本文件在
 *   <head> 里维护一份全局样式 `html.dshaihub-off-<id> <rootClass>{display:none}`
 *   并给 <html> 加/减 `dshaihub-off-<id>`：关闭立即隐藏；开启时移除 class，
 *   如果页面里没有该桌宠的 DOM（本次加载时它是关的，Host 没注入脚本），
 *   再补一个 <script src=script> 把它加载起来。
 *
 * 写法约束（见 SPEC.md）：
 *   - 普通 ModuleLoader bundle，无构建步骤、无 import、无 JSX，用 React.createElement；
 *   - 不使用任何 @deepseek-ai client 包；
 *   - 只把全局 <style> 和被注入的挂件脚本放到 document 上，页面 UI 交给插槽渲染。
 */
window.__ModuleLoader__.load({
  id: 'dsh-ai-widget-hub',
  factory: function (require) {
    var React = require('react');
    var h = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useMemo = React.useMemo;
    var useRef = React.useRef;

    /* ── 常量 ─────────────────────────────────────────────────────────────── */
    var NS = 'aiWidgetHub';
    var API_STATE = '/dsh-ai-hub/state';
    var API_TOGGLE = '/dsh-ai-hub/toggle';
    var OFF_PREFIX = 'dshaihub-off-';
    var POLL_MS = 5000;

    /* ── 兜底目录 ──────────────────────────────────────────────────────────
       第一次 state 请求返回之前（或请求失败时），全局隐藏样式需要一份 rootClass
       才能生成。这里照 SPEC §3 的表写死，state 到达后被 Host 的权威数据替换。 */
    var FALLBACK_WIDGETS = [
      { id: 'neko', rootClass: '.dshnkv-root' },
      { id: 'kimi', rootClass: '.dshkmv-root' },
      { id: 'glm', rootClass: '.dshglv-root' },
      { id: 'qwen', rootClass: '.dshqwv-root' },
      { id: 'grok', rootClass: '.dshgkv-root' },
      { id: 'whale', rootClass: '.dshwv-root' },
      { id: 'xiaoke', rootClass: '.dshxkv-root' },
      { id: 'gptniang', rootClass: '.dshgnv-root' },
    ];

    /* ── 文案（zh 为内置兜底，en 随语言切换） ─────────────────────────────── */
    var DICT = {
      zh: {
        sidebarLabel: 'AI娘',
        pageTitle: 'AI娘挂件中心',
        pageSubtitle: '选择要在右下角显示的余额桌宠，开关即时生效，下次启动沿用',
        searchPlaceholder: '搜索挂件名称或风格…',
        searchLabel: '搜索挂件',
        enableAll: '全部开启',
        disableAll: '全部关闭',
        refresh: '刷新',
        working: '处理中…',
        loading: '正在读取挂件状态…',
        statusEnabled: '启用中',
        statusDisabled: '已关闭',
        statusMissing: '未安装',
        missingHint: '未检测到这只挂件的插件，请先在插件市场安装。',
        descFallback: '余额 / 今日已用 / 峰谷时段 / 每轮消耗，点她会冒泡泡。',
        loadErrorTitle: '读取挂件状态失败',
        loadErrorHint: '插件宿主服务没有响应。请确认插件包已安装并启用，然后重试。',
        retry: '重试',
        emptyTitle: '没有匹配的挂件',
        emptyHint: '换个关键词试试，或者清空搜索框。',
        clearSearch: '清空搜索',
        noticeRestart: '开关已提交，但未能即时生效，可能需要重启 DSH 后再看。',
        noticeFailed: '切换失败：{message}',
        noticeWarnings: '已切换，但有提示：{message}',
        bulkDone: '已更新 {n} 只挂件。',
        bulkNone: '没有需要切换的挂件。',
        bulkFailed: '有 {n} 只挂件未能即时生效。',
        crashTitle: 'AI娘挂件中心面板出错了',
        crashHint: '页面其它部分不受影响。可以重置面板再试一次。',
        resetPanel: '重置面板',
      },
      en: {
        sidebarLabel: 'AI Widgets',
        pageTitle: 'AI Widget Hub',
        pageSubtitle: 'Choose which balance pet appears in the bottom-right corner. Toggles apply instantly and persist across launches.',
        searchPlaceholder: 'Search widgets by name or style…',
        searchLabel: 'Search widgets',
        enableAll: 'Enable all',
        disableAll: 'Disable all',
        refresh: 'Refresh',
        working: 'Working…',
        loading: 'Loading widget status…',
        statusEnabled: 'Enabled',
        statusDisabled: 'Off',
        statusMissing: 'Not installed',
        missingHint: 'This widget plugin is not installed. Install it from the plugin market first.',
        descFallback: 'Balance / used today / peak-off-peak / per-turn cost. Click her for a bubble.',
        loadErrorTitle: 'Could not read widget status',
        loadErrorHint: 'The host service did not respond. Make sure the plugin bundle is installed and enabled, then retry.',
        retry: 'Retry',
        emptyTitle: 'No matching widgets',
        emptyHint: 'Try a different keyword, or clear the search box.',
        clearSearch: 'Clear search',
        noticeRestart: 'The switch was submitted but did not take effect immediately. You may need to restart DSH.',
        noticeFailed: 'Could not switch this widget: {message}',
        noticeWarnings: 'Switch applied with a warning: {message}',
        bulkDone: 'Updated {n} widget(s).',
        bulkNone: 'Nothing to change.',
        bulkFailed: 'Could not switch {n} widget(s) right away.',
        crashTitle: 'The AI Widget Hub panel hit an error',
        crashHint: 'The rest of the app is unaffected. Reset the panel to try again.',
        resetPanel: 'Reset panel',
      },
    };

    /* ctx.locale 存在时在 apply() 里绑定；没有 locale 服务就始终用 zh 兜底。 */
    var boundT = null;

    function formatParams(text, params) {
      return String(text).replace(/\{(\w+)\}/g, function (match, name) {
        return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
      });
    }

    /** 统一取文案：优先 locale 服务，拿不到 / 缺 key 时退回内置中文。 */
    function t(key, params) {
      var text = null;
      if (boundT) {
        try {
          text = boundT(key, params);
        } catch (err) {
          text = null;
        }
      }
      if (text === null || text === undefined || text === key) {
        var dict = DICT.zh;
        text = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
        if (params) text = formatParams(text, params);
      }
      return text;
    }

    /* ── 样式 ─────────────────────────────────────────────────────────────── */
    var GATE_ATTR = 'data-dshaihub-gate';
    var STYLE_ATTR = 'data-dshaihub-style';
    var gateStyleEl = null;

    var UI_CSS = [
      /* 页面容器：铺满主面板、自己滚动；顶部让出桌面端标题栏 */
      '.dshaihub-page{box-sizing:border-box;height:100%;overflow:auto;padding:24px 28px;',
      'padding-top:calc(24px + var(--dsh-frame-top-clearance,0px));',
      'color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.5;',
      '--dshaihub-border:var(--dsw-alias-border-l1,rgba(127,127,127,.16));',
      '--dshaihub-border-strong:var(--dsw-alias-border-l2,rgba(127,127,127,.24));',
      '--dshaihub-layer1:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));',
      '--dshaihub-layer2:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));',
      '--dshaihub-layer3:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.16));',
      '--dshaihub-hover:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));',
      '--dshaihub-primary:var(--dsw-alias-state-business-primary,#4d6bfe);',
      '--dshaihub-success:var(--dsw-alias-state-success-primary,#2ea043);',
      '--dshaihub-idle:var(--dsw-alias-state-idle-primary,#8b949e);',
      '--dshaihub-error:var(--dsw-alias-state-error-primary,#e5534b);',
      '--dshaihub-warn:var(--dsw-alias-state-warn-primary,#d29922);',
      '--dshaihub-label2:var(--dsw-alias-label-secondary,#57606a);',
      '--dshaihub-label3:var(--dsw-alias-label-tertiary,#8b949e);}',
      '.dshaihub-pageInner{box-sizing:border-box;max-width:980px;min-height:100%;margin:0 auto;display:flex;flex-direction:column;gap:18px}',
      /* 页头 */
      '.dshaihub-head{display:flex;flex-direction:column;gap:5px}',
      '.dshaihub-title{margin:0;font-size:20px;font-weight:500;line-height:28px;letter-spacing:-.01em}',
      '.dshaihub-subtitle{margin:0;font-size:13px;line-height:20px;color:var(--dshaihub-label2)}',
      /* 工具栏 */
      '.dshaihub-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.dshaihub-search{position:relative;flex:1 1 200px;min-width:160px;display:flex;align-items:center}',
      '.dshaihub-searchIcon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--dshaihub-label3);display:flex;pointer-events:none}',
      '.dshaihub-input{box-sizing:border-box;width:100%;height:32px;padding:0 10px 0 30px;font:inherit;font-size:13px;',
      'color:var(--dsw-alias-label-primary,inherit);background:var(--dshaihub-layer1);border:1px solid var(--dshaihub-border-strong);',
      'border-radius:8px;outline:none}',
      '.dshaihub-input::placeholder{color:var(--dshaihub-label3)}',
      '.dshaihub-input:focus{border-color:var(--dshaihub-primary)}',
      '.dshaihub-actions{display:flex;flex-wrap:wrap;align-items:center;gap:6px}',
      '.dshaihub-btn{box-sizing:border-box;height:32px;padding:0 12px;font:inherit;font-size:13px;display:inline-flex;',
      'align-items:center;justify-content:center;gap:6px;border-radius:8px;border:1px solid var(--dshaihub-border-strong);',
      'background:var(--dshaihub-layer1);color:var(--dsw-alias-label-primary,inherit);cursor:pointer;white-space:nowrap}',
      '.dshaihub-btn:hover:not(:disabled){background:var(--dshaihub-hover)}',
      '.dshaihub-btn:disabled{opacity:.5;cursor:default}',
      '.dshaihub-btnDanger{border-color:var(--dshaihub-error);color:var(--dshaihub-error)}',
      '.dshaihub-page :focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dshaihub-primary));outline-offset:1px}',
      /* 卡片网格 */
      '.dshaihub-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch}',
      '@media (max-width:720px){.dshaihub-grid{grid-template-columns:1fr}}',
      '.dshaihub-card{box-sizing:border-box;display:flex;flex-direction:column;gap:10px;min-width:0;padding:14px;',
      'border:1px solid var(--dshaihub-border);border-radius:12px;background:var(--dshaihub-layer1);',
      'transition:border-color .16s ease}',
      '.dshaihub-card:hover{border-color:var(--dshaihub-border-strong)}',
      '.dshaihub-cardHead{display:flex;align-items:flex-start;gap:10px;min-width:0}',
      '.dshaihub-avatar{position:relative;box-sizing:border-box;flex:none;width:40px;height:40px;border-radius:12px;',
      'display:inline-flex;align-items:center;justify-content:center;overflow:hidden;',
      'border:1px solid var(--dshaihub-border-strong);background:var(--dshaihub-layer2)}',
      '.dshaihub-avatarImg{display:block;width:100%;height:100%;object-fit:cover}',
      '.dshaihub-avatarLetter{font-size:15px;font-weight:600;line-height:1}',
      '.dshaihub-cardBody{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}',
      '.dshaihub-cardTitleRow{display:flex;align-items:baseline;gap:6px;min-width:0}',
      '.dshaihub-cardTitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600;line-height:20px}',
      '.dshaihub-version{flex:none;font-size:11px;line-height:14px;color:var(--dshaihub-label3);font-variant-numeric:tabular-nums}',
      '.dshaihub-cardSubtitle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;color:var(--dshaihub-label2)}',
      '.dshaihub-desc{display:-webkit-box;margin:0;min-height:36px;overflow:hidden;font-size:12.5px;line-height:18px;',
      'color:var(--dshaihub-label3);-webkit-line-clamp:2;-webkit-box-orient:vertical}',
      '.dshaihub-cardFoot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:2px}',
      '.dshaihub-status{display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:12px;line-height:16px;color:var(--dshaihub-label2)}',
      '.dshaihub-statusText{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshaihub-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dshaihub-idle)}',
      '.dshaihub-card[data-on="true"] .dshaihub-dot{background:var(--dshaihub-success)}',
      '.dshaihub-card[data-missing="true"] .dshaihub-dot{background:var(--dshaihub-label3);opacity:.7}',
      /* 自绘开关 */
      '.dshaihub-switch{position:relative;box-sizing:border-box;flex:none;width:36px;height:20px;padding:0;',
      'border:1px solid var(--dshaihub-border-strong);border-radius:999px;background:var(--dshaihub-layer3);cursor:pointer;',
      'transition:background .16s ease,border-color .16s ease}',
      '.dshaihub-switchOn{background:var(--dshaihub-primary);border-color:var(--dshaihub-primary)}',
      '.dshaihub-switch:disabled{opacity:.45;cursor:default}',
      '.dshaihub-switchThumb{position:absolute;top:1px;left:1px;width:16px;height:16px;border-radius:50%;',
      'background:var(--dsw-alias-switch-thumb,#fff);box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .16s ease}',
      '.dshaihub-switchOn .dshaihub-switchThumb{transform:translateX(16px)}',
      /* 错误条 / 提示条 */
      '.dshaihub-error{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;',
      'padding:10px 12px;border:1px solid var(--dshaihub-error);border-radius:10px;background:var(--dshaihub-layer1)}',
      '.dshaihub-errorBody{display:flex;flex:1 1 240px;flex-direction:column;gap:2px;min-width:0}',
      '.dshaihub-errorTitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
      '.dshaihub-errorHint{font-size:12px;line-height:18px;color:var(--dshaihub-label3);word-break:break-word}',
      '.dshaihub-notice{padding:9px 12px;border:1px solid var(--dshaihub-border-strong);border-radius:10px;',
      'background:var(--dshaihub-layer1);font-size:12.5px;line-height:18px;color:var(--dshaihub-label2);word-break:break-word}',
      '.dshaihub-noticeOk{border-color:var(--dshaihub-success)}',
      '.dshaihub-noticeWarn{border-color:var(--dshaihub-warn)}',
      '.dshaihub-noticeError{border-color:var(--dshaihub-error)}',
      /* 空态 */
      '.dshaihub-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;',
      'padding:48px 20px;border:1px dashed var(--dshaihub-border-strong);border-radius:14px;text-align:center}',
      '.dshaihub-emptyTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
      '.dshaihub-emptyHint{max-width:360px;font-size:12.5px;line-height:18px;color:var(--dshaihub-label3)}',
      '.dshaihub-emptyAction{margin-top:4px}',
      /* 骨架屏 */
      '.dshaihub-cardSkeleton{pointer-events:none}',
      '.dshaihub-skLine{display:block;height:10px;border-radius:6px;',
      'background:var(--dsw-alias-bg-skeleton,var(--dshaihub-layer2));animation:dshaihub-skeleton 1.4s ease-in-out infinite}',
      '.dshaihub-skAvatar{border-color:transparent;background:var(--dsw-alias-bg-skeleton,var(--dshaihub-layer2))}',
      '.dshaihub-skTitle{width:56%;height:12px}',
      '.dshaihub-skSub{width:38%;height:10px}',
      '.dshaihub-skDesc{width:92%}',
      '.dshaihub-skDesc2{width:70%}',
      '@keyframes dshaihub-skeleton{0%,100%{opacity:.6}50%{opacity:1}}',
      '@media (prefers-reduced-motion:reduce){.dshaihub-skLine{animation:none}',
      '.dshaihub-switch,.dshaihub-switchThumb{transition:none}}',
    ].join('\n');

    /** 用一份 widgets 目录生成全局隐藏规则；没有数据时用兜底表。 */
    function buildGateCss(list) {
      var items = (list && list.length) ? list : FALLBACK_WIDGETS;
      var rules = [];
      for (var i = 0; i < items.length; i++) {
        var w = items[i];
        if (!w || !w.id || !w.rootClass) continue;
        rules.push('html.' + OFF_PREFIX + w.id + ' ' + w.rootClass + '{display:none!important}');
      }
      return rules.join('\n');
    }

    /** 把 Host 的权威 rootClass 写回全局隐藏样式（幂等）。 */
    function applyGateRules(list) {
      try {
        var el = gateStyleEl || document.querySelector('style[' + GATE_ATTR + ']');
        if (!el) return;
        var next = buildGateCss(list);
        if (el.textContent !== next) el.textContent = next;
        gateStyleEl = el;
      } catch (err) {
        /* 样式补写失败不影响 UI */
      }
    }

    /** 按每只挂件的 enabled 状态同步 <html> 上的隐藏 class。 */
    function applyGateClasses(list) {
      try {
        var root = document.documentElement;
        if (!root || !root.classList) return;
        for (var i = 0; i < list.length; i++) {
          var w = list[i];
          if (!w || !w.id) continue;
          var cls = OFF_PREFIX + w.id;
          if (w.installed === false || w.enabled === true) root.classList.remove(cls);
          else root.classList.add(cls);
        }
      } catch (err) {
        /* 隐藏失败只影响临时视觉效果，不抛给插槽 */
      }
    }

    /* ── 网络 ─────────────────────────────────────────────────────────────── */
    function errorMessage(err) {
      if (err === null || err === undefined) return 'unknown error';
      if (typeof err === 'string') return err;
      if (err.message) return String(err.message);
      return String(err);
    }

    function fetchState() {
      return fetch(API_STATE, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (err) {
            data = null;
          }
          if (!res.ok) throw new Error('HTTP ' + res.status + (res.statusText ? ' ' + res.statusText : ''));
          if (!data || data.ok !== true || !Array.isArray(data.widgets)) {
            throw new Error('unexpected state payload');
          }
          return data.widgets;
        });
      });
    }

    function requestToggle(id, enabled) {
      return fetch(API_TOGGLE, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: id, enabled: enabled === true }),
      }).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (err) {
            data = null;
          }
          if (!res.ok) {
            var httpMessage = data && data.error && data.error.message ? data.error.message : 'HTTP ' + res.status;
            throw new Error(httpMessage);
          }
          if (!data || data.ok !== true) {
            var message = data && data.error && data.error.message ? data.error.message : 'toggle rejected';
            throw new Error(message);
          }
          return data;
        });
      });
    }

    /* ── 小工具 ───────────────────────────────────────────────────────────── */
    var HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

    /** 把 #rgb / #rrggbb 转成 rgba()，用来给头像做淡色底；非法色回退到中性。 */
    function accentAlpha(hex, alpha) {
      if (typeof hex === 'string' && HEX_RE.test(hex)) {
        var raw = hex.slice(1);
        if (raw.length === 3) raw = raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2];
        var num = parseInt(raw, 16);
        var r = (num >> 16) & 255;
        var g = (num >> 8) & 255;
        var b = num & 255;
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
      }
      return 'rgba(127,127,127,' + alpha + ')';
    }

    function safeAccent(value) {
      return (typeof value === 'string' && HEX_RE.test(value)) ? value : '#8e75f0';
    }

    function textOf(value) {
      return (typeof value === 'string') ? value : '';
    }

    /** Host 数据 -> UI 内部结构；坏条目直接丢掉，绝不让一页崩掉。 */
    function normalizeWidgets(rawList) {
      var out = [];
      if (!Array.isArray(rawList)) return out;
      for (var i = 0; i < rawList.length; i++) {
        var raw = rawList[i];
        if (!raw || typeof raw !== 'object') continue;
        var id = textOf(raw.id);
        if (!id) continue;
        var fallbackRoot = '';
        for (var j = 0; j < FALLBACK_WIDGETS.length; j++) {
          if (FALLBACK_WIDGETS[j].id === id) { fallbackRoot = FALLBACK_WIDGETS[j].rootClass; break; }
        }
        out.push({
          id: id,
          title: textOf(raw.title) || id,
          subtitle: textOf(raw.subtitle),
          description: textOf(raw.description),
          accent: safeAccent(raw.accent),
          route: textOf(raw.route),
          script: textOf(raw.script),
          rootClass: textOf(raw.rootClass) || fallbackRoot,
          iconUrl: textOf(raw.iconUrl),
          installed: raw.installed !== false,
          // 未安装的挂件一律按「关闭」展示，避免出现禁用却显示「已开启」的怪状态
          enabled: raw.installed !== false && raw.enabled === true,
          version: textOf(raw.version),
          entryId: textOf(raw.entryId),
          fiberPhase: textOf(raw.fiberPhase),
        });
      }
      return out;
    }

    /**
     * 页面里没有该挂件 DOM、且切换已真正生效时，补加载它的脚本。
     * 只补一次：用 <script data-dshaihub=id> 去重；失败静默（不打断整个页面）。
     */
    var scriptLoading = {};

    function ensureWidgetScript(widget) {
      try {
        if (!widget || !widget.id || !widget.script) return;
        if (scriptLoading[widget.id]) return;
        if (document.querySelector('script[data-dshaihub="' + widget.id + '"]')) return;
        if (widget.rootClass && document.querySelector(widget.rootClass)) return;
        var el = document.createElement('script');
        el.src = widget.script;
        el.async = false;
        el.setAttribute('data-dshaihub', widget.id);
        scriptLoading[widget.id] = true;
        var done = function () { scriptLoading[widget.id] = false; };
        el.addEventListener('load', done);
        el.addEventListener('error', function () {
          done();
          // 脚本拿不到就撤掉标签，下次再点开关还能重试
          try { if (el.parentNode) el.parentNode.removeChild(el); } catch (err) { /* noop */ }
        });
        (document.body || document.documentElement).appendChild(el);
      } catch (err) {
        /* 补加载失败不影响开关本身 */
      }
    }

    /** 服务端权威数据合并本地「正在切换中」的乐观值，避免 5s 轮询把开关打回去。 */
    function mergePending(serverList, pendingMap, localList) {
      var localById = {};
      for (var i = 0; i < localList.length; i++) localById[localList[i].id] = localList[i];
      var out = [];
      for (var j = 0; j < serverList.length; j++) {
        var w = serverList[j];
        var local = localById[w.id];
        if (pendingMap[w.id] && local) {
          var copy = {};
          for (var key in w) {
            if (Object.prototype.hasOwnProperty.call(w, key)) copy[key] = w[key];
          }
          copy.enabled = local.enabled;
          out.push(copy);
        } else {
          out.push(w);
        }
      }
      return out;
    }

    /* ── 图标 ─────────────────────────────────────────────────────────────── */

    /** 左侧栏入口图标：两只猫耳 + 一颗星，currentColor 跟随主题。 */
    function HubSidebarIcon(props) {
      var size = (props && props.size) ? props.size : 20;
      var color = (props && props.active) ? 'var(--dsw-alias-brand-primary,currentColor)' : 'currentColor';
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': 'true', focusable: 'false',
        style: { display: 'block', color: color },
      },
        h('path', {
          d: 'M4.9 9.2 4.1 4.1 8.8 6.5h6.4l4.7-2.4-.8 5.1v6.5a3.5 3.5 0 0 1-3.5 3.5H8.4a3.5 3.5 0 0 1-3.5-3.5Z',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M12 10.5l.95 1.95 2.15.31-1.55 1.51.37 2.13L12 15.4l-1.92 1 .37-2.13-1.55-1.51 2.15-.31z',
          fill: 'currentColor',
        })
      );
    }

    function SearchIcon() {
      return h('svg', {
        className: 'dshaihub-searchIcon', width: 14, height: 14, viewBox: '0 0 16 16',
        fill: 'none', 'aria-hidden': 'true', focusable: 'false',
      },
        h('circle', { cx: 7, cy: 7, r: 4.4, stroke: 'currentColor', strokeWidth: 1.4 }),
        h('path', { d: 'M10.4 10.4 14 14', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' })
      );
    }

    /* ── 组件 ─────────────────────────────────────────────────────────────── */

    /** 40px 圆角头像：优先 iconUrl，加载失败用标题首字兜底，描边用挂件强调色。 */
    function WidgetAvatar(props) {
      var widget = props.widget;
      var failedState = useState(false);
      var failed = failedState[0];
      var setFailed = failedState[1];
      var accent = widget.accent;

      var inner;
      if (widget.iconUrl && !failed) {
        inner = h('img', {
          className: 'dshaihub-avatarImg',
          src: widget.iconUrl,
          alt: '',
          draggable: false,
          loading: 'lazy',
          onError: function () { setFailed(true); },
        });
      } else {
        inner = h('span', {
          className: 'dshaihub-avatarLetter',
          style: { color: accent },
        }, (widget.title || widget.id).slice(0, 1));
      }

      return h('span', {
        className: 'dshaihub-avatar',
        'aria-hidden': 'true',
        style: { borderColor: accent, backgroundColor: accentAlpha(accent, 0.12) },
      }, inner);
    }

    /**
     * 自绘开关。用原生 <button role="switch">：Space / Enter 由浏览器直接翻译成
     * click，既能被键盘操作，也保留 disabled 语义，不需要自己写 keydown 双触发。
     */
    function ToggleSwitch(props) {
      var checked = props.checked === true;
      var disabled = props.disabled === true;
      return h('button', {
        type: 'button',
        role: 'switch',
        'aria-checked': checked ? 'true' : 'false',
        'aria-label': props.label,
        title: props.label,
        disabled: disabled,
        className: 'dshaihub-switch' + (checked ? ' dshaihub-switchOn' : ''),
        onClick: function () {
          if (!disabled) props.onChange(!checked);
        },
      }, h('span', { className: 'dshaihub-switchThumb', 'aria-hidden': 'true' }));
    }

    /** 一张挂件卡片。 */
    function WidgetCard(props) {
      var widget = props.widget;
      var busy = props.busy === true;
      var installed = widget.installed !== false;
      var enabled = widget.enabled === true;
      var statusText = !installed ? t('statusMissing') : (enabled ? t('statusEnabled') : t('statusDisabled'));
      var version = (widget.version && widget.version !== '0.0.0') ? ('v' + widget.version) : '';

      return h('article', {
        className: 'dshaihub-card',
        'data-on': enabled ? 'true' : 'false',
        'data-missing': installed ? 'false' : 'true',
      },
        h('div', { className: 'dshaihub-cardHead' },
          h(WidgetAvatar, { widget: widget }),
          h('div', { className: 'dshaihub-cardBody' },
            h('div', { className: 'dshaihub-cardTitleRow' },
              h('span', { className: 'dshaihub-cardTitle', title: widget.title }, widget.title),
              version ? h('span', { className: 'dshaihub-version' }, version) : null
            ),
            h('span', { className: 'dshaihub-cardSubtitle', title: widget.subtitle || undefined }, widget.subtitle)
          )
        ),
        h('p', { className: 'dshaihub-desc' }, widget.description || t('descFallback')),
        h('div', { className: 'dshaihub-cardFoot' },
          h('span', { className: 'dshaihub-status' },
            h('span', { className: 'dshaihub-dot', 'aria-hidden': 'true' }),
            h('span', { className: 'dshaihub-statusText' }, statusText)
          ),
          h(ToggleSwitch, {
            checked: enabled,
            disabled: !installed || busy,
            label: widget.title + ' · ' + statusText,
            onChange: function (next) { props.onToggle(widget, next); },
          })
        )
      );
    }

    function SkeletonCard() {
      return h('div', { className: 'dshaihub-card dshaihub-cardSkeleton', 'aria-hidden': 'true' },
        h('div', { className: 'dshaihub-cardHead' },
          h('span', { className: 'dshaihub-avatar dshaihub-skAvatar' }),
          h('div', { className: 'dshaihub-cardBody' },
            h('span', { className: 'dshaihub-skLine dshaihub-skTitle' }),
            h('span', { className: 'dshaihub-skLine dshaihub-skSub' })
          )
        ),
        h('span', { className: 'dshaihub-skLine dshaihub-skDesc' }),
        h('span', { className: 'dshaihub-skLine dshaihub-skDesc2' })
      );
    }

    function ErrorBar(props) {
      return h('div', { className: 'dshaihub-error', role: 'alert' },
        h('div', { className: 'dshaihub-errorBody' },
          h('div', { className: 'dshaihub-errorTitle' }, props.title),
          props.hint ? h('div', { className: 'dshaihub-errorHint' }, props.hint) : null
        ),
        h('button', {
          type: 'button',
          className: 'dshaihub-btn',
          onClick: props.onRetry,
          disabled: props.busy === true,
        }, props.retryLabel)
      );
    }

    function EmptyState(props) {
      return h('div', { className: 'dshaihub-empty' },
        h('div', { className: 'dshaihub-emptyTitle' }, props.title),
        props.hint ? h('div', { className: 'dshaihub-emptyHint' }, props.hint) : null,
        props.action ? h('div', { className: 'dshaihub-emptyAction' }, props.action) : null
      );
    }

    /* ── 主面板 ───────────────────────────────────────────────────────────── */

    function HubPageInner() {
      var phaseState = useState('loading'); // loading | ready | error
      var phase = phaseState[0];
      var setPhase = phaseState[1];
      var widgetState = useState([]);
      var widgets = widgetState[0];
      var setWidgets = widgetState[1];
      var errorState = useState('');
      var errorText = errorState[0];
      var setErrorText = errorState[1];
      var queryState = useState('');
      var query = queryState[0];
      var setQuery = queryState[1];
      var busyState = useState({});
      var busyIds = busyState[0];
      var setBusyIds = busyState[1];
      var bulkState = useState(''); // '' | 'on' | 'off'
      var bulk = bulkState[0];
      var setBulk = bulkState[1];
      var refreshState = useState(false);
      var refreshing = refreshState[0];
      var setRefreshing = refreshState[1];
      var noticeState = useState(null);
      var notice = noticeState[0];
      var setNotice = noticeState[1];

      // 异步回调里读最新值用 ref，避免闭包拿到过期 state
      var widgetsRef = useRef([]);
      var phaseRef = useRef('loading');
      var busyRef = useRef({});
      var bulkRef = useRef(false);
      var inflightRef = useRef(false);
      var aliveRef = useRef(true);

      function setPhaseBoth(next) {
        phaseRef.current = next;
        setPhase(next);
      }

      function commitWidgets(next) {
        widgetsRef.current = next;
        setWidgets(next);
      }

      function markBusy(id, on) {
        var map = {};
        var prev = busyRef.current;
        for (var key in prev) {
          if (Object.prototype.hasOwnProperty.call(prev, key)) map[key] = prev[key];
        }
        if (on) map[id] = true;
        else delete map[id];
        busyRef.current = map;
        setBusyIds(map);
      }

      function updateWidget(id, patch) {
        var source = widgetsRef.current;
        var next = [];
        for (var i = 0; i < source.length; i++) {
          var w = source[i];
          if (w.id !== id) {
            next.push(w);
          } else {
            var copy = {};
            for (var key in w) {
              if (Object.prototype.hasOwnProperty.call(w, key)) copy[key] = w[key];
            }
            for (var patchKey in patch) {
              if (Object.prototype.hasOwnProperty.call(patch, patchKey)) copy[patchKey] = patch[patchKey];
            }
            next.push(copy);
          }
        }
        commitWidgets(next);
      }

      /**
       * 拉一次状态。silent 用于轮询：失败时保留旧卡片、不弹错误条，避免每 5s 闪一下。
       */
      function load(options) {
        var opts = options || {};
        var manual = opts.manual === true;
        if (inflightRef.current) return;
        inflightRef.current = true;
        if (manual) setRefreshing(true);

        fetchState().then(function (rawList) {
          if (!aliveRef.current) return;
          var clean = normalizeWidgets(rawList);
          commitWidgets(mergePending(clean, busyRef.current, widgetsRef.current));
          applyGateRules(clean); // 用 Host 的权威 rootClass 重写全局隐藏样式
          applyGateClasses(widgetsRef.current);
          setErrorText('');
          setPhaseBoth('ready');
        }).catch(function (err) {
          if (!aliveRef.current) return;
          var message = errorMessage(err);
          var firstLoad = phaseRef.current === 'loading';
          if (firstLoad) {
            setPhaseBoth('error');
            setErrorText(message);
          } else if (manual) {
            // 已有数据时只有手动刷新才提示，轮询失败保持安静
            setErrorText(message);
          }
        }).then(function () {
          inflightRef.current = false;
          if (aliveRef.current && manual) setRefreshing(false);
        });
      }

      /**
       * 切一只挂件：先乐观更新（开关 + 即时隐藏/显示），再请求 Host；
       * 失败或 application !== 'applied' 时回滚并给提示。
       * 返回 { ok, fail }，供「全部开启/全部关闭」汇总。
       */
      function toggleWidget(widget, nextEnabled, silent) {
        if (!widget || !widget.id) return Promise.resolve({ ok: false, fail: false });
        if (widget.installed === false) return Promise.resolve({ ok: false, fail: false });
        if (busyRef.current[widget.id]) return Promise.resolve({ ok: false, fail: false });

        var prev = widget.enabled === true;
        var target = nextEnabled === true;
        if (prev === target) return Promise.resolve({ ok: true, fail: false });

        markBusy(widget.id, true);
        updateWidget(widget.id, { enabled: target });
        applyGateClasses(widgetsRef.current); // 关闭立即隐藏

        return requestToggle(widget.id, target).then(function (result) {
          if (!aliveRef.current) return { ok: true, fail: false };
          var actual = (typeof result.enabled === 'boolean') ? result.enabled : target;
          var application = (typeof result.application === 'string') ? result.application : 'applied';
          var warnings = result.warnings;

          if (application !== 'applied' || actual !== target) {
            // Host 说切换没即时落地（例如需要重启）：把 UI 回滚到切换前，别让开关说谎
            updateWidget(widget.id, { enabled: prev });
            applyGateClasses(widgetsRef.current);
            if (!silent) setNotice({ kind: 'warn', text: t('noticeRestart') });
            return { ok: false, fail: true };
          }

          // 成功：按目标状态再对一次 class（幂等），首次开启时补脚本
          updateWidget(widget.id, { enabled: target });
          applyGateClasses(widgetsRef.current);
          if (target) ensureWidgetScript(widget);
          if (!silent && Array.isArray(warnings) && warnings.length) {
            setNotice({ kind: 'warn', text: t('noticeWarnings', { message: String(warnings[0]) }) });
          }
          return { ok: true, fail: false };
        }).catch(function (err) {
          if (!aliveRef.current) return { ok: false, fail: false };
          updateWidget(widget.id, { enabled: prev });
          applyGateClasses(widgetsRef.current);
          if (!silent) setNotice({ kind: 'error', text: t('noticeFailed', { message: errorMessage(err) }) });
          return { ok: false, fail: true };
        }).then(function (result) {
          markBusy(widget.id, false);
          return result;
        });
      }

      /** 全部开启 / 全部关闭：串行调用 toggle，避免同时打一堆 Host 请求。 */
      function runBulk(target) {
        if (bulkRef.current) return;
        var targets = [];
        var current = widgetsRef.current;
        for (var i = 0; i < current.length; i++) {
          var w = current[i];
          if (w.installed === false) continue;
          if ((w.enabled === true) !== target) targets.push(w);
        }
        if (!targets.length) {
          setNotice({ kind: 'ok', text: t('bulkNone') });
          return;
        }

        bulkRef.current = true;
        setBulk(target ? 'on' : 'off');

        var ok = 0;
        var fail = 0;
        var chain = Promise.resolve();
        var step = function (index) {
          if (index >= targets.length) return Promise.resolve();
          if (!aliveRef.current) return Promise.resolve();
          return toggleWidget(targets[index], target, true).then(function (result) {
            if (result.ok) ok += 1;
            if (result.fail) fail += 1;
            return step(index + 1);
          });
        };
        // 用递归 promise 串行（不能用 for + await：这里坚持 ES5 风格的可读写法）
        chain = step(0).then(function () {
          bulkRef.current = false;
          if (!aliveRef.current) return;
          setBulk('');
          if (fail > 0) setNotice({ kind: 'warn', text: t('bulkFailed', { n: fail }) });
          else setNotice({ kind: 'ok', text: t('bulkDone', { n: ok }) });
        });
        chain.catch(function () { /* 各步内部已兜底，这里只保护 promise 链 */ });
      }

      // 首次加载 + 5s 轮询 + 窗口 focus 刷新；卸载时全部清理
      useEffect(function () {
        aliveRef.current = true;
        load({ manual: false });
        var timer = window.setInterval(function () {
          if (document.hidden) return; // 页面在后台就不轮询
          load({ silent: true });
        }, POLL_MS);
        var onFocus = function () { load({ silent: true }); };
        window.addEventListener('focus', onFocus);
        return function () {
          aliveRef.current = false;
          window.clearInterval(timer);
          window.removeEventListener('focus', onFocus);
        };
      }, []);

      // 提示条自动消失（成功类短一点）
      useEffect(function () {
        if (!notice) return undefined;
        var ttl = notice.kind === 'ok' ? 4000 : 8000;
        var timer = window.setTimeout(function () { setNotice(null); }, ttl);
        return function () { window.clearTimeout(timer); };
      }, [notice]);

      var filtered = useMemo(function () {
        var q = query.trim().toLowerCase();
        if (!q) return widgets;
        return widgets.filter(function (w) {
          var haystack = (w.title + ' ' + w.subtitle + ' ' + w.description + ' ' + w.id).toLowerCase();
          return haystack.indexOf(q) !== -1;
        });
      }, [widgets, query]);

      var buttonsDisabled = refreshing || bulk !== '';
      var pageBody;
      if (phase === 'loading' && widgets.length === 0) {
        pageBody = h('div', { className: 'dshaihub-grid', 'aria-busy': 'true', 'aria-label': t('loading') },
          h(SkeletonCard, null), h(SkeletonCard, null), h(SkeletonCard, null), h(SkeletonCard, null)
        );
      } else if (widgets.length === 0) {
        pageBody = h(EmptyState, {
          title: t('loadErrorTitle'),
          hint: errorText || t('loadErrorHint'),
          action: h('button', {
            type: 'button', className: 'dshaihub-btn', onClick: function () { load({ manual: true }); },
          }, t('retry')),
        });
      } else if (filtered.length === 0) {
        pageBody = h(EmptyState, {
          title: t('emptyTitle'),
          hint: t('emptyHint'),
          action: h('button', {
            type: 'button', className: 'dshaihub-btn', onClick: function () { setQuery(''); },
          }, t('clearSearch')),
        });
      } else {
        var cards = [];
        for (var i = 0; i < filtered.length; i++) {
          var widget = filtered[i];
          cards.push(h(WidgetCard, {
            key: widget.id,
            widget: widget,
            busy: busyIds[widget.id] === true,
            onToggle: function (w, next) { toggleWidget(w, next, false); },
          }));
        }
        pageBody = h('div', { className: 'dshaihub-grid' }, cards);
      }

      // 一条状态都没拿到时，空态本身已经把错误说清楚，就不再叠一条错误条
      var errorBar = (!errorText || widgets.length === 0) ? null : h(ErrorBar, {
        title: t('loadErrorTitle'),
        hint: errorText,
        retryLabel: t('retry'),
        busy: refreshing,
        onRetry: function () { load({ manual: true }); },
      });

      var noticeBar = (!notice) ? null : h('div', {
        className: 'dshaihub-notice dshaihub-notice' + (notice.kind === 'error' ? 'Error' : notice.kind === 'warn' ? 'Warn' : 'Ok'),
        role: 'status',
        'aria-live': 'polite',
      }, notice.text);

      return h('div', { className: 'dshaihub-page' },
        h('div', { className: 'dshaihub-pageInner' },
          h('header', { className: 'dshaihub-head' },
            h('h1', { className: 'dshaihub-title' }, t('pageTitle')),
            h('p', { className: 'dshaihub-subtitle' }, t('pageSubtitle'))
          ),
          h('div', { className: 'dshaihub-toolbar' },
            h('div', { className: 'dshaihub-search' },
              h(SearchIcon, null),
              h('input', {
                className: 'dshaihub-input',
                type: 'search',
                value: query,
                placeholder: t('searchPlaceholder'),
                'aria-label': t('searchLabel'),
                autoComplete: 'off',
                spellCheck: false,
                onChange: function (event) { setQuery(event.target.value); },
              })
            ),
            h('div', { className: 'dshaihub-actions' },
              h('button', {
                type: 'button',
                className: 'dshaihub-btn',
                disabled: buttonsDisabled,
                'aria-busy': bulk === 'on' ? 'true' : 'false',
                onClick: function () { runBulk(true); },
              }, bulk === 'on' ? t('working') : t('enableAll')),
              h('button', {
                type: 'button',
                className: 'dshaihub-btn',
                disabled: buttonsDisabled,
                'aria-busy': bulk === 'off' ? 'true' : 'false',
                onClick: function () { runBulk(false); },
              }, bulk === 'off' ? t('working') : t('disableAll')),
              h('button', {
                type: 'button',
                className: 'dshaihub-btn',
                disabled: buttonsDisabled,
                onClick: function () { load({ manual: true }); },
              }, t('refresh'))
            )
          ),
          errorBar,
          noticeBar,
          pageBody
        )
      );
    }

    /**
     * React 错误边界：任一卡片渲染抛错时只坏这一页，不让整个插槽变空白。
     * 重置按钮把 failed 清掉后再渲染一次。
     */
    class HubErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { failed: false };
        this.handleReset = this.handleReset.bind(this);
      }

      static getDerivedStateFromError() {
        return { failed: true };
      }

      componentDidCatch(error) {
        try {
          console.error('[dsh-ai-widget-hub] 面板渲染出错，已由错误边界接住：', error);
        } catch (err) { /* noop */ }
      }

      handleReset() {
        this.setState({ failed: false });
      }

      render() {
        if (!this.state.failed) return this.props.children;
        return h('div', { className: 'dshaihub-page' },
          h('div', { className: 'dshaihub-pageInner' },
            h(EmptyState, {
              title: this.props.crashTitle,
              hint: this.props.crashHint,
              action: h('button', {
                type: 'button', className: 'dshaihub-btn', onClick: this.handleReset,
              }, this.props.resetLabel),
            })
          )
        );
      }
    }

    /** 插槽里注册的就是这个组件：错误边界 + 真正的主面板。 */
    function HubPage() {
      return h(HubErrorBoundary, {
        crashTitle: t('crashTitle'),
        crashHint: t('crashHint'),
        resetLabel: t('resetPanel'),
      }, h(HubPageInner, null));
    }

    /* ── 插件装配 ─────────────────────────────────────────────────────────── */

    /** 注册语言包；拿不到 locale 服务时保持内置中文兜底。 */
    function setupLocale(ctx) {
      try {
        ctx.effect(function () {
          var off = null;
          try {
            off = ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en });
          } catch (err) {
            // 已注册（例如 HMR 重载）不算错误：继续用已绑定的 t
            if (window.console && console.warn) console.warn('[dsh-ai-widget-hub] 语言包注册失败，继续使用内置中文兜底：', err);
          }
          return function () {
            if (typeof off === 'function') {
              try { off(); } catch (err) { /* noop */ }
            }
          };
        }, 'dsh-ai-widget-hub: dictionaries');
        boundT = ctx.locale.bind(NS);
      } catch (err) {
        if (window.console && console.warn) console.warn('[dsh-ai-widget-hub] locale 绑定失败：', err);
      }
    }

    function mount(ctx) {
      // 1) 全局隐藏样式：写在 <head>，插件卸载时随 effect 一起移除
      ctx.effect(function () {
        var old = document.querySelector('style[' + GATE_ATTR + ']');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var el = document.createElement('style');
        el.setAttribute(GATE_ATTR, '');
        el.textContent = buildGateCss(FALLBACK_WIDGETS);
        document.head.appendChild(el);
        gateStyleEl = el;
        return function () {
          if (gateStyleEl === el) gateStyleEl = null;
          try { if (el.parentNode) el.parentNode.removeChild(el); } catch (err) { /* noop */ }
        };
      }, 'dsh-ai-widget-hub: gate css');

      // 2) 本页面自己的 UI 样式
      ctx.effect(function () {
        var old = document.querySelector('style[' + STYLE_ATTR + ']');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var el = document.createElement('style');
        el.setAttribute(STYLE_ATTR, '');
        el.textContent = UI_CSS;
        document.head.appendChild(el);
        return function () {
          try { if (el.parentNode) el.parentNode.removeChild(el); } catch (err) { /* noop */ }
        };
      }, 'dsh-ai-widget-hub: ui css');

      // 3) 语言包：locale 服务可能晚于本插件就绪，用可选注入等它
      if (ctx.locale && typeof ctx.locale.bind === 'function' && typeof ctx.locale.register === 'function') {
        setupLocale(ctx);
      } else if (typeof ctx.inject === 'function') {
        try {
          ctx.inject(['locale'], function (scoped) { setupLocale(scoped); });
        } catch (err) {
          /* 没有 locale 服务也能用中文兜底跑 */
        }
      }

      // 4) 左侧栏入口：owner 会把图标渲染成按钮，并用同一个 id 选择主面板
      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'ai-widgets',
          order: 20,
          label: function () { return t('sidebarLabel'); },
          locale: NS,
        }, HubSidebarIcon);
      });

      // 5) 主面板：key 必须与侧栏 id 一致
      ctx.slots.inject('main', function () {
        return ctx.slots.register({
          name: 'main',
          key: 'ai-widgets',
          locale: NS,
        }, HubPage);
      });
    }

    function apply(ctx) {
      // 整个挂载过程兜底：Client 半出问题不能把宿主页面其它部分带崩
      try {
        mount(ctx);
      } catch (err) {
        try {
          console.error('[dsh-ai-widget-hub] 客户端挂载失败，AI娘入口本次不可用：', err);
        } catch (ignored) { /* noop */ }
      }
    }

    return {
      inject: ['slots'],
      apply: apply,
    };
  },
});
