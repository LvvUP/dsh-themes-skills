/**
 * Public plugin #3010 alpha.2 reviewed replacement — browser half.
 *
 * The upstream package rendered and edited OpenPencil documents through an
 * external binary, signed Host routes, browser DOM ownership, and private
 * recovery state. Those capabilities do not have a safe hosted equivalent.
 * This adaptation preserves the explicit design-review entry point: typing
 * [[op: queries alpha.2's official path-only fileReferences service, keeps
 * only .op files, and lets the user place a review or change-plan request in
 * the ordinary composer. It never reads a document, sends a prompt, renders a
 * canvas, changes a file, persists browser state, or handles a credential.
 */
window.__ModuleLoader__.load({
  id: '@dsh-themes/dsh-openpencil',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    const NS = 'dsh-themes.plugin-3010'
    const TRIGGER = '[[op:'
    const MAX_QUERY_CHARS = 160
    const MAX_CANDIDATES = 20
    const PROBES = Object.freeze({
      clientApply: 'DSH3010_PROBE:CLIENT_APPLY_V1',
      officialRemote: 'DSH3010_PROBE:OFFICIAL_FILE_REFERENCES_V1',
      opOnly: 'DSH3010_PROBE:OP_PATHS_ONLY_V1',
      draftOnly: 'DSH3010_PROBE:EXPLICIT_DRAFT_ONLY_V1',
      slot: 'DSH3010_PROBE:ADDITIVE_OVERLAY_V1',
      locales: 'DSH3010_PROBE:LOCALES_EIGHT_V1',
      dispose: 'DSH3010_PROBE:DISPOSE_CLEAN_V1',
    })

    const en = Object.freeze({
      title: 'OpenPencil design review', query: 'Design query: {query}', loading: 'Finding .op designs…',
      empty: 'No matching .op designs.', failed: 'Design paths could not be listed through Harness.',
      hint: 'Selection changes only the draft. The normal Harness tools and workspace permissions remain authoritative.',
      review: 'Review {title}', plan: 'Plan changes for {title}', close: 'Close OpenPencil suggestions',
      reviewPrompt: 'Review the OpenPencil design at {reference}. Inspect it with the ordinary workspace tools, summarize its structure and design quality, and do not modify it.',
      planPrompt: 'Inspect the OpenPencil design at {reference} with the ordinary workspace tools and propose a concrete, reversible improvement plan. Do not modify the file yet.',
    })
    const zh = Object.freeze({
      title: 'OpenPencil 设计审阅', query: '设计查询：{query}', loading: '正在查找 .op 设计…',
      empty: '没有匹配的 .op 设计。', failed: '无法通过 Harness 列出设计路径。',
      hint: '选择只会修改草稿；常规 Harness 工具与工作区权限仍是最终边界。',
      review: '审阅 {title}', plan: '为 {title} 规划修改', close: '关闭 OpenPencil 建议',
      reviewPrompt: '请审阅 OpenPencil 设计 {reference}。使用常规工作区工具检查，总结其结构与设计质量，不要修改文件。',
      planPrompt: '请使用常规工作区工具检查 OpenPencil 设计 {reference}，并提出具体、可逆的改进计划。暂不修改文件。',
    })
    const zhHant = Object.freeze({
      title: 'OpenPencil 設計審閱', query: '設計查詢：{query}', loading: '正在尋找 .op 設計…',
      empty: '沒有相符的 .op 設計。', failed: '無法透過 Harness 列出設計路徑。',
      hint: '選擇只會修改草稿；一般 Harness 工具與工作區權限仍是最終邊界。',
      review: '審閱 {title}', plan: '為 {title} 規劃修改', close: '關閉 OpenPencil 建議',
      reviewPrompt: '請審閱 OpenPencil 設計 {reference}。使用一般工作區工具檢查，總結其結構與設計品質，不要修改檔案。',
      planPrompt: '請使用一般工作區工具檢查 OpenPencil 設計 {reference}，並提出具體、可還原的改善計畫。先不要修改檔案。',
    })
    const ja = Object.freeze({
      title: 'OpenPencil デザインレビュー', query: 'デザイン検索: {query}', loading: '.op デザインを検索中…',
      empty: '一致する .op デザインはありません。', failed: 'Harness 経由でデザインパスを取得できません。',
      hint: '選択しても下書きが変わるだけです。通常の Harness ツールとワークスペース権限が常に優先されます。',
      review: '{title} をレビュー', plan: '{title} の変更を計画', close: 'OpenPencil 候補を閉じる',
      reviewPrompt: 'OpenPencil デザイン {reference} をレビューしてください。通常のワークスペースツールで検査し、構造とデザイン品質を要約し、ファイルは変更しないでください。',
      planPrompt: '通常のワークスペースツールで OpenPencil デザイン {reference} を検査し、具体的で可逆的な改善計画を提案してください。まだファイルは変更しないでください。',
    })
    const ko = Object.freeze({
      title: 'OpenPencil 디자인 리뷰', query: '디자인 검색: {query}', loading: '.op 디자인 찾는 중…',
      empty: '일치하는 .op 디자인이 없습니다.', failed: 'Harness를 통해 디자인 경로를 나열할 수 없습니다.',
      hint: '선택은 초안만 바꿉니다. 일반 Harness 도구와 작업 공간 권한이 항상 최종 기준입니다.',
      review: '{title} 리뷰', plan: '{title} 변경 계획', close: 'OpenPencil 제안 닫기',
      reviewPrompt: 'OpenPencil 디자인 {reference}를 리뷰하세요. 일반 작업 공간 도구로 검사하고 구조와 디자인 품질을 요약하며 파일은 수정하지 마세요.',
      planPrompt: '일반 작업 공간 도구로 OpenPencil 디자인 {reference}를 검사하고 구체적이며 되돌릴 수 있는 개선 계획을 제안하세요. 아직 파일은 수정하지 마세요.',
    })
    const fr = Object.freeze({
      title: 'Revue de design OpenPencil', query: 'Recherche de design : {query}', loading: 'Recherche des designs .op…',
      empty: 'Aucun design .op correspondant.', failed: 'Harness ne peut pas lister les chemins de design.',
      hint: 'La sélection ne modifie que le brouillon. Les outils Harness et les autorisations de l’espace de travail restent la référence.',
      review: 'Examiner {title}', plan: 'Planifier les changements de {title}', close: 'Fermer les suggestions OpenPencil',
      reviewPrompt: 'Examinez le design OpenPencil {reference}. Inspectez-le avec les outils ordinaires de l’espace de travail, résumez sa structure et sa qualité visuelle, sans modifier le fichier.',
      planPrompt: 'Inspectez le design OpenPencil {reference} avec les outils ordinaires de l’espace de travail et proposez un plan d’amélioration concret et réversible. Ne modifiez pas encore le fichier.',
    })
    const de = Object.freeze({
      title: 'OpenPencil-Designprüfung', query: 'Designsuche: {query}', loading: '.op-Designs werden gesucht…',
      empty: 'Keine passenden .op-Designs.', failed: 'Designpfade konnten nicht über Harness aufgelistet werden.',
      hint: 'Die Auswahl ändert nur den Entwurf. Normale Harness-Werkzeuge und Workspace-Berechtigungen bleiben maßgeblich.',
      review: '{title} prüfen', plan: 'Änderungen für {title} planen', close: 'OpenPencil-Vorschläge schließen',
      reviewPrompt: 'Prüfen Sie das OpenPencil-Design {reference}. Untersuchen Sie es mit den normalen Workspace-Werkzeugen, fassen Sie Struktur und Designqualität zusammen und ändern Sie die Datei nicht.',
      planPrompt: 'Untersuchen Sie das OpenPencil-Design {reference} mit den normalen Workspace-Werkzeugen und schlagen Sie einen konkreten, reversiblen Verbesserungsplan vor. Ändern Sie die Datei noch nicht.',
    })
    const es = Object.freeze({
      title: 'Revisión de diseño OpenPencil', query: 'Búsqueda de diseño: {query}', loading: 'Buscando diseños .op…',
      empty: 'No hay diseños .op coincidentes.', failed: 'No se pudieron listar las rutas de diseño mediante Harness.',
      hint: 'La selección solo cambia el borrador. Las herramientas normales de Harness y los permisos del espacio de trabajo siguen siendo la autoridad.',
      review: 'Revisar {title}', plan: 'Planificar cambios para {title}', close: 'Cerrar sugerencias de OpenPencil',
      reviewPrompt: 'Revisa el diseño OpenPencil {reference}. Examínalo con las herramientas normales del espacio de trabajo, resume su estructura y calidad de diseño y no modifiques el archivo.',
      planPrompt: 'Examina el diseño OpenPencil {reference} con las herramientas normales del espacio de trabajo y propone un plan de mejora concreto y reversible. No modifiques el archivo todavía.',
    })
    const EXTRA_DICTIONARIES = Object.freeze([
      Object.freeze(['zh-Hant', zhHant]), Object.freeze(['ja', ja]), Object.freeze(['ko', ko]),
      Object.freeze(['fr', fr]), Object.freeze(['de', de]), Object.freeze(['es', es]),
    ])

    function findTrigger(draft) {
      const start = draft.lastIndexOf(TRIGGER)
      if (start < 0) return null
      const query = draft.slice(start + TRIGGER.length)
      if (query.length > MAX_QUERY_CHARS || query.indexOf('\n') >= 0 || query.indexOf('\r') >= 0) return null
      return Object.freeze({ start, query })
    }

    function formatReference(path) {
      if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return null
      return /\s/u.test(path) ? '@"' + path + '"' : '@' + path
    }

    function openPencilFiles(value) {
      if (!Array.isArray(value)) return []
      const designs = []
      const seen = new Set()
      for (const candidate of value) {
        if (designs.length >= MAX_CANDIDATES) break
        if (candidate === null || typeof candidate !== 'object' || candidate.kind !== 'file') continue
        const path = candidate.path
        if (typeof path !== 'string' || path.length < 4 || path.length > 1024) continue
        if (!path.toLocaleLowerCase().endsWith('.op') || seen.has(path)) continue
        const reference = formatReference(path)
        if (reference === null) continue
        const slash = path.lastIndexOf('/')
        const title = slash < 0 ? path : path.slice(slash + 1)
        seen.add(path)
        designs.push(Object.freeze({ path, title, reference }))
      }
      return designs
    }

    function OpenPencilPicker(props) {
      const input = props.useInput(function (state) { return state })
      const draft = input && typeof input.draft === 'string' ? input.draft : ''
      const trigger = React.useMemo(function () { return findTrigger(draft) }, [draft])
      const query = trigger === null ? '' : trigger.query.trim()
      const [suppressedDraft, setSuppressedDraft] = React.useState('')
      const [view, setView] = React.useState(function () { return { phase: 'idle', designs: [] } })
      const open = trigger !== null && suppressedDraft !== draft

      React.useEffect(function () {
        if (!open || trigger === null) {
          setView({ phase: 'idle', designs: [] })
          return undefined
        }
        const controller = new AbortController()
        setView({ phase: 'loading', designs: [] })
        Promise.resolve(props.listDesigns(props.sessionId, query, controller.signal)).then(
          function (result) {
            if (controller.signal.aborted) return
            if (result === null || typeof result !== 'object' || result.ok !== true) {
              setView({ phase: 'failed', designs: [] })
              return
            }
            setView({ phase: 'ready', designs: openPencilFiles(result.value) })
          },
          function () { if (!controller.signal.aborted) setView({ phase: 'failed', designs: [] }) },
        )
        return function () { controller.abort() }
      }, [open, trigger === null ? -1 : trigger.start, query, props.sessionId, props.listDesigns])

      function close() { setSuppressedDraft(draft) }

      function choose(design, mode) {
        if (trigger === null) return
        const prefix = draft.slice(0, trigger.start)
        const separator = prefix === '' || /\s$/u.test(prefix) ? '' : ' '
        const key = mode === 'review' ? 'reviewPrompt' : 'planPrompt'
        props.inputActions.setDraft(prefix + separator + props.t(key, { reference: design.reference }))
      }

      if (!open || trigger === null) return null
      let content
      if (view.phase === 'loading') {
        content = React.createElement('p', { role: 'status' }, props.t('loading'))
      } else if (view.phase === 'failed') {
        content = React.createElement('p', { role: 'status' }, props.t('failed'))
      } else if (view.phase === 'ready' && view.designs.length === 0) {
        content = React.createElement('p', { role: 'status' }, props.t('empty'))
      } else {
        content = React.createElement('ul', { 'aria-label': props.t('title') }, view.designs.map(function (design) {
          return React.createElement('li', { key: design.path },
            React.createElement('strong', null, design.title),
            React.createElement('p', null, design.path),
            React.createElement('button', { type: 'button', onClick: function () { choose(design, 'review') } }, props.t('review', { title: design.title })),
            React.createElement('button', { type: 'button', onClick: function () { choose(design, 'plan') } }, props.t('plan', { title: design.title })))
        }))
      }

      return React.createElement('section', {
        role: 'dialog', 'aria-label': props.t('title'),
        'data-dsh-client-probe': PROBES.clientApply + ' ' + PROBES.officialRemote + ' ' + PROBES.opOnly + ' ' + PROBES.draftOnly + ' ' + PROBES.locales + ' ' + PROBES.dispose,
        'data-dsh-slot-probe': PROBES.slot,
      }, React.createElement('header', null,
        React.createElement('h2', null, props.t('title')),
        React.createElement('p', null, props.t('query', { query: query || '.op' })),
        React.createElement('button', { type: 'button', 'aria-label': props.t('close'), onClick: close }, '×')),
      content,
      React.createElement('p', null, props.t('hint')))
    }

    const inject = ['slots', 'locale', 'remote', 'remote.fileReferences']

    function registerDictionaries(ctx) {
      const disposers = []
      try {
        disposers.push(ctx.locale.register(NS, { zh, en }))
        for (const [locale, dictionary] of EXTRA_DICTIONARIES) disposers.push(ctx.locale.register(NS, locale, dictionary))
      } catch (error) {
        for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)()
        throw error
      }
      return function () { for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)() }
    }

    function apply(ctx) {
      ctx.effect(function () { return registerDictionaries(ctx) }, 'dsh-plugin-3010: dictionaries')
      ctx.slots.inject('conversation.input.overlay', function () {
        return ctx.slots.register({
          name: 'conversation.input.overlay', id: 'dsh-openpencil-review-picker', order: 41, locale: NS,
          inject: function () {
            return { listDesigns: function (sessionId, query, signal) { return ctx.remote.fileReferences.list(sessionId, query, signal) } }
          },
        }, OpenPencilPicker)
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.reviewProbes = PROBES
    exports.reviewOpenPencilFiles = openPencilFiles
    return module.exports
  },
})
