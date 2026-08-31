/**
 * Public plugin #3050 alpha.2 reviewed replacement — browser half.
 *
 * This is a consent-first planning surface. Plans are page-memory values and
 * never run automatically. Only the user's Run now or Schedule click submits
 * a prompt through alpha.2's official Session Controller. Schedule asks the
 * root Agent to use schedule_create; the plugin cannot constrain that choice.
 */
window.__ModuleLoader__.load({
  id: '@dsh-themes/dsh-automation',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    const NS = 'dsh-themes.plugin-3050'
    const STYLE_ID = 'dsh-plugin-3050-automation/client.css'
    const PROBES = Object.freeze({
      clientApply: 'DSH3050_PROBE:CLIENT_APPLY_V1',
      memoryPlans: 'DSH3050_PROBE:MEMORY_ONLY_PLANS_V1',
      explicitRun: 'DSH3050_PROBE:EXPLICIT_RUN_CLICK_V1',
      officialSchedule: 'DSH3050_PROBE:OFFICIAL_SCHEDULE_CREATE_V1',
      sessionController: 'DSH3050_PROBE:OFFICIAL_SESSION_PROMPT_V1',
      rootSessionOnly: 'DSH3050_PROBE:ROOT_SESSION_ONLY_V1',
      inheritedPermissions: 'DSH3050_PROBE:INHERITED_SESSION_PERMISSIONS_V1',
      slots: 'DSH3050_PROBE:ADDITIVE_SLOTS_TWO_V1',
      locales: 'DSH3050_PROBE:LOCALES_EIGHT_V1',
      style: 'DSH3050_PROBE:STYLE_OWNED_V1',
      dispose: 'DSH3050_PROBE:DISPOSE_CLEAN_V1',
    })

    const en = Object.freeze({
      title: 'Automation planner', subtitle: 'Plan first. Run or schedule only on your click.',
      trigger: 'Open automation planner', close: 'Close automation planner', name: 'Plan name',
      namePlaceholder: 'Weekly repository check', prompt: 'Self-contained task',
      promptPlaceholder: 'State the goal, allowed work, evidence, and stopping condition.',
      cadence: 'Schedule type', after: 'After a delay', every: 'Repeat at an interval', at: 'At an exact time',
      minutes: 'Minutes', exactTime: 'RFC 3339 time with offset', add: 'Add plan', plans: 'Plans',
      empty: 'No plans yet. Adding a plan does not create or run a task.', run: 'Run now',
      schedule: 'Ask official Schedule to create', remove: 'Remove plan', noSession: 'Select a regular root session; subagent sessions are not supported.',
      sentRun: 'Run request sent to the current session.', sentSchedule: 'Schedule request sent; verify the official tool result in the conversation.',
      failed: 'The official Session Controller rejected the request.', pending: 'Sending…',
      boundary: 'Plans stay in page memory. Each prompt inherits the root session’s tools and may use them for network, process, or file actions; Schedule is an Agent request, not an enforced tool call.',
      explicit: 'Run and schedule creation require separate user clicks.',
    })
    const zh = Object.freeze({
      title: '自动化计划器', subtitle: '先规划；仅在你点击后运行或定时。', trigger: '打开自动化计划器', close: '关闭自动化计划器',
      name: '计划名称', namePlaceholder: '每周仓库检查', prompt: '完整任务描述', promptPlaceholder: '写明目标、允许的操作、证据与停止条件。',
      cadence: '定时类型', after: '延迟后执行', every: '按间隔重复', at: '指定准确时间', minutes: '分钟', exactTime: '带时区偏移的 RFC 3339 时间',
      add: '添加计划', plans: '计划', empty: '暂无计划。添加计划不会创建或执行任务。', run: '立即运行', schedule: '请求官方 Schedule 创建',
      remove: '删除计划', noSession: '请选择普通根会话；不支持子代理会话。', sentRun: '运行请求已发送到当前会话。', sentSchedule: '定时请求已发送；请在对话中核验官方工具结果。',
      failed: '官方 Session Controller 拒绝了请求。', pending: '正在发送…', boundary: '计划仅保存在页面内存。每次提示会继承根会话的工具，并可能借此访问网络、运行进程或操作文件；定时只是向 Agent 发出请求，并非受插件强制的工具调用。',
      explicit: '立即运行与创建定时均需分别点击确认。',
    })
    const zhHant = Object.freeze({
      title: '自動化計劃器', subtitle: '先規劃；僅在你點擊後執行或排程。', trigger: '開啟自動化計劃器', close: '關閉自動化計劃器',
      name: '計劃名稱', namePlaceholder: '每週儲存庫檢查', prompt: '完整任務描述', promptPlaceholder: '寫明目標、允許的操作、證據與停止條件。',
      cadence: '排程類型', after: '延遲後執行', every: '按間隔重複', at: '指定準確時間', minutes: '分鐘', exactTime: '帶時區偏移的 RFC 3339 時間',
      add: '新增計劃', plans: '計劃', empty: '尚無計劃。新增計劃不會建立或執行任務。', run: '立即執行', schedule: '請求官方 Schedule 建立',
      remove: '移除計劃', noSession: '請選擇一般根會話；不支援子代理會話。', sentRun: '執行請求已傳送到目前會話。', sentSchedule: '排程請求已傳送；請在對話中核對官方工具結果。',
      failed: '官方 Session Controller 拒絕了請求。', pending: '傳送中…', boundary: '計劃僅保留在頁面記憶體。每次提示會繼承根會話的工具，並可能藉此存取網路、執行程序或操作檔案；排程只是向 Agent 發出請求，並非由外掛強制的工具呼叫。',
      explicit: '立即執行與建立排程均需分別點擊確認。',
    })
    const ja = Object.freeze({
      title: '自動化プランナー', subtitle: '先に計画し、クリックした時だけ実行・予約します。', trigger: '自動化プランナーを開く', close: '自動化プランナーを閉じる',
      name: 'プラン名', namePlaceholder: '週次リポジトリ確認', prompt: '自己完結したタスク', promptPlaceholder: '目的、許可範囲、証拠、停止条件を記述します。',
      cadence: 'スケジュール種別', after: '遅延後', every: '一定間隔', at: '正確な日時', minutes: '分', exactTime: 'オフセット付き RFC 3339 時刻',
      add: 'プランを追加', plans: 'プラン', empty: 'プランはありません。追加だけではタスクは作成・実行されません。', run: '今すぐ実行', schedule: '公式 Schedule に作成を依頼',
      remove: 'プランを削除', noSession: '通常のルートセッションを選択してください。サブエージェントには対応しません。', sentRun: '実行依頼を現在のセッションへ送りました。', sentSchedule: '予約依頼を送信しました。会話で公式ツール結果を確認してください。',
      failed: '公式 Session Controller が依頼を拒否しました。', pending: '送信中…', boundary: '各プロンプトはルートセッションのツールを継承し、ネットワーク、プロセス、ファイル操作に使う場合があります。予約は Agent への依頼であり、プラグインが強制するツール呼び出しではありません。',
      explicit: '実行と予約作成には個別のクリックが必要です。',
    })
    const ko = Object.freeze({
      title: '자동화 플래너', subtitle: '먼저 계획하고 클릭할 때만 실행하거나 예약합니다.', trigger: '자동화 플래너 열기', close: '자동화 플래너 닫기',
      name: '계획 이름', namePlaceholder: '주간 저장소 점검', prompt: '독립적인 작업 설명', promptPlaceholder: '목표, 허용 작업, 근거와 중지 조건을 적으세요.',
      cadence: '예약 유형', after: '지연 후', every: '일정 간격 반복', at: '정확한 시간', minutes: '분', exactTime: '오프셋이 있는 RFC 3339 시간',
      add: '계획 추가', plans: '계획', empty: '계획이 없습니다. 추가만으로 작업이 생성되거나 실행되지 않습니다.', run: '지금 실행', schedule: '공식 Schedule에 생성 요청',
      remove: '계획 삭제', noSession: '일반 루트 세션을 선택하세요. 하위 에이전트 세션은 지원하지 않습니다.', sentRun: '현재 세션으로 실행 요청을 보냈습니다.', sentSchedule: '예약 요청을 보냈습니다. 대화에서 공식 도구 결과를 확인하세요.',
      failed: '공식 Session Controller가 요청을 거부했습니다.', pending: '보내는 중…', boundary: '각 프롬프트는 루트 세션의 도구를 상속하며 네트워크, 프로세스 또는 파일 작업에 사용할 수 있습니다. 예약은 Agent에 보내는 요청이며 플러그인이 강제하는 도구 호출이 아닙니다.',
      explicit: '실행과 예약 생성은 각각 사용자의 클릭이 필요합니다.',
    })
    const fr = Object.freeze({
      title: 'Planificateur d’automatisation', subtitle: 'Planifiez, puis exécutez ou programmez uniquement par clic.', trigger: 'Ouvrir le planificateur', close: 'Fermer le planificateur',
      name: 'Nom du plan', namePlaceholder: 'Contrôle hebdomadaire du dépôt', prompt: 'Tâche autonome', promptPlaceholder: 'Indiquez le but, les actions permises, les preuves et l’arrêt.',
      cadence: 'Type de planification', after: 'Après un délai', every: 'À intervalle fixe', at: 'À une heure exacte', minutes: 'Minutes', exactTime: 'Heure RFC 3339 avec décalage',
      add: 'Ajouter le plan', plans: 'Plans', empty: 'Aucun plan. L’ajout ne crée ni n’exécute de tâche.', run: 'Exécuter maintenant', schedule: 'Demander la création à Schedule officiel',
      remove: 'Supprimer le plan', noSession: 'Sélectionnez une session racine normale ; les sous-agents ne sont pas pris en charge.', sentRun: 'Demande envoyée à la session courante.', sentSchedule: 'Demande de planification envoyée ; vérifiez le résultat officiel dans la conversation.',
      failed: 'Le Session Controller officiel a refusé la demande.', pending: 'Envoi…', boundary: 'Chaque prompt hérite des outils de la session racine et peut les employer pour le réseau, les processus ou les fichiers. Schedule est une demande à l’Agent, pas un appel d’outil imposé par le plugin.',
      explicit: 'Exécution et création de planification exigent deux clics explicites.',
    })
    const de = Object.freeze({
      title: 'Automatisierungsplaner', subtitle: 'Erst planen; nur per Klick ausführen oder terminieren.', trigger: 'Automatisierungsplaner öffnen', close: 'Automatisierungsplaner schließen',
      name: 'Planname', namePlaceholder: 'Wöchentliche Repository-Prüfung', prompt: 'Eigenständige Aufgabe', promptPlaceholder: 'Ziel, erlaubte Arbeit, Nachweise und Stoppbedingung angeben.',
      cadence: 'Zeitplantyp', after: 'Nach Verzögerung', every: 'In festem Intervall', at: 'Zu genauer Zeit', minutes: 'Minuten', exactTime: 'RFC-3339-Zeit mit Offset',
      add: 'Plan hinzufügen', plans: 'Pläne', empty: 'Noch keine Pläne. Hinzufügen erstellt oder startet keine Aufgabe.', run: 'Jetzt ausführen', schedule: 'Offiziellen Schedule um Erstellung bitten',
      remove: 'Plan entfernen', noSession: 'Wählen Sie eine normale Root-Session; Subagent-Sessions werden nicht unterstützt.', sentRun: 'Ausführungsanfrage an die aktuelle Session gesendet.', sentSchedule: 'Zeitplananfrage gesendet; prüfen Sie das offizielle Tool-Ergebnis im Gespräch.',
      failed: 'Der offizielle Session Controller hat die Anfrage abgelehnt.', pending: 'Senden…', boundary: 'Jeder Prompt erbt die Tools der Root-Session und kann sie für Netzwerk-, Prozess- oder Dateiaktionen einsetzen. Schedule ist eine Agent-Anfrage, kein vom Plugin erzwungener Tool-Aufruf.',
      explicit: 'Ausführung und Zeitplanerstellung benötigen jeweils einen Klick.',
    })
    const es = Object.freeze({
      title: 'Planificador de automatización', subtitle: 'Planifica y ejecuta o programa solo con tu clic.', trigger: 'Abrir el planificador', close: 'Cerrar el planificador',
      name: 'Nombre del plan', namePlaceholder: 'Revisión semanal del repositorio', prompt: 'Tarea autocontenida', promptPlaceholder: 'Indica objetivo, acciones permitidas, pruebas y condición de parada.',
      cadence: 'Tipo de horario', after: 'Tras una espera', every: 'A intervalo fijo', at: 'A una hora exacta', minutes: 'Minutos', exactTime: 'Hora RFC 3339 con desplazamiento',
      add: 'Añadir plan', plans: 'Planes', empty: 'No hay planes. Añadir uno no crea ni ejecuta tareas.', run: 'Ejecutar ahora', schedule: 'Pedir creación al Schedule oficial',
      remove: 'Eliminar plan', noSession: 'Selecciona una sesión raíz normal; no se admiten sesiones de subagente.', sentRun: 'Solicitud enviada a la sesión actual.', sentSchedule: 'Solicitud de horario enviada; verifica el resultado oficial en la conversación.',
      failed: 'El Session Controller oficial rechazó la solicitud.', pending: 'Enviando…', boundary: 'Cada prompt hereda las herramientas de la sesión raíz y puede usarlas para acciones de red, procesos o archivos. Schedule es una solicitud al Agent, no una llamada de herramienta impuesta por el plugin.',
      explicit: 'Ejecutar y crear el horario requieren clics separados.',
    })
    const EXTRA_DICTIONARIES = Object.freeze([
      ['zh-Hant', zhHant], ['ja', ja], ['ko', ko], ['fr', fr], ['de', de], ['es', es],
    ])

    const CSS = [
      '.dsh3050-trigger{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:38px;padding:0 8px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary,inherit);font:500 14px/20px inherit;cursor:pointer}.dsh3050-trigger:hover,.dsh3050-trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}.dsh3050-trigger:focus-visible,.dsh3050-button:focus-visible,.dsh3050-input:focus-visible,.dsh3050-select:focus-visible,.dsh3050-textarea:focus-visible,.dsh3050-close:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4176e6);outline-offset:2px}.dsh3050-icon{display:grid;flex:none;width:20px;height:20px;place-items:center;font-size:17px}.dsh3050-copy{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh3050-rail{justify-content:center;width:36px;height:36px;padding:0;border-radius:50%}',
      '.dsh3050-layer{position:absolute;inset:0;z-index:45;display:grid;place-items:center;padding:18px;pointer-events:none}.dsh3050-backdrop{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.48));pointer-events:auto}.dsh3050-panel{position:relative;z-index:1;box-sizing:border-box;display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(980px,96vw);height:min(720px,92vh);min-height:0;overflow:hidden;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:16px;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#1f2024);box-shadow:var(--dsw-shadow-lv3,0 20px 64px rgba(0,0,0,.35));font:14px/1.45 inherit;pointer-events:auto}',
      '.dsh3050-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}.dsh3050-title{margin:0;font-size:17px;line-height:24px}.dsh3050-subtitle{display:block;margin-top:2px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px}.dsh3050-close{flex:none;width:34px;height:34px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:9px;background:var(--dsw-alias-button-elevated-fill,rgba(127,127,127,.08));color:inherit;font-size:17px;cursor:pointer}',
      '.dsh3050-body{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:0;min-height:0;overflow:hidden}.dsh3050-form{display:flex;flex-direction:column;gap:11px;padding:14px;border-right:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));overflow:auto}.dsh3050-field{display:grid;gap:5px}.dsh3050-label{font-size:12px;font-weight:600}.dsh3050-input,.dsh3050-select,.dsh3050-textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:9px;background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font:14px/20px inherit}.dsh3050-input,.dsh3050-select{height:36px;padding:6px 9px}.dsh3050-textarea{min-height:132px;padding:8px 9px;resize:vertical}.dsh3050-button{min-height:36px;padding:7px 11px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:9px;background:var(--dsw-alias-button-elevated-fill,rgba(127,127,127,.08));color:inherit;font:600 13px/20px inherit;cursor:pointer}.dsh3050-primary{border-color:transparent;background:var(--dsw-alias-brand-primary,#4176e6);color:#fff}.dsh3050-button:disabled{cursor:not-allowed;opacity:.55}',
      '.dsh3050-list-region{min-width:0;min-height:0;padding:14px;overflow:auto;background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-module-platform,rgba(127,127,127,.04)))}.dsh3050-list-title{margin:0 0 10px;font-size:14px}.dsh3050-list{display:grid;gap:9px}.dsh3050-empty{display:grid;min-height:140px;place-items:center;padding:18px;border:1px dashed var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:12px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:14px;text-align:center}.dsh3050-card{display:grid;gap:9px;padding:12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18));border-radius:12px;background:var(--dsw-alias-bg-layer-1,#fff)}.dsh3050-card h3{margin:0;font-size:14px;line-height:20px}.dsh3050-card p{display:-webkit-box;overflow:hidden;margin:0;color:var(--dsw-alias-label-secondary,inherit);font-size:12px;line-height:17px;-webkit-box-orient:vertical;-webkit-line-clamp:3}.dsh3050-meta{color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px}.dsh3050-actions{display:flex;flex-wrap:wrap;gap:7px}.dsh3050-message{min-height:18px;color:var(--dsw-alias-label-secondary,inherit);font-size:12px}',
      '.dsh3050-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 14px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:12px}.dsh3050-footer span{min-width:0}',
      '@media(max-width:720px){.dsh3050-layer{padding:8px}.dsh3050-panel{width:100%;height:100%;border-radius:12px}.dsh3050-body{grid-template-columns:1fr;overflow:auto}.dsh3050-form{border-right:0;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));overflow:visible}.dsh3050-list-region{overflow:visible}.dsh3050-footer{align-items:flex-start;flex-direction:column}}',
      '@media(prefers-reduced-motion:reduce){.dsh3050-trigger,.dsh3050-panel,.dsh3050-button{scroll-behavior:auto!important;transition:none!important}}',
    ].join('\n')

    function createController() {
      let visible = false
      let returnFocusTarget = null
      const listeners = new Set()
      function emit() { for (const listener of Array.from(listeners)) listener() }
      return Object.freeze({
        getSnapshot: function () { return visible },
        subscribe: function (listener) { listeners.add(listener); return function () { listeners.delete(listener) } },
        show: function (event) {
          if (visible) return
          const target = event && event.currentTarget
          returnFocusTarget = target && typeof target.focus === 'function' ? target : null
          visible = true
          emit()
        },
        hide: function () {
          if (!visible) return
          visible = false
          const target = returnFocusTarget
          returnFocusTarget = null
          emit()
          Promise.resolve().then(function () { if (target && target.isConnected === true) target.focus() })
        },
        dispose: function () { visible = false; returnFocusTarget = null; listeners.clear() },
      })
    }

    function useController(controller) {
      return React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    }

    function FooterAction(props) {
      const visible = useController(props.controller)
      return React.createElement('button', {
        type: 'button', className: 'dsh3050-trigger' + (props.wide ? '' : ' dsh3050-rail'),
        'aria-label': props.t('trigger'), 'aria-expanded': visible, onClick: props.controller.show,
        'data-dsh-automation-slots': PROBES.slots,
      }, React.createElement('span', { className: 'dsh3050-icon', 'aria-hidden': true }, '◷'),
      props.wide ? React.createElement('span', { className: 'dsh3050-copy' }, props.t('title')) : null)
    }

    function scheduleArguments(plan) {
      if (plan.kind === 'after') return { prompt: plan.prompt, after_seconds: Number(plan.value) * 60 }
      if (plan.kind === 'every') return { prompt: plan.prompt, every_seconds: Number(plan.value) * 60 }
      return { prompt: plan.prompt, at: plan.value }
    }

    function scheduleRequest(plan) {
      return [
        'This is my explicit request to create one reminder in this current session.',
        'This plugin can only submit this request; it cannot call or constrain tools itself.',
        'If the official alpha.2 schedule_create tool is available in this root session, call it exactly once with the following JSON arguments.',
        'If that tool is unavailable, do not substitute another mechanism and report that no reminder was created.',
        'Do not substitute a plugin-owned timer, file, process, network call, or background task.',
        JSON.stringify(scheduleArguments(plan)),
        'Return the exact official tool result so I can verify the reminder id and delivery mode.',
      ].join('\n')
    }

    async function submitPrompt(session, text, signal) {
      const handle = session.beginSubmission({ text, images: [] })
      const result = await session.prompt([{ type: 'text', text }], 'queue', signal, handle.requestId)
      return result.ok === true
    }

    function ownDataValue(record, key) {
      for (const [entryKey, entryValue] of Object.entries(record)) {
        if (entryKey === key) return entryValue
      }
      return undefined
    }

    function regularRootSessionId(sessions) {
      const currentId = sessions.current
      const currentSummary = currentId === undefined ? undefined : ownDataValue(sessions.byId, currentId)
      return currentId !== undefined && sessions.currentAddress === undefined &&
        currentSummary !== undefined && currentSummary.origin !== 'subagent'
        ? currentId
        : undefined
    }

    function PlannerOverlay(props) {
      const visible = useController(props.controller)
      const sessions = props.useSessions(function (state) { return state })
      const [name, setName] = React.useState('')
      const [prompt, setPrompt] = React.useState('')
      const [kind, setKind] = React.useState('after')
      const [value, setValue] = React.useState('30')
      const [plans, setPlans] = React.useState(function () { return [] })
      const [busy, setBusy] = React.useState('')
      const [message, setMessage] = React.useState('')
      const sequence = React.useRef(1)
      const aborter = React.useRef(null)
      const panelRef = React.useRef(null)

      React.useEffect(function () {
        return function () { if (aborter.current !== null) aborter.current.abort() }
      }, [])

      React.useEffect(function () {
        if (!visible) return undefined
        function onKey(event) {
          if (event.key === 'Escape') props.controller.hide()
          if (event.key !== 'Tab' || panelRef.current === null) return
          const focusable = panelRef.current.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')
          if (focusable.length === 0) { event.preventDefault(); return }
          const first = focusable.item(0)
          const last = focusable.item(focusable.length - 1)
          if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus() }
          else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus() }
        }
        document.addEventListener('keydown', onKey)
        return function () { document.removeEventListener('keydown', onKey) }
      }, [visible, props.controller])

      if (!visible) return null

      function addPlan(event) {
        event.preventDefault()
        const nextName = name.trim()
        const nextPrompt = prompt.trim()
        const numeric = Number(value)
        const validValue = kind === 'at'
          ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.trim())
          : Number.isSafeInteger(numeric) && numeric > 0 && (kind !== 'every' || numeric >= 5)
        if (nextName === '' || nextPrompt === '' || !validValue) return
        const id = 'plan-' + String(sequence.current++)
        setPlans(function (current) { return current.concat([{ id, name: nextName, prompt: nextPrompt, kind, value: value.trim() }]) })
        setName('')
        setPrompt('')
        setMessage('')
      }

      async function act(action, plan) {
        const currentId = regularRootSessionId(sessions)
        const session = currentId === undefined ? undefined : props.sessionFor(currentId)
        if (session === undefined) { setMessage(props.t('noSession')); return }
        if (aborter.current !== null) aborter.current.abort()
        const controller = new AbortController()
        aborter.current = controller
        setBusy(action + ':' + plan.id)
        setMessage('')
        const text = action === 'run' ? plan.prompt : scheduleRequest(plan)
        let accepted = false
        try { accepted = await submitPrompt(session, text, controller.signal) } catch (error) { accepted = false }
        if (aborter.current === controller) aborter.current = null
        setBusy('')
        setMessage(accepted ? props.t(action === 'run' ? 'sentRun' : 'sentSchedule') : props.t('failed'))
      }

      function cadenceLabel(plan) {
        if (plan.kind === 'at') return props.t('at') + ': ' + plan.value
        return props.t(plan.kind) + ': ' + plan.value + ' ' + props.t('minutes')
      }

      const formNode = React.createElement('form', { className: 'dsh3050-form', onSubmit: addPlan },
        React.createElement('label', { className: 'dsh3050-field' }, React.createElement('span', { className: 'dsh3050-label' }, props.t('name')), React.createElement('input', { className: 'dsh3050-input', value: name, maxLength: 80, required: true, placeholder: props.t('namePlaceholder'), onChange: function (event) { setName(event.target.value) } })),
        React.createElement('label', { className: 'dsh3050-field' }, React.createElement('span', { className: 'dsh3050-label' }, props.t('prompt')), React.createElement('textarea', { className: 'dsh3050-textarea', value: prompt, maxLength: 4000, required: true, placeholder: props.t('promptPlaceholder'), onChange: function (event) { setPrompt(event.target.value) } })),
        React.createElement('label', { className: 'dsh3050-field' }, React.createElement('span', { className: 'dsh3050-label' }, props.t('cadence')), React.createElement('select', { className: 'dsh3050-select', value: kind, onChange: function (event) { const next = event.target.value; setKind(next); setValue(next === 'at' ? '' : next === 'every' ? '60' : '30') } },
          React.createElement('option', { value: 'after' }, props.t('after')), React.createElement('option', { value: 'every' }, props.t('every')), React.createElement('option', { value: 'at' }, props.t('at')))),
        React.createElement('label', { className: 'dsh3050-field' }, React.createElement('span', { className: 'dsh3050-label' }, props.t(kind === 'at' ? 'exactTime' : 'minutes')), React.createElement('input', { className: 'dsh3050-input', type: kind === 'at' ? 'text' : 'number', min: kind === 'every' ? 5 : 1, step: 1, value, required: true, placeholder: kind === 'at' ? '2026-09-01T09:30+08:00' : '', onChange: function (event) { setValue(event.target.value) } })),
        React.createElement('button', { type: 'submit', className: 'dsh3050-button dsh3050-primary' }, props.t('add')))

      const planNodes = plans.length === 0
        ? React.createElement('div', { className: 'dsh3050-empty' }, props.t('empty'))
        : plans.map(function (plan) {
          const runKey = 'run:' + plan.id
          const scheduleKey = 'schedule:' + plan.id
          return React.createElement('article', { className: 'dsh3050-card', key: plan.id },
            React.createElement('h3', null, plan.name),
            React.createElement('p', null, plan.prompt),
            React.createElement('span', { className: 'dsh3050-meta' }, cadenceLabel(plan)),
            React.createElement('div', { className: 'dsh3050-actions' },
              React.createElement('button', { type: 'button', className: 'dsh3050-button dsh3050-primary', disabled: busy !== '', onClick: function () { void act('run', plan) }, 'data-dsh-automation-run': PROBES.explicitRun }, busy === runKey ? props.t('pending') : props.t('run')),
              React.createElement('button', { type: 'button', className: 'dsh3050-button', disabled: busy !== '', onClick: function () { void act('schedule', plan) }, 'data-dsh-automation-schedule': PROBES.officialSchedule }, busy === scheduleKey ? props.t('pending') : props.t('schedule')),
              React.createElement('button', { type: 'button', className: 'dsh3050-button', disabled: busy !== '', onClick: function () { setPlans(function (current) { return current.filter(function (item) { return item.id !== plan.id }) }) } }, props.t('remove'))))
        })

      const listNode = React.createElement('section', { className: 'dsh3050-list-region', 'aria-labelledby': 'dsh3050-plans' },
        React.createElement('h2', { className: 'dsh3050-list-title', id: 'dsh3050-plans' }, props.t('plans')),
        React.createElement('div', { className: 'dsh3050-list' }, planNodes))

      return React.createElement('div', {
        className: 'dsh3050-layer', 'data-dsh-automation-memory': PROBES.memoryPlans,
        'data-dsh-automation-locales': PROBES.locales, 'data-dsh-automation-session': PROBES.sessionController,
        'data-dsh-automation-root-only': PROBES.rootSessionOnly,
        'data-dsh-automation-inherited-permissions': PROBES.inheritedPermissions,
      },
      React.createElement('button', { type: 'button', tabIndex: -1, className: 'dsh3050-backdrop', 'aria-label': props.t('close'), onClick: props.controller.hide }),
      React.createElement('section', { className: 'dsh3050-panel', ref: panelRef, role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'dsh3050-title' },
        React.createElement('header', { className: 'dsh3050-header' },
          React.createElement('div', null,
            React.createElement('h2', { className: 'dsh3050-title', id: 'dsh3050-title' }, props.t('title')),
            React.createElement('span', { className: 'dsh3050-subtitle' }, props.t('subtitle'))),
          React.createElement('button', { type: 'button', className: 'dsh3050-close', autoFocus: true, 'aria-label': props.t('close'), onClick: props.controller.hide }, '×')),
        React.createElement('div', { className: 'dsh3050-body' }, formNode, listNode),
        React.createElement('footer', { className: 'dsh3050-footer' },
          React.createElement('span', null, props.t('boundary')),
          React.createElement('span', null, message || props.t('explicit')))))
    }

    const inject = ['slots', 'sessions', 'locale']

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
      ctx.effect(function () { return controller.dispose }, 'dsh-plugin-3050: memory controller')
      ctx.effect(function () {
        if (typeof document === 'undefined') return function () {}
        const selector = 'style[data-dsh-plugin-css="' + STYLE_ID + '"]'
        if (document.querySelector(selector) !== null) throw new Error('duplicate #3050 owned style')
        const tag = document.createElement('style')
        tag.dataset.dshPluginCss = STYLE_ID
        tag.dataset.dshProbe = PROBES.style
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () { tag.remove() }
      }, 'dsh-plugin-3050: owned style')
      ctx.effect(function () { return registerDictionaries(ctx) }, 'dsh-plugin-3050: dictionaries')

      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register({ name: 'sidebar.footer.action', id: 'dsh-automation-planner-trigger', order: 72, locale: NS, inject: function () { return { controller } } }, FooterAction)
      })
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({
          name: 'shell.overlay', id: 'dsh-automation-planner', order: 42, locale: NS,
          inject: function () { return { controller, sessionFor: function (sessionId) { const binding = ctx.sessions.binding(sessionId); return binding === undefined ? undefined : binding.session } } },
        }, PlannerOverlay)
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.reviewProbes = PROBES
    exports.reviewRegularRootSessionId = regularRootSessionId
    return module.exports
  },
})
