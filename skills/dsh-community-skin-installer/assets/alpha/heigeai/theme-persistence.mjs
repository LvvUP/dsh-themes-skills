// Alpha's base settings arrive after third-party plugins and can be republished.
export function preserveSelection(ctx, { themeId, isSelected, disable }) {
  const scope = ctx.settingsScope.bind({ namespace: 'ui-theme' });
  let active = true, settled = false, adopting = false, previous;
  const adopt = () => {
    const snapshot = scope.getSnapshot();
    if (snapshot.status !== 'ready' || !snapshot.value) return;
    const preference = snapshot.value.preference;
    const restore = !settled || preference === previous;
    settled = true; previous = preference;
    if (restore) {
      adopting = true;
      queueMicrotask(() => {
        if (active && isSelected() && ctx.theme.getTheme().preference !== themeId) ctx.theme.setTheme(themeId);
        adopting = false;
      });
    }
  };
  ctx.effect(() => scope.subscribe(adopt));
  adopt();
  ctx.on('theme/change', (snapshot) => {
    if (!settled || !isSelected() || snapshot.preference === themeId) return;
    queueMicrotask(() => {
      if (active && !adopting && isSelected() && ctx.theme.getTheme().preference !== themeId) disable(ctx.theme.getTheme().preference);
    });
  });
  ctx.effect(() => () => { active = false; });
}
