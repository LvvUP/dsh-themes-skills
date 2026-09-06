import presets from './presets.json' with { type: 'json' };

export const MAX_STATE_BYTES = 6 * 1024 * 1024;
export const DEFAULT_STATE = { id: null, image: '', opacity: 0.14, blur: 0, seeds: { accent: '#1e6eb5', secondary: '#0b3c6d', surface: '#f0f4f8', text: '#17212b' }, appearance: 'light' };

export function normalizeState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected skin preferences.');
  if (value.id !== null && value.id !== 'custom' && !presets.some((preset) => preset.id === value.id)) throw new Error('Unknown preset.');
  if (value.appearance !== 'light' && value.appearance !== 'dark') throw new Error('Unknown appearance.');
  if (!Number.isFinite(value.opacity) || value.opacity < 0 || value.opacity > 0.4) throw new Error('Invalid background opacity.');
  if (!Number.isFinite(value.blur) || value.blur < 0 || value.blur > 20) throw new Error('Invalid background blur.');
  if (typeof value.image !== 'string' || (value.image !== '' && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.image))) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (value.image.length > 5 * 1024 * 1024) throw new Error('Image is too large.');
  const seeds = {};
  for (const name of ['accent', 'secondary', 'surface', 'text']) {
    if (!/^#[a-f\d]{6}$/i.test(value.seeds?.[name])) throw new Error('Invalid seed color.');
    seeds[name] = value.seeds[name];
  }
  return { id: value.id, image: value.image, opacity: value.opacity, blur: value.blur, seeds, appearance: value.appearance };
}
