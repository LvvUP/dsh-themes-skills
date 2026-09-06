# SHOPLINE Alpha adaptation

`python3 build.py` verifies the complete fixed native plugin and official MCP 1.1.0 source inventories, then produces a deterministic archive. Both upstream MIT licenses remain in the package.

The bundle starts the fixed local backend through Node with structured arguments. Its configuration and cache stay below the Harness home. All eight upstream agent skills and the complete official single-file MCP implementation remain present. All eleven packages imported at runtime remain dependencies; the four unused manifest-only packages are listed explicitly in `PROVENANCE.json` alongside the original dependency manifest.

The Alpha bridge requires an actual initial MCP connection and tool discovery. The current runtime receipt records the registered tool and skill names. Store API calls and model tasks are separate from installation verification.
