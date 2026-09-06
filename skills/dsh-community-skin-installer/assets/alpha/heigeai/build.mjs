// Optional explicit module path reuses the already installed Alpha build tool.
const { build } = await import(process.argv[2] || 'esbuild');
export const options = { entryPoints: [new URL('./client.ts', import.meta.url).pathname], outfile: new URL('./lib/client.js', import.meta.url).pathname, bundle: true, format: 'cjs', platform: 'browser', target: 'es2022', minify: true,
  banner: { js: 'window.__ModuleLoader__.load({id:"@dsh-themes/community-heigeai-skin-center",factory:(require)=>{var module={exports:{}};var exports=module.exports;' },
  footer: { js: 'return module.exports;}});' } };
await build(options);
