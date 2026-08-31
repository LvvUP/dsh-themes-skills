/**
 * Public plugin #3006 alpha.1 reviewed replacement — browser half.
 *
 * Review properties:
 * - no direct browser key-value persistence access;
 * - no global keyboard shortcut;
 * - no direct browser network or Remote access;
 * - favorites use the official settingsScope namespace;
 * - model reads/writes use the official per-session ModelDirectory;
 * - every DOM/style/locale/slot subscription belongs to the plugin fiber;
 * - action failures reach a role=status + aria-live surface;
 * - model and favorite actions are sibling buttons, never nested controls.
 */
window.__ModuleLoader__.load({
  id: '@dsh-themes/dsh-better-model-selector',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    const PLUGIN_ID = 'dsh-plugin-3006-better-model-selector'
    const SETTINGS_NAMESPACE = 'dsh-better-model-selector'
    const FAVORITES_FIELD = 'favorites'
    const LOCALE_NAMESPACE = 'dsh-themes.plugin-3006'
    const MAX_FAVORITES = 128
    const STYLE_ID = 'dsh-plugin-3006-better-model-selector/client.css'

    const PROBES = Object.freeze({
      clientApply: 'DSH3006_PROBE:CLIENT_APPLY_V1',
      settingsScope: 'DSH3006_PROBE:SETTINGS_SCOPE_BOUND_V1',
      slot: 'DSH3006_PROBE:SLOT_REGISTERED_V1',
      style: 'DSH3006_PROBE:STYLE_OWNED_V1',
    })

    const en = Object.freeze({
      'trigger.aria': 'Choose model and reasoning effort',
      'trigger.fallback': 'Choose model',
      'dialog.aria': 'Model chooser',
      'search.label': 'Search models',
      'search.placeholder': 'Search models…',
      'filter.favorites': 'Show favorites only',
      'filter.all': 'Show all models',
      'favorite.add': 'Add {model} to favorites',
      'favorite.remove': 'Remove {model} from favorites',
      'favorite.saved': 'Favorites saved to this DSH home.',
      'favorite.memory': 'Favorites changed for this browser process only; this connection does not permit Host persistence.',
      'favorite.unavailable': 'Favorites are unavailable because the Host settings namespace is not ready or writable.',
      'favorite.invalid': 'This model identifier cannot be stored as a favorite.',
      'favorite.limit': 'At most 128 favorite models can be stored.',
      'favorite.failed': 'The Host did not confirm the favorites update. The authoritative settings value was restored.',
      'status.loading': 'Loading models…',
      'status.loaded': 'Models loaded.',
      'status.loadFailed': 'Models could not be loaded: {message}',
      'status.selecting': 'Applying model selection…',
      'status.selected': 'Model selection applied.',
      'status.selectFailed': 'The Host rejected the model selection: {message}',
      'status.empty': 'No models are available.',
      'status.noMatch': 'No models match the current filter.',
      'effort.label': 'Reasoning effort',
      'effort.providerDefault': 'Provider default',
      'effort.applying': 'Applying reasoning effort…',
      'effort.applied': 'Reasoning effort applied.',
      'effort.failed': 'The Host rejected the reasoning effort: {message}',
      'model.current': 'Current',
    })

    const zh = Object.freeze({
      'trigger.aria': '选择模型和思考强度',
      'trigger.fallback': '选择模型',
      'dialog.aria': '模型选择器',
      'search.label': '搜索模型',
      'search.placeholder': '搜索模型…',
      'filter.favorites': '仅显示收藏模型',
      'filter.all': '显示全部模型',
      'favorite.add': '将 {model} 加入收藏',
      'favorite.remove': '将 {model} 移出收藏',
      'favorite.saved': '收藏已保存到当前 DSH home。',
      'favorite.memory': '收藏只在当前浏览器进程内生效；此连接不允许写入 Host 设置。',
      'favorite.unavailable': 'Host 设置命名空间尚未就绪或不可写，暂时不能修改收藏。',
      'favorite.invalid': '此模型标识无法安全保存为收藏。',
      'favorite.limit': '最多可以保存 128 个收藏模型。',
      'favorite.failed': 'Host 未确认收藏更新，已恢复权威设置值。',
      'status.loading': '正在加载模型…',
      'status.loaded': '模型已加载。',
      'status.loadFailed': '模型加载失败：{message}',
      'status.selecting': '正在应用模型选择…',
      'status.selected': '模型选择已应用。',
      'status.selectFailed': 'Host 拒绝了模型选择：{message}',
      'status.empty': '当前没有可用模型。',
      'status.noMatch': '没有符合当前筛选条件的模型。',
      'effort.label': '思考强度',
      'effort.providerDefault': '提供商默认值',
      'effort.applying': '正在应用思考强度…',
      'effort.applied': '思考强度已应用。',
      'effort.failed': 'Host 拒绝了思考强度：{message}',
      'model.current': '当前',
    })

    const zhHant = Object.freeze({
      'trigger.aria': '選擇模型與思考強度',
      'trigger.fallback': '選擇模型',
      'dialog.aria': '模型選擇器',
      'search.label': '搜尋模型',
      'search.placeholder': '搜尋模型…',
      'filter.favorites': '僅顯示收藏模型',
      'filter.all': '顯示所有模型',
      'favorite.add': '將 {model} 加入收藏',
      'favorite.remove': '將 {model} 移出收藏',
      'favorite.saved': '收藏已儲存至目前的 DSH home。',
      'favorite.memory': '收藏變更僅在目前的瀏覽器程序中生效；此連線不允許將設定持久化至 Host。',
      'favorite.unavailable': '由於 Host 設定命名空間尚未就緒或不可寫入，目前無法使用收藏功能。',
      'favorite.invalid': '無法將此模型識別碼儲存為收藏。',
      'favorite.limit': '最多可儲存 128 個收藏模型。',
      'favorite.failed': 'Host 未確認收藏更新。已還原 Host 的設定值。',
      'status.loading': '正在載入模型…',
      'status.loaded': '模型已載入。',
      'status.loadFailed': '無法載入模型：{message}',
      'status.selecting': '正在套用模型選擇…',
      'status.selected': '已套用模型選擇。',
      'status.selectFailed': 'Host 拒絕了模型選擇：{message}',
      'status.empty': '沒有可用的模型。',
      'status.noMatch': '沒有符合目前篩選條件的模型。',
      'effort.label': '思考強度',
      'effort.providerDefault': '提供者預設值',
      'effort.applying': '正在套用思考強度…',
      'effort.applied': '已套用思考強度。',
      'effort.failed': 'Host 拒絕了思考強度：{message}',
      'model.current': '目前',
    })

    const ja = Object.freeze({
      'trigger.aria': 'モデルと推論レベルを選択',
      'trigger.fallback': 'モデルを選択',
      'dialog.aria': 'モデル選択',
      'search.label': 'モデルを検索',
      'search.placeholder': 'モデルを検索…',
      'filter.favorites': 'お気に入りのみ表示',
      'filter.all': 'すべてのモデルを表示',
      'favorite.add': '{model} をお気に入りに追加',
      'favorite.remove': '{model} をお気に入りから削除',
      'favorite.saved': 'お気に入りをこの DSH home に保存しました。',
      'favorite.memory': 'お気に入りの変更はこのブラウザプロセス内でのみ有効です。この接続では Host に設定を永続保存できません。',
      'favorite.unavailable': 'Host の設定名前空間の準備ができていないか、書き込みできないため、お気に入りを利用できません。',
      'favorite.invalid': 'このモデル識別子はお気に入りとして保存できません。',
      'favorite.limit': 'お気に入りのモデルは最大 128 件まで保存できます。',
      'favorite.failed': 'Host がお気に入りの更新を確認できなかったため、Host の設定値に戻しました。',
      'status.loading': 'モデルを読み込んでいます…',
      'status.loaded': 'モデルを読み込みました。',
      'status.loadFailed': 'モデルを読み込めませんでした：{message}',
      'status.selecting': 'モデル選択を適用しています…',
      'status.selected': 'モデル選択を適用しました。',
      'status.selectFailed': 'Host がモデル選択を拒否しました：{message}',
      'status.empty': '利用可能なモデルはありません。',
      'status.noMatch': '現在のフィルターに一致するモデルはありません。',
      'effort.label': '推論レベル',
      'effort.providerDefault': 'プロバイダーのデフォルト',
      'effort.applying': '推論レベルを適用しています…',
      'effort.applied': '推論レベルを適用しました。',
      'effort.failed': 'Host が推論レベルを拒否しました：{message}',
      'model.current': '現在',
    })

    const ko = Object.freeze({
      'trigger.aria': '모델 및 추론 강도 선택',
      'trigger.fallback': '모델 선택',
      'dialog.aria': '모델 선택기',
      'search.label': '모델 검색',
      'search.placeholder': '모델 검색…',
      'filter.favorites': '즐겨찾기만 표시',
      'filter.all': '모든 모델 표시',
      'favorite.add': '{model} 모델을 즐겨찾기에 추가',
      'favorite.remove': '{model} 모델을 즐겨찾기에서 제거',
      'favorite.saved': '즐겨찾기를 현재 DSH home에 저장했습니다.',
      'favorite.memory': '즐겨찾기 변경 사항은 현재 브라우저 프로세스에만 적용됩니다. 이 연결에서는 Host 설정을 영구적으로 저장할 수 없습니다.',
      'favorite.unavailable': 'Host 설정 네임스페이스가 준비되지 않았거나 쓰기 가능하지 않아 즐겨찾기를 사용할 수 없습니다.',
      'favorite.invalid': '이 모델 식별자는 즐겨찾기로 저장할 수 없습니다.',
      'favorite.limit': '즐겨찾기 모델은 최대 128개까지 저장할 수 있습니다.',
      'favorite.failed': 'Host가 즐겨찾기 업데이트를 확인하지 않았습니다. Host의 설정값으로 복원했습니다.',
      'status.loading': '모델을 불러오는 중…',
      'status.loaded': '모델을 불러왔습니다.',
      'status.loadFailed': '모델을 불러올 수 없습니다: {message}',
      'status.selecting': '모델 선택을 적용하는 중…',
      'status.selected': '모델 선택을 적용했습니다.',
      'status.selectFailed': 'Host가 모델 선택을 거부했습니다: {message}',
      'status.empty': '사용할 수 있는 모델이 없습니다.',
      'status.noMatch': '현재 필터와 일치하는 모델이 없습니다.',
      'effort.label': '추론 강도',
      'effort.providerDefault': '제공자 기본값',
      'effort.applying': '추론 강도를 적용하는 중…',
      'effort.applied': '추론 강도를 적용했습니다.',
      'effort.failed': 'Host가 추론 강도를 거부했습니다: {message}',
      'model.current': '현재',
    })

    const fr = Object.freeze({
      'trigger.aria': 'Choisir le modèle et le niveau de raisonnement',
      'trigger.fallback': 'Choisir un modèle',
      'dialog.aria': 'Sélecteur de modèle',
      'search.label': 'Rechercher des modèles',
      'search.placeholder': 'Rechercher des modèles…',
      'filter.favorites': 'Afficher uniquement les favoris',
      'filter.all': 'Afficher tous les modèles',
      'favorite.add': 'Ajouter {model} aux favoris',
      'favorite.remove': 'Retirer {model} des favoris',
      'favorite.saved': 'Les favoris ont été enregistrés dans ce DSH home.',
      'favorite.memory': 'Les favoris ont été modifiés uniquement pour ce processus de navigateur ; cette connexion ne permet pas leur persistance dans les paramètres du Host.',
      'favorite.unavailable': 'Les favoris sont indisponibles car l’espace de noms des paramètres du Host n’est pas prêt ou n’est pas accessible en écriture.',
      'favorite.invalid': 'Cet identifiant de modèle ne peut pas être enregistré comme favori.',
      'favorite.limit': 'Vous pouvez enregistrer au maximum 128 modèles favoris.',
      'favorite.failed': 'Le Host n’a pas confirmé la mise à jour des favoris. La valeur des paramètres du Host a été restaurée.',
      'status.loading': 'Chargement des modèles…',
      'status.loaded': 'Modèles chargés.',
      'status.loadFailed': 'Impossible de charger les modèles : {message}',
      'status.selecting': 'Application du modèle sélectionné…',
      'status.selected': 'Modèle sélectionné appliqué.',
      'status.selectFailed': 'Le Host a refusé le modèle sélectionné : {message}',
      'status.empty': 'Aucun modèle disponible.',
      'status.noMatch': 'Aucun modèle ne correspond au filtre actuel.',
      'effort.label': 'Niveau de raisonnement',
      'effort.providerDefault': 'Valeur par défaut du fournisseur',
      'effort.applying': 'Application du niveau de raisonnement…',
      'effort.applied': 'Niveau de raisonnement appliqué.',
      'effort.failed': 'Le Host a refusé le niveau de raisonnement : {message}',
      'model.current': 'Actuel',
    })

    const de = Object.freeze({
      'trigger.aria': 'Modell und Denkaufwand auswählen',
      'trigger.fallback': 'Modell auswählen',
      'dialog.aria': 'Modellauswahl',
      'search.label': 'Modelle durchsuchen',
      'search.placeholder': 'Modelle durchsuchen…',
      'filter.favorites': 'Nur Favoriten anzeigen',
      'filter.all': 'Alle Modelle anzeigen',
      'favorite.add': '{model} zu Favoriten hinzufügen',
      'favorite.remove': '{model} aus Favoriten entfernen',
      'favorite.saved': 'Favoriten wurden in diesem DSH home gespeichert.',
      'favorite.memory': 'Favoriten wurden nur für diesen Browserprozess geändert; diese Verbindung erlaubt keine dauerhafte Speicherung in den Host-Einstellungen.',
      'favorite.unavailable': 'Favoriten sind nicht verfügbar, da der Host-Einstellungsnamensraum noch nicht bereit oder nicht beschreibbar ist.',
      'favorite.invalid': 'Diese Modellkennung kann nicht als Favorit gespeichert werden.',
      'favorite.limit': 'Es können höchstens 128 Favoritenmodelle gespeichert werden.',
      'favorite.failed': 'Der Host hat die Aktualisierung der Favoriten nicht bestätigt. Der maßgebliche Einstellungswert wurde wiederhergestellt.',
      'status.loading': 'Modelle werden geladen…',
      'status.loaded': 'Modelle geladen.',
      'status.loadFailed': 'Modelle konnten nicht geladen werden: {message}',
      'status.selecting': 'Modellauswahl wird angewendet…',
      'status.selected': 'Modellauswahl angewendet.',
      'status.selectFailed': 'Der Host hat die Modellauswahl abgelehnt: {message}',
      'status.empty': 'Keine Modelle verfügbar.',
      'status.noMatch': 'Keine Modelle entsprechen dem aktuellen Filter.',
      'effort.label': 'Denkaufwand',
      'effort.providerDefault': 'Standardwert des Anbieters',
      'effort.applying': 'Denkaufwand wird angewendet…',
      'effort.applied': 'Denkaufwand angewendet.',
      'effort.failed': 'Der Host hat den Denkaufwand abgelehnt: {message}',
      'model.current': 'Aktuell',
    })

    const es = Object.freeze({
      'trigger.aria': 'Elegir modelo y nivel de razonamiento',
      'trigger.fallback': 'Elegir modelo',
      'dialog.aria': 'Selector de modelos',
      'search.label': 'Buscar modelos',
      'search.placeholder': 'Buscar modelos…',
      'filter.favorites': 'Mostrar solo favoritos',
      'filter.all': 'Mostrar todos los modelos',
      'favorite.add': 'Agregar {model} a favoritos',
      'favorite.remove': 'Quitar {model} de favoritos',
      'favorite.saved': 'Los favoritos se guardaron en este DSH home.',
      'favorite.memory': 'Los cambios en favoritos solo se aplican a este proceso del navegador; esta conexión no permite guardarlos de forma persistente en la configuración del Host.',
      'favorite.unavailable': 'Los favoritos no están disponibles porque el espacio de nombres de configuración del Host aún no está listo o no permite escritura.',
      'favorite.invalid': 'Este identificador de modelo no se puede guardar como favorito.',
      'favorite.limit': 'Se pueden guardar hasta 128 modelos favoritos.',
      'favorite.failed': 'El Host no confirmó la actualización de favoritos. Se restauró el valor de configuración del Host.',
      'status.loading': 'Cargando modelos…',
      'status.loaded': 'Modelos cargados.',
      'status.loadFailed': 'No se pudieron cargar los modelos: {message}',
      'status.selecting': 'Aplicando la selección del modelo…',
      'status.selected': 'Selección del modelo aplicada.',
      'status.selectFailed': 'El Host rechazó la selección del modelo: {message}',
      'status.empty': 'No hay modelos disponibles.',
      'status.noMatch': 'Ningún modelo coincide con el filtro actual.',
      'effort.label': 'Nivel de razonamiento',
      'effort.providerDefault': 'Valor predeterminado del proveedor',
      'effort.applying': 'Aplicando el nivel de razonamiento…',
      'effort.applied': 'Se aplicó el nivel de razonamiento.',
      'effort.failed': 'El Host rechazó el nivel de razonamiento: {message}',
      'model.current': 'Actual',
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
      '.dsh3006-root{position:relative;display:flex;align-items:center;gap:8px;min-width:0;max-width:100%;}',
      '.dsh3006-trigger{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:220px;height:28px;padding:0 9px;border:0;border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary,rgba(127,127,127,.92));font:500 13px/20px inherit;cursor:pointer;}',
      '.dsh3006-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,inherit);}',
      '.dsh3006-trigger:focus-visible,.dsh3006-model:focus-visible,.dsh3006-favorite:focus-visible,.dsh3006-filter:focus-visible,.dsh3006-search:focus-visible,.dsh3006-effort-select:focus-visible{outline:2px solid var(--dsw-static-deepseek-500,#4176e6);outline-offset:2px;}',
      '.dsh3006-trigger:disabled,.dsh3006-model:disabled,.dsh3006-favorite:disabled,.dsh3006-filter:disabled,.dsh3006-effort-select:disabled{cursor:default;opacity:.55;}',
      '.dsh3006-trigger-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.dsh3006-current-star{color:var(--dsw-alias-state-warn-primary,#d99b2b);}',
      '.dsh3006-popover{position:absolute;right:0;bottom:calc(100% + 8px);z-index:200;display:flex;flex-direction:column;width:min(340px,calc(100vw - 24px));max-height:min(440px,calc(100vh - 72px));padding:8px;border:1px solid var(--dsw-alias-border-inverted,rgba(127,127,127,.3));border-radius:12px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,#202225));color:var(--dsw-alias-label-primary,#e8e8ea);box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.4));}',
      '.dsh3006-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;padding-bottom:7px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.16));}',
      '.dsh3006-search,.dsh3006-filter,.dsh3006-effort-select{box-sizing:border-box;min-height:30px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:7px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.07));color:inherit;font:12px/18px inherit;}',
      '.dsh3006-search{min-width:0;padding:5px 8px;}',
      '.dsh3006-filter{padding:4px 9px;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;}',
      '.dsh3006-filter[aria-pressed=true]{border-color:var(--dsw-alias-state-warn-primary,#d99b2b);color:var(--dsw-alias-state-warn-primary,#d99b2b);}',
      '.dsh3006-list{min-height:0;margin:0;padding:3px 0;overflow:auto;list-style:none;}',
      '.dsh3006-heading{padding:8px 7px 4px;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font:600 11px/16px inherit;}',
      '.dsh3006-row{display:grid;grid-template-columns:minmax(0,1fr) 32px;align-items:stretch;gap:3px;margin:1px 0;}',
      '.dsh3006-model,.dsh3006-favorite{border:0;border-radius:8px;background:transparent;color:inherit;font-family:inherit;cursor:pointer;}',
      '.dsh3006-model{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;padding:6px 8px;text-align:left;}',
      '.dsh3006-model:hover:not(:disabled),.dsh3006-favorite:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.11));}',
      '.dsh3006-model[aria-current=true]{background:color-mix(in srgb,var(--dsw-static-deepseek-500,#4176e6) 16%,transparent);}',
      '.dsh3006-copy{display:flex;min-width:0;flex-direction:column;}',
      '.dsh3006-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 13px/18px inherit;}',
      '.dsh3006-description{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font:11px/16px inherit;}',
      '.dsh3006-check{flex:none;color:var(--dsw-static-deepseek-500,#4176e6);font-size:11px;}',
      '.dsh3006-favorite{padding:0;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font-size:16px;}',
      '.dsh3006-favorite[aria-pressed=true]{color:var(--dsw-alias-state-warn-primary,#d99b2b);}',
      '.dsh3006-empty{padding:14px 8px;text-align:center;color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.72));font:12px/18px inherit;}',
      '.dsh3006-effort{display:flex;align-items:center;gap:6px;min-width:0;}',
      '.dsh3006-effort-label{font:12px/18px inherit;color:var(--dsw-alias-label-secondary,inherit);}',
      '.dsh3006-effort-select{max-width:132px;padding:3px 24px 3px 7px;}',
      '.dsh3006-status{position:absolute;left:0;bottom:calc(100% + 4px);max-width:min(420px,calc(100vw - 24px));padding:4px 7px;border-radius:6px;background:var(--dsw-alias-bg-overlay,#202225);color:var(--dsw-alias-label-secondary,#d7d7da);font:11px/16px inherit;box-shadow:0 4px 14px rgba(0,0,0,.25);}',
      '@media (max-width:640px){.dsh3006-root{gap:4px}.dsh3006-trigger{max-width:150px}.dsh3006-effort-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}',
    ].join('\n')

    // Do not surface transport, path, provider, or credential-bearing details
    // through the browser. Runtime evidence records only closed assertion IDs.
    function errorMessage() { return 'request failed' }

    function favoriteKey(provider, model) {
      return JSON.stringify([provider, model])
    }

    function isFavoriteKey(value) {
      if (typeof value !== 'string' || value.length > 4096) return false
      let parsed
      try {
        parsed = JSON.parse(value)
      } catch {
        return false
      }
      return Array.isArray(parsed)
        && parsed.length === 2
        && parsed.every(part => typeof part === 'string' && part.length > 0 && part.length <= 1024)
    }

    function decodeSettings(section) {
      if (!section || typeof section !== 'object' || Array.isArray(section)) return undefined
      const favorites = section.favorites
      if (!Array.isArray(favorites) || favorites.length > MAX_FAVORITES) return undefined
      const seen = new Set()
      for (const key of favorites) {
        if (!isFavoriteKey(key) || seen.has(key)) return undefined
        seen.add(key)
      }
      return Object.freeze({ favorites: Object.freeze(favorites.slice()) })
    }

    function sameList(left, right) {
      return left.length === right.length && left.every((value, index) => value === right.at(index))
    }

    function changedList(list, key) {
      const next = list.slice()
      const at = next.indexOf(key)
      if (at >= 0) next.splice(at, 1)
      else if (next.length < MAX_FAVORITES) next.push(key)
      else return undefined
      return Object.freeze(next)
    }

    /**
     * Keep favorites behind the official alpha.1 SettingsScope. Host writes
     * are never treated as successful until the post-write scope snapshot
     * exactly matches the requested list. Non-loopback memory mode remains
     * process-local and deliberately uses no browser persistence primitive.
     */
    function createFavoritesController(scope) {
      const listeners = new Set()
      let disposed = false
      let memoryFavorites = Object.freeze([])
      let snapshot = Object.freeze({
        favorites: Object.freeze([]),
        status: 'loading',
        mode: scope.getSnapshot().mode,
        writable: false,
        pending: false,
      })

      function publish(next) {
        if (disposed) return
        const stableFavorites = sameList(snapshot.favorites, next.favorites)
          ? snapshot.favorites
          : Object.freeze(next.favorites.slice())
        const replacement = Object.freeze({ ...next, favorites: stableFavorites })
        if (snapshot.status === replacement.status
          && snapshot.mode === replacement.mode
          && snapshot.writable === replacement.writable
          && snapshot.pending === replacement.pending
          && snapshot.favorites === replacement.favorites) return
        snapshot = replacement
        for (const listener of Array.from(listeners)) listener()
      }

      function adoptScope() {
        const source = scope.getSnapshot()
        const decoded = decodeSettings(source.value)
        const favorites = source.mode === 'memory'
          ? memoryFavorites
          : decoded === undefined
            ? (source.status === 'loading' ? snapshot.favorites : Object.freeze([]))
            : decoded.favorites
        publish({
          favorites,
          status: source.status,
          mode: source.mode,
          writable: source.writable,
          pending: snapshot.pending,
        })
      }

      const unsubscribe = scope.subscribe(adoptScope)
      adoptScope()

      return Object.freeze({
        probe: PROBES.settingsScope,
        getSnapshot: function () { return snapshot },
        subscribe: function (listener) {
          listeners.add(listener)
          return function () { listeners.delete(listener) }
        },
        toggle: async function (key) {
          if (disposed || !isFavoriteKey(key)) {
            return { ok: false, reason: 'invalid', detail: 'malformed favorite key' }
          }
          const before = snapshot.favorites
          const next = changedList(before, key)
          if (next === undefined) {
            return { ok: false, reason: 'limit', detail: 'favorite limit reached' }
          }
          const source = scope.getSnapshot()

          if (source.mode === 'memory') {
            memoryFavorites = next
            publish({
              favorites: memoryFavorites,
              status: 'unavailable',
              mode: 'memory',
              writable: false,
              pending: false,
            })
            return { ok: true, reason: 'memory' }
          }

          if (snapshot.pending || source.status !== 'ready' || !source.writable) {
            return { ok: false, reason: 'unavailable', detail: 'settings namespace is not ready and writable' }
          }

          publish({
            favorites: before,
            status: source.status,
            mode: source.mode,
            writable: source.writable,
            pending: true,
          })

          let thrown
          try {
            await scope.set(FAVORITES_FIELD, next)
          } catch (error) {
            thrown = error
          }
          if (disposed) return { ok: false, reason: 'unavailable', detail: 'plugin disposed during settings write' }

          const settled = scope.getSnapshot()
          const decoded = decodeSettings(settled.value)
          const confirmed = thrown === undefined
            && settled.status === 'ready'
            && settled.writable
            && decoded !== undefined
            && sameList(decoded.favorites, next)
          const authoritative = decoded === undefined ? before : decoded.favorites
          publish({
            favorites: confirmed ? next : authoritative,
            status: settled.status,
            mode: settled.mode,
            writable: settled.writable,
            pending: false,
          })
          return confirmed
            ? { ok: true, reason: 'saved' }
            : { ok: false, reason: 'write-failed', detail: thrown === undefined ? 'post-write snapshot mismatch' : errorMessage(thrown) }
        },
        dispose: function () {
          if (disposed) return
          disposed = true
          unsubscribe()
          listeners.clear()
        },
      })
    }

    function choicesOf(groups) {
      const choices = []
      for (const group of groups || []) {
        for (const model of group.models || []) choices.push({ group, model })
      }
      return choices
    }

    function reasoningChoices(reasoning, t) {
      if (!reasoning || !Array.isArray(reasoning.efforts) || reasoning.efforts.length === 0) return []
      const choices = []
      if (reasoning.defaultEffort === undefined) {
        choices.push({ effort: undefined, label: t('effort.providerDefault') })
      }
      for (const effort of reasoning.efforts) {
        choices.push({ effort: effort.id, label: effort.name || effort.id })
      }
      return choices
    }

    function ModelToolbox(props) {
      const state = React.useSyncExternalStore(
        function (listener) { return props.directory.subscribe(listener) },
        function () { return props.directory.getSnapshot() },
        function () { return props.directory.getSnapshot() },
      )
      const favoriteState = React.useSyncExternalStore(
        props.favorites.subscribe,
        props.favorites.getSnapshot,
        props.favorites.getSnapshot,
      )
      const [open, setOpen] = React.useState(false)
      const [query, setQuery] = React.useState('')
      const [favoritesOnly, setFavoritesOnly] = React.useState(false)
      const [notice, setNotice] = React.useState(null)
      const [actionPending, setActionPending] = React.useState(false)
      const rootRef = React.useRef(null)
      const triggerRef = React.useRef(null)
      const searchRef = React.useRef(null)
      const popupId = React.useId()
      const effortId = React.useId()
      const t = props.t

      const choices = React.useMemo(function () { return choicesOf(state.groups) }, [state.groups])
      const current = state.current
      const currentChoice = current
        ? choices.find(function (choice) {
          return choice.group.id === current.provider && choice.model.id === current.model
        }) || null
        : null
      const currentKey = current
        ? favoriteKey(current.provider, current.model)
        : null
      const reasoning = currentChoice ? currentChoice.model.reasoning : undefined
      const efforts = React.useMemo(function () { return reasoningChoices(reasoning, t) }, [reasoning, t])
      const effectiveEffort = current && current.reasoningEffort !== undefined
        ? current.reasoningEffort
        : reasoning && reasoning.defaultEffort !== undefined
          ? reasoning.defaultEffort
          : undefined
      let effortIndex = efforts.findIndex(function (choice) { return choice.effort === effectiveEffort })
      if (effortIndex < 0) effortIndex = 0
      const busy = props.locked || state.status === 'selecting' || actionPending || favoriteState.pending

      const filteredGroups = React.useMemo(function () {
        const needle = query.trim().toLocaleLowerCase()
        return (state.groups || []).map(function (group) {
          const models = (group.models || []).filter(function (model) {
            const key = favoriteKey(group.id, model.id)
            if (favoritesOnly && favoriteState.favorites.indexOf(key) < 0) return false
            if (!needle) return true
            return [group.name, group.id, model.name, model.id, model.description]
              .filter(Boolean)
              .some(function (value) { return String(value).toLocaleLowerCase().includes(needle) })
          })
          return { group, models }
        }).filter(function (entry) { return entry.models.length > 0 })
      }, [state.groups, query, favoritesOnly, favoriteState.favorites])

      function showNotice(key, params) {
        setNotice(t(key, params))
      }

      function closePopover(restoreFocus) {
        setOpen(false)
        setQuery('')
        if (restoreFocus) queueMicrotask(function () { triggerRef.current && triggerRef.current.focus() })
      }

      function loadModels() {
        if (!props.available) return
        showNotice('status.loading')
        props.load().then(function (ok) {
          if (ok) showNotice('status.loaded')
          else showNotice('status.loadFailed', { message: 'request rejected' })
        }, function (error) {
          showNotice('status.loadFailed', { message: errorMessage(error) })
        })
      }

      React.useEffect(function () {
        if (!props.available) return undefined
        let active = true
        props.load().then(function (ok) {
          if (active && !ok) showNotice('status.loadFailed', { message: 'request rejected' })
        }, function (error) {
          if (active) showNotice('status.loadFailed', { message: errorMessage(error) })
        })
        return function () { active = false }
      }, [props.available, props.load, props.directory])

      React.useEffect(function () {
        if (!open) return undefined
        function closeOutside(event) {
          if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
        }
        document.addEventListener('mousedown', closeOutside)
        return function () { document.removeEventListener('mousedown', closeOutside) }
      }, [open])

      React.useEffect(function () {
        if (open && searchRef.current) searchRef.current.focus()
      }, [open])

      if (!props.available) return null

      function chooseModel(group, model) {
        setActionPending(true)
        showNotice('status.selecting')
        props.select({ provider: group.id, model: model.id }).then(function (accepted) {
          setActionPending(false)
          if (accepted) {
            closePopover(true)
            showNotice('status.selected')
          } else {
            showNotice('status.selectFailed', { message: 'request rejected' })
          }
        }, function (error) {
          setActionPending(false)
          showNotice('status.selectFailed', { message: errorMessage(error) })
        })
      }

      function toggleFavorite(group, model) {
        const key = favoriteKey(group.id, model.id)
        props.favorites.toggle(key).then(function (result) {
          if (result.ok && result.reason === 'saved') showNotice('favorite.saved')
          else if (result.ok && result.reason === 'memory') showNotice('favorite.memory')
          else if (result.reason === 'invalid') showNotice('favorite.invalid')
          else if (result.reason === 'limit') showNotice('favorite.limit')
          else if (result.reason === 'unavailable') showNotice('favorite.unavailable')
          else showNotice('favorite.failed')
        }, function (error) {
          showNotice('favorite.failed', { message: errorMessage(error) })
        })
      }

      function chooseEffort(index) {
        const choice = efforts.at(index)
        if (!current || !choice) return
        const selection = { provider: current.provider, model: current.model }
        if (choice.effort !== undefined) selection.reasoningEffort = choice.effort
        setActionPending(true)
        showNotice('effort.applying')
        props.select(selection).then(function (accepted) {
          setActionPending(false)
          if (accepted) showNotice('effort.applied')
          else showNotice('effort.failed', { message: 'request rejected' })
        }, function (error) {
          setActionPending(false)
          showNotice('effort.failed', { message: errorMessage(error) })
        })
      }

      const modelLabel = currentChoice
        ? (currentChoice.model.name || currentChoice.model.id)
        : current
          ? current.provider + '/' + current.model
          : t('trigger.fallback')
      const noMatches = filteredGroups.length === 0
      const favoriteWritable = favoriteState.mode === 'memory'
        || (favoriteState.status === 'ready' && favoriteState.writable)
      const visibleNotice = notice || (
        favoriteState.mode === 'host' && favoriteState.status === 'unavailable'
          ? t('favorite.unavailable')
          : null
      )

      return React.createElement('div', {
        ref: rootRef,
        className: 'dsh3006-root',
        'data-dsh-plugin': PLUGIN_ID,
        'data-dsh-client-probe': PROBES.clientApply,
        'data-dsh-settings-probe': props.favorites.probe,
        'data-dsh-slot-probe': PROBES.slot,
        onKeyDown: function (event) {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            closePopover(true)
          }
        },
      },
      React.createElement('button', {
        ref: triggerRef,
        type: 'button',
        className: 'dsh3006-trigger',
        disabled: props.locked,
        'aria-label': t('trigger.aria'),
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': open ? popupId : undefined,
        'data-dsh-better-model-selector': 'trigger',
        onClick: function () {
          const next = !open
          if (next) {
            setOpen(true)
            loadModels()
          } else {
            closePopover(false)
          }
        },
      },
      React.createElement('span', { className: 'dsh3006-trigger-label' }, modelLabel),
      currentKey && favoriteState.favorites.indexOf(currentKey) >= 0
        ? React.createElement('span', { className: 'dsh3006-current-star', 'aria-hidden': true }, '★')
        : null,
      React.createElement('span', { 'aria-hidden': true }, open ? '▴' : '▾')),

      efforts.length > 0 && current
        ? React.createElement('div', { className: 'dsh3006-effort' },
          React.createElement('label', { className: 'dsh3006-effort-label', htmlFor: effortId }, t('effort.label')),
          React.createElement('select', {
            id: effortId,
            className: 'dsh3006-effort-select',
            value: String(effortIndex),
            disabled: busy,
            onChange: function (event) { chooseEffort(Number(event.target.value)) },
          }, efforts.map(function (choice, index) {
            return React.createElement('option', { key: String(choice.effort) + ':' + index, value: String(index) }, choice.label)
          })))
        : null,

      open ? React.createElement('div', {
        id: popupId,
        className: 'dsh3006-popover',
        role: 'dialog',
        'aria-label': t('dialog.aria'),
        'aria-busy': state.status === 'loading' || busy,
      },
      React.createElement('div', { className: 'dsh3006-toolbar' },
        React.createElement('input', {
          ref: searchRef,
          className: 'dsh3006-search',
          type: 'search',
          value: query,
          spellCheck: false,
          'aria-label': t('search.label'),
          placeholder: t('search.placeholder'),
          onChange: function (event) { setQuery(event.target.value) },
        }),
        React.createElement('button', {
          type: 'button',
          className: 'dsh3006-filter',
          'aria-pressed': favoritesOnly,
          'aria-label': favoritesOnly ? t('filter.all') : t('filter.favorites'),
          title: favoritesOnly ? t('filter.all') : t('filter.favorites'),
          onClick: function () { setFavoritesOnly(!favoritesOnly) },
        }, '★')),
      React.createElement('ul', { className: 'dsh3006-list', 'aria-label': t('dialog.aria') },
        filteredGroups.map(function (entry) {
          return React.createElement(React.Fragment, { key: entry.group.id },
            React.createElement('li', { className: 'dsh3006-heading' }, entry.group.name),
            entry.models.map(function (model) {
              const key = favoriteKey(entry.group.id, model.id)
              const selected = !!current && current.provider === entry.group.id && current.model === model.id
              const favorite = favoriteState.favorites.indexOf(key) >= 0
              const name = model.name || model.id
              return React.createElement('li', { className: 'dsh3006-row', key },
                React.createElement('button', {
                  type: 'button',
                  className: 'dsh3006-model',
                  disabled: busy,
                  'aria-current': selected ? 'true' : undefined,
                  onClick: function () { chooseModel(entry.group, model) },
                },
                React.createElement('span', { className: 'dsh3006-copy' },
                  React.createElement('span', { className: 'dsh3006-name' }, name),
                  model.description
                    ? React.createElement('span', { className: 'dsh3006-description' }, model.description)
                    : null),
                selected ? React.createElement('span', { className: 'dsh3006-check' }, t('model.current')) : null),
                React.createElement('button', {
                  type: 'button',
                  className: 'dsh3006-favorite',
                  disabled: busy || !favoriteWritable,
                  'aria-pressed': favorite,
                  'aria-label': favorite ? t('favorite.remove', { model: name }) : t('favorite.add', { model: name }),
                  title: favorite ? t('favorite.remove', { model: name }) : t('favorite.add', { model: name }),
                  onClick: function () { toggleFavorite(entry.group, model) },
                }, favorite ? '★' : '☆'))
            }))
        }),
        noMatches
          ? React.createElement('li', { className: 'dsh3006-empty' },
            state.groups.length === 0 ? t('status.empty') : t('status.noMatch'))
          : null))
        : null,

      visibleNotice
        ? React.createElement('div', { className: 'dsh3006-status', role: 'status', 'aria-live': 'polite' }, visibleNotice)
        : null)
    }

    const inject = ['slots', 'sessions', 'modelDirectories', 'locale', 'settingsScope']

    function registerDictionaries(ctx) {
      const disposers = []
      try {
        disposers.push(ctx.locale.register(LOCALE_NAMESPACE, { zh, en }))
        for (const [locale, dictionary] of EXTRA_DICTIONARIES) {
          disposers.push(ctx.locale.register(LOCALE_NAMESPACE, locale, dictionary))
        }
      } catch (error) {
        for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)()
        throw error
      }

      let disposed = false
      return function () {
        if (disposed) return
        disposed = true
        for (let index = disposers.length - 1; index >= 0; index -= 1) disposers.at(index)()
      }
    }

    function apply(ctx) {
      ctx.effect(function () {
        if (typeof document === 'undefined') return function () {}
        const selector = 'style[data-dsh-plugin-css="' + STYLE_ID + '"]'
        if (document.querySelector(selector) !== null) {
          throw new Error('duplicate #3006 owned style: ' + STYLE_ID)
        }
        const tag = document.createElement('style')
        tag.dataset.dshPluginCss = STYLE_ID
        tag.dataset.dshProbe = PROBES.style
        tag.textContent = CSS
        document.head.appendChild(tag)
        return function () { tag.remove() }
      }, 'dsh-plugin-3006: owned style')

      ctx.effect(function () {
        return registerDictionaries(ctx)
      }, 'dsh-plugin-3006: dictionaries')

      const settings = ctx.settingsScope.bind({
        namespace: SETTINGS_NAMESPACE,
        decode: decodeSettings,
      })
      const favorites = createFavoritesController(settings)
      ctx.effect(function () {
        return function () { favorites.dispose() }
      }, 'dsh-plugin-3006: favorites controller')

      ctx.slots.inject('conversation.input.model', function () {
        return ctx.slots.register({
          name: 'conversation.input.model',
          priority: -1,
          locale: LOCALE_NAMESPACE,
          inject: function (sessionId) {
            const directory = ctx.modelDirectories.directoryFor(sessionId)
            const available = ctx.sessions.subagentAddress(sessionId) === undefined
            return {
              available,
              directory: directory.store,
              favorites,
              load: function () {
                if (!available) return Promise.resolve(false)
                return directory.load().then(function () { return true }, function () { return false })
              },
              select: function (selection) {
                if (!available) return Promise.resolve(false)
                return directory.select(selection).then(function () { return true }, function () { return false })
              },
            }
          },
        }, ModelToolbox)
      })
    }

    exports.apply = apply
    exports.inject = inject
    exports.reviewProbes = PROBES
    return module.exports
  },
})
