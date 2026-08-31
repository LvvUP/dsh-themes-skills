/**
 * Public plugin #3040 alpha.1 reviewed replacement — browser half.
 *
 * DSH Kanban is a bounded view over alpha.1's standard Session list and
 * pending-interaction hook. It owns two additive slots and in-memory column
 * overrides only. It does not replace a route, hide official UI, persist
 * browser data, call a Remote, or create a task on the user's behalf.
 */
window.__ModuleLoader__.load({
  id: '@dsh-themes/dsh-kanban',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    const NS = 'dsh-themes.plugin-3040'
    const STYLE_ID = 'dsh-plugin-3040-kanban/client.css'
    const COLUMN_IDS = Object.freeze(['inbox', 'ready', 'running', 'blocked', 'done'])
    const PROBES = Object.freeze({
      clientApply: 'DSH3040_PROBE:CLIENT_APPLY_V1',
      sessionList: 'DSH3040_PROBE:SESSION_LIST_READ_V1',
      columns: 'DSH3040_PROBE:KANBAN_FIVE_COLUMNS_V1',
      ephemeral: 'DSH3040_PROBE:EPHEMERAL_MOVES_V1',
      controller: 'DSH3040_PROBE:EPHEMERAL_CONTROLLER_V1',
      slots: 'DSH3040_PROBE:ADDITIVE_SLOTS_TWO_V1',
      style: 'DSH3040_PROBE:STYLE_OWNED_V1',
      locales: 'DSH3040_PROBE:LOCALES_EIGHT_V1',
      dispose: 'DSH3040_PROBE:DISPOSE_CLEAN_V1',
    })

    const en = Object.freeze({
      title: 'DSH Kanban',
      subtitle: 'Live session planning board',
      trigger: 'Open task board',
      close: 'Close task board',
      newSession: 'New session',
      search: 'Search sessions',
      searchPlaceholder: 'Search title or workspace',
      inbox: 'Inbox',
      ready: 'Ready',
      running: 'Running',
      blocked: 'Needs input',
      done: 'Done',
      empty: 'No matching sessions',
      blankTitle: 'New session',
      noWorkspace: 'No workspace',
      current: 'Current',
      runningStatus: 'Running',
      blockedStatus: 'Waiting for input',
      doneStatus: 'Completed',
      readyStatus: 'Ready',
      inboxStatus: 'Inbox',
      moveTo: 'Move idle session to',
      openSession: 'Open session',
      taskCount: 'sessions',
      ephemeral: 'Manual columns stay in memory only and reset when the plugin unloads.',
      loading: 'Waiting for the session list…',
    })
    const zh = Object.freeze({
      title: 'DSH 任务看板',
      subtitle: '实时会话规划视图',
      trigger: '打开任务看板',
      close: '关闭任务看板',
      newSession: '新建会话',
      search: '搜索会话',
      searchPlaceholder: '搜索标题或工作区',
      inbox: '收件箱',
      ready: '待开始',
      running: '进行中',
      blocked: '等待输入',
      done: '已完成',
      empty: '没有匹配的会话',
      blankTitle: '新会话',
      noWorkspace: '未关联工作区',
      current: '当前',
      runningStatus: '执行中',
      blockedStatus: '等待输入',
      doneStatus: '已完成',
      readyStatus: '待开始',
      inboxStatus: '收件箱',
      moveTo: '将空闲会话移至',
      openSession: '打开会话',
      taskCount: '个会话',
      ephemeral: '手动分栏只保存在内存中，插件卸载后会重置。',
      loading: '正在等待会话列表…',
    })
    const zhHant = Object.freeze({
      title: 'DSH 任務看板',
      subtitle: '即時會話規劃檢視',
      trigger: '開啟任務看板',
      close: '關閉任務看板',
      newSession: '新增會話',
      search: '搜尋會話',
      searchPlaceholder: '搜尋標題或工作區',
      inbox: '收件匣',
      ready: '待開始',
      running: '進行中',
      blocked: '等待輸入',
      done: '已完成',
      empty: '沒有相符的會話',
      blankTitle: '新會話',
      noWorkspace: '未連結工作區',
      current: '目前',
      runningStatus: '執行中',
      blockedStatus: '等待輸入',
      doneStatus: '已完成',
      readyStatus: '待開始',
      inboxStatus: '收件匣',
      moveTo: '將閒置會話移至',
      openSession: '開啟會話',
      taskCount: '個會話',
      ephemeral: '手動分欄只保存在記憶體中，外掛程式卸載後會重設。',
      loading: '正在等待會話清單…',
    })
    const ja = Object.freeze({
      title: 'DSH カンバン',
      subtitle: 'ライブセッション計画ボード',
      trigger: 'タスクボードを開く',
      close: 'タスクボードを閉じる',
      newSession: '新しいセッション',
      search: 'セッションを検索',
      searchPlaceholder: 'タイトルまたはワークスペースを検索',
      inbox: '受信箱',
      ready: '準備完了',
      running: '実行中',
      blocked: '入力待ち',
      done: '完了',
      empty: '一致するセッションはありません',
      blankTitle: '新しいセッション',
      noWorkspace: 'ワークスペースなし',
      current: '現在',
      runningStatus: '実行中',
      blockedStatus: '入力待ち',
      doneStatus: '完了',
      readyStatus: '準備完了',
      inboxStatus: '受信箱',
      moveTo: '待機中のセッションを移動',
      openSession: 'セッションを開く',
      taskCount: 'セッション',
      ephemeral: '手動の列分けはメモリ内だけに保持され、プラグインの終了時にリセットされます。',
      loading: 'セッション一覧を待っています…',
    })
    const ko = Object.freeze({
      title: 'DSH 칸반',
      subtitle: '실시간 세션 계획 보드',
      trigger: '작업 보드 열기',
      close: '작업 보드 닫기',
      newSession: '새 세션',
      search: '세션 검색',
      searchPlaceholder: '제목 또는 작업 공간 검색',
      inbox: '받은 편지함',
      ready: '준비',
      running: '실행 중',
      blocked: '입력 대기',
      done: '완료',
      empty: '일치하는 세션이 없습니다',
      blankTitle: '새 세션',
      noWorkspace: '작업 공간 없음',
      current: '현재',
      runningStatus: '실행 중',
      blockedStatus: '입력 대기',
      doneStatus: '완료',
      readyStatus: '준비',
      inboxStatus: '받은 편지함',
      moveTo: '유휴 세션 이동',
      openSession: '세션 열기',
      taskCount: '개 세션',
      ephemeral: '수동 열 분류는 메모리에만 유지되며 플러그인이 종료되면 초기화됩니다.',
      loading: '세션 목록을 기다리는 중…',
    })
    const fr = Object.freeze({
      title: 'Kanban DSH',
      subtitle: 'Tableau de planification des sessions en direct',
      trigger: 'Ouvrir le tableau des tâches',
      close: 'Fermer le tableau des tâches',
      newSession: 'Nouvelle session',
      search: 'Rechercher des sessions',
      searchPlaceholder: 'Rechercher un titre ou un espace de travail',
      inbox: 'Boîte de réception',
      ready: 'Prêt',
      running: 'En cours',
      blocked: 'Attend une saisie',
      done: 'Terminé',
      empty: 'Aucune session correspondante',
      blankTitle: 'Nouvelle session',
      noWorkspace: 'Aucun espace de travail',
      current: 'Actuelle',
      runningStatus: 'En cours',
      blockedStatus: 'Attend une saisie',
      doneStatus: 'Terminée',
      readyStatus: 'Prête',
      inboxStatus: 'Boîte de réception',
      moveTo: 'Déplacer la session inactive vers',
      openSession: 'Ouvrir la session',
      taskCount: 'sessions',
      ephemeral: 'Les colonnes manuelles restent uniquement en mémoire et sont réinitialisées au déchargement du plugin.',
      loading: 'En attente de la liste des sessions…',
    })
    const de = Object.freeze({
      title: 'DSH-Kanban',
      subtitle: 'Live-Planungstafel für Sitzungen',
      trigger: 'Aufgabentafel öffnen',
      close: 'Aufgabentafel schließen',
      newSession: 'Neue Sitzung',
      search: 'Sitzungen durchsuchen',
      searchPlaceholder: 'Titel oder Arbeitsbereich durchsuchen',
      inbox: 'Eingang',
      ready: 'Bereit',
      running: 'Läuft',
      blocked: 'Wartet auf Eingabe',
      done: 'Erledigt',
      empty: 'Keine passenden Sitzungen',
      blankTitle: 'Neue Sitzung',
      noWorkspace: 'Kein Arbeitsbereich',
      current: 'Aktuell',
      runningStatus: 'Läuft',
      blockedStatus: 'Wartet auf Eingabe',
      doneStatus: 'Erledigt',
      readyStatus: 'Bereit',
      inboxStatus: 'Eingang',
      moveTo: 'Inaktive Sitzung verschieben nach',
      openSession: 'Sitzung öffnen',
      taskCount: 'Sitzungen',
      ephemeral: 'Manuelle Spalten bleiben nur im Speicher und werden beim Entladen des Plugins zurückgesetzt.',
      loading: 'Sitzungsliste wird erwartet…',
    })
    const es = Object.freeze({
      title: 'Kanban de DSH',
      subtitle: 'Tablero de planificación de sesiones en directo',
      trigger: 'Abrir el tablero de tareas',
      close: 'Cerrar el tablero de tareas',
      newSession: 'Nueva sesión',
      search: 'Buscar sesiones',
      searchPlaceholder: 'Buscar por título o espacio de trabajo',
      inbox: 'Bandeja de entrada',
      ready: 'Lista',
      running: 'En curso',
      blocked: 'Espera una respuesta',
      done: 'Terminada',
      empty: 'No hay sesiones coincidentes',
      blankTitle: 'Nueva sesión',
      noWorkspace: 'Sin espacio de trabajo',
      current: 'Actual',
      runningStatus: 'En curso',
      blockedStatus: 'Espera una respuesta',
      doneStatus: 'Terminada',
      readyStatus: 'Lista',
      inboxStatus: 'Bandeja de entrada',
      moveTo: 'Mover la sesión inactiva a',
      openSession: 'Abrir la sesión',
      taskCount: 'sesiones',
      ephemeral: 'Las columnas manuales solo permanecen en memoria y se restablecen al descargar el plugin.',
      loading: 'Esperando la lista de sesiones…',
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
      '.dsh3040-trigger{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:38px;padding:0 8px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary,inherit);font:500 14px/20px inherit;cursor:pointer;}',
      '.dsh3040-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}.dsh3040-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-active,rgba(65,118,230,.14));color:var(--dsw-alias-brand-primary,#4176e6)}',
      '.dsh3040-trigger:focus-visible,.dsh3040-close:focus-visible,.dsh3040-new:focus-visible,.dsh3040-search:focus-visible,.dsh3040-open:focus-visible,.dsh3040-move:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4176e6);outline-offset:2px}',
      '.dsh3040-glyph{display:grid;flex:none;width:20px;height:20px;place-items:center;font-size:17px}.dsh3040-trigger-copy{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh3040-trigger-count{margin-left:auto;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px;font-variant-numeric:tabular-nums}',
      '.dsh3040-rail{justify-content:center;width:36px;height:36px;padding:0;border-radius:50%}',
      '.dsh3040-layer{position:absolute;inset:0;z-index:40;display:grid;place-items:center;padding:18px;pointer-events:none}',
      '.dsh3040-backdrop{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.48));cursor:default;pointer-events:auto}',
      '.dsh3040-panel{position:relative;z-index:1;box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:0;width:min(1180px,96vw);height:min(760px,92vh);min-height:0;overflow:hidden;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:16px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2024);box-shadow:var(--dsw-shadow-lv3,0 20px 64px rgba(0,0,0,.35));font:14px/1.45 inherit;pointer-events:auto}',
      '.dsh3040-header{display:flex;align-items:center;justify-content:space-between;gap:16px;min-width:0;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}.dsh3040-heading{display:grid;min-width:0}.dsh3040-title{margin:0;font-size:17px;line-height:24px}.dsh3040-subtitle{overflow:hidden;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh3040-actions{display:flex;align-items:center;gap:8px}.dsh3040-search{box-sizing:border-box;width:min(260px,32vw);height:34px;padding:6px 10px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:9px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.05));color:inherit;font:13px/20px inherit}.dsh3040-new,.dsh3040-close{height:34px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:9px;background:var(--dsw-alias-button-elevated-fill,rgba(127,127,127,.08));color:inherit;font:500 13px/20px inherit;cursor:pointer}.dsh3040-new{padding:0 11px}.dsh3040-close{width:34px;padding:0;font-size:17px}',
      '.dsh3040-board{display:grid;grid-template-columns:repeat(5,minmax(190px,1fr));gap:9px;min-height:0;padding:11px;overflow:auto;background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-module-platform,rgba(127,127,127,.04)))}',
      '.dsh3040-column{display:flex;flex-direction:column;min-width:190px;min-height:0;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fff) 90%,transparent)}.dsh3040-column-head{display:flex;align-items:center;gap:7px;min-height:40px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.14))}.dsh3040-column-title{margin:0;font-size:13px;line-height:18px}.dsh3040-column-count{margin-left:auto;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px;font-variant-numeric:tabular-nums}',
      '.dsh3040-dot{width:7px;height:7px;border-radius:50%;background:#8b93a7}.dsh3040-column[data-column=ready] .dsh3040-dot{background:#4c86ed}.dsh3040-column[data-column=running] .dsh3040-dot{background:#335fd1}.dsh3040-column[data-column=blocked] .dsh3040-dot{background:#d99b2b}.dsh3040-column[data-column=done] .dsh3040-dot{background:#35a36f}',
      '.dsh3040-cards{display:flex;flex:1;flex-direction:column;gap:7px;min-height:0;padding:7px;overflow:auto}.dsh3040-card{display:grid;gap:8px;padding:9px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:var(--dsw-shadow-lv1,0 1px 3px rgba(0,0,0,.08))}.dsh3040-card[data-current=true]{border-color:var(--dsw-alias-brand-primary,#4176e6)}',
      '.dsh3040-card-top{display:flex;align-items:center;justify-content:space-between;gap:6px}.dsh3040-status{overflow:hidden;padding:2px 6px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4176e6) 14%,transparent);color:var(--dsw-alias-brand-primary,#315fc4);font-size:11px;line-height:16px;text-overflow:ellipsis;white-space:nowrap}.dsh3040-current{color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:11px}',
      '.dsh3040-open{min-width:0;padding:0;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.dsh3040-card-title{display:block;overflow:hidden;font-size:14px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}.dsh3040-card-path{display:block;overflow:hidden;margin-top:2px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px;line-height:17px;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh3040-move{box-sizing:border-box;width:100%;height:30px;padding:4px 7px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.25));border-radius:8px;background:var(--dsw-alias-bg-base,#fff);color:inherit;font:12px/18px inherit}.dsh3040-move:disabled{cursor:not-allowed;opacity:.62}.dsh3040-empty{display:grid;min-height:74px;place-items:center;padding:8px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px;text-align:center}',
      '.dsh3040-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 14px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px}.dsh3040-memory{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh3040-loading{grid-column:1/-1;display:grid;place-items:center;min-height:180px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:14px}',
      '@media(max-width:760px){.dsh3040-layer{padding:8px}.dsh3040-panel{width:100%;height:100%;border-radius:12px}.dsh3040-header{align-items:flex-start;padding:10px}.dsh3040-actions{flex-wrap:wrap;justify-content:flex-end}.dsh3040-search{order:2;width:min(100%,260px)}.dsh3040-new{max-width:150px}.dsh3040-board{grid-template-columns:repeat(5,minmax(min(78vw,280px),1fr));padding:8px;scroll-snap-type:x proximity}.dsh3040-column{scroll-snap-align:start}.dsh3040-footer{padding:7px 10px}}',
      '@media(prefers-reduced-motion:reduce){.dsh3040-trigger,.dsh3040-panel,.dsh3040-card{scroll-behavior:auto!important;transition:none!important}}',
    ].join('\n')

    function createController() {
      let visible = false
      let returnFocusTarget = null
      const listeners = new Set()
      function emit() {
        for (const listener of Array.from(listeners)) listener()
      }
      const controller = Object.freeze({
        getSnapshot: function () { return visible },
        subscribe: function (listener) {
          listeners.add(listener)
          return function () { listeners.delete(listener) }
        },
        show: function (event) {
          if (visible) return
          const candidate = event && event.currentTarget
          returnFocusTarget = candidate && typeof candidate.focus === 'function' ? candidate : null
          visible = true
          emit()
        },
        hide: function () {
          if (!visible) return
          visible = false
          const target = returnFocusTarget
          returnFocusTarget = null
          emit()
          Promise.resolve().then(function () {
            if (target && target.isConnected === true && typeof target.focus === 'function') {
              target.focus()
            }
          })
        },
        dispose: function () {
          visible = false
          returnFocusTarget = null
          listeners.clear()
        },
      })
      return controller
    }

    function useController(controller) {
      return React.useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
        controller.getSnapshot,
      )
    }

    function FooterAction(props) {
      const visible = useController(props.controller)
      const sessions = props.useSessions(function (state) { return state })
      return React.createElement('button', {
        type: 'button',
        className: 'dsh3040-trigger' + (props.wide ? '' : ' dsh3040-rail'),
        'aria-label': props.t('trigger'),
        'aria-expanded': visible,
        'data-dsh-kanban-slots': PROBES.slots,
        onClick: props.controller.show,
      },
      React.createElement('span', { className: 'dsh3040-glyph', 'aria-hidden': true }, '▦'),
      props.wide ? React.createElement('span', { className: 'dsh3040-trigger-copy' }, props.t('title')) : null,
      props.wide ? React.createElement('span', { className: 'dsh3040-trigger-count' }, String(sessions.ids.length)) : null)
    }

    function columnFor(session, pending, overrides) {
      if (pending.has(session.id)) return 'blocked'
      if (session.running) return 'running'
      if (session.completed === true) return 'done'
      return overrides.get(session.id) || (session.blank ? 'inbox' : 'ready')
    }

    function ownDataValue(record, key) {
      for (const [entryKey, entryValue] of Object.entries(record)) {
        if (entryKey === key) return entryValue
      }
      return undefined
    }

    function statusFor(column, t) {
      if (column === 'running') return t('runningStatus')
      if (column === 'blocked') return t('blockedStatus')
      if (column === 'done') return t('doneStatus')
      if (column === 'inbox') return t('inboxStatus')
      return t('readyStatus')
    }

    function KanbanOverlay(props) {
      const visible = useController(props.controller)
      const sessions = props.useSessions(function (state) { return state })
      const pending = props.useSessionPendingInteraction(function (state) { return state })
      const [query, setQuery] = React.useState('')
      const [overrides, setOverrides] = React.useState(function () { return new Map() })
      const panelRef = React.useRef(null)
      const normalizedQuery = query.trim().toLocaleLowerCase()
      const items = React.useMemo(function () {
        return sessions.ids
          .map(function (id) { return ownDataValue(sessions.byId, id) })
          .filter(function (session) { return session !== undefined })
          .filter(function (session) {
            if (normalizedQuery === '') return true
            return (session.displayTitle + ' ' + (session.cwd || ''))
              .toLocaleLowerCase()
              .includes(normalizedQuery)
          })
      }, [sessions, normalizedQuery])

      React.useEffect(function () {
        if (!visible) return undefined
        function handleDialogKeys(event) {
          if (event.key === 'Escape') {
            props.controller.hide()
            return
          }
          if (event.key !== 'Tab' || panelRef.current === null) return
          const panel = panelRef.current
          const focusable = panel.querySelectorAll(
            'button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([tabindex="-1"]),select:not([disabled]):not([tabindex="-1"])',
          )
          if (focusable.length === 0) {
            event.preventDefault()
            return
          }
          const first = focusable.item(0)
          const last = focusable.item(focusable.length - 1)
          if (event.shiftKey && event.target === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && event.target === last) {
            event.preventDefault()
            first.focus()
          } else if (!panel.contains(event.target)) {
            event.preventDefault()
            first.focus()
          }
        }
        document.addEventListener('keydown', handleDialogKeys)
        return function () { document.removeEventListener('keydown', handleDialogKeys) }
      }, [visible, props.controller])

      if (!visible) return null
      const columns = [
        { id: 'inbox', label: props.t('inbox') },
        { id: 'ready', label: props.t('ready') },
        { id: 'running', label: props.t('running') },
        { id: 'blocked', label: props.t('blocked') },
        { id: 'done', label: props.t('done') },
      ]

      function openSession(sessionId) {
        props.controller.hide()
        props.openSession(sessionId)
      }

      function startNativeSession() {
        props.controller.hide()
        props.clearSession()
      }

      function move(sessionId, nextColumn) {
        if (COLUMN_IDS.indexOf(nextColumn) === -1) return
        setOverrides(function (current) {
          const next = new Map(current)
          next.set(sessionId, nextColumn)
          return next
        })
      }

      return React.createElement('div', {
        className: 'dsh3040-layer',
        'data-dsh-kanban-controller': PROBES.controller,
        'data-dsh-kanban-locales': PROBES.locales,
      },
      React.createElement('button', {
        type: 'button',
        className: 'dsh3040-backdrop',
        tabIndex: -1,
        'aria-label': props.t('close'),
        onClick: props.controller.hide,
      }),
      React.createElement('section', {
        className: 'dsh3040-panel',
        ref: panelRef,
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': 'dsh3040-title',
      },
      React.createElement('header', { className: 'dsh3040-header' },
        React.createElement('div', { className: 'dsh3040-heading' },
          React.createElement('h2', { className: 'dsh3040-title', id: 'dsh3040-title' }, props.t('title')),
          React.createElement('span', { className: 'dsh3040-subtitle' }, props.t('subtitle'))),
        React.createElement('div', { className: 'dsh3040-actions' },
          React.createElement('input', {
            className: 'dsh3040-search',
            type: 'search',
            value: query,
            'aria-label': props.t('search'),
            placeholder: props.t('searchPlaceholder'),
            onChange: function (event) { setQuery(event.target.value) },
          }),
          React.createElement('button', {
            className: 'dsh3040-new',
            type: 'button',
            onClick: startNativeSession,
          }, props.t('newSession')),
          React.createElement('button', {
            className: 'dsh3040-close',
            type: 'button',
            autoFocus: true,
            'aria-label': props.t('close'),
            onClick: props.controller.hide,
          }, '×'))),
      React.createElement('div', {
        className: 'dsh3040-board',
        'data-dsh-kanban-list': PROBES.sessionList,
        'data-dsh-kanban-columns': PROBES.columns,
      },
      sessions.phase !== 'ready'
        ? React.createElement('div', { className: 'dsh3040-loading' }, props.t('loading'))
        : columns.map(function (column) {
          const columnItems = items.filter(function (session) {
            return columnFor(session, pending, overrides) === column.id
          })
          return React.createElement('section', {
            className: 'dsh3040-column',
            key: column.id,
            'data-column': column.id,
            'aria-labelledby': 'dsh3040-column-' + column.id,
          },
          React.createElement('header', { className: 'dsh3040-column-head' },
            React.createElement('span', { className: 'dsh3040-dot', 'aria-hidden': true }),
            React.createElement('h3', {
              className: 'dsh3040-column-title',
              id: 'dsh3040-column-' + column.id,
            }, column.label),
            React.createElement('span', { className: 'dsh3040-column-count' }, String(columnItems.length))),
          React.createElement('div', { className: 'dsh3040-cards' },
            columnItems.length === 0
              ? React.createElement('div', { className: 'dsh3040-empty' }, props.t('empty'))
              : columnItems.map(function (session) {
                const resolved = columnFor(session, pending, overrides)
                const locked = pending.has(session.id) || session.running || session.completed === true
                const title = session.blank ? props.t('blankTitle') : session.displayTitle
                return React.createElement('article', {
                  className: 'dsh3040-card',
                  key: session.id,
                  'data-current': sessions.current === session.id,
                },
                React.createElement('div', { className: 'dsh3040-card-top' },
                  React.createElement('span', { className: 'dsh3040-status' }, statusFor(resolved, props.t)),
                  sessions.current === session.id
                    ? React.createElement('span', { className: 'dsh3040-current' }, props.t('current'))
                    : null),
                React.createElement('button', {
                  className: 'dsh3040-open',
                  type: 'button',
                  'aria-label': props.t('openSession') + ': ' + title,
                  onClick: function () { openSession(session.id) },
                },
                React.createElement('span', { className: 'dsh3040-card-title' }, title),
                React.createElement('span', { className: 'dsh3040-card-path' }, session.cwd || props.t('noWorkspace'))),
                React.createElement('select', {
                  className: 'dsh3040-move',
                  value: resolved,
                  disabled: locked,
                  'aria-label': props.t('moveTo') + ': ' + title,
                  'data-dsh-kanban-ephemeral': PROBES.ephemeral,
                  onChange: function (event) { move(session.id, event.target.value) },
                }, columns.map(function (option) {
                  return React.createElement('option', { key: option.id, value: option.id }, option.label)
                })))
              })))
        })),
      React.createElement('footer', { className: 'dsh3040-footer' },
        React.createElement('span', { className: 'dsh3040-memory' }, props.t('ephemeral')),
        React.createElement('span', null, String(items.length) + ' ' + props.t('taskCount')))))
    }

    const inject = ['slots', 'sessions', 'locale']

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
      const controller = createController()
      ctx.effect(function () { return controller.dispose }, 'dsh-plugin-3040: ephemeral controller')

      ctx.effect(function () {
        if (typeof document === 'undefined') return function () {}
        const selector = 'style[data-dsh-plugin-css="' + STYLE_ID + '"]'
        if (document.querySelector(selector) !== null) throw new Error('duplicate #3040 owned style')
        const tag = document.createElement('style')
        tag.dataset.dshPluginCss = STYLE_ID
        tag.dataset.dshProbe = PROBES.style
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () { tag.remove() }
      }, 'dsh-plugin-3040: owned style')

      ctx.effect(function () { return registerDictionaries(ctx) }, 'dsh-plugin-3040: dictionaries')

      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'dsh-kanban-trigger',
          order: 70,
          locale: NS,
          inject: function () { return { controller } },
        }, FooterAction)
      })

      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-kanban-board',
          order: 40,
          locale: NS,
          inject: function () {
            return {
              controller,
              openSession: function (sessionId) { ctx.sessions.open(sessionId) },
              clearSession: function () { ctx.sessions.clear() },
            }
          },
        }, KanbanOverlay)
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.reviewProbes = PROBES
    return module.exports
  },
})
