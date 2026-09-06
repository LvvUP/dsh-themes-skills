import presets from './presets.json';
import { preserveSelection } from './theme-persistence.mjs';
import { deriveSkin } from './upstream/skins/derive.ts';
import { STOCK } from './upstream/styles/skins/generated/stock.ts';
import { DEFAULT_STATE, normalizeState } from './state.mjs';

export const inject = ['theme', 'settingsScope'];
const api = '/dsh-themes/heigeai/state';
const themeId = 'dsh-themes-heigeai';

export async function apply(ctx) {
  let state = normalizeState(await fetch(api).then((response) => response.json()));
  let disposeTheme = () => {};
  let previousTheme = ctx.theme.getTheme().preference;
  const element = (name, text = '') => { const node = document.createElement(name); node.textContent = text; return node; };
  const chinese = navigator.language.startsWith('zh');
  const label = (en, zh) => chinese ? zh : en;
  const controls = element('div'); controls.id = 'dsh-themes-heigeai-controls';
  const style = element('style');
  style.textContent = `#dsh-themes-heigeai-controls{position:fixed;right:16px;bottom:16px;z-index:3000;font:14px system-ui;color:#24313b}#dsh-themes-heigeai-controls button,#dsh-themes-heigeai-controls select{font:inherit;border:1px solid #bdcbd3;border-radius:9px;padding:9px 13px;background:#fff;color:#24313b}#dsh-themes-heigeai-controls dialog{border:1px solid #bdcbd3;border-radius:18px;padding:24px;background:#f8fafc;color:#24313b;max-width:min(470px,90vw);max-height:85vh;overflow:auto;box-shadow:0 20px 70px #142d4255}#dsh-themes-heigeai-controls dialog::backdrop{background:#17212b66}#dsh-themes-heigeai-controls label{display:grid;gap:7px;margin:15px 0}#dsh-themes-heigeai-controls input{max-width:100%}#dsh-themes-heigeai-controls .buttons{display:flex;gap:8px;margin-top:20px}#dsh-themes-heigeai-background{position:fixed;inset:0;z-index:2990;pointer-events:none;background-position:center;background-size:cover}`;
  const backdrop = element('div'); backdrop.id = 'dsh-themes-heigeai-background';
  const launch = element('button', label('21 palettes', '21 款配色')); launch.type = 'button';
  const dialog = element('dialog'); dialog.setAttribute('aria-label', label('HeiGeAi palettes', 'HeiGeAi 配色'));
  const heading = element('h2', label('HeiGeAi palettes', 'HeiGeAi 配色'));
  const disclosure = element('p', label('Alpha adaptation · Original palettes by HeiGeAi. Choose your own local wallpaper.', 'Alpha 适配版 · 原创配色来自 HeiGeAi。可选择自己的本地壁纸。'));
  const status = element('p'); status.setAttribute('role', 'status');
  const wrap = (text, input) => { const row = element('label', text); row.append(input); dialog.append(row); return input; };
  dialog.append(heading, disclosure);
  const select = element('select'); select.setAttribute('aria-label', label('Palette', '配色'));
  for (const [id, title] of [[ '', label('Official default', '官方默认') ], ...presets.map((preset) => [preset.id, preset.name[chinese ? 'zh' : 'en']]), ['custom', label('Custom seed colors', '自定义种子色')]]) {
    const option = element('option', title); option.value = id; select.append(option);
  }
  wrap(label('Palette', '配色'), select);
  const scheme = element('select'); for (const value of ['light', 'dark']) { const option = element('option', label(value, value === 'light' ? '浅色' : '深色')); option.value = value; scheme.append(option); }
  wrap(label('Custom appearance', '自定义明暗'), scheme);
  const colors = {};
  for (const [name, en, zh] of [['accent', 'Accent', '强调色'], ['secondary', 'Secondary', '辅助色'], ['surface', 'Surface', '背景色'], ['text', 'Text', '文字色']]) { const input = element('input'); input.type = 'color'; colors[name] = wrap(label(en, zh), input); }
  const image = element('input'); image.type = 'file'; image.accept = 'image/png,image/jpeg,image/webp'; wrap(label('Local background (PNG, JPEG, WebP)', '本地背景（PNG、JPEG、WebP）'), image);
  const opacity = element('input'); opacity.type = 'range'; opacity.min = '0'; opacity.max = '0.4'; opacity.step = '0.01'; wrap(label('Background opacity', '背景透明度'), opacity);
  const blur = element('input'); blur.type = 'range'; blur.min = '0'; blur.max = '20'; blur.step = '1'; wrap(label('Background blur', '背景模糊'), blur);
  const buttons = element('div'); buttons.className = 'buttons';
  const clear = element('button', label('Remove image', '移除图片')); clear.type = 'button';
  const close = element('button', label('Done', '完成')); close.type = 'button'; buttons.append(clear, close); dialog.append(status, buttons);
  controls.append(launch, dialog); document.head.append(style); document.body.append(backdrop, controls);

  const syncInputs = () => { select.value = state.id || ''; scheme.value = state.appearance; opacity.value = String(state.opacity); blur.value = String(state.blur); for (const key of Object.keys(colors)) colors[key].value = state.seeds[key]; };
  const paint = () => {
    disposeTheme(); disposeTheme = () => {};
    if (state.id) {
      const preset = state.id === 'custom' ? { id: 'custom', appearance: state.appearance, chrome: 'flat', seeds: state.seeds } : presets.find((preset) => preset.id === state.id);
      const derived = deriveSkin(preset, STOCK);
      const tokens = { ...derived.palette, ...STOCK.aliases[preset.appearance], ...derived.brand };
      disposeTheme = ctx.theme.register({ id: themeId, colorScheme: preset.appearance, tokens });
      ctx.theme.setTheme(themeId);
    } else ctx.theme.setTheme(previousTheme);
    backdrop.style.backgroundImage = state.image ? `url("${state.image}")` : '';
    backdrop.style.opacity = String(state.opacity);
    backdrop.style.filter = `blur(${state.blur}px)`;
  };
  let saving = Promise.resolve();
  const save = () => {
    const next = normalizeState(state); paint();
    saving = saving.then(async () => { const response = await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }); if (!response.ok) throw new Error((await response.json()).error); status.textContent = label('Saved on this device.', '已保存到此设备。'); }).catch((error) => { status.textContent = error.message; });
  };
  launch.onclick = () => dialog.showModal(); close.onclick = () => dialog.close();
  select.onchange = () => {
    state.id = select.value || null;
    const preset = presets.find((preset) => preset.id === state.id);
    if (preset) { state.seeds = { ...preset.seeds }; state.appearance = preset.appearance; }
    syncInputs(); save();
  };
  scheme.onchange = () => {
    state.appearance = scheme.value;
    state.seeds.surface = state.appearance === 'dark' ? '#171c27' : '#f0f4f8';
    state.seeds.text = state.appearance === 'dark' ? '#eef2f8' : '#17212b';
    state.id = 'custom'; syncInputs(); save();
  };
  for (const key of Object.keys(colors)) colors[key].onchange = () => { state.seeds[key] = colors[key].value; state.id = 'custom'; syncInputs(); save(); };
  opacity.oninput = () => { state.opacity = Number(opacity.value); save(); };
  blur.oninput = () => { state.blur = Number(blur.value); save(); };
  clear.onclick = () => { state.image = ''; image.value = ''; save(); };
  image.onchange = async () => {
    const file = image.files?.[0]; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3.5 * 1024 * 1024) { status.textContent = label('Choose a PNG, JPEG, or WebP smaller than 3.5 MB.', '请选择小于 3.5 MB 的 PNG、JPEG 或 WebP。'); return; }
    const reader = new FileReader(); reader.onload = () => { state.image = String(reader.result); save(); }; reader.readAsDataURL(file);
  };
  syncInputs(); paint();
  preserveSelection(ctx, { themeId, isSelected: () => !!state.id, disable: (preference) => { previousTheme = preference; state.id = null; syncInputs(); save(); } });
  ctx.on('dispose', () => { disposeTheme(); style.remove(); controls.remove(); backdrop.remove(); });
}
