window.__ModuleLoader__.load({ id: "@dsh-themes/plugin-list-plus", factory: (require) => {
// client/index.tsx
var React = require("react");
var { useEffect, useId, useMemo, useState } = React;
var NS = "settings.pluginListPlus";
var inject = ["slots", "locale", "remote", "remote.pluginInventory"];
var PACKAGE_NAME = "@dsh-themes/plugin-list-plus";
var GROUP_ORDER = ["harness", "scoped", "unscoped"];
var GROUP_LABELS = /* @__PURE__ */ new Map([
  ["harness", "groupHarness"],
  ["scoped", "groupScoped"],
  ["unscoped", "groupUnscoped"]
]);
var GROUP_HINTS = /* @__PURE__ */ new Map([
  ["harness", "groupHarnessHint"],
  ["scoped", "groupScopedHint"],
  ["unscoped", "groupUnscopedHint"]
]);
var PHASE_LABELS = /* @__PURE__ */ new Map([
  ["pending", "pending"],
  ["loading", "loadingPhase"],
  ["active", "active"],
  ["failed", "failed"],
  ["unloading", "unloading"]
]);
var zh = {
  tab: "\u63D2\u4EF6\u5217\u8868 Plus",
  loading: "\u6B63\u5728\u8BFB\u53D6\u63D2\u4EF6\u2026",
  error: "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u63D2\u4EF6\u3002",
  retry: "\u91CD\u8BD5",
  search: "\u641C\u7D22\u63D2\u4EF6\u540D\u79F0\u6216\u5165\u53E3 ID",
  empty: "\u6682\u65E0\u63D2\u4EF6\u3002",
  emptySearch: "\u6CA1\u6709\u5339\u914D\u7684\u63D2\u4EF6\u3002",
  groupHarness: "Harness \u4E0E Cordis \u547D\u540D\u7A7A\u95F4",
  groupHarnessHint: "\u6A21\u5757\u6807\u8BC6\u4EE5 @deepseek-ai/ \u6216 cordis: \u5F00\u5934\u3002\u6B64\u5206\u7EC4\u53EA\u63CF\u8FF0\u540D\u79F0\u5F62\u5F0F\u3002",
  groupScoped: "\u5176\u4ED6\u4F5C\u7528\u57DF\u547D\u540D\u7A7A\u95F4",
  groupScopedHint: "\u6A21\u5757\u6807\u8BC6\u4F7F\u7528\u5176\u4ED6 @scope/name \u5F62\u5F0F\u3002\u6B64\u5206\u7EC4\u4E0D\u4EE3\u8868\u4FE1\u4EFB\u8BC4\u7EA7\u3002",
  groupUnscoped: "\u65E0\u4F5C\u7528\u57DF\u4E0E\u672C\u5730\u6807\u8BC6",
  groupUnscopedHint: "\u65E0\u4F5C\u7528\u57DF\u5305\u540D\u3001\u8DEF\u5F84\u6216\u5176\u4ED6\u6A21\u5757\u6807\u8BC6\u3002\u8BF7\u6309\u5B9E\u9645\u6765\u6E90\u5206\u522B\u5224\u65AD\u3002",
  collapseGroup: "\u6536\u8D77\u8BE5\u7EC4",
  expandGroup: "\u5C55\u5F00\u8BE5\u7EC4",
  enabledTag: "\u5DF2\u542F\u7528",
  disabledTag: "\u5DF2\u505C\u7528",
  entryId: "\u5165\u53E3 ID",
  moduleName: "\u6A21\u5757\u6807\u8BC6",
  configuration: "\u914D\u7F6E\u72B6\u6001",
  cordis: "Cordis \u72B6\u6001",
  unobserved: "\u672A\u6302\u8F7D",
  pending: "\u7B49\u5F85\u4F9D\u8D56",
  loadingPhase: "\u52A0\u8F7D\u4E2D",
  active: "\u5DF2\u6302\u8F7D",
  failed: "\u6302\u8F7D\u5931\u8D25",
  unloading: "\u5378\u8F7D\u4E2D"
};
var en = {
  tab: "Plugin list Plus",
  loading: "Reading plugins\u2026",
  error: "Plugins are temporarily unavailable.",
  retry: "Retry",
  search: "Search module name or entry ID",
  empty: "No plugins are available.",
  emptySearch: "No matching plugins.",
  groupHarness: "Harness and Cordis namespaces",
  groupHarnessHint: "Module identifiers beginning with @deepseek-ai/ or cordis:. This is naming metadata only.",
  groupScoped: "Other scoped namespaces",
  groupScopedHint: "Module identifiers using another @scope/name form. This is not a trust rating.",
  groupUnscoped: "Unscoped and local identifiers",
  groupUnscopedHint: "Unscoped package names, paths, and other module identifiers. Assess each source separately.",
  collapseGroup: "Collapse group",
  expandGroup: "Expand group",
  enabledTag: "Enabled",
  disabledTag: "Disabled",
  entryId: "Entry ID",
  moduleName: "Module identifier",
  configuration: "Configuration",
  cordis: "Cordis status",
  unobserved: "Not mounted",
  pending: "Waiting for dependencies",
  loadingPhase: "Loading",
  active: "Mounted",
  failed: "Mount failed",
  unloading: "Unloading"
};
var zhHant = {
  tab: "外掛程式清單 Plus",
  loading: "正在讀取外掛程式…",
  error: "暫時無法讀取外掛程式。",
  retry: "重試",
  search: "搜尋模組名稱或入口 ID",
  empty: "目前沒有可用的外掛程式。",
  emptySearch: "沒有符合的外掛程式。",
  groupHarness: "Harness 與 Cordis 命名空間",
  groupHarnessHint: "以 @deepseek-ai/ 或 cordis: 開頭的模組識別碼。此分組僅描述命名資訊。",
  groupScoped: "其他具作用域的命名空間",
  groupScopedHint: "使用其他 @scope/name 格式的模組識別碼。此分組不代表信任評級。",
  groupUnscoped: "無作用域與本機識別碼",
  groupUnscopedHint: "無作用域的套件名稱、路徑及其他模組識別碼。請分別評估各個來源。",
  collapseGroup: "收合此群組",
  expandGroup: "展開此群組",
  enabledTag: "已啟用",
  disabledTag: "已停用",
  entryId: "入口 ID",
  moduleName: "模組識別碼",
  configuration: "設定狀態",
  cordis: "Cordis 狀態",
  unobserved: "未掛載",
  pending: "正在等待相依項目",
  loadingPhase: "載入中",
  active: "已掛載",
  failed: "掛載失敗",
  unloading: "卸載中"
};
var ja = {
  tab: "プラグイン一覧 Plus",
  loading: "プラグインを読み込んでいます…",
  error: "現在プラグインを読み込めません。",
  retry: "再試行",
  search: "モジュール名またはエントリ ID を検索",
  empty: "利用可能なプラグインはありません。",
  emptySearch: "一致するプラグインはありません。",
  groupHarness: "Harness と Cordis の名前空間",
  groupHarnessHint: "@deepseek-ai/ または cordis: で始まるモジュール識別子です。この分類は命名情報のみを示します。",
  groupScoped: "その他のスコープ付き名前空間",
  groupScopedHint: "別の @scope/name 形式を使用するモジュール識別子です。信頼性の評価を示すものではありません。",
  groupUnscoped: "スコープなしおよびローカルの識別子",
  groupUnscopedHint: "スコープなしのパッケージ名、パス、その他のモジュール識別子です。ソースごとに個別に評価してください。",
  collapseGroup: "このグループを折りたたむ",
  expandGroup: "このグループを展開",
  enabledTag: "有効",
  disabledTag: "無効",
  entryId: "エントリ ID",
  moduleName: "モジュール識別子",
  configuration: "構成状態",
  cordis: "Cordis の状態",
  unobserved: "未マウント",
  pending: "依存関係を待機中",
  loadingPhase: "読み込み中",
  active: "マウント済み",
  failed: "マウント失敗",
  unloading: "アンマウント中"
};
var ko = {
  tab: "플러그인 목록 Plus",
  loading: "플러그인을 불러오는 중…",
  error: "현재 플러그인을 불러올 수 없습니다.",
  retry: "다시 시도",
  search: "모듈 이름 또는 엔트리 ID 검색",
  empty: "사용할 수 있는 플러그인이 없습니다.",
  emptySearch: "일치하는 플러그인이 없습니다.",
  groupHarness: "Harness 및 Cordis 네임스페이스",
  groupHarnessHint: "@deepseek-ai/ 또는 cordis:로 시작하는 모듈 식별자입니다. 이 분류는 이름 형식만 나타냅니다.",
  groupScoped: "기타 스코프 네임스페이스",
  groupScopedHint: "다른 @scope/name 형식을 사용하는 모듈 식별자입니다. 신뢰도 등급을 의미하지 않습니다.",
  groupUnscoped: "스코프 없는 식별자 및 로컬 식별자",
  groupUnscopedHint: "스코프 없는 패키지 이름, 경로 및 기타 모듈 식별자입니다. 각 출처를 개별적으로 평가하세요.",
  collapseGroup: "그룹 접기",
  expandGroup: "그룹 펼치기",
  enabledTag: "활성화됨",
  disabledTag: "비활성화됨",
  entryId: "엔트리 ID",
  moduleName: "모듈 식별자",
  configuration: "구성 상태",
  cordis: "Cordis 상태",
  unobserved: "마운트되지 않음",
  pending: "종속 항목 대기 중",
  loadingPhase: "로드 중",
  active: "마운트됨",
  failed: "마운트 실패",
  unloading: "마운트 해제 중"
};
var fr = {
  tab: "Liste des plugins Plus",
  loading: "Chargement des plugins…",
  error: "Les plugins sont temporairement indisponibles.",
  retry: "Réessayer",
  search: "Rechercher par nom de module ou ID d’entrée",
  empty: "Aucun plugin n’est disponible.",
  emptySearch: "Aucun plugin correspondant.",
  groupHarness: "Espaces de noms Harness et Cordis",
  groupHarnessHint: "Identifiants de module commençant par @deepseek-ai/ ou cordis:. Ce regroupement décrit uniquement la convention de nommage.",
  groupScoped: "Autres espaces de noms avec scope",
  groupScopedHint: "Identifiants de module suivant une autre forme @scope/name. Ce regroupement ne constitue pas une évaluation de confiance.",
  groupUnscoped: "Identifiants sans scope et locaux",
  groupUnscopedHint: "Noms de paquets sans scope, chemins et autres identifiants de module. Évaluez chaque source séparément.",
  collapseGroup: "Replier le groupe",
  expandGroup: "Déplier le groupe",
  enabledTag: "Activé",
  disabledTag: "Désactivé",
  entryId: "ID d’entrée",
  moduleName: "Identifiant du module",
  configuration: "Configuration",
  cordis: "État de Cordis",
  unobserved: "Non monté",
  pending: "En attente des dépendances",
  loadingPhase: "Chargement",
  active: "Monté",
  failed: "Échec du montage",
  unloading: "Démontage"
};
var de = {
  tab: "Pluginliste Plus",
  loading: "Plugins werden eingelesen…",
  error: "Plugins sind vorübergehend nicht verfügbar.",
  retry: "Erneut versuchen",
  search: "Nach Modulname oder Eintrags-ID suchen",
  empty: "Keine Plugins verfügbar.",
  emptySearch: "Keine passenden Plugins.",
  groupHarness: "Harness- und Cordis-Namensräume",
  groupHarnessHint: "Modulkennungen, die mit @deepseek-ai/ oder cordis: beginnen. Diese Gruppierung beschreibt nur die Namensform.",
  groupScoped: "Andere Namensräume mit Scope",
  groupScopedHint: "Modulkennungen in einer anderen @scope/name-Form. Dies ist keine Vertrauensbewertung.",
  groupUnscoped: "Kennungen ohne Scope und lokale Kennungen",
  groupUnscopedHint: "Paketnamen ohne Scope, Pfade und andere Modulkennungen. Bewerten Sie jede Quelle separat.",
  collapseGroup: "Gruppe einklappen",
  expandGroup: "Gruppe ausklappen",
  enabledTag: "Aktiviert",
  disabledTag: "Deaktiviert",
  entryId: "Eintrags-ID",
  moduleName: "Modulkennung",
  configuration: "Konfiguration",
  cordis: "Cordis-Status",
  unobserved: "Nicht eingebunden",
  pending: "Warten auf Abhängigkeiten",
  loadingPhase: "Wird geladen",
  active: "Eingebunden",
  failed: "Einbinden fehlgeschlagen",
  unloading: "Wird entladen"
};
var es = {
  tab: "Lista de plugins Plus",
  loading: "Cargando plugins…",
  error: "Los plugins no están disponibles temporalmente.",
  retry: "Reintentar",
  search: "Buscar por nombre de módulo o ID de entrada",
  empty: "No hay plugins disponibles.",
  emptySearch: "Ningún plugin coincide con la búsqueda.",
  groupHarness: "Espacios de nombres de Harness y Cordis",
  groupHarnessHint: "Identificadores de módulo que comienzan con @deepseek-ai/ o cordis:. Esta agrupación solo describe la nomenclatura.",
  groupScoped: "Otros espacios de nombres con ámbito",
  groupScopedHint: "Identificadores de módulo que usan otro formato @scope/name. Esto no representa una calificación de confianza.",
  groupUnscoped: "Identificadores sin ámbito y locales",
  groupUnscopedHint: "Nombres de paquetes sin ámbito, rutas y otros identificadores de módulo. Cada fuente se debe evaluar por separado.",
  collapseGroup: "Contraer el grupo",
  expandGroup: "Expandir el grupo",
  enabledTag: "Habilitado",
  disabledTag: "Deshabilitado",
  entryId: "ID de entrada",
  moduleName: "Identificador del módulo",
  configuration: "Configuración",
  cordis: "Estado de Cordis",
  unobserved: "Sin montar",
  pending: "Esperando dependencias",
  loadingPhase: "Cargando",
  active: "Montado",
  failed: "Error al montar",
  unloading: "Desmontando"
};
var EXTRA_DICTIONARIES = [
  ["zh-Hant", zhHant],
  ["ja", ja],
  ["ko", ko],
  ["fr", fr],
  ["de", de],
  ["es", es]
];
var CSS = `
.dsh-plp{display:grid;gap:16px;color:inherit}.dsh-plp__status{margin:0;padding:18px;border:1px solid color-mix(in srgb,currentColor 16%,transparent);border-radius:12px}.dsh-plp__failure{display:flex;align-items:center;justify-content:space-between;gap:12px}.dsh-plp__failure p{margin:0}.dsh-plp button,.dsh-plp input{font:inherit;color:inherit}.dsh-plp__retry{border:1px solid color-mix(in srgb,currentColor 24%,transparent);border-radius:8px;padding:6px 10px;background:transparent;cursor:pointer}.dsh-plp__search{display:flex;align-items:center;gap:8px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:10px;padding:0 12px}.dsh-plp__search input{width:100%;min-height:40px;border:0;outline:0;background:transparent}.dsh-plp__group{display:grid;gap:8px}.dsh-plp__heading{margin:0}.dsh-plp__group-toggle{width:100%;display:flex;align-items:center;gap:10px;padding:8px 0;border:0;background:transparent;text-align:left;cursor:pointer}.dsh-plp__count{min-width:24px;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,currentColor 10%,transparent);font-size:12px;text-align:center}.dsh-plp__chevron{margin-left:auto;transition:transform .15s ease}.dsh-plp__group-toggle[aria-expanded=false] .dsh-plp__chevron,.dsh-plp__card-toggle[aria-expanded=false] .dsh-plp__chevron{transform:rotate(-90deg)}.dsh-plp__hint{margin:0 0 4px;color:color-mix(in srgb,currentColor 68%,transparent);font-size:12px;line-height:1.5}.dsh-plp__cards{list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:8px;margin:0;padding:0}.dsh-plp__card{border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:10px;overflow:hidden}.dsh-plp__card-toggle{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;border:0;background:transparent;text-align:left;cursor:pointer}.dsh-plp__title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-plp__trailing{display:flex;align-items:center;gap:7px}.dsh-plp__tag{font-size:12px;padding:2px 7px;border-radius:999px;background:color-mix(in srgb,currentColor 9%,transparent)}.dsh-plp__dot{width:8px;height:8px;border-radius:50%;background:#8a8a8a}.dsh-plp__dot[data-phase=active]{background:#2aa66a}.dsh-plp__dot[data-phase=failed]{background:#d95050}.dsh-plp__dot[data-phase=loading],.dsh-plp__dot[data-phase=pending]{background:#d49a2a}.dsh-plp__details{display:grid;gap:8px;margin:0;padding:10px 12px 12px;border-top:1px solid color-mix(in srgb,currentColor 10%,transparent)}.dsh-plp__details div{display:grid;gap:2px}.dsh-plp__details dt{font-size:12px;color:color-mix(in srgb,currentColor 62%,transparent)}.dsh-plp__details dd{margin:0;overflow-wrap:anywhere}.dsh-plp__details code{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.dsh-plp__empty{margin:0;padding:10px 0;color:color-mix(in srgb,currentColor 62%,transparent)}.dsh-plp__sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media (prefers-reduced-motion:reduce){.dsh-plp__chevron{transition:none}}
`;
function installStyle() {
  if (typeof document === "undefined") return () => {
  };
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = `${PACKAGE_NAME}/runtime`;
  tag.textContent = CSS;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}
function groupOf(moduleName) {
  if (moduleName.startsWith("@deepseek-ai/") || moduleName.startsWith("cordis:")) return "harness";
  if (/^@[^/]+\/[^/]+/.test(moduleName)) return "scoped";
  return "unscoped";
}
function shortName(moduleName) {
  const slash = moduleName.indexOf("/");
  const unscoped = moduleName.startsWith("@") && slash >= 0 ? moduleName.slice(slash + 1) : moduleName;
  return unscoped.replace(/^cordis:/, "").replace(/^cordis-plugin-/, "").replace(/^dsh-(?:host-|client-)?/, "");
}
function compareEntries(left, right) {
  const a = `${shortName(left.moduleName)}\0${left.entryId}`.toLowerCase();
  const b = `${shortName(right.moduleName)}\0${right.entryId}`.toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
}
function matches(entry, query) {
  return query.length === 0 || entry.moduleName.toLowerCase().includes(query) || entry.entryId.toLowerCase().includes(query);
}
function phaseLabel(phase, t) {
  return phase === null ? t("unobserved") : t(PHASE_LABELS.get(phase));
}
function PluginListPlus({ list, t }) {
  const idBase = useId();
  const [request, setRequest] = useState(0);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [collapsed, setCollapsed] = useState(/* @__PURE__ */ new Set());
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let current = true;
    void Promise.resolve().then(() => list()).then(
      (snapshot) => {
        if (current) setState({ status: "ready", snapshot });
      },
      () => {
        if (current) setState({ status: "error" });
      }
    );
    return () => {
      current = false;
    };
  }, [list, request]);
  const normalizedQuery = query.trim().toLowerCase();
  const grouped = useMemo(() => {
    const result = new Map(GROUP_ORDER.map((group) => [group, []]));
    if (state.status !== "ready") return result;
    for (const entry of state.snapshot.entries) {
      if (matches(entry, normalizedQuery)) result.get(groupOf(entry.moduleName))?.push(entry);
    }
    for (const entries of result.values()) entries.sort(compareEntries);
    return result;
  }, [normalizedQuery, state]);
  useEffect(() => {
    if (expanded !== null && ![...grouped.values()].some((entries) => entries.some((entry) => entry.entryId === expanded))) {
      setExpanded(null);
    }
  }, [expanded, grouped]);
  const retry = () => {
    setState({ status: "loading" });
    setRequest((value) => value + 1);
  };
  const visibleCount = [...grouped.values()].reduce((sum, entries) => sum + entries.length, 0);
  return /* @__PURE__ */ React.createElement("div", { className: "dsh-plp", "aria-busy": state.status === "loading" }, state.status === "loading" ? /* @__PURE__ */ React.createElement("p", { className: "dsh-plp__status" }, t("loading")) : null, state.status === "error" ? /* @__PURE__ */ React.createElement("div", { className: "dsh-plp__status dsh-plp__failure" }, /* @__PURE__ */ React.createElement("p", { role: "alert" }, t("error")), /* @__PURE__ */ React.createElement("button", { className: "dsh-plp__retry", type: "button", onClick: retry }, t("retry"))) : null, state.status === "ready" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("label", { className: "dsh-plp__search" }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, "\u2315"), /* @__PURE__ */ React.createElement("span", { className: "dsh-plp__sr" }, t("search")), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "search",
      value: query,
      maxLength: 160,
      autoComplete: "off",
      spellCheck: false,
      placeholder: t("search"),
      "aria-label": t("search"),
      onChange: (event) => {
        setQuery(event.currentTarget.value);
      }
    }
  )), state.snapshot.entries.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "dsh-plp__empty" }, t("empty")) : null, state.snapshot.entries.length > 0 && visibleCount === 0 ? /* @__PURE__ */ React.createElement("p", { className: "dsh-plp__empty" }, t("emptySearch")) : null, state.snapshot.entries.length > 0 ? GROUP_ORDER.map((group) => {
    const entries = grouped.get(group) ?? [];
    if (normalizedQuery.length > 0 && entries.length === 0) return null;
    const groupCollapsed = collapsed.has(group);
    const headingId = `${idBase}-${group}-heading`;
    const bodyId = `${idBase}-${group}-body`;
    return /* @__PURE__ */ React.createElement("section", { className: "dsh-plp__group", key: group, "aria-labelledby": headingId, "data-namespace-group": group }, /* @__PURE__ */ React.createElement("h3", { className: "dsh-plp__heading", id: headingId }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "dsh-plp__group-toggle",
        type: "button",
        "aria-expanded": !groupCollapsed,
        "aria-controls": bodyId,
        "aria-label": `${t(GROUP_LABELS.get(group))}, ${t(groupCollapsed ? "expandGroup" : "collapseGroup")}`,
        onClick: () => {
          setCollapsed((previous) => {
            const next = new Set(previous);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
          });
        }
      },
      /* @__PURE__ */ React.createElement("span", null, t(GROUP_LABELS.get(group))),
      /* @__PURE__ */ React.createElement("span", { className: "dsh-plp__count", "data-group-count": group }, entries.length),
      /* @__PURE__ */ React.createElement("span", { className: "dsh-plp__chevron", "aria-hidden": "true" }, "\u25BE")
    )), /* @__PURE__ */ React.createElement("div", { id: bodyId }, !groupCollapsed ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "dsh-plp__hint" }, t(GROUP_HINTS.get(group))), entries.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "dsh-plp__empty" }, t("empty")) : /* @__PURE__ */ React.createElement("ul", { className: "dsh-plp__cards" }, entries.map((entry, index) => {
      const title = shortName(entry.moduleName);
      const status = phaseLabel(entry.fiberPhase, t);
      const configured = t(entry.enabled ? "enabledTag" : "disabledTag");
      const open = expanded === entry.entryId;
      const detailId = `${idBase}-${group}-detail-${index}`;
      return /* @__PURE__ */ React.createElement("li", { className: "dsh-plp__card", key: entry.entryId, "data-plugin-entry": entry.entryId }, /* @__PURE__ */ React.createElement(
        "button",
        {
          className: "dsh-plp__card-toggle",
          type: "button",
          "aria-expanded": open,
          "aria-controls": detailId,
          "aria-label": `${title}, ${configured}, ${status}`,
          onClick: () => {
            setExpanded((value) => value === entry.entryId ? null : entry.entryId);
          }
        },
        /* @__PURE__ */ React.createElement("strong", { className: "dsh-plp__title", title: entry.moduleName }, title),
        /* @__PURE__ */ React.createElement("span", { className: "dsh-plp__trailing" }, entry.enabled ? /* @__PURE__ */ React.createElement(
          "span",
          {
            className: "dsh-plp__dot",
            "data-phase": entry.fiberPhase ?? "unobserved",
            role: "img",
            "aria-label": status,
            title: status
          }
        ) : null, /* @__PURE__ */ React.createElement("span", { className: "dsh-plp__tag" }, configured), /* @__PURE__ */ React.createElement("span", { className: "dsh-plp__chevron", "aria-hidden": "true" }, "\u25BE"))
      ), open ? /* @__PURE__ */ React.createElement("dl", { className: "dsh-plp__details", id: detailId }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, t("moduleName")), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement("code", null, entry.moduleName))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, t("entryId")), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement("code", null, entry.entryId))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, t("configuration")), /* @__PURE__ */ React.createElement("dd", null, configured)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, t("cordis")), /* @__PURE__ */ React.createElement("dd", null, status))) : null);
    }))) : null));
  }) : null) : null);
}
function registerDictionaries(ctx) {
  const disposers = [];
  try {
    disposers.push(ctx.locale.register(NS, { zh, en }));
    for (const [locale, dictionary] of EXTRA_DICTIONARIES) {
      disposers.push(ctx.locale.register(NS, locale, dictionary));
    }
  } catch (error) {
    for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)?.();
    throw error;
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)?.();
  };
}
function apply(ctx) {
  ctx.effect(() => registerDictionaries(ctx), "plugin-list-plus: dictionaries");
  ctx.effect(installStyle, "plugin-list-plus: stylesheet");
  const t = ctx.locale.bind(NS);
  const list = async () => {
    const result = await ctx.remote.pluginInventory.list();
    if (!result.ok) {
      throw new Error(`pluginInventory.list failed: ${result.error.code}: ${result.error.message}`);
    }
    return result.value;
  };
  ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
    name: "settings.plugins.tab",
    id: "dsh-themes-plus",
    order: 20,
    label: () => t("tab"),
    locale: NS,
    inject: () => ({ list })
  }, PluginListPlus));
}
return { NS, PluginListPlus, apply, de, en, es, fr, inject, ja, ko, zh, zhHant }; } });
