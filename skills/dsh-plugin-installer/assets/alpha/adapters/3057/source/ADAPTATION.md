# DSH Themes Alpha adaptation

Upstream: Proton1917/dsh-live-stats at ebd44aa89c40d8de2519c932c2237ce474f8558e (BSD-3-Clause).

This adaptation retains the upstream DeepSeek V3 tokenizer files and all live usage, provider correction, cache-hit, duration and throughput features. It uses Alpha projection stateSchema and wire view contracts, declares browser services that exist in Alpha, waits for the composer dock slot, and preserves sparse stream block indexes as JSON-safe null entries for checkpoint replay. State cache version is 3.

Runtime dependencies are bundled at the exact versions in DEPENDENCIES.json; the installed archive has no dependency downloads or lifecycle scripts. React and official DSH services remain provided by the host. Both tokenizer JSON files are unmodified; DeepSeek code and model license texts are included as upstream provenance. No model weights are bundled, and this plugin does not run a DeepSeek model. Estimates use the DeepSeek V3 tokenizer and may differ for another provider; provider usage replaces estimates when available.

Installation and opening the UI do not require a separate account. A configured model provider and actual conversation activity are needed to generate live measurements. This build is a candidate until independently installed, loaded, restarted and removed under the pinned Alpha runtime. Offline projection fixtures are not real provider measurements.
