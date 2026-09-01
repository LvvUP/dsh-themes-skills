/**
 * Public plugin #3011 alpha.2 reviewed replacement — browser half.
 *
 * The command deck reads and executes commands only through alpha.2's owning
 * Commands Remote. Every execution follows a direct click, argument-taking
 * commands require a second explicit Run click, and usage ranking remains in
 * mounted React memory. There is no DOM traversal, browser persistence,
 * custom route, hidden submission, credential, process, or file capability.
 */
window.__ModuleLoader__.load({
  id: '@dsh-themes/arcana',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    const NS = 'dsh-themes.plugin-3011'
    const MAX_COMMANDS = 80
    const PROBES = Object.freeze({
      clientApply: 'DSH3011_PROBE:CLIENT_APPLY_V1',
      directory: 'DSH3011_PROBE:COMMANDS_REMOTE_DIRECTORY_V1',
      execute: 'DSH3011_PROBE:EXPLICIT_COMMAND_EXECUTE_V1',
      memory: 'DSH3011_PROBE:MEMORY_USAGE_RANKING_V1',
      slots: 'DSH3011_PROBE:ADDITIVE_SLOTS_TWO_V1',
      locales: 'DSH3011_PROBE:LOCALES_EIGHT_V1',
      dispose: 'DSH3011_PROBE:DISPOSE_CLEAN_V1',
    })

    const en = Object.freeze({
      title: 'Arcana command deck', trigger: 'Open command deck', close: 'Close command deck',
      loading: 'Loading the official command directory…', empty: 'No commands are available for this session.',
      failed: 'The command directory is unavailable.', noSession: 'Open a regular session to use commands.',
      argument: 'Command input', argumentHint: 'Enter the arguments shown by the command.', run: 'Run command',
      cancel: 'Cancel', used: 'Used {count} times in this mounted deck', ready: 'Choose a command. Nothing runs automatically.',
      success: 'Command accepted.', failure: 'Command execution failed without retry.',
    })
    const zh = Object.freeze({
      title: 'Arcana 命令甲板', trigger: '打开命令甲板', close: '关闭命令甲板',
      loading: '正在加载官方命令目录…', empty: '当前会话没有可用命令。', failed: '命令目录暂不可用。', noSession: '请先打开常规会话。',
      argument: '命令参数', argumentHint: '输入命令所需参数。', run: '运行命令', cancel: '取消',
      used: '在当前甲板中使用了 {count} 次', ready: '请选择命令，不会自动运行。', success: '命令已接收。', failure: '命令执行失败，未重试。',
    })
    const zhHant = Object.freeze({
      title: 'Arcana 命令甲板', trigger: '開啟命令甲板', close: '關閉命令甲板',
      loading: '正在載入官方命令目錄…', empty: '目前會話沒有可用命令。', failed: '命令目錄暫時無法使用。', noSession: '請先開啟一般會話。',
      argument: '命令參數', argumentHint: '輸入命令所需參數。', run: '執行命令', cancel: '取消',
      used: '在目前甲板中使用了 {count} 次', ready: '請選擇命令，不會自動執行。', success: '命令已接受。', failure: '命令執行失敗，未重試。',
    })
    const ja = Object.freeze({
      title: 'Arcana コマンドデッキ', trigger: 'コマンドデッキを開く', close: 'コマンドデッキを閉じる',
      loading: '公式コマンドディレクトリを読み込み中…', empty: 'このセッションで使えるコマンドはありません。', failed: 'コマンドディレクトリを利用できません。', noSession: '通常のセッションを開いてください。',
      argument: 'コマンド入力', argumentHint: 'コマンドに必要な引数を入力します。', run: 'コマンドを実行', cancel: 'キャンセル',
      used: 'このデッキのマウント中に {count} 回使用', ready: 'コマンドを選択してください。自動実行はしません。', success: 'コマンドが受け付けられました。', failure: 'コマンドの実行に失敗し、再試行はしませんでした。',
    })
    const ko = Object.freeze({
      title: 'Arcana 명령 덱', trigger: '명령 덱 열기', close: '명령 덱 닫기',
      loading: '공식 명령 디렉터리 불러오는 중…', empty: '이 세션에서 사용할 명령이 없습니다.', failed: '명령 디렉터리를 사용할 수 없습니다.', noSession: '일반 세션을 먼저 여세요.',
      argument: '명령 입력', argumentHint: '명령에 표시된 인수를 입력하세요.', run: '명령 실행', cancel: '취소',
      used: '이 마운트된 덱에서 {count}회 사용', ready: '명령을 선택하세요. 자동으로 실행되지 않습니다.', success: '명령이 수락되었습니다.', failure: '명령 실행에 실패했으며 재시도하지 않았습니다.',
    })
    const fr = Object.freeze({
      title: 'Jeu de commandes Arcana', trigger: 'Ouvrir le jeu de commandes', close: 'Fermer le jeu de commandes',
      loading: 'Chargement de l’annuaire officiel des commandes…', empty: 'Aucune commande disponible pour cette session.', failed: 'L’annuaire des commandes est indisponible.', noSession: 'Ouvrez une session ordinaire pour utiliser les commandes.',
      argument: 'Entrée de commande', argumentHint: 'Saisissez les arguments indiqués par la commande.', run: 'Exécuter la commande', cancel: 'Annuler',
      used: 'Utilisée {count} fois dans ce jeu monté', ready: 'Choisissez une commande. Rien ne s’exécute automatiquement.', success: 'Commande acceptée.', failure: 'Échec de la commande sans nouvelle tentative.',
    })
    const de = Object.freeze({
      title: 'Arcana-Befehlsdeck', trigger: 'Befehlsdeck öffnen', close: 'Befehlsdeck schließen',
      loading: 'Offizielles Befehlsverzeichnis wird geladen…', empty: 'Für diese Sitzung sind keine Befehle verfügbar.', failed: 'Das Befehlsverzeichnis ist nicht verfügbar.', noSession: 'Öffnen Sie eine reguläre Sitzung, um Befehle zu verwenden.',
      argument: 'Befehlseingabe', argumentHint: 'Geben Sie die vom Befehl erwarteten Argumente ein.', run: 'Befehl ausführen', cancel: 'Abbrechen',
      used: 'In diesem eingebundenen Deck {count}-mal verwendet', ready: 'Wählen Sie einen Befehl. Nichts wird automatisch ausgeführt.', success: 'Befehl angenommen.', failure: 'Befehlsausführung ohne Wiederholung fehlgeschlagen.',
    })
    const es = Object.freeze({
      title: 'Baraja de comandos Arcana', trigger: 'Abrir baraja de comandos', close: 'Cerrar baraja de comandos',
      loading: 'Cargando el directorio oficial de comandos…', empty: 'No hay comandos disponibles para esta sesión.', failed: 'El directorio de comandos no está disponible.', noSession: 'Abre una sesión normal para usar comandos.',
      argument: 'Entrada del comando', argumentHint: 'Introduce los argumentos indicados por el comando.', run: 'Ejecutar comando', cancel: 'Cancelar',
      used: 'Usado {count} veces en esta baraja montada', ready: 'Elige un comando. Nada se ejecuta automáticamente.', success: 'Comando aceptado.', failure: 'La ejecución falló sin reintento.',
    })
    const EXTRA_DICTIONARIES = Object.freeze([
      Object.freeze(['zh-Hant', zhHant]), Object.freeze(['ja', ja]), Object.freeze(['ko', ko]),
      Object.freeze(['fr', fr]), Object.freeze(['de', de]), Object.freeze(['es', es]),
    ])

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

    function usageCount(rows, name) {
      const row = rows.find(function (entry) { return entry.name === name })
      return row === undefined ? 0 : row.count
    }

    function rankedCommands(commands, usage) {
      return commands.slice(0, MAX_COMMANDS).sort(function (left, right) {
        const delta = usageCount(usage, right.name) - usageCount(usage, left.name)
        return delta === 0 ? String(left.name).localeCompare(String(right.name)) : delta
      })
    }

    function FooterAction(props) {
      const visible = useController(props.controller)
      return React.createElement('button', {
        type: 'button', 'aria-label': props.t('trigger'), 'aria-expanded': visible,
        'data-dsh-slot-probe': PROBES.slots, onClick: props.controller.show,
      }, props.t('trigger'))
    }

    function CommandDeck(props) {
      const visible = useController(props.controller)
      const sessions = props.useSessions(function (state) { return state })
      const [view, setView] = React.useState(function () {
        return { sessionId: null, phase: 'idle', commands: [] }
      })
      const [usage, setUsage] = React.useState(function () { return [] })
      const [selected, setSelected] = React.useState(null)
      const [argument, setArgument] = React.useState('')
      const [message, setMessage] = React.useState('')
      const execution = React.useRef(null)
      const currentSession = React.useRef(sessions.current)
      currentSession.current = sessions.current

      React.useEffect(function () {
        if (!visible || sessions.current === undefined) {
          setView({ sessionId: null, phase: 'idle', commands: [] })
          return undefined
        }
        let active = true
        const requestedSessionId = sessions.current
        setView({ sessionId: requestedSessionId, phase: 'loading', commands: [] })
        Promise.resolve(props.listCommands(requestedSessionId)).then(function (result) {
          if (!active || currentSession.current !== requestedSessionId) return
          if (result === null || typeof result !== 'object' || result.ok !== true || !Array.isArray(result.value)) {
            setView({ sessionId: requestedSessionId, phase: 'failed', commands: [] })
            return
          }
          setView({
            sessionId: requestedSessionId,
            phase: 'ready',
            commands: result.value.slice(0, MAX_COMMANDS),
          })
        }, function () {
          if (active && currentSession.current === requestedSessionId) {
            setView({ sessionId: requestedSessionId, phase: 'failed', commands: [] })
          }
        })
        return function () { active = false }
      }, [visible, sessions.current, props.listCommands])

      React.useEffect(function () {
        return function () { if (execution.current !== null) execution.current.abort() }
      }, [])

      React.useEffect(function () {
        if (execution.current !== null) execution.current.abort()
        execution.current = null
        setSelected(null)
        setArgument('')
        setMessage('')
      }, [sessions.current])

      function record(name) {
        setUsage(function (rows) {
          let found = false
          const next = rows.map(function (row) {
            if (row.name !== name) return row
            found = true
            return Object.freeze({ name: row.name, count: row.count + 1 })
          })
          if (!found) next.push(Object.freeze({ name, count: 1 }))
          return next
        })
      }

      function execute(command, value, selectedSessionId) {
        if (selectedSessionId === undefined || sessions.current !== selectedSessionId ||
            execution.current !== null) return
        const controller = new AbortController()
        execution.current = controller
        const suffix = value.trim()
        const line = '/' + command.name + (suffix === '' ? '' : ' ' + suffix)
        setMessage('')
        Promise.resolve(props.executeCommand(selectedSessionId, line, controller.signal)).then(function (result) {
          if (execution.current === controller) execution.current = null
          if (controller.signal.aborted) return
          if (result !== null && typeof result === 'object' && result.ok === true &&
              result.value !== undefined && result.value !== null &&
              typeof result.value === 'object' && result.value.result !== undefined &&
              result.value.result !== null && typeof result.value.result === 'object' &&
              result.value.result.kind === 'success') {
            record(command.name)
            setSelected(null)
            setArgument('')
            setMessage(props.t('success'))
          } else {
            setMessage(props.t('failure'))
          }
        }, function () {
          if (execution.current === controller) execution.current = null
          if (!controller.signal.aborted) setMessage(props.t('failure'))
        })
      }

      function choose(command, sessionId) {
        if (sessionId === null || sessions.current !== sessionId ||
            view.sessionId !== sessionId) return
        if (command.input === undefined) { execute(command, '', sessionId); return }
        setSelected(Object.freeze({ command, sessionId }))
        setArgument('')
        setMessage('')
      }

      function close() {
        if (execution.current !== null) execution.current.abort()
        execution.current = null
        setSelected(null)
        setArgument('')
        props.controller.hide()
      }

      if (!visible) return null
      const currentView = view.sessionId === sessions.current
        ? view
        : { sessionId: sessions.current ?? null, phase: 'loading', commands: [] }
      let content
      if (sessions.current === undefined) {
        content = React.createElement('p', { role: 'status' }, props.t('noSession'))
      } else if (currentView.phase === 'loading') {
        content = React.createElement('p', { role: 'status' }, props.t('loading'))
      } else if (currentView.phase === 'failed') {
        content = React.createElement('p', { role: 'status' }, props.t('failed'))
      } else if (currentView.phase === 'ready' && currentView.commands.length === 0) {
        content = React.createElement('p', { role: 'status' }, props.t('empty'))
      } else {
        content = React.createElement('ul', { 'aria-label': props.t('title') }, rankedCommands(currentView.commands, usage).map(function (command) {
          const count = usageCount(usage, command.name)
          return React.createElement('li', { key: command.name },
            React.createElement('button', { type: 'button', onClick: function () { choose(command, currentView.sessionId) } }, '/' + command.name),
            React.createElement('p', null, command.description || ''),
            count === 0 ? null : React.createElement('span', null, props.t('used', { count })))
        }))
      }

      const argumentForm = selected === null ? null : React.createElement('form', {
        onSubmit: function (event) {
          event.preventDefault()
          execute(selected.command, argument, selected.sessionId)
        },
      }, React.createElement('label', { htmlFor: 'dsh3011-command-input' }, props.t('argument')),
      React.createElement('input', {
        id: 'dsh3011-command-input', type: 'text', value: argument, autoFocus: true,
        placeholder: selected.command.input && typeof selected.command.input.hint === 'string' ? selected.command.input.hint : props.t('argumentHint'),
        onChange: function (event) { setArgument(event.target.value) },
      }),
      React.createElement('button', { type: 'submit' }, props.t('run')),
      React.createElement('button', { type: 'button', onClick: function () { setSelected(null); setArgument('') } }, props.t('cancel')))

      return React.createElement('section', {
        role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'dsh3011-title',
        'data-dsh-client-probe': PROBES.clientApply + ' ' + PROBES.directory + ' ' + PROBES.execute + ' ' + PROBES.memory + ' ' + PROBES.locales + ' ' + PROBES.dispose,
        'data-dsh-slot-probe': PROBES.slots,
      }, React.createElement('header', null,
        React.createElement('h2', { id: 'dsh3011-title' }, props.t('title')),
        React.createElement('button', { type: 'button', autoFocus: true, 'aria-label': props.t('close'), onClick: close }, '×')),
      content, argumentForm, React.createElement('p', { 'aria-live': 'polite' }, message || props.t('ready')))
    }

    const inject = ['slots', 'sessions', 'locale', 'remote', 'remote.commands']

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
      ctx.effect(function () { return controller.dispose }, 'dsh-plugin-3011: memory controller')
      ctx.effect(function () { return registerDictionaries(ctx) }, 'dsh-plugin-3011: dictionaries')
      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register({
          name: 'sidebar.footer.action', id: 'arcana-command-deck-trigger', order: 76, locale: NS,
          inject: function () { return { controller } },
        }, FooterAction)
      })
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({
          name: 'shell.overlay', id: 'arcana-command-deck', order: 46, locale: NS,
          inject: function () {
            return {
              controller,
              listCommands: function (sessionId) { return ctx.remote.commands.list(sessionId) },
              executeCommand: function (sessionId, line, signal) { return ctx.remote.commands.execute(sessionId, line, [], signal) },
            }
          },
        }, CommandDeck)
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.reviewProbes = PROBES
    exports.reviewRankedCommands = rankedCommands
    return module.exports
  },
})
