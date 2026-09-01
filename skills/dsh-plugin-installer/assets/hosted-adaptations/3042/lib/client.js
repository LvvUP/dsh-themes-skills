/**
 * Public plugin #3042 alpha.2 reviewed replacement — browser half.
 *
 * The original [[ picker directly walked and read Host files, mounted a
 * custom Typert namespace, and injected hidden note contents before a model
 * step. This adaptation preserves the explicit [[ note-picking use case while
 * delegating path discovery to alpha.2's official fileReferences Remote and
 * writing the selected Markdown note as the standard @path prompt reference.
 * The model can then use the ordinary read tool under Harness policy.
 */
window.__ModuleLoader__.load({
  id: '@dsh-themes/dsh-wikilink',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    const NS = 'dsh-themes.plugin-3042'
    const STYLE_ID = 'dsh-plugin-3042-wikilink/client.css'
    const MAX_QUERY_CHARS = 160
    const MAX_CANDIDATES = 24
    const PROBES = Object.freeze({
      clientApply: 'DSH3042_PROBE:CLIENT_APPLY_V1',
      officialRemote: 'DSH3042_PROBE:OFFICIAL_FILE_REFERENCES_V1',
      standardReference: 'DSH3042_PROBE:STANDARD_AT_PATH_V1',
      slot: 'DSH3042_PROBE:ADDITIVE_OVERLAY_V1',
      style: 'DSH3042_PROBE:STYLE_OWNED_V1',
      locales: 'DSH3042_PROBE:LOCALES_EIGHT_V1',
      dispose: 'DSH3042_PROBE:DISPOSE_CLEAN_V1',
    })

    const en = Object.freeze({
      title: 'Markdown note references',
      query: 'Wikilink query: {query}',
      loading: 'Finding Markdown notes…',
      empty: 'No matching Markdown notes.',
      failed: 'Notes could not be listed through the Harness file-reference service.',
      hint: 'Selection inserts the standard Harness @path reference; the model reads it with the normal read tool.',
      choose: 'Reference {title}',
      close: 'Close note suggestions',
    })
    const zh = Object.freeze({
      title: 'Markdown 笔记引用',
      query: '双链查询：{query}',
      loading: '正在查找 Markdown 笔记…',
      empty: '没有匹配的 Markdown 笔记。',
      failed: '无法通过 Harness 文件引用服务列出笔记。',
      hint: '选择后插入 Harness 标准 @路径 引用；模型会使用常规 read 工具读取。',
      choose: '引用 {title}',
      close: '关闭笔记建议',
    })
    const zhHant = Object.freeze({
      title: 'Markdown 筆記引用',
      query: '雙鏈查詢：{query}',
      loading: '正在尋找 Markdown 筆記…',
      empty: '沒有相符的 Markdown 筆記。',
      failed: '無法透過 Harness 檔案引用服務列出筆記。',
      hint: '選擇後會插入 Harness 標準 @路徑 引用；模型會使用一般 read 工具讀取。',
      choose: '引用 {title}',
      close: '關閉筆記建議',
    })
    const ja = Object.freeze({
      title: 'Markdown ノート参照',
      query: 'ウィキリンク検索：{query}',
      loading: 'Markdown ノートを検索中…',
      empty: '一致する Markdown ノートはありません。',
      failed: 'Harness のファイル参照サービスでノートを取得できませんでした。',
      hint: '選択すると標準の Harness @path 参照が挿入され、モデルは通常の read ツールで読み取ります。',
      choose: '{title} を参照',
      close: 'ノート候補を閉じる',
    })
    const ko = Object.freeze({
      title: 'Markdown 노트 참조',
      query: '위키링크 검색: {query}',
      loading: 'Markdown 노트를 찾는 중…',
      empty: '일치하는 Markdown 노트가 없습니다.',
      failed: 'Harness 파일 참조 서비스에서 노트를 가져오지 못했습니다.',
      hint: '선택하면 표준 Harness @path 참조가 삽입되며 모델은 일반 read 도구로 읽습니다.',
      choose: '{title} 참조',
      close: '노트 제안 닫기',
    })
    const fr = Object.freeze({
      title: 'Références de notes Markdown',
      query: 'Recherche wikilien : {query}',
      loading: 'Recherche des notes Markdown…',
      empty: 'Aucune note Markdown correspondante.',
      failed: 'Le service de références de fichiers Harness ne peut pas lister les notes.',
      hint: 'La sélection insère la référence Harness @path standard ; le modèle la lit avec l’outil read habituel.',
      choose: 'Référencer {title}',
      close: 'Fermer les suggestions de notes',
    })
    const de = Object.freeze({
      title: 'Markdown-Notizverweise',
      query: 'Wikilink-Suche: {query}',
      loading: 'Markdown-Notizen werden gesucht…',
      empty: 'Keine passende Markdown-Notiz.',
      failed: 'Der Harness-Dateiverweisdienst konnte keine Notizen auflisten.',
      hint: 'Die Auswahl fügt den standardmäßigen Harness-@path-Verweis ein; das Modell liest ihn mit dem normalen read-Werkzeug.',
      choose: '{title} referenzieren',
      close: 'Notizvorschläge schließen',
    })
    const es = Object.freeze({
      title: 'Referencias a notas Markdown',
      query: 'Búsqueda de wikienlace: {query}',
      loading: 'Buscando notas Markdown…',
      empty: 'No hay notas Markdown coincidentes.',
      failed: 'El servicio de referencias de archivos de Harness no pudo listar las notas.',
      hint: 'La selección inserta la referencia @path estándar de Harness; el modelo la lee con la herramienta read habitual.',
      choose: 'Referenciar {title}',
      close: 'Cerrar sugerencias de notas',
    })
    const EXTRA_DICTIONARIES = Object.freeze([
      Object.freeze(['zh-Hant', zhHant]),
      Object.freeze(['ja', ja]),
      Object.freeze(['ko', ko]),
      Object.freeze(['fr', fr]),
      Object.freeze(['de', de]),
      Object.freeze(['es', es]),
    ])

    const CSS = [
      '.dsh3042-menu{position:absolute;left:0;bottom:calc(100% + 6px);z-index:120;box-sizing:border-box;display:grid;gap:6px;width:min(560px,calc(100vw - 24px));max-height:min(360px,calc(100vh - 80px));padding:8px;border:1px solid var(--dsw-alias-border-inverted,rgba(127,127,127,.3));border-radius:12px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,#202225));color:var(--dsw-alias-label-primary,#f4f4f5);box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.35));font:14px/1.45 inherit;overflow:hidden;}',
      '.dsh3042-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:2px 4px 6px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));}.dsh3042-copy{display:grid;gap:1px;min-width:0}.dsh3042-title{font-size:17px;font-weight:650}.dsh3042-query{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.76));font-size:12px}.dsh3042-close{flex:none;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:inherit;font:17px/1 inherit;cursor:pointer}',
      '.dsh3042-close:hover,.dsh3042-option:hover,.dsh3042-option[aria-selected="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));}.dsh3042-close:focus-visible,.dsh3042-option:focus-visible{outline:2px solid var(--dsw-static-deepseek-500,#4176e6);outline-offset:2px}',
      '.dsh3042-list{display:grid;gap:2px;min-height:0;overflow:auto;overscroll-behavior:contain}.dsh3042-option{display:grid;grid-template-columns:minmax(0,1fr);gap:1px;width:100%;min-height:42px;padding:7px 9px;border:0;border-radius:9px;background:transparent;color:inherit;text-align:left;cursor:pointer}.dsh3042-note{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:600}.dsh3042-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.74));font-size:12px}',
      '.dsh3042-status{padding:18px 10px;color:var(--dsw-alias-label-secondary,rgba(127,127,127,.84));font-size:14px;text-align:center}.dsh3042-hint{margin:0;padding:6px 4px 1px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px}',
      '@media(max-width:640px){.dsh3042-menu{left:50%;transform:translateX(-50%);width:calc(100vw - 16px);max-height:min(52vh,360px);padding:7px}.dsh3042-title{font-size:14px}.dsh3042-option{min-height:46px}.dsh3042-hint{white-space:normal}}',
      '@media(prefers-color-scheme:light){.dsh3042-menu{background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-1,#fff));color:var(--dsw-alias-label-primary,#171717)}}',
      '@media(prefers-color-scheme:dark){.dsh3042-menu{background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,#202225));color:var(--dsw-alias-label-primary,#f4f4f5)}}',
      '@media(prefers-reduced-motion:reduce){.dsh3042-menu,.dsh3042-list{scroll-behavior:auto!important}}',
    ].join('\n')

    function findOpenTrigger(draft) {
      const half = draft.lastIndexOf('[[')
      const full = draft.lastIndexOf('【【')
      const start = Math.max(half, full)
      if (start < 0) return null
      if (draft.indexOf(']]', start + 2) >= 0 || draft.indexOf('】】', start + 2) >= 0) return null
      const query = draft.slice(start + 2)
      if (query.length > MAX_QUERY_CHARS || query.indexOf('\n') >= 0 || query.indexOf('\r') >= 0) return null
      return Object.freeze({ start, query })
    }

    function cleanQuery(query) {
      return query.replace(/(?:\]|】)+$/u, '').trim()
    }

    function formatReference(path) {
      if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return null
      return /\s/u.test(path) ? '@"' + path + '"' : '@' + path
    }

    function markdownNotes(value) {
      if (!Array.isArray(value)) return []
      const notes = []
      const seen = new Set()
      for (const candidate of value) {
        if (notes.length >= MAX_CANDIDATES) break
        if (candidate === null || typeof candidate !== 'object' || candidate.kind !== 'file') continue
        const path = candidate.path
        if (typeof path !== 'string' || path.length < 4 || path.length > 1024) continue
        if (!path.toLocaleLowerCase().endsWith('.md') || seen.has(path)) continue
        const mention = formatReference(path)
        if (mention === null) continue
        const slash = path.lastIndexOf('/')
        const basename = slash < 0 ? path : path.slice(slash + 1)
        const title = basename.slice(0, -3)
        if (title === '') continue
        seen.add(path)
        notes.push(Object.freeze({ path, title, mention }))
      }
      return notes
    }

    function WikilinkPicker(props) {
      const input = props.useInput(function (state) { return state })
      const draft = input && typeof input.draft === 'string' ? input.draft : ''
      const trigger = React.useMemo(function () { return findOpenTrigger(draft) }, [draft])
      const query = trigger === null ? '' : cleanQuery(trigger.query)
      const [suppressedDraft, setSuppressedDraft] = React.useState('')
      const [view, setView] = React.useState(function () { return { phase: 'idle', notes: [] } })
      const listRef = React.useRef(null)
      const open = trigger !== null && suppressedDraft !== draft

      React.useEffect(function () {
        if (!open || trigger === null) {
          setView({ phase: 'idle', notes: [] })
          return undefined
        }
        const controller = new AbortController()
        setView({ phase: 'loading', notes: [] })
        Promise.resolve(props.listNotes(props.sessionId, query, controller.signal)).then(
          function (result) {
            if (controller.signal.aborted) return
            if (result === null || typeof result !== 'object' || result.ok !== true) {
              setView({ phase: 'failed', notes: [] })
              return
            }
            setView({ phase: 'ready', notes: markdownNotes(result.value) })
          },
          function () {
            if (!controller.signal.aborted) setView({ phase: 'failed', notes: [] })
          },
        )
        return function () { controller.abort() }
      }, [open, trigger === null ? -1 : trigger.start, query, props.sessionId, props.listNotes])

      function close() {
        setSuppressedDraft(draft)
      }

      function choose(note) {
        if (trigger === null) return
        const prefix = draft.slice(0, trigger.start)
        const separator = prefix === '' || /\s$/u.test(prefix) ? '' : ' '
        props.inputActions.setDraft(prefix + separator + note.mention)
      }

      function moveFocus(event) {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          close()
          return
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        const root = listRef.current
        if (root === null) return
        const buttons = Array.from(root.querySelectorAll('button[data-dsh3042-note]'))
        if (buttons.length === 0) return
        event.preventDefault()
        const current = buttons.indexOf(event.target)
        const next = event.key === 'ArrowDown'
          ? Math.min(buttons.length - 1, current + 1)
          : Math.max(0, current < 0 ? 0 : current - 1)
        buttons.at(next).focus()
      }

      if (!open || trigger === null) return null
      let content
      if (view.phase === 'loading') {
        content = React.createElement('div', { className: 'dsh3042-status', role: 'status' }, props.t('loading'))
      } else if (view.phase === 'failed') {
        content = React.createElement('div', { className: 'dsh3042-status', role: 'status' }, props.t('failed'))
      } else if (view.phase === 'ready' && view.notes.length === 0) {
        content = React.createElement('div', { className: 'dsh3042-status', role: 'status' }, props.t('empty'))
      } else {
        content = React.createElement('div', {
          className: 'dsh3042-list',
          role: 'listbox',
          'aria-label': props.t('title'),
          'data-dsh3042-official-remote': PROBES.officialRemote,
        }, view.notes.map(function (note, index) {
          return React.createElement('button', {
            type: 'button',
            role: 'option',
            className: 'dsh3042-option',
            key: note.path,
            'aria-label': props.t('choose', { title: note.title }),
            'aria-selected': index === 0,
            'data-dsh3042-note': note.path,
            onClick: function () { choose(note) },
          },
          React.createElement('span', { className: 'dsh3042-note' }, note.title),
          React.createElement('span', { className: 'dsh3042-path' }, note.path))
        }))
      }

      return React.createElement('section', {
        className: 'dsh3042-menu',
        ref: listRef,
        role: 'dialog',
        'aria-label': props.t('title'),
        'data-dsh3042-client': PROBES.clientApply,
        'data-dsh3042-slot': PROBES.slot,
        'data-dsh3042-reference': PROBES.standardReference,
        'data-dsh3042-locales': PROBES.locales,
        'data-dsh3042-dispose': PROBES.dispose,
        onKeyDown: moveFocus,
      },
      React.createElement('header', { className: 'dsh3042-head' },
        React.createElement('span', { className: 'dsh3042-copy' },
          React.createElement('strong', { className: 'dsh3042-title' }, props.t('title')),
          React.createElement('span', { className: 'dsh3042-query' }, props.t('query', { query: query || '[[…' }))),
        React.createElement('button', {
          type: 'button',
          className: 'dsh3042-close',
          'aria-label': props.t('close'),
          onClick: close,
        }, '×')),
      content,
      React.createElement('p', { className: 'dsh3042-hint' }, props.t('hint')))
    }

    const inject = ['slots', 'locale', 'remote', 'remote.fileReferences']

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
        if (document.querySelector(selector) !== null) throw new Error('duplicate #3042 owned style')
        const tag = document.createElement('style')
        tag.dataset.dshPluginCss = STYLE_ID
        tag.dataset.dshProbe = PROBES.style
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () { tag.remove() }
      }, 'dsh-plugin-3042: owned style')

      ctx.effect(function () { return registerDictionaries(ctx) }, 'dsh-plugin-3042: dictionaries')

      ctx.slots.inject('conversation.input.overlay', function () {
        return ctx.slots.register({
          name: 'conversation.input.overlay',
          id: 'dsh-wikilink-picker',
          order: 40,
          locale: NS,
          inject: function () {
            return {
              listNotes: function (sessionId, query, signal) {
                return ctx.remote.fileReferences.list(sessionId, query, signal)
              },
            }
          },
        }, WikilinkPicker)
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.reviewProbes = PROBES
    return module.exports
  },
})
