# Community packages for DeepSeek Harness Alpha

This directory contains reviewable adaptations for DeepSeek Harness `0.1.3-alpha.1`, source commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`. A package being present here does not authorize installation. The current item status, exact artifact hash, and receipt are in [community-recipes.json](../../references/community-recipes.json).

## Inspect or install an item

Start with the [Community Skin Installer](../../SKILL.md) and the selected catalog number. It checks the exact recipe and its runtime receipt. Pending items are available for source inspection; they cannot be installed through the public installer until their final artifact passes the required checks.

Use the Alpha launcher described in the repository [README](../../../../README.md) to prepare the fixed official source. Package changes require restarting Harness. Keep an existing installation and its recovery information separate from an isolated test profile.

## Adaptation scope

| Catalog IDs | Source directory | Preserved behavior and Alpha changes |
| --- | --- | --- |
| #2301 | `community-packages/open-sea-skin` | Open Sea's local assets, ocean surface, and settings. Runtime files were checked against the fixed source revision; packaged development dependencies were removed. WebGPU and fallback behavior require their own runtime observations. |
| #2302 | `community-packages/dsh-dream-skin` | Dream Skin palettes, wallpaper settings, and local state. The shared store import uses Alpha's `dsh-client-store`; the obsolete runtime injection is removed. Material styles target Alpha's composer, todo, queue, and question-card markers without blurring page or settings ancestors. Wallpaper washes read the registered palette to avoid recycling the previous composed color after a switch. |
| #2303 | `community-packages/dsh-scenery-background` | Background modes and controls, including the original remote Unsplash sources and offline fallback. Obsolete hashed layout selectors were adapted. Scheme-aware washes and secondary labels improve readability over scenery. Remote image availability is external to this package. |
| #2304 | `community-packages/dsh-skin-community` | Palette and wallpaper settings and the original character feature. The shared store import and injection declaration were adapted. A saved palette is restored after Alpha's asynchronous preference adoption; a dragged character remains visible when the viewport narrows. |
| #2305 | `community-packages/dsh-homepage-skin` | Original homepage effects and settings. The shared store import and injection declaration were adapted. Canvas/WebGL behavior requires a real browser check. |
| #2308–#2312 | `xiaoyao/packages/*` | Original artwork, guide and focus controls are retained. Alpha layout selectors and token priority are adapted; Sky Lab has a darker reading surface in dark mode. |

The original Ocean package, #2307, is referenced by its fixed upstream release URL and SHA-256 in the recipe. It does not require a repacked source directory here. HeiGeAi, the 15 community color variants, and the earlier Skin Center selection group have separate sources and receipts; this document does not expand their verification scope.

Each adapted source directory includes `DSH-ALPHA-ADAPTATION.json`, its original license, and retained upstream documentation. The packaged upstream README describes its original release; the recipe and this document describe Alpha packaging. Xiaoyao code remains MIT and its images remain CC-BY-NC-4.0. Adaptation does not replace the original author's rights or attribution.

## Find the original controls

These are the controls provided by the pinned packages. Their presence in this table describes source behavior; the item receipt identifies which actions were actually verified.

| Catalog ID | Controls after installation and restart |
| --- | --- |
| #2301 | Use the wave button near Harness Settings to open **Open Sea skin settings**. Adjust sea intensity, time of day, and glass opacity. The original renderer requires WebGPU; it explicitly rejects a WebGL fallback. Read the receipt for the tested GPU/browser result. |
| #2302 | Open Harness **Settings → Theme / 外观**. Select a skin, then use the wallpaper, gradient, accent, or theme-pack controls in that section. The package keeps settings in its isolated Harness home and a same-origin browser fallback. |
| #2303 | Use the mountain button to open **山海背景设置**. Choose daily or slideshow mode, move to the next image, and adjust the clear/soft overlay. **Alt+B** restores a hidden control button. The original package preloads its embedded artwork and remote Unsplash photographs; remote image availability can vary. |
| #2304 | Open Harness **Settings → General** for the skin, wallpaper, and character controls. The character can also be dragged and has a sticker picker. The retained artwork is the original author's inline SVG design. |
| #2305 | Open Harness **Settings → General → 首页皮肤** and toggle the homepage effects. The package follows light/dark appearance, disables animation when reduced motion is requested, and disables the fluid brush and grid on coarse-pointer or non-hover devices. |

The #2305 Alpha adapter also follows the `conversation` slot's `display: contents` wrapper when making the page surface transparent. This leaves composer and nested tool-card backgrounds intact; an active canvas marker alone is insufficient to establish a visible effect.

## Reproduce an artifact

From this Skills repository root, Python 3.9 or newer is sufficient; no dependency installation is needed:

```bash
python3 skills/dsh-community-skin-installer/assets/alpha/repack-community.py --check
```

This checks that all ten adapted source directories reproduce the catalog's content-addressed `.tgz` files. It validates each package identity and rejects links or files outside the declared source directory. Archives use sorted files, fixed metadata, and deterministic gzip timestamps.

After an intentional source change to a pending item, regenerate only that item:

```bash
python3 skills/dsh-community-skin-installer/assets/alpha/repack-community.py --write --ids 2303
```

A changed artifact must receive a new hash and fresh runtime evidence. The repacker refuses to replace changed bytes for an item still marked `runtime-verified`. It never installs a package or promotes a validation status.

## Read the evidence accurately

A final receipt binds the package hash, fixed Harness source, test environment, installation, observed client errors, controls exercised, cold process restart, and removal checks. Screenshots are identified separately from original artwork. Failed and superseded candidates remain diagnostics and cannot authorize another artifact.

Current local checks use an isolated Harness home and loopback Web UI, without real user conversations, model credentials, or external model API calls. A successful local lifecycle does not establish every operating system, GPU, browser, remote image service, or third-party feature. Read the limitations in the selected receipt before relying on an observation.
