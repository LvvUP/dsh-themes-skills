# Live Stats — Alpha candidate

Fixed upstream: `Proton1917/dsh-live-stats@ebd44aa89c40d8de2519c932c2237ce474f8558e`, BSD-3-Clause. Full tokenizer files, production source and original license notices are retained. `UPSTREAM.json` pins original source bytes; `alpha.patch` records the precise changes. No DSH lifecycle certification is implied by this candidate.

Recompile with Node 24 and an existing esbuild 0.28.2 installation:

```sh
node build.mjs /absolute/esbuild/package /absolute/pinned/node_modules
python3 build.py
DSH_FIXTURE_RUNTIME=/absolute/fixed/alpha/source node --test fixture.test.mjs
```

`build.mjs` checks every dependency file against `DEPENDENCIES.json` before use. Obtain those exact verified npm archives and extract them into the supplied flat node_modules; do not install upstream prepare or dev dependencies. `build.py` checks the final source inventory before producing a deterministic gzip/tar archive. Recompiling unchanged inputs must reproduce the frozen lib hashes.

See source/ADAPTATION.md for Alpha changes and source/THIRD_PARTY_NOTICES.md for separate tokenizer and bundled dependency rights. The fixture uses the official Alpha isSurfaceEvent function plus manually constructed events; it starts no server and sends no model request.
