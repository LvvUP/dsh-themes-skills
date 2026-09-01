/**
 * Public plugin #3004 alpha.2 reviewed replacement — browser half.
 *
 * This Spotlight is a React-only view over the official Session, Commands,
 * Plugin Inventory, Slots, Command UI, and Locale services. It does not
 * inspect host page content, persist browser state, or own a network capability.
 * Its only raw DOM query targets the style marker that this plugin owns.
 */
window.__ModuleLoader__.load({
  id: '@dsh-themes/dsh-spotlight',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    const NS = 'dsh-themes.plugin-3004'
    const STYLE_ID = 'dsh-plugin-3004-spotlight/client.css'
    const PROBES = Object.freeze({
      clientApply: 'DSH3004_PROBE:CLIENT_APPLY_V1',
      services: 'DSH3004_PROBE:OFFICIAL_SERVICES_ONLY_V1',
      commands: 'DSH3004_PROBE:COMMAND_DIRECTORY_V1',
      inventory: 'DSH3004_PROBE:PLUGIN_INVENTORY_V1',
      sessions: 'DSH3004_PROBE:SESSION_NAVIGATION_V1',
      commandUi: 'DSH3004_PROBE:COMMAND_UI_V1',
      slots: 'DSH3004_PROBE:ADDITIVE_SLOTS_TWO_V1',
      locales: 'DSH3004_PROBE:LOCALES_EIGHT_V1',
      style: 'DSH3004_PROBE:STYLE_OWNED_V1',
      dispose: 'DSH3004_PROBE:DISPOSE_CLEAN_V1',
    })

    const en = Object.freeze({
      title: 'Spotlight', subtitle: 'Search sessions, commands, and installed plugins.',
      trigger: 'Open Spotlight', close: 'Close Spotlight', search: 'Search Spotlight',
      placeholder: 'Search sessions, commands, or plugins', loading: 'Refreshing official directories…',
      empty: 'No matching items', session: 'Session', command: 'Command', plugin: 'Plugin',
      execute: 'Run command', open: 'Open session', installed: 'Installed plugin',
      pluginNotice: 'Plugin inventory is read-only.', error: 'One or more official directories are unavailable.',
      hint: 'Choose an item with the keyboard or mouse. Commands run only after your click.',
    })
    const zh = Object.freeze({
      title: '聚光灯', subtitle: '搜索会话、命令和已安装插件。', trigger: '打开聚光灯', close: '关闭聚光灯', search: '搜索聚光灯',
      placeholder: '搜索会话、命令或插件', loading: '正在刷新官方目录…', empty: '没有匹配项', session: '会话', command: '命令', plugin: '插件',
      execute: '运行命令', open: '打开会话', installed: '已安装插件', pluginNotice: '插件清单为只读。',
      error: '一个或多个官方目录暂时不可用。', hint: '可使用键盘或鼠标选择项目。命令只会在你点击后运行。',
    })
    const zhHant = Object.freeze({
      title: '聚光燈', subtitle: '搜尋會話、命令和已安裝外掛。', trigger: '開啟聚光燈', close: '關閉聚光燈', search: '搜尋聚光燈',
      placeholder: '搜尋會話、命令或外掛', loading: '正在重新整理官方目錄…', empty: '沒有符合項目', session: '會話', command: '命令', plugin: '外掛',
      execute: '執行命令', open: '開啟會話', installed: '已安裝外掛', pluginNotice: '外掛清單為唯讀。',
      error: '一個或多個官方目錄暫時無法使用。', hint: '可使用鍵盤或滑鼠選擇項目。命令只會在你點擊後執行。',
    })
    const ja = Object.freeze({
      title: 'Spotlight', subtitle: 'セッション、コマンド、インストール済みプラグインを検索します。', trigger: 'Spotlight を開く', close: 'Spotlight を閉じる', search: 'Spotlight を検索',
      placeholder: 'セッション、コマンド、プラグインを検索', loading: '公式ディレクトリを更新中…', empty: '一致する項目はありません', session: 'セッション', command: 'コマンド', plugin: 'プラグイン',
      execute: 'コマンドを実行', open: 'セッションを開く', installed: 'インストール済みプラグイン', pluginNotice: 'プラグイン一覧は読み取り専用です。',
      error: '一部の公式ディレクトリを利用できません。', hint: 'キーボードまたはマウスで項目を選択します。コマンドはクリック後にのみ実行されます。',
    })
    const ko = Object.freeze({
      title: 'Spotlight', subtitle: '세션, 명령 및 설치된 플러그인을 검색합니다.', trigger: 'Spotlight 열기', close: 'Spotlight 닫기', search: 'Spotlight 검색',
      placeholder: '세션, 명령 또는 플러그인 검색', loading: '공식 디렉터리 새로 고침…', empty: '일치하는 항목이 없습니다', session: '세션', command: '명령', plugin: '플러그인',
      execute: '명령 실행', open: '세션 열기', installed: '설치된 플러그인', pluginNotice: '플러그인 인벤토리는 읽기 전용입니다.',
      error: '하나 이상의 공식 디렉터리를 사용할 수 없습니다.', hint: '키보드나 마우스로 항목을 선택하세요. 명령은 클릭한 후에만 실행됩니다.',
    })
    const fr = Object.freeze({
      title: 'Spotlight', subtitle: 'Recherchez des sessions, commandes et plugins installés.', trigger: 'Ouvrir Spotlight', close: 'Fermer Spotlight', search: 'Rechercher dans Spotlight',
      placeholder: 'Rechercher sessions, commandes ou plugins', loading: 'Actualisation des annuaires officiels…', empty: 'Aucun élément correspondant', session: 'Session', command: 'Commande', plugin: 'Plugin',
      execute: 'Exécuter la commande', open: 'Ouvrir la session', installed: 'Plugin installé', pluginNotice: 'L’inventaire des plugins est en lecture seule.',
      error: 'Un ou plusieurs annuaires officiels sont indisponibles.', hint: 'Choisissez un élément au clavier ou à la souris. Les commandes ne s’exécutent qu’après votre clic.',
    })
    const de = Object.freeze({
      title: 'Spotlight', subtitle: 'Suchen Sie nach Sitzungen, Befehlen und installierten Plugins.', trigger: 'Spotlight öffnen', close: 'Spotlight schließen', search: 'Spotlight durchsuchen',
      placeholder: 'Sitzungen, Befehle oder Plugins suchen', loading: 'Offizielle Verzeichnisse werden aktualisiert…', empty: 'Keine passenden Elemente', session: 'Sitzung', command: 'Befehl', plugin: 'Plugin',
      execute: 'Befehl ausführen', open: 'Sitzung öffnen', installed: 'Installiertes Plugin', pluginNotice: 'Das Plugin-Inventar ist schreibgeschützt.',
      error: 'Ein oder mehrere offizielle Verzeichnisse sind nicht verfügbar.', hint: 'Wählen Sie ein Element per Tastatur oder Maus. Befehle werden erst nach Ihrem Klick ausgeführt.',
    })
    const es = Object.freeze({
      title: 'Spotlight', subtitle: 'Busca sesiones, comandos y plugins instalados.', trigger: 'Abrir Spotlight', close: 'Cerrar Spotlight', search: 'Buscar en Spotlight',
      placeholder: 'Buscar sesiones, comandos o plugins', loading: 'Actualizando directorios oficiales…', empty: 'No hay elementos coincidentes', session: 'Sesión', command: 'Comando', plugin: 'Plugin',
      execute: 'Ejecutar comando', open: 'Abrir sesión', installed: 'Plugin instalado', pluginNotice: 'El inventario de plugins es de solo lectura.',
      error: 'Uno o más directorios oficiales no están disponibles.', hint: 'Elige un elemento con el teclado o el ratón. Los comandos se ejecutan solo después de tu clic.',
    })
    const EXTRA_DICTIONARIES = Object.freeze([
      ['zh-Hant', zhHant], ['ja', ja], ['ko', ko], ['fr', fr], ['de', de], ['es', es],
    ])

    const CSS = [
      '.dsh3004-trigger{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;height:38px;padding:0 8px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary,inherit);font:500 14px/20px inherit;cursor:pointer}.dsh3004-trigger:hover,.dsh3004-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}.dsh3004-icon{display:grid;place-items:center;width:20px;height:20px;font-size:17px}.dsh3004-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh3004-layer{position:absolute;inset:0;z-index:46;display:grid;place-items:start center;padding:clamp(18px,12vh,120px) 12px;pointer-events:none}.dsh3004-backdrop{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.48));pointer-events:auto}.dsh3004-panel{position:relative;box-sizing:border-box;width:min(760px,100%);max-height:min(680px,82vh);overflow:auto;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:16px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2024);box-shadow:var(--dsw-shadow-lv3,0 20px 64px rgba(0,0,0,.35));pointer-events:auto}.dsh3004-head{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}.dsh3004-input{box-sizing:border-box;flex:1;min-width:0;height:38px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:9px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font:14px/20px inherit}.dsh3004-close{width:38px;height:38px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:9px;background:var(--dsw-alias-button-elevated-fill,rgba(127,127,127,.08));color:inherit;font-size:18px;cursor:pointer}',
      '.dsh3004-list{display:grid;gap:7px;padding:10px}.dsh3004-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;padding:11px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;text-align:left;cursor:pointer}.dsh3004-item:hover,.dsh3004-item:focus-visible{border-color:var(--dsw-alias-brand-primary,#4176e6);outline:2px solid transparent}.dsh3004-copy{display:grid;min-width:0;gap:3px}.dsh3004-title,.dsh3004-detail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh3004-title{font-size:14px;font-weight:600}.dsh3004-detail,.dsh3004-kind,.dsh3004-footer{color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px}.dsh3004-kind{padding:3px 7px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:999px}.dsh3004-empty{padding:36px 14px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));text-align:center}.dsh3004-footer{display:flex;justify-content:space-between;gap:12px;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}.dsh3004-trigger:focus-visible,.dsh3004-input:focus-visible,.dsh3004-close:focus-visible,.dsh3004-item:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4176e6);outline-offset:2px}',
      '@media(max-width:560px){.dsh3004-layer{padding:8px}.dsh3004-panel{max-height:100%;border-radius:12px}.dsh3004-footer{align-items:flex-start;flex-direction:column}}',
      '@media(prefers-reduced-motion:reduce){.dsh3004-panel,.dsh3004-item{scroll-behavior:auto!important;transition:none!important}}',
    ].join('\n')

    function createController() {
      let visible = false
      const listeners = new Set()
      function emit() { for (const listener of Array.from(listeners)) listener() }
      return Object.freeze({
        getSnapshot: function () { return visible },
        subscribe: function (listener) { listeners.add(listener); return function () { listeners.delete(listener) } },
        show: function () { if (!visible) { visible = true; emit() } },
        hide: function () { if (visible) { visible = false; emit() } },
        dispose: function () { visible = false; listeners.clear() },
      })
    }

    function useController(controller) {
      return React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    }

    function itemFor(record, id) {
      for (const [entryId, value] of Object.entries(record)) { if (entryId === id) return value }
      return undefined
    }

    function lower(value) { return String(value).toLocaleLowerCase() }

    function FooterAction(props) {
      const visible = useController(props.controller)
      return React.createElement('button', {
        type: 'button', className: 'dsh3004-trigger', 'aria-label': props.t('trigger'),
        'aria-expanded': visible, 'data-dsh-slot-probe': PROBES.slots, onClick: props.controller.show,
      }, React.createElement('span', { className: 'dsh3004-icon', 'aria-hidden': true }, '⌘'),
      React.createElement('span', { className: 'dsh3004-label' }, props.t('title')))
    }

    function SpotlightOverlay(props) {
      const visible = useController(props.controller)
      const sessions = props.useSessions(function (state) { return state })
      const [query, setQuery] = React.useState('')
      const [view, setView] = React.useState(function () {
        return { sessionId: null, phase: 'idle', commands: [], plugins: [] }
      })
      const [notice, setNotice] = React.useState('')
      const currentSession = React.useRef(sessions.current)
      currentSession.current = sessions.current

      React.useEffect(function () {
        if (!visible) {
          setView({ sessionId: null, phase: 'idle', commands: [], plugins: [] })
          return undefined
        }
        let active = true
        const requestedSessionId = sessions.current
        const viewSessionId = requestedSessionId === undefined ? null : requestedSessionId
        setView({ sessionId: viewSessionId, phase: 'loading', commands: [], plugins: [] })
        setNotice('')
        const commandRequest = requestedSessionId === undefined
          ? Promise.resolve({ ok: true, value: [] })
          : props.listCommands(requestedSessionId)
        Promise.all([commandRequest, props.listPlugins()]).then(function (results) {
          if (!active || currentSession.current !== requestedSessionId) return
          const [commandResult, pluginResult] = results
          setView({
            sessionId: viewSessionId,
            phase: commandResult.ok && pluginResult.ok ? 'ready' : 'error',
            commands: commandResult.ok && Array.isArray(commandResult.value)
              ? commandResult.value
              : [],
            plugins: pluginResult.ok && Array.isArray(pluginResult.value?.entries)
              ? pluginResult.value.entries
              : [],
          })
        }, function () {
          if (active && currentSession.current === requestedSessionId) {
            setView({ sessionId: viewSessionId, phase: 'error', commands: [], plugins: [] })
          }
        })
        return function () { active = false }
      }, [visible, sessions.current, props.listCommands, props.listPlugins])

      if (!visible) return null
      const currentViewSessionId = sessions.current === undefined ? null : sessions.current
      const currentView = view.sessionId === currentViewSessionId
        ? view
        : { sessionId: currentViewSessionId, phase: 'loading', commands: [], plugins: [] }
      const normalized = lower(query.trim())
      const items = []
      for (const id of sessions.ids) {
        const session = itemFor(sessions.byId, id)
        if (session !== undefined) items.push({ kind: 'session', id: session.id, title: session.displayTitle, detail: session.cwd || '' })
      }
      for (const command of currentView.commands) {
        if (command.input === undefined && currentView.sessionId !== null) {
          items.push({
            kind: 'command',
            id: command.name,
            sessionId: currentView.sessionId,
            title: '/' + command.name,
            detail: command.description || '',
          })
        }
      }
      for (const plugin of currentView.plugins) {
        items.push({ kind: 'plugin', id: plugin.entryId, title: plugin.moduleName, detail: plugin.enabled ? props.t('installed') : props.t('plugin') })
      }
      const matches = items.filter(function (item) {
        return normalized === '' || lower(item.title + ' ' + item.detail).includes(normalized)
      }).slice(0, 24)

      function activate(item) {
        if (item.kind === 'session') { props.openSession(item.id); props.controller.hide(); return }
        if (item.kind === 'plugin') { setNotice(props.t('pluginNotice')); return }
        if (item.sessionId === undefined || sessions.current !== item.sessionId ||
            view.sessionId !== item.sessionId) return
        props.executeCommand(item.sessionId, '/' + item.id).then(function (result) {
          const accepted = result !== null && typeof result === 'object' && result.ok === true &&
            result.value !== undefined && result.value !== null &&
            typeof result.value === 'object' && result.value.result !== undefined &&
            result.value.result !== null && typeof result.value.result === 'object' &&
            result.value.result.kind === 'success'
          setNotice(accepted ? props.t('execute') : props.t('error'))
        }, function () { setNotice(props.t('error')) })
      }

      return React.createElement('div', {
        className: 'dsh3004-layer', 'data-dsh-client-probe': PROBES.services + ' ' + PROBES.commandUi + ' ' + PROBES.locales,
      }, React.createElement('button', { type: 'button', tabIndex: -1, className: 'dsh3004-backdrop', 'aria-label': props.t('close'), onClick: props.controller.hide }),
      React.createElement('section', { className: 'dsh3004-panel', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'dsh3004-title' },
        React.createElement('header', { className: 'dsh3004-head' },
          React.createElement('input', { className: 'dsh3004-input', type: 'search', autoFocus: true, value: query, 'aria-label': props.t('search'), placeholder: props.t('placeholder'), onChange: function (event) { setQuery(event.target.value) }, onKeyDown: function (event) { if (event.key === 'Escape') props.controller.hide() } }),
          React.createElement('button', { type: 'button', className: 'dsh3004-close', 'aria-label': props.t('close'), onClick: props.controller.hide }, '×')),
        React.createElement('div', { className: 'dsh3004-list', 'data-dsh-slot-probe': PROBES.commands + ' ' + PROBES.inventory + ' ' + PROBES.sessions },
          currentView.phase === 'loading' ? React.createElement('div', { className: 'dsh3004-empty' }, props.t('loading')) : null,
          currentView.phase !== 'loading' && matches.length === 0 ? React.createElement('div', { className: 'dsh3004-empty' }, props.t('empty')) : null,
          currentView.phase !== 'loading' ? matches.map(function (item) {
            return React.createElement('button', { type: 'button', className: 'dsh3004-item', key: item.kind + ':' + item.id + ':' + (item.sessionId || ''), onClick: function () { activate(item) } },
              React.createElement('span', { className: 'dsh3004-copy' }, React.createElement('span', { className: 'dsh3004-title' }, item.title), React.createElement('span', { className: 'dsh3004-detail' }, item.detail)),
              React.createElement('span', { className: 'dsh3004-kind' }, props.t(item.kind)))
          }) : null),
        React.createElement('footer', { className: 'dsh3004-footer' }, React.createElement('span', { id: 'dsh3004-title' }, props.t('subtitle')), React.createElement('span', null, notice || props.t('hint')))))
    }

    const inject = ['slots', 'sessions', 'locale', 'remote', 'remote.commands', 'remote.pluginInventory', 'commandUi']

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
      const controller = createController()
      ctx.effect(function () { return controller.dispose }, 'dsh-plugin-3004: controller')
      ctx.effect(function () {
        if (typeof document === 'undefined') return function () {}
        const selector = 'style[data-dsh-plugin-css="' + STYLE_ID + '"]'
        if (document.querySelector(selector) !== null) throw new Error('duplicate #3004 owned style')
        const tag = document.createElement('style')
        tag.dataset.dshPluginCss = STYLE_ID
        tag.dataset.dshProbe = PROBES.style
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () { tag.remove() }
      }, 'dsh-plugin-3004: owned style')
      ctx.effect(function () { return registerDictionaries(ctx) }, 'dsh-plugin-3004: dictionaries')
      const t = ctx.locale.bind(NS)
      ctx.effect(function () {
        return ctx.commandUi.register({
          name: 'spotlight', description: t('subtitle'), available: function () { return true },
          ui: { kind: 'popupSelect', options: function () { return Promise.resolve([{ id: 'open', label: t('trigger'), detail: t('subtitle') }]) }, onSelect: function () { controller.show() } },
        })
      }, 'dsh-plugin-3004: command-ui')
      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register({ name: 'sidebar.footer.action', id: 'dsh-spotlight-trigger', order: 74, locale: NS, inject: function () { return { controller } } }, FooterAction)
      })
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({
          name: 'shell.overlay', id: 'dsh-spotlight-palette', order: 44, locale: NS,
          inject: function () { return { controller, openSession: function (sessionId) { ctx.sessions.open(sessionId) }, listCommands: function (sessionId) { return ctx.remote.commands.list(sessionId) }, executeCommand: function (sessionId, line) { return ctx.remote.commands.execute(sessionId, line, []) }, listPlugins: function () { return ctx.remote.pluginInventory.list() } } },
        }, SpotlightOverlay)
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.reviewProbes = PROBES
    return module.exports
  },
})
