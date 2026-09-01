/**
 * Public plugin #3008 alpha.2 reviewed replacement — browser half.
 *
 * The upstream plugin changed browser-owned transcript markup. This hosted
 * adaptation instead contributes one additive `conversation.view` entry. Its
 * per-Session inject face binds the official Chat target observable and the
 * View reads only `ChatSnapshot.navigation.items()`. Verbose, Normal, and
 * Summary are local presentation windows over that immutable projection; no
 * official Chat state, DOM, storage, network, process, or file surface is
 * changed.
 */
window.__ModuleLoader__.load({
  id: '@dsh-themes/dsh-view-modes',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    const NS = 'dsh-themes.plugin-3008'
    const VIEW_ID = 'dsh-view-modes'
    const MODE_IDS = Object.freeze(['verbose', 'normal', 'summary'])
    const EMPTY_ITEMS = Object.freeze([])
    const NORMAL_TURN_LIMIT = 6
    const PROBES = Object.freeze({
      clientApply: 'DSH3008_PROBE:CLIENT_APPLY_V2',
      chatTarget: 'DSH3008_PROBE:CHAT_TARGET_BINDING_V1',
      navigation: 'DSH3008_PROBE:CHAT_NAVIGATION_ITEMS_V1',
      slot: 'DSH3008_PROBE:ADDITIVE_CONVERSATION_VIEW_V1',
      locales: 'DSH3008_PROBE:LOCALES_EIGHT_V1',
      memory: 'DSH3008_PROBE:EPHEMERAL_MODE_ONLY_V2',
      dispose: 'DSH3008_PROBE:DISPOSE_CLEAN_V2',
    })

    const en = Object.freeze({
      tab: 'View modes',
      title: 'Conversation view modes',
      verbose: 'Verbose',
      normal: 'Normal',
      summary: 'Summary',
      verboseDetail: 'Show every loaded turn preview from the official Chat navigation index.',
      normalDetail: 'Show the six most recent loaded turn previews.',
      summaryDetail: 'Show only the most recent loaded turn preview.',
      selector: 'Choose conversation presentation',
      current: 'Current presentation',
      loadedTurns: 'Loaded turns',
      turn: 'Turn',
      prompt: 'Prompt',
      response: 'Response',
      noTurns: 'No loaded turn previews are available yet.',
      unavailable: 'Not available in the loaded window.',
      ephemeral: 'This choice is held only in this mounted view and resets when it closes or unloads.',
    })
    const zh = Object.freeze({
      tab: '视图模式',
      title: '会话视图模式',
      verbose: '详尽',
      normal: '普通',
      summary: '摘要',
      verboseDetail: '显示官方 Chat 导航索引中所有已加载的轮次预览。',
      normalDetail: '显示最近六个已加载的轮次预览。',
      summaryDetail: '仅显示最近一个已加载的轮次预览。',
      selector: '选择会话展示方式',
      current: '当前展示',
      loadedTurns: '已加载轮次',
      turn: '轮次',
      prompt: '提示',
      response: '回复',
      noTurns: '尚无可用的已加载轮次预览。',
      unavailable: '当前加载窗口中不可用。',
      ephemeral: '该选择只保留在当前已挂载视图的内存中，关闭或卸载后会重置。',
    })
    const zhHant = Object.freeze({
      tab: '檢視模式',
      title: '對話檢視模式',
      verbose: '詳盡',
      normal: '一般',
      summary: '摘要',
      verboseDetail: '顯示官方 Chat 導覽索引中所有已載入的輪次預覽。',
      normalDetail: '顯示最近六個已載入的輪次預覽。',
      summaryDetail: '只顯示最近一個已載入的輪次預覽。',
      selector: '選擇對話呈現方式',
      current: '目前呈現',
      loadedTurns: '已載入輪次',
      turn: '輪次',
      prompt: '提示',
      response: '回覆',
      noTurns: '目前沒有可用的已載入輪次預覽。',
      unavailable: '目前載入的視窗中無法取得。',
      ephemeral: '此選擇只保留在目前已掛載檢視的記憶體中，關閉或卸載後會重設。',
    })
    const ja = Object.freeze({
      tab: '表示モード',
      title: '会話表示モード',
      verbose: '詳細',
      normal: '標準',
      summary: '要約',
      verboseDetail: '公式 Chat ナビゲーション索引に読み込まれたすべてのターンプレビューを表示します。',
      normalDetail: '読み込まれた最新 6 件のターンプレビューを表示します。',
      summaryDetail: '読み込まれた最新 1 件のターンプレビューだけを表示します。',
      selector: '会話の表示方法を選択',
      current: '現在の表示',
      loadedTurns: '読み込み済みターン',
      turn: 'ターン',
      prompt: 'プロンプト',
      response: '応答',
      noTurns: '読み込み済みのターンプレビューはまだありません。',
      unavailable: '読み込み済みの範囲では利用できません。',
      ephemeral: 'この選択はマウント中のビューのメモリだけに保持され、閉じるかアンロードするとリセットされます。',
    })
    const ko = Object.freeze({
      tab: '보기 모드',
      title: '대화 보기 모드',
      verbose: '자세히',
      normal: '일반',
      summary: '요약',
      verboseDetail: '공식 Chat 탐색 인덱스에 로드된 모든 턴 미리보기를 표시합니다.',
      normalDetail: '최근에 로드된 턴 미리보기 6개를 표시합니다.',
      summaryDetail: '가장 최근에 로드된 턴 미리보기만 표시합니다.',
      selector: '대화 표시 방식 선택',
      current: '현재 표시',
      loadedTurns: '로드된 턴',
      turn: '턴',
      prompt: '프롬프트',
      response: '응답',
      noTurns: '아직 사용할 수 있는 로드된 턴 미리보기가 없습니다.',
      unavailable: '로드된 범위에서 사용할 수 없습니다.',
      ephemeral: '이 선택은 마운트된 보기의 메모리에만 유지되며 닫거나 언로드하면 재설정됩니다.',
    })
    const fr = Object.freeze({
      tab: 'Modes d’affichage',
      title: 'Modes d’affichage de la conversation',
      verbose: 'Détaillé',
      normal: 'Normal',
      summary: 'Résumé',
      verboseDetail: 'Afficher tous les aperçus de tours chargés depuis l’index de navigation Chat officiel.',
      normalDetail: 'Afficher les six aperçus de tours chargés les plus récents.',
      summaryDetail: 'Afficher uniquement l’aperçu du dernier tour chargé.',
      selector: 'Choisir la présentation de la conversation',
      current: 'Présentation actuelle',
      loadedTurns: 'Tours chargés',
      turn: 'Tour',
      prompt: 'Invite',
      response: 'Réponse',
      noTurns: 'Aucun aperçu de tour chargé n’est encore disponible.',
      unavailable: 'Indisponible dans la fenêtre chargée.',
      ephemeral: 'Ce choix reste uniquement en mémoire dans cette vue montée et se réinitialise à sa fermeture ou à son déchargement.',
    })
    const de = Object.freeze({
      tab: 'Ansichtsmodi',
      title: 'Ansichtsmodi für Unterhaltungen',
      verbose: 'Ausführlich',
      normal: 'Normal',
      summary: 'Zusammenfassung',
      verboseDetail: 'Alle geladenen Vorschauen aus dem offiziellen Chat-Navigationsindex anzeigen.',
      normalDetail: 'Die sechs zuletzt geladenen Vorschauen anzeigen.',
      summaryDetail: 'Nur die zuletzt geladene Vorschau anzeigen.',
      selector: 'Unterhaltungsdarstellung auswählen',
      current: 'Aktuelle Darstellung',
      loadedTurns: 'Geladene Durchläufe',
      turn: 'Durchlauf',
      prompt: 'Eingabe',
      response: 'Antwort',
      noTurns: 'Es sind noch keine geladenen Vorschauen verfügbar.',
      unavailable: 'Im geladenen Fenster nicht verfügbar.',
      ephemeral: 'Diese Auswahl bleibt nur im Speicher dieser eingebundenen Ansicht und wird beim Schließen oder Entladen zurückgesetzt.',
    })
    const es = Object.freeze({
      tab: 'Modos de vista',
      title: 'Modos de vista de la conversación',
      verbose: 'Detallado',
      normal: 'Normal',
      summary: 'Resumen',
      verboseDetail: 'Mostrar todas las vistas previas cargadas del índice de navegación oficial de Chat.',
      normalDetail: 'Mostrar las seis vistas previas cargadas más recientes.',
      summaryDetail: 'Mostrar solo la vista previa cargada más reciente.',
      selector: 'Elegir la presentación de la conversación',
      current: 'Presentación actual',
      loadedTurns: 'Turnos cargados',
      turn: 'Turno',
      prompt: 'Solicitud',
      response: 'Respuesta',
      noTurns: 'Todavía no hay vistas previas de turnos cargados disponibles.',
      unavailable: 'No disponible en la ventana cargada.',
      ephemeral: 'Esta elección se conserva solo en la memoria de esta vista montada y se restablece al cerrarla o descargarla.',
    })
    const EXTRA_DICTIONARIES = Object.freeze([
      ['zh-Hant', zhHant],
      ['ja', ja],
      ['ko', ko],
      ['fr', fr],
      ['de', de],
      ['es', es],
    ])

    function modeDetail(mode, t) {
      if (mode === 'verbose') return t('verboseDetail')
      if (mode === 'summary') return t('summaryDetail')
      return t('normalDetail')
    }

    function visibleItems(items, mode) {
      if (mode === 'summary') return items.slice(-1)
      if (mode === 'normal') return items.slice(-NORMAL_TURN_LIMIT)
      return items
    }

    function preview(value, t) {
      return value === '' ? t('unavailable') : value
    }

    function modeButtons(mode, setMode, t) {
      return React.createElement('div', {
        className: 'dsh3008-modes',
        role: 'group',
        'aria-label': t('selector'),
        'data-dsh-client-probe': PROBES.memory,
      }, MODE_IDS.map(function (entry) {
        return React.createElement('button', {
          key: entry,
          type: 'button',
          className: 'dsh3008-mode',
          'aria-pressed': mode === entry,
          onClick: function () { setMode(entry) },
        }, t(entry))
      }))
    }

    function turnPreview(item, current, t) {
      return React.createElement('li', {
        className: 'dsh3008-turn',
        'data-current': current,
        key: item.anchorKey,
      },
      React.createElement('strong', null, t('turn') + ' ' + item.turn),
      React.createElement('p', null,
        React.createElement('strong', null, t('prompt') + ': '),
        preview(item.prompt, t)),
      React.createElement('p', null,
        React.createElement('strong', null, t('response') + ': '),
        preview(item.response, t)))
    }

    function ViewModes(props) {
      const [mode, setMode] = React.useState('normal')
      const items = props.useViewChat(function (snapshot) {
        return snapshot === undefined ? EMPTY_ITEMS : snapshot.navigation.items()
      })
      const displayed = visibleItems(items, mode)
      return React.createElement('article', {
        className: 'dsh3008-view',
        'data-dsh-client-probe': PROBES.clientApply + ' ' + PROBES.chatTarget + ' ' + PROBES.navigation + ' ' + PROBES.locales,
        'data-dsh-slot-probe': PROBES.slot,
      },
      React.createElement('header', { className: 'dsh3008-header' },
        React.createElement('h2', null, props.t('title')),
        React.createElement('p', null, modeDetail(mode, props.t)),
        modeButtons(mode, setMode, props.t),
        React.createElement('p', { 'aria-live': 'polite' },
          props.t('current') + ': ' + props.t(mode) + ' · ' + props.t('loadedTurns') + ': ' + items.length),
        React.createElement('p', null, props.t('ephemeral'))),
      displayed.length === 0
        ? React.createElement('p', { className: 'dsh3008-empty' }, props.t('noTurns'))
        : React.createElement('ul', { className: 'dsh3008-turns' }, displayed.map(function (item, index) {
            return turnPreview(item, index === displayed.length - 1, props.t)
          })))
    }

    const inject = ['slots', 'uiConversation', 'locale']

    function registerDictionaries(ctx) {
      const disposers = []
      let disposed = false
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
        if (disposed) return
        disposed = true
        for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)()
      }
    }

    function apply(ctx) {
      ctx.effect(function () { return registerDictionaries(ctx) }, 'dsh-plugin-3008: dictionaries')
      const t = ctx.locale.bind(NS)
      ctx.effect(function () {
        return ctx.slots.inject('conversation.view', function () {
          return ctx.slots.register({
            name: 'conversation.view',
            id: VIEW_ID,
            order: 20,
            label: function () { return t('tab') },
            locale: NS,
            inject: function (sessionId) {
              return {
                hooks: {
                  viewChat: ctx.uiConversation.binding(sessionId).target('chat'),
                },
              }
            },
          }, ViewModes)
        })
      }, 'dsh-plugin-3008: additive conversation view')
    }

    exports.apply = apply
    exports.inject = inject
    exports.reviewProbes = PROBES
    return module.exports
  },
})
