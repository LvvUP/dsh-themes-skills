/**
 * Public plugin #3041 alpha.1 reviewed replacement — browser half.
 *
 * Context Vista is a read-only view over alpha.1's standard tokenUsage,
 * contextPressure, and contextBreakdown projections. It owns no Host route,
 * Remote, persistence, credential, process, or file capability.
 */
window.__ModuleLoader__.load({
  id: '@dsh-themes/context-vista',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    const NS = 'dsh-themes.plugin-3041'
    const STYLE_ID = 'dsh-plugin-3041-context-vista/client.css'
    const PROBES = Object.freeze({
      clientApply: 'DSH3041_PROBE:CLIENT_APPLY_V1',
      projections: 'DSH3041_PROBE:PROJECTION_THREE_V1',
      slot: 'DSH3041_PROBE:SLOT_REGISTERED_V1',
      style: 'DSH3041_PROBE:STYLE_OWNED_V1',
      locales: 'DSH3041_PROBE:LOCALES_EIGHT_V1',
      dispose: 'DSH3041_PROBE:DISPOSE_CLEAN_V1',
    })

    const en = Object.freeze({
      title: 'Context Vista',
      occupied: 'Projected context',
      remaining: 'Remaining',
      unavailable: 'Context data will appear after the first model turn.',
      composition: 'Estimated composition',
      system: 'System prompt',
      tools: 'Tools',
      messages: 'Messages',
      usage: 'Durable token usage',
      input: 'Input',
      output: 'Output',
      cacheRead: 'Cache read',
      cacheWrite: 'Cache write',
      estimate: 'Composition is heuristic; projected context is the provider-facing estimate.',
      expand: 'Show context details',
    })
    const zh = Object.freeze({
      title: '上下文视野',
      occupied: '预计上下文',
      remaining: '剩余',
      unavailable: '完成第一次模型对话后会显示上下文数据。',
      composition: '估算组成',
      system: '系统提示词',
      tools: '工具',
      messages: '消息',
      usage: '持久 Token 用量',
      input: '输入',
      output: '输出',
      cacheRead: '缓存读取',
      cacheWrite: '缓存写入',
      estimate: '组成数据采用启发式估算；预计上下文是面向提供商的估计值。',
      expand: '显示上下文详情',
    })
    const zhHant = Object.freeze({
      title: '上下文視野',
      occupied: '預計上下文',
      remaining: '剩餘',
      unavailable: '完成第一次模型對話後會顯示上下文資料。',
      composition: '估算組成',
      system: '系統提示詞',
      tools: '工具',
      messages: '訊息',
      usage: '持久 Token 用量',
      input: '輸入',
      output: '輸出',
      cacheRead: '快取讀取',
      cacheWrite: '快取寫入',
      estimate: '組成資料採用啟發式估算；預計上下文是面向供應商的估計值。',
      expand: '顯示上下文詳情',
    })
    const ja = Object.freeze({
      title: 'コンテキスト表示',
      occupied: '予測コンテキスト',
      remaining: '残り',
      unavailable: '最初のモデル応答後にコンテキストデータが表示されます。',
      composition: '推定内訳',
      system: 'システムプロンプト',
      tools: 'ツール',
      messages: 'メッセージ',
      usage: '永続 Token 使用量',
      input: '入力',
      output: '出力',
      cacheRead: 'キャッシュ読み取り',
      cacheWrite: 'キャッシュ書き込み',
      estimate: '内訳はヒューリスティック推定です。予測コンテキストはプロバイダー向けの推定値です。',
      expand: 'コンテキストの詳細を表示',
    })
    const ko = Object.freeze({
      title: '컨텍스트 보기',
      occupied: '예상 컨텍스트',
      remaining: '남음',
      unavailable: '첫 모델 응답 후 컨텍스트 데이터가 표시됩니다.',
      composition: '예상 구성',
      system: '시스템 프롬프트',
      tools: '도구',
      messages: '메시지',
      usage: '지속 Token 사용량',
      input: '입력',
      output: '출력',
      cacheRead: '캐시 읽기',
      cacheWrite: '캐시 쓰기',
      estimate: '구성은 휴리스틱 추정치이며, 예상 컨텍스트는 공급자 관점의 추정치입니다.',
      expand: '컨텍스트 세부 정보 표시',
    })
    const fr = Object.freeze({
      title: 'Vue du contexte',
      occupied: 'Contexte projeté',
      remaining: 'Restant',
      unavailable: 'Les données de contexte apparaîtront après le premier tour du modèle.',
      composition: 'Composition estimée',
      system: 'Invite système',
      tools: 'Outils',
      messages: 'Messages',
      usage: 'Utilisation durable des tokens',
      input: 'Entrée',
      output: 'Sortie',
      cacheRead: 'Lecture du cache',
      cacheWrite: 'Écriture du cache',
      estimate: 'La composition est heuristique ; le contexte projeté est l’estimation destinée au fournisseur.',
      expand: 'Afficher les détails du contexte',
    })
    const de = Object.freeze({
      title: 'Kontextübersicht',
      occupied: 'Voraussichtlicher Kontext',
      remaining: 'Verbleibend',
      unavailable: 'Kontextdaten erscheinen nach der ersten Modellantwort.',
      composition: 'Geschätzte Zusammensetzung',
      system: 'Systemanweisung',
      tools: 'Werkzeuge',
      messages: 'Nachrichten',
      usage: 'Dauerhafte Token-Nutzung',
      input: 'Eingabe',
      output: 'Ausgabe',
      cacheRead: 'Cache-Lesezugriff',
      cacheWrite: 'Cache-Schreibzugriff',
      estimate: 'Die Zusammensetzung ist heuristisch; der voraussichtliche Kontext ist die anbieterseitige Schätzung.',
      expand: 'Kontextdetails anzeigen',
    })
    const es = Object.freeze({
      title: 'Vista del contexto',
      occupied: 'Contexto proyectado',
      remaining: 'Restante',
      unavailable: 'Los datos de contexto aparecerán después del primer turno del modelo.',
      composition: 'Composición estimada',
      system: 'Instrucción del sistema',
      tools: 'Herramientas',
      messages: 'Mensajes',
      usage: 'Uso persistente de tokens',
      input: 'Entrada',
      output: 'Salida',
      cacheRead: 'Lectura de caché',
      cacheWrite: 'Escritura de caché',
      estimate: 'La composición es heurística; el contexto proyectado es la estimación orientada al proveedor.',
      expand: 'Mostrar detalles del contexto',
    })
    const EXTRA_DICTIONARIES = Object.freeze([
      ['zh-Hant', zhHant],
      ['ja', ja],
      ['ko', ko],
      ['fr', fr],
      ['de', de],
      ['es', es],
    ])

    const CSS = [
      '.dsh3041{box-sizing:border-box;margin:4px 0;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));border-radius:12px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.04));color:var(--dsw-alias-label-primary,inherit);font:14px/1.45 inherit;}',
      '.dsh3041 summary{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;list-style:none;}',
      '.dsh3041 summary::-webkit-details-marker{display:none}.dsh3041 summary:focus-visible{outline:2px solid var(--dsw-static-deepseek-500,#4176e6);outline-offset:2px;border-radius:10px;}',
      '.dsh3041-ring{display:block;width:38px;height:38px;transform:rotate(-90deg)}.dsh3041-ring-base{fill:none;stroke:var(--dsw-alias-border-l2,rgba(127,127,127,.18));stroke-width:4}.dsh3041-ring-value{fill:none;stroke:var(--dsw-static-deepseek-500,#4176e6);stroke-width:4;stroke-linecap:round}',
      '.dsh3041-copy{display:grid;min-width:0}.dsh3041-title{font-size:14px;font-weight:650}.dsh3041-subtitle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,rgba(127,127,127,.82));font-size:12px;font-variant-numeric:tabular-nums}.dsh3041-pct{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums}',
      '.dsh3041-body{display:grid;gap:12px;padding:10px 12px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16))}.dsh3041-heading{margin:0 0 5px;font-size:12px;font-weight:650;color:var(--dsw-alias-label-secondary,inherit)}',
      '.dsh3041-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.dsh3041-metric{display:grid;gap:2px;min-width:0}.dsh3041-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px}.dsh3041-value{font-size:14px;font-variant-numeric:tabular-nums}',
      '.dsh3041-usage{grid-template-columns:repeat(4,minmax(0,1fr))}.dsh3041-note,.dsh3041-empty{margin:0;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px}.dsh3041-empty{padding:2px 0}',
      '@media (max-width:640px){.dsh3041 summary{grid-template-columns:36px minmax(0,1fr) auto;padding:7px 8px}.dsh3041-ring{width:32px;height:32px}.dsh3041-grid,.dsh3041-usage{grid-template-columns:repeat(2,minmax(0,1fr))}}',
      '@media (prefers-reduced-motion:reduce){.dsh3041 *{scroll-behavior:auto!important}}',
    ].join('\n')

    function numberOf(value) {
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
    }

    function tokenText(value) {
      if (value === undefined) return '—'
      if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'
      if (value >= 1000) return (value / 1000).toFixed(1) + 'K'
      return String(Math.round(value))
    }

    function metric(label, value, key) {
      return React.createElement('div', { className: 'dsh3041-metric', key },
        React.createElement('span', { className: 'dsh3041-label' }, label),
        React.createElement('span', { className: 'dsh3041-value' }, tokenText(value)))
    }

    function ContextVista(props) {
      const pressure = props.useProjection('contextPressure') || {}
      const breakdown = props.useProjection('contextBreakdown') || {}
      const usage = props.useProjection('tokenUsage') || {}
      const t = props.t
      const windowTokens = numberOf(pressure.contextWindow)
      const projected = numberOf(pressure.projectedTokens) ?? numberOf(pressure.pressureTokens)
      const fraction = windowTokens && projected !== undefined
        ? Math.max(0, Math.min(1, projected / windowTokens))
        : undefined
      const percent = fraction === undefined ? undefined : Math.round(fraction * 100)
      const remaining = windowTokens === undefined || projected === undefined
        ? undefined
        : Math.max(0, windowTokens - projected)
      const subtitle = projected === undefined || windowTokens === undefined
        ? t('unavailable')
        : t('occupied') + ' ' + tokenText(projected) + ' · ' + t('remaining') + ' ' + tokenText(remaining)
      const dash = percent === undefined ? '0 100' : String(percent) + ' ' + String(100 - percent)

      return React.createElement('details', {
        className: 'dsh3041',
        'data-dsh-context-vista': PROBES.projections,
      },
      React.createElement('summary', { 'aria-label': t('expand') },
        React.createElement('svg', { className: 'dsh3041-ring', viewBox: '0 0 44 44', role: 'img', 'aria-label': percent === undefined ? t('unavailable') : String(percent) + '%' },
          React.createElement('circle', { className: 'dsh3041-ring-base', cx: 22, cy: 22, r: 17 }),
          React.createElement('circle', { className: 'dsh3041-ring-value', cx: 22, cy: 22, r: 17, pathLength: 100, strokeDasharray: dash })),
        React.createElement('span', { className: 'dsh3041-copy' },
          React.createElement('span', { className: 'dsh3041-title' }, t('title')),
          React.createElement('span', { className: 'dsh3041-subtitle' }, subtitle)),
        React.createElement('span', { className: 'dsh3041-pct', 'aria-hidden': true }, percent === undefined ? '—' : String(percent) + '%')),
      React.createElement('div', { className: 'dsh3041-body' },
        projected === undefined && numberOf(usage.outputTokens) === undefined
          ? React.createElement('p', { className: 'dsh3041-empty' }, t('unavailable'))
          : null,
        React.createElement('section', null,
          React.createElement('h3', { className: 'dsh3041-heading' }, t('composition')),
          React.createElement('div', { className: 'dsh3041-grid' },
            metric(t('system'), numberOf(breakdown.systemTokens), 'system'),
            metric(t('tools'), numberOf(breakdown.toolsTokens), 'tools'),
            metric(t('messages'), numberOf(breakdown.messageTokens), 'messages'))),
        React.createElement('section', null,
          React.createElement('h3', { className: 'dsh3041-heading' }, t('usage')),
          React.createElement('div', { className: 'dsh3041-grid dsh3041-usage' },
            metric(t('input'), numberOf(usage.uncachedInputTokens), 'input'),
            metric(t('output'), numberOf(usage.outputTokens), 'output'),
            metric(t('cacheRead'), numberOf(usage.cacheReadTokens), 'cache-read'),
            metric(t('cacheWrite'), numberOf(usage.cacheWriteTokens), 'cache-write'))),
        React.createElement('p', { className: 'dsh3041-note' }, t('estimate'))))
    }

    const inject = ['slots', 'locale']

    function registerDictionaries(ctx) {
      const disposers = []
      try {
        disposers.push(ctx.locale.register(NS, { zh, en }))
        for (const [locale, dictionary] of EXTRA_DICTIONARIES) {
          disposers.push(ctx.locale.register(NS, locale, dictionary))
        }
      } catch (error) {
        for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)()
        throw error
      }
      return function () {
        for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)()
      }
    }

    function apply(ctx) {
      ctx.effect(function () {
        if (typeof document === 'undefined') return function () {}
        const selector = 'style[data-dsh-plugin-css="' + STYLE_ID + '"]'
        if (document.querySelector(selector) !== null) throw new Error('duplicate #3041 owned style')
        const tag = document.createElement('style')
        tag.dataset.dshPluginCss = STYLE_ID
        tag.dataset.dshProbe = PROBES.style
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () { tag.remove() }
      }, 'dsh-plugin-3041: owned style')

      ctx.effect(function () { return registerDictionaries(ctx) }, 'dsh-plugin-3041: dictionaries')

      ctx.slots.inject('conversation.input.dock', function () {
        return ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'context-vista',
          order: 30,
          locale: NS,
        }, ContextVista)
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.reviewProbes = PROBES
    return module.exports
  },
})
