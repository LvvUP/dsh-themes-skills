/**
 * Browser-only Plugin List Plus for DeepSeek Harness 0.1.2-alpha.1.
 *
 * The official pluginInventory Remote is the sole data authority. This client
 * adds search, neutral namespace grouping, and collapsible groups/cards while
 * keeping all state local to the mounted tab.
 */

import type { PluginInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import * as React from 'react'

const { useEffect, useId, useMemo, useState } = React

type LocaleKey = keyof typeof zh
type InventoryEntry = PluginInventorySnapshot['entries'][number]
type FiberPhase = InventoryEntry['fiberPhase']
type GroupId = 'harness' | 'scoped' | 'unscoped'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Browser-only, read-only enhanced plugin inventory copy. */
    'settings.pluginListPlus': LocaleKey
  }
}

export interface PluginListPlusInjected {
  list: () => Promise<PluginInventorySnapshot>
}

export type PluginListPlusProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginListPlus'>
  & InjectFace<PluginListPlusInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: PluginInventorySnapshot }

export const NS = 'settings.pluginListPlus'
export const inject = ['slots', 'locale', 'remote', 'remote.pluginInventory']

const PACKAGE_NAME = '@dsh-themes/plugin-list-plus'
const GROUP_ORDER: readonly GroupId[] = ['harness', 'scoped', 'unscoped']
const GROUP_LABELS = new Map<GroupId, LocaleKey>([
  ['harness', 'groupHarness'],
  ['scoped', 'groupScoped'],
  ['unscoped', 'groupUnscoped'],
])
const GROUP_HINTS = new Map<GroupId, LocaleKey>([
  ['harness', 'groupHarnessHint'],
  ['scoped', 'groupScopedHint'],
  ['unscoped', 'groupUnscopedHint'],
])
const PHASE_LABELS = new Map<Exclude<FiberPhase, null>, LocaleKey>([
  ['pending', 'pending'],
  ['loading', 'loadingPhase'],
  ['active', 'active'],
  ['failed', 'failed'],
  ['unloading', 'unloading'],
])

export const zh = {
  tab: '插件列表 Plus',
  loading: '正在读取插件…',
  error: '暂时无法读取插件。',
  retry: '重试',
  search: '搜索插件名称或入口 ID',
  empty: '暂无插件。',
  emptySearch: '没有匹配的插件。',
  groupHarness: 'Harness 与 Cordis 命名空间',
  groupHarnessHint: '模块标识以 @deepseek-ai/ 或 cordis: 开头。此分组只描述名称形式。',
  groupScoped: '其他作用域命名空间',
  groupScopedHint: '模块标识使用其他 @scope/name 形式。此分组不代表信任评级。',
  groupUnscoped: '无作用域与本地标识',
  groupUnscopedHint: '无作用域包名、路径或其他模块标识。请按实际来源分别判断。',
  collapseGroup: '收起该组',
  expandGroup: '展开该组',
  enabledTag: '已启用',
  disabledTag: '已停用',
  entryId: '入口 ID',
  moduleName: '模块标识',
  configuration: '配置状态',
  cordis: 'Cordis 状态',
  unobserved: '未挂载',
  pending: '等待依赖',
  loadingPhase: '加载中',
  active: '已挂载',
  failed: '挂载失败',
  unloading: '卸载中',
} as const

export const en = {
  tab: 'Plugin list Plus',
  loading: 'Reading plugins…',
  error: 'Plugins are temporarily unavailable.',
  retry: 'Retry',
  search: 'Search module name or entry ID',
  empty: 'No plugins are available.',
  emptySearch: 'No matching plugins.',
  groupHarness: 'Harness and Cordis namespaces',
  groupHarnessHint: 'Module identifiers beginning with @deepseek-ai/ or cordis:. This is naming metadata only.',
  groupScoped: 'Other scoped namespaces',
  groupScopedHint: 'Module identifiers using another @scope/name form. This is not a trust rating.',
  groupUnscoped: 'Unscoped and local identifiers',
  groupUnscopedHint: 'Unscoped package names, paths, and other module identifiers. Assess each source separately.',
  collapseGroup: 'Collapse group',
  expandGroup: 'Expand group',
  enabledTag: 'Enabled',
  disabledTag: 'Disabled',
  entryId: 'Entry ID',
  moduleName: 'Module identifier',
  configuration: 'Configuration',
  cordis: 'Cordis status',
  unobserved: 'Not mounted',
  pending: 'Waiting for dependencies',
  loadingPhase: 'Loading',
  active: 'Mounted',
  failed: 'Mount failed',
  unloading: 'Unloading',
} as const satisfies Record<LocaleKey, string>

export const zhHant = {
  tab: '外掛程式清單 Plus',
  loading: '正在讀取外掛程式…',
  error: '暫時無法讀取外掛程式。',
  retry: '重試',
  search: '搜尋模組名稱或入口 ID',
  empty: '目前沒有可用的外掛程式。',
  emptySearch: '沒有符合的外掛程式。',
  groupHarness: 'Harness 與 Cordis 命名空間',
  groupHarnessHint: '以 @deepseek-ai/ 或 cordis: 開頭的模組識別碼。此分組僅描述命名資訊。',
  groupScoped: '其他具作用域的命名空間',
  groupScopedHint: '使用其他 @scope/name 格式的模組識別碼。此分組不代表信任評級。',
  groupUnscoped: '無作用域與本機識別碼',
  groupUnscopedHint: '無作用域的套件名稱、路徑及其他模組識別碼。請分別評估各個來源。',
  collapseGroup: '收合此群組',
  expandGroup: '展開此群組',
  enabledTag: '已啟用',
  disabledTag: '已停用',
  entryId: '入口 ID',
  moduleName: '模組識別碼',
  configuration: '設定狀態',
  cordis: 'Cordis 狀態',
  unobserved: '未掛載',
  pending: '正在等待相依項目',
  loadingPhase: '載入中',
  active: '已掛載',
  failed: '掛載失敗',
  unloading: '卸載中',
} as const satisfies Record<LocaleKey, string>

export const ja = {
  tab: 'プラグイン一覧 Plus',
  loading: 'プラグインを読み込んでいます…',
  error: '現在プラグインを読み込めません。',
  retry: '再試行',
  search: 'モジュール名またはエントリ ID を検索',
  empty: '利用可能なプラグインはありません。',
  emptySearch: '一致するプラグインはありません。',
  groupHarness: 'Harness と Cordis の名前空間',
  groupHarnessHint: '@deepseek-ai/ または cordis: で始まるモジュール識別子です。この分類は命名情報のみを示します。',
  groupScoped: 'その他のスコープ付き名前空間',
  groupScopedHint: '別の @scope/name 形式を使用するモジュール識別子です。信頼性の評価を示すものではありません。',
  groupUnscoped: 'スコープなしおよびローカルの識別子',
  groupUnscopedHint: 'スコープなしのパッケージ名、パス、その他のモジュール識別子です。ソースごとに個別に評価してください。',
  collapseGroup: 'このグループを折りたたむ',
  expandGroup: 'このグループを展開',
  enabledTag: '有効',
  disabledTag: '無効',
  entryId: 'エントリ ID',
  moduleName: 'モジュール識別子',
  configuration: '構成状態',
  cordis: 'Cordis の状態',
  unobserved: '未マウント',
  pending: '依存関係を待機中',
  loadingPhase: '読み込み中',
  active: 'マウント済み',
  failed: 'マウント失敗',
  unloading: 'アンマウント中',
} as const satisfies Record<LocaleKey, string>

export const ko = {
  tab: '플러그인 목록 Plus',
  loading: '플러그인을 불러오는 중…',
  error: '현재 플러그인을 불러올 수 없습니다.',
  retry: '다시 시도',
  search: '모듈 이름 또는 엔트리 ID 검색',
  empty: '사용할 수 있는 플러그인이 없습니다.',
  emptySearch: '일치하는 플러그인이 없습니다.',
  groupHarness: 'Harness 및 Cordis 네임스페이스',
  groupHarnessHint: '@deepseek-ai/ 또는 cordis:로 시작하는 모듈 식별자입니다. 이 분류는 이름 형식만 나타냅니다.',
  groupScoped: '기타 스코프 네임스페이스',
  groupScopedHint: '다른 @scope/name 형식을 사용하는 모듈 식별자입니다. 신뢰도 등급을 의미하지 않습니다.',
  groupUnscoped: '스코프 없는 식별자 및 로컬 식별자',
  groupUnscopedHint: '스코프 없는 패키지 이름, 경로 및 기타 모듈 식별자입니다. 각 출처를 개별적으로 평가하세요.',
  collapseGroup: '그룹 접기',
  expandGroup: '그룹 펼치기',
  enabledTag: '활성화됨',
  disabledTag: '비활성화됨',
  entryId: '엔트리 ID',
  moduleName: '모듈 식별자',
  configuration: '구성 상태',
  cordis: 'Cordis 상태',
  unobserved: '마운트되지 않음',
  pending: '종속 항목 대기 중',
  loadingPhase: '로드 중',
  active: '마운트됨',
  failed: '마운트 실패',
  unloading: '마운트 해제 중',
} as const satisfies Record<LocaleKey, string>

export const fr = {
  tab: 'Liste des plugins Plus',
  loading: 'Chargement des plugins…',
  error: 'Les plugins sont temporairement indisponibles.',
  retry: 'Réessayer',
  search: 'Rechercher par nom de module ou ID d’entrée',
  empty: 'Aucun plugin n’est disponible.',
  emptySearch: 'Aucun plugin correspondant.',
  groupHarness: 'Espaces de noms Harness et Cordis',
  groupHarnessHint: 'Identifiants de module commençant par @deepseek-ai/ ou cordis:. Ce regroupement décrit uniquement la convention de nommage.',
  groupScoped: 'Autres espaces de noms avec scope',
  groupScopedHint: 'Identifiants de module suivant une autre forme @scope/name. Ce regroupement ne constitue pas une évaluation de confiance.',
  groupUnscoped: 'Identifiants sans scope et locaux',
  groupUnscopedHint: 'Noms de paquets sans scope, chemins et autres identifiants de module. Évaluez chaque source séparément.',
  collapseGroup: 'Replier le groupe',
  expandGroup: 'Déplier le groupe',
  enabledTag: 'Activé',
  disabledTag: 'Désactivé',
  entryId: 'ID d’entrée',
  moduleName: 'Identifiant du module',
  configuration: 'Configuration',
  cordis: 'État de Cordis',
  unobserved: 'Non monté',
  pending: 'En attente des dépendances',
  loadingPhase: 'Chargement',
  active: 'Monté',
  failed: 'Échec du montage',
  unloading: 'Démontage',
} as const satisfies Record<LocaleKey, string>

export const de = {
  tab: 'Pluginliste Plus',
  loading: 'Plugins werden eingelesen…',
  error: 'Plugins sind vorübergehend nicht verfügbar.',
  retry: 'Erneut versuchen',
  search: 'Nach Modulname oder Eintrags-ID suchen',
  empty: 'Keine Plugins verfügbar.',
  emptySearch: 'Keine passenden Plugins.',
  groupHarness: 'Harness- und Cordis-Namensräume',
  groupHarnessHint: 'Modulkennungen, die mit @deepseek-ai/ oder cordis: beginnen. Diese Gruppierung beschreibt nur die Namensform.',
  groupScoped: 'Andere Namensräume mit Scope',
  groupScopedHint: 'Modulkennungen in einer anderen @scope/name-Form. Dies ist keine Vertrauensbewertung.',
  groupUnscoped: 'Kennungen ohne Scope und lokale Kennungen',
  groupUnscopedHint: 'Paketnamen ohne Scope, Pfade und andere Modulkennungen. Bewerten Sie jede Quelle separat.',
  collapseGroup: 'Gruppe einklappen',
  expandGroup: 'Gruppe ausklappen',
  enabledTag: 'Aktiviert',
  disabledTag: 'Deaktiviert',
  entryId: 'Eintrags-ID',
  moduleName: 'Modulkennung',
  configuration: 'Konfiguration',
  cordis: 'Cordis-Status',
  unobserved: 'Nicht eingebunden',
  pending: 'Warten auf Abhängigkeiten',
  loadingPhase: 'Wird geladen',
  active: 'Eingebunden',
  failed: 'Einbinden fehlgeschlagen',
  unloading: 'Wird entladen',
} as const satisfies Record<LocaleKey, string>

export const es = {
  tab: 'Lista de plugins Plus',
  loading: 'Cargando plugins…',
  error: 'Los plugins no están disponibles temporalmente.',
  retry: 'Reintentar',
  search: 'Buscar por nombre de módulo o ID de entrada',
  empty: 'No hay plugins disponibles.',
  emptySearch: 'Ningún plugin coincide con la búsqueda.',
  groupHarness: 'Espacios de nombres de Harness y Cordis',
  groupHarnessHint: 'Identificadores de módulo que comienzan con @deepseek-ai/ o cordis:. Esta agrupación solo describe la nomenclatura.',
  groupScoped: 'Otros espacios de nombres con ámbito',
  groupScopedHint: 'Identificadores de módulo que usan otro formato @scope/name. Esto no representa una calificación de confianza.',
  groupUnscoped: 'Identificadores sin ámbito y locales',
  groupUnscopedHint: 'Nombres de paquetes sin ámbito, rutas y otros identificadores de módulo. Cada fuente se debe evaluar por separado.',
  collapseGroup: 'Contraer el grupo',
  expandGroup: 'Expandir el grupo',
  enabledTag: 'Habilitado',
  disabledTag: 'Deshabilitado',
  entryId: 'ID de entrada',
  moduleName: 'Identificador del módulo',
  configuration: 'Configuración',
  cordis: 'Estado de Cordis',
  unobserved: 'Sin montar',
  pending: 'Esperando dependencias',
  loadingPhase: 'Cargando',
  active: 'Montado',
  failed: 'Error al montar',
  unloading: 'Desmontando',
} as const satisfies Record<LocaleKey, string>

const EXTRA_DICTIONARIES = [
  ['zh-Hant', zhHant],
  ['ja', ja],
  ['ko', ko],
  ['fr', fr],
  ['de', de],
  ['es', es],
] as const

const CSS = `
.dsh-plp{display:grid;gap:16px;color:inherit}.dsh-plp__status{margin:0;padding:18px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:12px}.dsh-plp__failure{display:flex;align-items:center;justify-content:space-between;gap:12px}.dsh-plp__failure p{margin:0}.dsh-plp button,.dsh-plp input{font:inherit;color:inherit}.dsh-plp__retry{border:1px solid color-mix(in srgb,currentColor 24%,transparent);border-radius:8px;padding:6px 10px;background:transparent;cursor:pointer}.dsh-plp__search{display:flex;align-items:center;gap:8px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:10px;padding:0 12px}.dsh-plp__search input{width:100%;min-height:40px;border:0;outline:0;background:transparent}.dsh-plp__group{display:grid;gap:8px}.dsh-plp__heading{margin:0}.dsh-plp__group-toggle{width:100%;display:flex;align-items:center;gap:10px;padding:8px 0;border:0;background:transparent;text-align:left;cursor:pointer}.dsh-plp__count{min-width:24px;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,currentColor 10%,transparent);font-size:12px;text-align:center}.dsh-plp__chevron{margin-left:auto;transition:transform .15s ease}.dsh-plp__group-toggle[aria-expanded=false] .dsh-plp__chevron,.dsh-plp__card-toggle[aria-expanded=false] .dsh-plp__chevron{transform:rotate(-90deg)}.dsh-plp__hint{margin:0 0 4px;color:color-mix(in srgb,currentColor 68%,transparent);font-size:12px;line-height:1.5}.dsh-plp__cards{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:8px;margin:0;padding:0}.dsh-plp__card{border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:10px;overflow:hidden}.dsh-plp__card-toggle{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;border:0;background:transparent;text-align:left;cursor:pointer}.dsh-plp__title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-plp__trailing{display:flex;align-items:center;gap:7px}.dsh-plp__tag{font-size:12px;padding:2px 7px;border-radius:999px;background:color-mix(in srgb,currentColor 9%,transparent)}.dsh-plp__dot{width:8px;height:8px;border-radius:50%;background:#8a8a8a}.dsh-plp__dot[data-phase=active]{background:#2aa66a}.dsh-plp__dot[data-phase=failed]{background:#d95050}.dsh-plp__dot[data-phase=loading],.dsh-plp__dot[data-phase=pending]{background:#d49a2a}.dsh-plp__details{display:grid;gap:8px;margin:0;padding:10px 12px 12px;border-top:1px solid color-mix(in srgb,currentColor 10%,transparent)}.dsh-plp__details div{display:grid;gap:2px}.dsh-plp__details dt{font-size:12px;color:color-mix(in srgb,currentColor 62%,transparent)}.dsh-plp__details dd{margin:0;overflow-wrap:anywhere}.dsh-plp__details code{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.dsh-plp__empty{margin:0;padding:10px 0;color:color-mix(in srgb,currentColor 62%,transparent)}.dsh-plp__sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media (prefers-reduced-motion:reduce){.dsh-plp__chevron{transition:none}}
`

function installStyle(): () => void {
  if (typeof document === 'undefined') return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = PACKAGE_NAME
  tag.dataset.pluginCss = `${PACKAGE_NAME}/runtime`
  tag.textContent = CSS
  document.head.appendChild(tag)
  return () => { tag.remove() }
}

function groupOf(moduleName: string): GroupId {
  if (moduleName.startsWith('@deepseek-ai/') || moduleName.startsWith('cordis:')) return 'harness'
  if (/^@[^/]+\/[^/]+/.test(moduleName)) return 'scoped'
  return 'unscoped'
}

function shortName(moduleName: string): string {
  const slash = moduleName.indexOf('/')
  const unscoped = moduleName.startsWith('@') && slash >= 0 ? moduleName.slice(slash + 1) : moduleName
  return unscoped
    .replace(/^cordis:/, '')
    .replace(/^cordis-plugin-/, '')
    .replace(/^dsh-(?:host-|client-)?/, '')
}

function compareEntries(left: InventoryEntry, right: InventoryEntry): number {
  const a = `${shortName(left.moduleName)}\u0000${left.entryId}`.toLowerCase()
  const b = `${shortName(right.moduleName)}\u0000${right.entryId}`.toLowerCase()
  return a < b ? -1 : a > b ? 1 : 0
}

function matches(entry: InventoryEntry, query: string): boolean {
  return query.length === 0
    || entry.moduleName.toLowerCase().includes(query)
    || entry.entryId.toLowerCase().includes(query)
}

function phaseLabel(phase: FiberPhase, t: PluginListPlusProps['t']): string {
  return phase === null ? t('unobserved') : t(PHASE_LABELS.get(phase)!)
}

export function PluginListPlus({ list, t }: PluginListPlusProps): React.ReactNode {
  const idBase = useId()
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<GroupId>>(new Set())
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      snapshot => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const normalizedQuery = query.trim().toLowerCase()
  const grouped = useMemo(() => {
    const result = new Map<GroupId, InventoryEntry[]>(GROUP_ORDER.map(group => [group, []]))
    if (state.status !== 'ready') return result
    for (const entry of state.snapshot.entries) {
      if (matches(entry, normalizedQuery)) result.get(groupOf(entry.moduleName))?.push(entry)
    }
    for (const entries of result.values()) entries.sort(compareEntries)
    return result
  }, [normalizedQuery, state])

  useEffect(() => {
    if (expanded !== null && ![...grouped.values()].some(entries => entries.some(entry => entry.entryId === expanded))) {
      setExpanded(null)
    }
  }, [expanded, grouped])

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  const visibleCount = [...grouped.values()].reduce((sum, entries) => sum + entries.length, 0)

  return (
    <div className="dsh-plp" aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className="dsh-plp__status">{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className="dsh-plp__status dsh-plp__failure">
          <p role="alert">{t('error')}</p>
          <button className="dsh-plp__retry" type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <label className="dsh-plp__search">
            <span aria-hidden="true">⌕</span>
            <span className="dsh-plp__sr">{t('search')}</span>
            <input
              type="search"
              value={query}
              maxLength={160}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('search')}
              aria-label={t('search')}
              onChange={event => { setQuery(event.currentTarget.value) }}
            />
          </label>
          {state.snapshot.entries.length === 0 ? <p className="dsh-plp__empty">{t('empty')}</p> : null}
          {state.snapshot.entries.length > 0 && visibleCount === 0
            ? <p className="dsh-plp__empty">{t('emptySearch')}</p>
            : null}
          {state.snapshot.entries.length > 0 ? GROUP_ORDER.map(group => {
            const entries = grouped.get(group) ?? []
            if (normalizedQuery.length > 0 && entries.length === 0) return null
            const groupCollapsed = collapsed.has(group)
            const headingId = `${idBase}-${group}-heading`
            const bodyId = `${idBase}-${group}-body`
            return (
              <section className="dsh-plp__group" key={group} aria-labelledby={headingId} data-namespace-group={group}>
                <h3 className="dsh-plp__heading" id={headingId}>
                  <button
                    className="dsh-plp__group-toggle"
                    type="button"
                    aria-expanded={!groupCollapsed}
                    aria-controls={bodyId}
                    aria-label={`${t(GROUP_LABELS.get(group)!)}, ${t(groupCollapsed ? 'expandGroup' : 'collapseGroup')}`}
                    onClick={() => {
                      setCollapsed(previous => {
                        const next = new Set(previous)
                        if (next.has(group)) next.delete(group)
                        else next.add(group)
                        return next
                      })
                    }}
                  >
                    <span>{t(GROUP_LABELS.get(group)!)}</span>
                    <span className="dsh-plp__count" data-group-count={group}>{entries.length}</span>
                    <span className="dsh-plp__chevron" aria-hidden="true">▾</span>
                  </button>
                </h3>
                <div id={bodyId}>
                  {!groupCollapsed ? (
                    <>
                      <p className="dsh-plp__hint">{t(GROUP_HINTS.get(group)!)}</p>
                      {entries.length === 0 ? <p className="dsh-plp__empty">{t('empty')}</p> : (
                        <ul className="dsh-plp__cards">
                          {entries.map((entry, index) => {
                          const title = shortName(entry.moduleName)
                          const status = phaseLabel(entry.fiberPhase, t)
                          const configured = t(entry.enabled ? 'enabledTag' : 'disabledTag')
                          const open = expanded === entry.entryId
                          const detailId = `${idBase}-${group}-detail-${index}`
                          return (
                            <li className="dsh-plp__card" key={entry.entryId} data-plugin-entry={entry.entryId}>
                              <button
                                className="dsh-plp__card-toggle"
                                type="button"
                                aria-expanded={open}
                                aria-controls={detailId}
                                aria-label={`${title}, ${configured}, ${status}`}
                                onClick={() => { setExpanded(value => value === entry.entryId ? null : entry.entryId) }}
                              >
                                <strong className="dsh-plp__title" title={entry.moduleName}>{title}</strong>
                                <span className="dsh-plp__trailing">
                                  {entry.enabled ? (
                                    <span
                                      className="dsh-plp__dot"
                                      data-phase={entry.fiberPhase ?? 'unobserved'}
                                      role="img"
                                      aria-label={status}
                                      title={status}
                                    />
                                  ) : null}
                                  <span className="dsh-plp__tag">{configured}</span>
                                  <span className="dsh-plp__chevron" aria-hidden="true">▾</span>
                                </span>
                              </button>
                              {open ? (
                                <dl className="dsh-plp__details" id={detailId}>
                                  <div><dt>{t('moduleName')}</dt><dd><code>{entry.moduleName}</code></dd></div>
                                  <div><dt>{t('entryId')}</dt><dd><code>{entry.entryId}</code></dd></div>
                                  <div><dt>{t('configuration')}</dt><dd>{configured}</dd></div>
                                  <div><dt>{t('cordis')}</dt><dd>{status}</dd></div>
                                </dl>
                              ) : null}
                            </li>
                          )
                          })}
                        </ul>
                      )}
                    </>
                  ) : null}
                </div>
              </section>
            )
          }) : null}
        </>
      ) : null}
    </div>
  )
}

function registerDictionaries(ctx: ClientContext): () => void {
  const disposers: Array<() => void> = []
  try {
    disposers.push(ctx.locale.register(NS, { zh, en }))
    for (const [locale, dictionary] of EXTRA_DICTIONARIES) {
      disposers.push(ctx.locale.register(NS, locale, dictionary))
    }
  } catch (error) {
    for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)?.()
    throw error
  }

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)?.()
  }
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => registerDictionaries(ctx), 'plugin-list-plus: dictionaries')
  ctx.effect(installStyle, 'plugin-list-plus: stylesheet')

  const t = ctx.locale.bind(NS)
  const list: PluginListPlusInjected['list'] = async () => {
    const result = await ctx.remote.pluginInventory.list()
    if (!result.ok) {
      throw new Error(`pluginInventory.list failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'dsh-themes-plus',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: (): PluginListPlusInjected => ({ list }),
  }, PluginListPlus))
}
