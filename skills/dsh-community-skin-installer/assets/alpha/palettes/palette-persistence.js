/** Host-persisted selections; this function is embedded into each adapted client. */
function installPalettePersistence(ctx, themes, group) {
  const route = '/api/dsh-community-palettes/' + group;
  const owns = (id) => themes.some((theme) => theme.id === id);
  const builtIn = (id) => ['light', 'dark', 'system'].includes(id);
  const baseScope = ctx.settingsScope.bind({ namespace: 'ui-theme' });
  let active = true;
  let loaded = false;
  let settled = false;
  let selection = 'off';
  let base = 'system';
  let previousBase;
  let previousFont;
  let adoption = false;
  let writeTail = Promise.resolve();
  const persist = () => {
    const body = JSON.stringify({ selection, base });
    writeTail = writeTail.then(async () => {
      const response = await fetch(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      if (!response.ok) throw new Error('Palette selection could not be saved');
    }).catch((error) => ctx.logger.warn(error.message));
  };
  const restore = () => {
    if (active && loaded && settled && owns(selection) && ctx.theme.getTheme().preference !== selection) ctx.theme.setTheme(selection);
  };
  const adoptBase = () => {
    const snapshot = baseScope.getSnapshot();
    if (snapshot.status !== 'ready' || !snapshot.value) return;
    const value = snapshot.value;
    const initial = !settled;
    // Alpha republishes the base section when any settings namespace changes.
    // Re-adopting its unchanged preference must not undo our own palette save.
    const unchangedBase = settled && value.preference === previousBase;
    previousBase = value.preference;
    previousFont = value.fontSize;
    base = value.preference;
    settled = true;
    if (initial || unchangedBase) {
      adoption = true;
      queueMicrotask(() => { restore(); adoption = false; });
    }
  };
  ctx.effect(() => baseScope.subscribe(adoptBase), group + ': built-in preference readiness');
  adoptBase();
  ctx.on('theme/change', (snapshot) => {
    if (!loaded || !settled || !owns(selection) || snapshot.preference === selection) return;
    queueMicrotask(() => {
      if (!active || adoption || ctx.theme.getTheme().preference === selection) return;
      const current = ctx.theme.getTheme().preference;
      if (builtIn(current)) base = current;
      selection = 'off';
      persist();
    });
  });
  void fetch(route).then(async (response) => {
    if (!response.ok) throw new Error('Palette selection could not be loaded');
    const state = await response.json();
    if (!active || loaded) return;
    selection = owns(state.selection) ? state.selection : 'off';
    base = builtIn(state.base) ? state.base : base;
    loaded = true;
    restore();
  }).catch((error) => ctx.logger.warn(error.message));
  ctx.effect(() => () => { active = false; }, group + ': persistence lifecycle');
  return (id) => {
    loaded = true;
    if (owns(id)) {
      const before = ctx.theme.getTheme().preference;
      if (builtIn(before)) base = before;
      selection = id;
      ctx.theme.setTheme(id);
    } else {
      selection = 'off';
      ctx.theme.setTheme(base);
    }
    persist();
  };
}
