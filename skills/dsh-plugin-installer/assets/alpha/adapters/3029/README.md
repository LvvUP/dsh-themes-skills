# Session Tree — Alpha candidate

Catalog ID 3029 and its existing slug are retained. Upstream is `ZhengQingJing/dsh-session-tree@28e7887a888adf1747e9a35b38b96f1dac233a23`, MIT. The original input files and exact patch are included. This package is native read-only session navigation; it is not a memory store or rollback tool.

Reproduce with an existing esbuild 0.28.2 installation (no dependency installation):

```sh
node build.mjs /absolute/esbuild/package
python3 build.py
DSH_FIXTURE_RUNTIME=/absolute/fixed/alpha/source node --test fixture.test.mjs
```

The compiler bundles the complete source and inlines the original CSS Module. Cordis owns the stylesheet lifecycle, including hot removal. React and DSH services stay supplied by the host. `build.py` validates every frozen source file and produces a deterministic archive. The browser test uses React server rendering and constructed lineage snapshots only; actual DSH installation/loading/restart/removal remains pending.
