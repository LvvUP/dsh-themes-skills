/* =====================================================================
   dsh-scenery-background — 山海背景插件（客户端 bundle）
   注意：客户端 bundle 必须以经典脚本注册工厂（window.__ModuleLoader__.load），
   不能用 ESM export 语法（否则脚本解析失败会导致整个 harness 启动失败）。
   ===================================================================== */
window.__ModuleLoader__.load({
  id: "@dsh-themes/community-dsh-scenery-background",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var inject = [];

    function apply(ctx) {
      "use strict";
      try {
        /* ---------- 幂等保护 ---------- */
        if (typeof document === "undefined") return;
        if (document.getElementById("dsh-scenery-bg")) return;

        /* ---------- 样式 ---------- */
        var CSS = "/* =====================================================================\n   DeepSeek Harness Web — 山海背景 (Mountain \u0026 Sea Scenery Background)\n   通过 dist/index.html 引入；由 dist/backgrounds.js 控制。\n   ===================================================================== */\n\n/* 1. 页面画布透明，让背景层透出 */\nhtml,\nbody {\n  background: transparent !important;\n}\n\n/* 2. 固定全屏背景层（不拦截任何鼠标事件） */\n#dsh-scenery-bg {\n  position: fixed;\n  inset: 0;\n  z-index: -1;\n  overflow: hidden;\n  pointer-events: none;\n  background-color: #0b1424;\n  /* 离线兜底：内置的一幅山·海渐变插画（正确 URL 编码） */\n  background-image: url(\"data:image/svg+xml,%3Csvg%20xmlns%3D\u0027http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg\u0027%20width%3D\u00271600\u0027%20height%3D\u0027900\u0027%3E%3Cdefs%3E%3ClinearGradient%20id%3D\u0027sky\u0027%20x1%3D\u00270\u0027%20y1%3D\u00270\u0027%20x2%3D\u00270\u0027%20y2%3D\u00271\u0027%3E%3Cstop%20offset%3D\u00270\u0027%20stop-color%3D\u0027%231c2b4a\u0027%2F%3E%3Cstop%20offset%3D\u0027.55\u0027%20stop-color%3D\u0027%233e5c80\u0027%2F%3E%3Cstop%20offset%3D\u0027.82\u0027%20stop-color%3D\u0027%239db8d0\u0027%2F%3E%3Cstop%20offset%3D\u00271\u0027%20stop-color%3D\u0027%23e2ebf2\u0027%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D\u0027sea\u0027%20x1%3D\u00270\u0027%20y1%3D\u00270\u0027%20x2%3D\u00270\u0027%20y2%3D\u00271\u0027%3E%3Cstop%20offset%3D\u00270\u0027%20stop-color%3D\u0027%232b4666\u0027%2F%3E%3Cstop%20offset%3D\u00271\u0027%20stop-color%3D\u0027%23122238\u0027%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D\u00271600\u0027%20height%3D\u0027900\u0027%20fill%3D\u0027url(%23sky)\u0027%2F%3E%3Ccircle%20cx%3D\u00271120\u0027%20cy%3D\u0027470\u0027%20r%3D\u002786\u0027%20fill%3D\u0027%23f7c873\u0027%2F%3E%3Cpath%20d%3D\u0027M0%20560%20L180%20400%20L330%20540%20L520%20380%20L700%20560%20L900%20420%20L1080%20560%20L1280%20440%20L1450%20560%20L1600%20470%20L1600%20900%20L0%20900%20Z\u0027%20fill%3D\u0027%233a5a80\u0027%2F%3E%3Cpath%20d%3D\u0027M0%20670%20L160%20520%20L320%20640%20L500%20500%20L680%20650%20L860%20540%20L1040%20660%20L1240%20560%20L1420%20660%20L1600%20585%20L1600%20900%20L0%20900%20Z\u0027%20fill%3D\u0027%2329415f\u0027%2F%3E%3Crect%20x%3D\u00270\u0027%20y%3D\u0027700\u0027%20width%3D\u00271600\u0027%20height%3D\u0027200\u0027%20fill%3D\u0027url(%23sea)\u0027%2F%3E%3Cellipse%20cx%3D\u00271120\u0027%20cy%3D\u0027750\u0027%20rx%3D\u002746\u0027%20ry%3D\u002716\u0027%20fill%3D\u0027%23f7c873\u0027%20opacity%3D\u0027.35\u0027%2F%3E%3Cellipse%20cx%3D\u00271120\u0027%20cy%3D\u0027790\u0027%20rx%3D\u002730\u0027%20ry%3D\u00279\u0027%20fill%3D\u0027%23f7c873\u0027%20opacity%3D\u0027.22\u0027%2F%3E%3C%2Fsvg%3E\");\n  background-size: cover;\n  background-position: center;\n  background-repeat: no-repeat;\n}\n\n/* 轮播画面层 */\n#dsh-scenery-bg .slide {\n  position: absolute;\n  inset: 0;\n  background-size: cover;\n  background-position: center;\n  background-repeat: no-repeat;\n  opacity: 0;\n  transition: opacity 1.8s ease;\n  will-change: opacity, transform;\n}\n#dsh-scenery-bg .slide.on {\n  opacity: 1;\n}\n#dsh-scenery-bg .slide.kenburns {\n  animation: dsh-kenburns 26s ease-out both;\n}\n@keyframes dsh-kenburns {\n  from {\n    transform: scale(1.02) translate(0, 0);\n  }\n  to {\n    transform: scale(1.12) translate(-1.4%, 1.1%);\n  }\n}\n\n/* 柔和遮罩：兼顾唯美与界面可读性（默认「更清晰」档） */\n#dsh-scenery-bg::after {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  background: radial-gradient(\n    130% 100% at 15% 8%,\n    rgba(10, 16, 30, 0.1) 0%,\n    rgba(10, 16, 30, 0.22) 52%,\n    rgba(8, 12, 22, 0.4) 100%\n  );\n}\n/* 「更柔和」档：遮罩加深，保证内容可读性优先 */\nbody[data-bg-vivid=\"soft\"] #dsh-scenery-bg::after {\n  background: radial-gradient(\n    130% 100% at 15% 8%,\n    rgba(10, 16, 30, 0.18) 0%,\n    rgba(10, 16, 30, 0.38) 52%,\n    rgba(8, 12, 22, 0.62) 100%\n  );\n}\n\n/* 3. 主框架：背景交给内部面板的令牌控制。\n       注意：这里不能加 backdrop-filter / filter / transform——\n       它们会让祖先元素成为包含块，把设置面板等 position:fixed 弹层\n       锁进侧栏里（曾导致设置面板被压成 279px 窄条、看不到右侧内容）。 */\n[class*=_frame] {\n  background: transparent !important;\n}\n\n[class*=_sidebarCol],\n[class*=_detailsCol] {\n  background: transparent !important;\n}\n\n/* 侧栏边界：让导航栏保持面板轮廓（浅色主题） */\nbody:not([data-ds-dark-theme]) [class*=_sidebarCol] {\n  border-right-color: rgba(130, 150, 180, 0.3) !important;\n}\n\n/* 3b. 覆盖主题背景令牌：应用内部面板（会话区 / 侧栏 / 输入卡等）\n      统一改为半透明毛玻璃，让山海背景透出。\n      主题管理器以内联方式写入这些令牌（非 !important），\n      这里用 !important 的样式表声明覆盖，优先级必胜。\n      默认档 =「更清晰」：面板更透、背景更亮眼；\n      data-bg-vivid=\"soft\" =「更柔和」：面板更实、可读性优先。 */\nbody:not([data-ds-dark-theme]) {\n  --dsw-alias-bg-base: rgba(248, 250, 255, 0.46) !important;\n  --dsw-alias-bg-layer-1: rgba(248, 250, 255, 0.4) !important;\n  --dsw-alias-bg-layer-2: rgba(250, 251, 255, 0.5) !important;\n  --dsw-specific-sidebar-fill: rgba(240, 244, 250, 0.3) !important;\n  --dsw-specific-input-major: rgba(255, 255, 255, 0.48) !important;\n}\nbody[data-ds-dark-theme] {\n  --dsw-alias-bg-base: rgba(9, 12, 20, 0.38) !important;\n  --dsw-alias-bg-layer-1: rgba(9, 12, 20, 0.36) !important;\n  --dsw-alias-bg-layer-2: rgba(12, 16, 26, 0.45) !important;\n  --dsw-specific-sidebar-fill: rgba(7, 9, 15, 0.28) !important;\n  --dsw-specific-input-major: rgba(12, 16, 26, 0.45) !important;\n}\nbody[data-bg-vivid=\"soft\"]:not([data-ds-dark-theme]) {\n  --dsw-alias-bg-base: rgba(248, 250, 255, 0.58) !important;\n  --dsw-alias-bg-layer-1: rgba(248, 250, 255, 0.52) !important;\n  --dsw-alias-bg-layer-2: rgba(250, 251, 255, 0.62) !important;\n  --dsw-specific-sidebar-fill: rgba(255, 255, 255, 0.42) !important;\n  --dsw-specific-input-major: rgba(255, 255, 255, 0.58) !important;\n}\nbody[data-bg-vivid=\"soft\"][data-ds-dark-theme] {\n  --dsw-alias-bg-base: rgba(9, 12, 20, 0.46) !important;\n  --dsw-alias-bg-layer-1: rgba(9, 12, 20, 0.44) !important;\n  --dsw-alias-bg-layer-2: rgba(12, 16, 26, 0.52) !important;\n  --dsw-specific-sidebar-fill: rgba(7, 9, 15, 0.36) !important;\n  --dsw-specific-input-major: rgba(12, 16, 26, 0.5) !important;\n}\n\n/* 4. 悬浮控制按钮与面板 */\n#dsh-bg-toggle {\n  position: fixed;\n  right: 16px;\n  bottom: 16px;\n  z-index: 60;\n  width: 40px;\n  height: 40px;\n  border-radius: 50%;\n  border: 1px solid rgba(255, 255, 255, 0.28);\n  background: rgba(16, 24, 38, 0.55);\n  backdrop-filter: blur(10px);\n  -webkit-backdrop-filter: blur(10px);\n  color: #fff;\n  font-size: 18px;\n  line-height: 1;\n  cursor: pointer;\n  display: grid;\n  place-items: center;\n  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);\n  transition: transform 0.18s ease, background 0.18s ease;\n  user-select: none;\n}\n#dsh-bg-toggle:hover {\n  transform: scale(1.1);\n  background: rgba(30, 44, 66, 0.75);\n}\n#dsh-bg-toggle.hidden {\n  display: none;\n}\n\n#dsh-bg-panel {\n  position: fixed;\n  right: 16px;\n  bottom: 66px;\n  z-index: 60;\n  width: 236px;\n  box-sizing: border-box;\n  padding: 14px 14px 12px;\n  border-radius: 14px;\n  border: 1px solid rgba(255, 255, 255, 0.18);\n  background: rgba(20, 28, 44, 0.82);\n  backdrop-filter: blur(16px);\n  -webkit-backdrop-filter: blur(16px);\n  color: #eef2f8;\n  font-size: 12px;\n  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);\n  display: none;\n}\n#dsh-bg-panel.open {\n  display: block;\n}\n#dsh-bg-panel h4 {\n  margin: 0 0 10px;\n  font-size: 13px;\n  font-weight: 600;\n  letter-spacing: 0.02em;\n}\n#dsh-bg-panel .row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin: 8px 0;\n}\n#dsh-bg-panel button {\n  flex: 1;\n  padding: 6px 8px;\n  border-radius: 8px;\n  border: 1px solid rgba(255, 255, 255, 0.16);\n  background: rgba(255, 255, 255, 0.08);\n  color: #eef2f8;\n  font-size: 12px;\n  cursor: pointer;\n  transition: background 0.15s ease, border-color 0.15s ease;\n}\n#dsh-bg-panel button:hover {\n  background: rgba(255, 255, 255, 0.16);\n}\n#dsh-bg-panel button.active {\n  background: rgba(120, 170, 220, 0.35);\n  border-color: rgba(150, 200, 255, 0.6);\n}\n#dsh-bg-panel .meta {\n  margin-top: 8px;\n  color: rgba(238, 242, 248, 0.62);\n  font-size: 11px;\n  line-height: 1.5;\n}\n#dsh-bg-panel label {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  color: rgba(238, 242, 248, 0.85);\n  cursor: pointer;\n  margin: 8px 0 0;\n}\n#dsh-bg-panel input[type=\"checkbox\"] {\n  accent-color: #8ab4f8;\n}\n#dsh-bg-panel a {\n  color: #9ec7ff;\n  text-decoration: none;\n}\n#dsh-bg-panel .credits {\n  margin-top: 10px;\n  padding-top: 8px;\n  border-top: 1px solid rgba(255, 255, 255, 0.12);\n  color: rgba(238, 242, 248, 0.5);\n  font-size: 10px;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  #dsh-scenery-bg .slide {\n    transition: none;\n  }\n  #dsh-scenery-bg .slide.kenburns {\n    animation: none;\n  }\n}\n";

        /* ---------- 图片 ---------- */
        var LOCAL = [{ name: "晨光山峦", url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIwIDEwODAiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIHNsaWNlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic2t5IiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzIzMmE0ZCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNDUiIHN0b3AtY29sb3I9IiM0YjRlNzkiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjcyIiBzdG9wLWNvbG9yPSIjYjA2ZjdlIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMC44OCIgc3RvcC1jb2xvcj0iI2U4YTg3YyIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNmNmQ2YTYiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8cmFkaWFsR3JhZGllbnQgaWQ9InN1biIgY3g9IjAuNSIgY3k9IjAuNSIgcj0iMC41Ij4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmM2Q2IiBzdG9wLW9wYWNpdHk9IjAuOTUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjM1IiBzdG9wLWNvbG9yPSIjZmZkOWEwIiBzdG9wLW9wYWNpdHk9IjAuNSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNmZmQ5YTAiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ibWlzdCIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNmMmQ5YzQiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNiIgc3RvcC1jb2xvcj0iI2Y0ZGZjOSIgc3RvcC1vcGFjaXR5PSIwLjQ1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2Y2ZTZkMiIgc3RvcC1vcGFjaXR5PSIwLjgiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjEwODAiIGZpbGw9InVybCgjc2t5KSIvPgogIDxjaXJjbGUgY3g9IjEyNTAiIGN5PSI2MjAiIHI9IjM0MCIgZmlsbD0idXJsKCNzdW4pIi8+CiAgPHBhdGggZD0iTTAgNjIwIEwxODAgNTAwIEwzNjAgNTkwIEw1NjAgNDUwIEw3NjAgNjAwIEw5ODAgNDgwIEwxMTgwIDYxMCBMMTM4MCA1MDAgTDE1NjAgNTkwIEwxNzYwIDQ4MCBMMTkyMCA2MDAgTDE5MjAgMTA4MCBMMCAxMDgwIFoiIGZpbGw9IiM1ZDVhODYiIG9wYWNpdHk9IjAuOTIiLz4KICA8cmVjdCB4PSIwIiB5PSI2NDAiIHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjIwMCIgZmlsbD0idXJsKCNtaXN0KSIvPgogIDxwYXRoIGQ9Ik0wIDcyMCBMMjIwIDYwMCBMNDIwIDcwMCBMNjQwIDU3MCBMODQwIDY5MCBMMTA2MCA1ODAgTDEyNjAgNzAwIEwxNDgwIDU5MCBMMTcwMCA2OTAgTDE5MjAgNjEwIEwxOTIwIDEwODAgTDAgMTA4MCBaIiBmaWxsPSIjM2Y0NDcwIi8+CiAgPHJlY3QgeD0iMCIgeT0iNzQwIiB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxNDAiIGZpbGw9InVybCgjbWlzdCkiLz4KICA8cGF0aCBkPSJNMCA4MjAgTDI0MCA3MDAgTDQ2MCA4MDAgTDY4MCA2NzAgTDkwMCA3OTAgTDExMjAgNjgwIEwxMzQwIDgwMCBMMTU2MCA2OTAgTDE3ODAgNzkwIEwxOTIwIDcyMCBMMTkyMCAxMDgwIEwwIDEwODAgWiIgZmlsbD0iIzJjMzE1NyIvPgogIDxwYXRoIGQ9Ik0wIDk0MCBMMjYwIDg0MCBMNTIwIDkzMCBMNzgwIDgzMCBMMTA0MCA5MjAgTDEzMDAgODQwIEwxNTYwIDkzMCBMMTgyMCA4NTAgTDE5MjAgOTAwIEwxOTIwIDEwODAgTDAgMTA4MCBaIiBmaWxsPSIjMWQyMTQyIi8+Cjwvc3ZnPgo=" }, { name: "海上落日", url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIwIDEwODAiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIHNsaWNlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic2t5IiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzJjMjM0OCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iIzhhNGE3MiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNzUiIHN0b3AtY29sb3I9IiNkOTdmNmUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjkyIiBzdG9wLWNvbG9yPSIjZjJiMDdjIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2Y3ZDlhOCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0iZ2xvdyIgY3g9IjAuNSIgY3k9IjAuNSIgcj0iMC41Ij4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmNmRkIiBzdG9wLW9wYWNpdHk9IjEiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjQiIHN0b3AtY29sb3I9IiNmZmUzYWQiIHN0b3Atb3BhY2l0eT0iMC41NSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNmZmUzYWQiIHN0b3Atb3BhY2l0eT0iMCIvPgogICAgPC9yYWRpYWxHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic2VhIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzNhMzA1OSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuMyIgc3RvcC1jb2xvcj0iIzZiNGE3MiIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNjUiIHN0b3AtY29sb3I9IiNhMDZhNzAiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMmEyMDM4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJyZWZsIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmZTliOCIgc3RvcC1vcGFjaXR5PSIwLjkiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmZkOWEwIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjEwODAiIGZpbGw9InVybCgjc2t5KSIvPgogIDxjaXJjbGUgY3g9Ijk2MCIgY3k9IjU0MCIgcj0iMzIwIiBmaWxsPSJ1cmwoI2dsb3cpIi8+CiAgPGNpcmNsZSBjeD0iOTYwIiBjeT0iNTQwIiByPSI5MiIgZmlsbD0iI2ZmZTliOCIvPgogIDxyZWN0IHg9IjAiIHk9IjYzMCIgd2lkdGg9IjE5MjAiIGhlaWdodD0iNDUwIiBmaWxsPSJ1cmwoI3NlYSkiLz4KICA8cGF0aCBkPSJNODAwIDYzMCBMMTEyMCA2MzAgTDEyODAgMTA4MCBMNjQwIDEwODAgWiIgZmlsbD0idXJsKCNyZWZsKSIgb3BhY2l0eT0iMC43Ii8+CiAgPHBhdGggZD0iTTAgNzAwIFEyNDAgNjg4IDQ4MCA3MDIgVDk2MCA3MDAgVDE0NDAgNzAyIFQxOTIwIDcwMCBMMTkyMCA3MjQgTDAgNzI0IFoiIGZpbGw9IiNmZmQ5YTAiIG9wYWNpdHk9IjAuMTMiLz4KICA8cGF0aCBkPSJNMCA3OTAgUTI2MCA3NzYgNTIwIDc5MiBUMTA0MCA3ODYgVDE1NjAgNzkyIFQxOTIwIDc4NiBMMTkyMCA4MTIgTDAgODEyIFoiIGZpbGw9IiNmZmU5YjgiIG9wYWNpdHk9IjAuMSIvPgogIDxwYXRoIGQ9Ik0wIDg5MCBRMzAwIDg3NCA2MDAgODkyIFQxMjAwIDg4NiBUMTgwMCA4OTIgVDE5MjAgODg2IEwxOTIwIDkxMiBMMCA5MTIgWiIgZmlsbD0iI2ZmZTliOCIgb3BhY2l0eT0iMC4wOCIvPgogIDxwYXRoIGQ9Ik0wIDEwMDAgUTI4MCA5ODYgNTYwIDEwMDIgVDExMjAgOTk2IFQxNjgwIDEwMDIgVDE5MjAgOTk2IEwxOTIwIDEwMjAgTDAgMTAyMCBaIiBmaWxsPSIjZjJjOThmIiBvcGFjaXR5PSIwLjEiLz4KICA8cGF0aCBkPSJNMCA2NDAgUTQ4MCA2MjAgOTYwIDY0MCBUMTkyMCA2NDAgTDE5MjAgNjYwIEwwIDY2MCBaIiBmaWxsPSIjZmZlOWI4IiBvcGFjaXR5PSIwLjE2Ii8+Cjwvc3ZnPgo=" }, { name: "星夜之山", url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIwIDEwODAiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIHNsaWNlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ibmlnaHQiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMDUwYTFjIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMC42IiBzdG9wLWNvbG9yPSIjMGQxNzMwIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzE2MjMzZiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxyYWRpYWxHcmFkaWVudCBpZD0ibW9vbmdsb3ciIGN4PSIwLjUiIGN5PSIwLjUiIHI9IjAuNSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2U4ZWZmZiIgc3RvcC1vcGFjaXR5PSIwLjk1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMC4zNSIgc3RvcC1jb2xvcj0iI2M5ZDhmZiIgc3RvcC1vcGFjaXR5PSIwLjM1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2M5ZDhmZiIgc3RvcC1vcGFjaXR5PSIwIi8+CiAgICA8L3JhZGlhbEdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSJ1cmwoI25pZ2h0KSIvPgogIDxlbGxpcHNlIGN4PSI2MjAiIGN5PSIzMDAiIHJ4PSI4NDAiIHJ5PSIyMDAiIGZpbGw9IiNiOWM4ZjIiIG9wYWNpdHk9IjAuMDciIHRyYW5zZm9ybT0icm90YXRlKC0xNiA2MjAgMzAwKSIvPgogIDxlbGxpcHNlIGN4PSI2MjAiIGN5PSIzMDAiIHJ4PSI2MDAiIHJ5PSIxMzAiIGZpbGw9IiNjZmRjZmYiIG9wYWNpdHk9IjAuMDUiIHRyYW5zZm9ybT0icm90YXRlKC0xNiA2MjAgMzAwKSIvPgogIDxnIGZpbGw9IiNmZmZmZmYiPgogICAgPGNpcmNsZSBjeD0iMTIwIiBjeT0iOTAiIHI9IjEuNiIgb3BhY2l0eT0iMC45Ii8+PGNpcmNsZSBjeD0iMjYwIiBjeT0iNjAiIHI9IjEuMiIgb3BhY2l0eT0iMC43Ii8+PGNpcmNsZSBjeD0iNDAwIiBjeT0iMTMwIiByPSIxLjgiIG9wYWNpdHk9IjAuODUiLz48Y2lyY2xlIGN4PSI1NDAiIGN5PSI3MCIgcj0iMS4xIiBvcGFjaXR5PSIwLjYiLz48Y2lyY2xlIGN4PSI3MDAiIGN5PSIxNTAiIHI9IjEuNSIgb3BhY2l0eT0iMC44Ii8+PGNpcmNsZSBjeD0iODMwIiBjeT0iNTUiIHI9IjEuMyIgb3BhY2l0eT0iMC43Ii8+PGNpcmNsZSBjeD0iOTgwIiBjeT0iMTIwIiByPSIxLjciIG9wYWNpdHk9IjAuOSIvPjxjaXJjbGUgY3g9IjExMzAiIGN5PSI2NSIgcj0iMS4yIiBvcGFjaXR5PSIwLjY1Ii8+PGNpcmNsZSBjeD0iMTI5MCIgY3k9IjE0MCIgcj0iMS42IiBvcGFjaXR5PSIwLjg1Ii8+PGNpcmNsZSBjeD0iMTQ0MCIgY3k9IjcwIiByPSIxLjEiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjE2MDAiIGN5PSIxMjAiIHI9IjEuOCIgb3BhY2l0eT0iMC45Ii8+PGNpcmNsZSBjeD0iMTc2MCIgY3k9IjYwIiByPSIxLjMiIG9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjE5MDAiIGN5PSIxNTAiIHI9IjEuNSIgb3BhY2l0eT0iMC44Ii8+PGNpcmNsZSBjeD0iMTgwIiBjeT0iMjIwIiByPSIxLjIiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjM2MCIgY3k9IjI2MCIgcj0iMS42IiBvcGFjaXR5PSIwLjg1Ii8+PGNpcmNsZSBjeD0iNTIwIiBjeT0iMjEwIiByPSIxLjEiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjY4MCIgY3k9IjI4MCIgcj0iMS40IiBvcGFjaXR5PSIwLjc1Ii8+PGNpcmNsZSBjeD0iODUwIiBjeT0iMjMwIiByPSIxLjciIG9wYWNpdHk9IjAuOSIvPjxjaXJjbGUgY3g9IjEwMjAiIGN5PSIyNzAiIHI9IjEuMiIgb3BhY2l0eT0iMC42NSIvPjxjaXJjbGUgY3g9IjExOTAiIGN5PSIyMjAiIHI9IjEuNSIgb3BhY2l0eT0iMC44Ii8+PGNpcmNsZSBjeD0iMTM2MCIgY3k9IjI4MCIgcj0iMS4zIiBvcGFjaXR5PSIwLjciLz48Y2lyY2xlIGN4PSIxNTIwIiBjeT0iMjMwIiByPSIxLjYiIG9wYWNpdHk9IjAuODUiLz48Y2lyY2xlIGN4PSIxNjkwIiBjeT0iMjcwIiByPSIxLjEiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjE4NjAiIGN5PSIyMjAiIHI9IjEuNCIgb3BhY2l0eT0iMC43NSIvPjxjaXJjbGUgY3g9IjkwIiBjeT0iMzYwIiByPSIxLjMiIG9wYWNpdHk9IjAuNyIvPjxjaXJjbGUgY3g9IjI0MCIgY3k9IjQxMCIgcj0iMS4xIiBvcGFjaXR5PSIwLjYiLz48Y2lyY2xlIGN4PSI0NzAiIGN5PSIzODAiIHI9IjEuNiIgb3BhY2l0eT0iMC44NSIvPjxjaXJjbGUgY3g9IjY0MCIgY3k9IjQzMCIgcj0iMS4yIiBvcGFjaXR5PSIwLjY1Ii8+PGNpcmNsZSBjeD0iOTAwIiBjeT0iMzcwIiByPSIxLjUiIG9wYWNpdHk9IjAuOCIvPjxjaXJjbGUgY3g9IjEwODAiIGN5PSI0MjAiIHI9IjEuMSIgb3BhY2l0eT0iMC42Ii8+PGNpcmNsZSBjeD0iMTM0MCIgY3k9IjM4MCIgcj0iMS40IiBvcGFjaXR5PSIwLjc1Ii8+PGNpcmNsZSBjeD0iMTU4MCIgY3k9IjQyMCIgcj0iMS4yIiBvcGFjaXR5PSIwLjY1Ii8+PGNpcmNsZSBjeD0iMTgyMCIgY3k9IjM3MCIgcj0iMS42IiBvcGFjaXR5PSIwLjg1Ii8+PGNpcmNsZSBjeD0iMzIwIiBjeT0iNTIwIiByPSIxLjEiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjU2MCIgY3k9IjU2MCIgcj0iMS40IiBvcGFjaXR5PSIwLjc1Ii8+PGNpcmNsZSBjeD0iNzgwIiBjeT0iNTEwIiByPSIxLjIiIG9wYWNpdHk9IjAuNjUiLz48Y2lyY2xlIGN4PSIxMTIwIiBjeT0iNTQwIiByPSIxLjUiIG9wYWNpdHk9IjAuOCIvPjxjaXJjbGUgY3g9IjE0NjAiIGN5PSI1MjAiIHI9IjEuMSIgb3BhY2l0eT0iMC42Ii8+PGNpcmNsZSBjeD0iMTc0MCIgY3k9IjU2MCIgcj0iMS4zIiBvcGFjaXR5PSIwLjciLz4KICA8L2c+CiAgPGNpcmNsZSBjeD0iMTUyMCIgY3k9IjIwMCIgcj0iMTcwIiBmaWxsPSJ1cmwoI21vb25nbG93KSIvPgogIDxjaXJjbGUgY3g9IjE1MjAiIGN5PSIyMDAiIHI9IjU0IiBmaWxsPSIjZWVmM2ZmIi8+CiAgPGNpcmNsZSBjeD0iMTUzOCIgY3k9IjE4NSIgcj0iNTQiIGZpbGw9IiMwZDE3MzAiIG9wYWNpdHk9IjAuMDciLz4KICA8cGF0aCBkPSJNMCA3MDAgTDIwMCA1NjAgTDQwMCA2ODAgTDYyMCA1MjAgTDg0MCA2NjAgTDEwNjAgNTQwIEwxMjgwIDY4MCBMMTUwMCA1NTAgTDE3MjAgNjcwIEwxOTIwIDU4MCBMMTkyMCAxMDgwIEwwIDEwODAgWiIgZmlsbD0iIzEwMWEzMyIvPgogIDxwYXRoIGQ9Ik0wIDgyMCBMMjYwIDY4MCBMNTIwIDgwMCBMNzgwIDY2MCBMMTA0MCA4MDAgTDEzMDAgNjgwIEwxNTYwIDgwMCBMMTgyMCA2OTAgTDE5MjAgNzgwIEwxOTIwIDEwODAgTDAgMTA4MCBaIiBmaWxsPSIjMGExMzI2Ii8+CiAgPHBhdGggZD0iTTAgOTgwIEwzMDAgOTAwIEw2MDAgOTcwIEw5MDAgODkwIEwxMjAwIDk2MCBMMTUwMCA5MDAgTDE4MDAgOTcwIEwxOTIwIDkyMCBMMTkyMCAxMDgwIEwwIDEwODAgWiIgZmlsbD0iIzA2MGQxZCIvPgo8L3N2Zz4K" }, { name: "碧海波涛", url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIwIDEwODAiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIHNsaWNlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic2t5IiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2I4ZTRlOCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNlYWY3ZjQiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InNlYSIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMyYjdhOWIiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjMWY2ZjhmIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzEwM2M1OCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZ2xpbnQiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZWFmOWY3IiBzdG9wLW9wYWNpdHk9IjAuODUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjY2ZlZWYwIiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNza3kpIi8+CiAgPHJlY3QgeD0iMCIgeT0iMzAwIiB3aWR0aD0iMTkyMCIgaGVpZ2h0PSI3ODAiIGZpbGw9InVybCgjc2VhKSIvPgogIDxjaXJjbGUgY3g9IjQyMCIgY3k9IjI0MCIgcj0iNTYiIGZpbGw9IiNmZmY4ZTgiIG9wYWNpdHk9IjAuOSIvPgogIDxjaXJjbGUgY3g9IjQyMCIgY3k9IjI0MCIgcj0iMTIwIiBmaWxsPSIjZmZmOGU4IiBvcGFjaXR5PSIwLjE0Ii8+CiAgPHBhdGggZD0iTTMwMCAzMDAgTDU0MCAzMDAgTDY2MCAxMDgwIEwxODAgMTA4MCBaIiBmaWxsPSJ1cmwoI2dsaW50KSIgb3BhY2l0eT0iMC41NSIvPgogIDxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2JmZTZlNiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuNSI+CiAgICA8cGF0aCBkPSJNMCAzODAgUTE2MCAzNjAgMzIwIDM4MiBUNjQwIDM4MCBUOTYwIDM4MiBUMTI4MCAzODAgVDE2MDAgMzgyIFQxOTIwIDM4MCIvPgogICAgPHBhdGggZD0iTTAgNDcwIFEyMDAgNDQ4IDQwMCA0NzIgVDgwMCA0NjggVDEyMDAgNDcyIFQxNjAwIDQ2OCBUMTkyMCA0NzIiLz4KICAgIDxwYXRoIGQ9Ik0wIDU4MCBRMjIwIDU1NiA0NDAgNTgyIFQ4ODAgNTc2IFQxMzIwIDU4MiBUMTc2MCA1NzYgVDE5MjAgNTgyIi8+CiAgICA8cGF0aCBkPSJNMCA3MDAgUTE4MCA2NzQgMzYwIDcwMiBUNzIwIDY5NiBUMTA4MCA3MDIgVDE0NDAgNjk2IFQxODAwIDcwMiBUMTkyMCA3MDAiLz4KICA8L2c+CiAgPGcgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC41Ij4KICAgIDxlbGxpcHNlIGN4PSIzNjAiIGN5PSIzNzUiIHJ4PSI0MCIgcnk9IjUiLz48ZWxsaXBzZSBjeD0iNzIwIiBjeT0iMzg1IiByeD0iMzAiIHJ5PSI0Ii8+PGVsbGlwc2UgY3g9IjExNTAiIGN5PSIzNzUiIHJ4PSI0NCIgcnk9IjUiLz48ZWxsaXBzZSBjeD0iMTU2MCIgY3k9IjM4NSIgcng9IjM0IiByeT0iNCIvPjxlbGxpcHNlIGN4PSI0MjAiIGN5PSI0NzAiIHJ4PSIzNiIgcnk9IjQiLz48ZWxsaXBzZSBjeD0iOTgwIiBjeT0iNDcyIiByeD0iNDgiIHJ5PSI1Ii8+PGVsbGlwc2UgY3g9IjE1MDAiIGN5PSI0NjgiIHJ4PSIzMCIgcnk9IjQiLz48ZWxsaXBzZSBjeD0iNjQwIiBjeT0iNTgyIiByeD0iMzgiIHJ5PSI0Ii8+PGVsbGlwc2UgY3g9IjEyNDAiIGN5PSI1NzgiIHJ4PSI0MiIgcnk9IjUiLz48ZWxsaXBzZSBjeD0iMTcwMCIgY3k9IjU4MCIgcng9IjMwIiByeT0iNCIvPgogIDwvZz4KICA8cGF0aCBkPSJNMTQwMCAzMDAgTDE0NzAgMzAwIEwxNDQwIDMzNiBMMTQzNSAzMDAgWiIgZmlsbD0iIzEyM2E1MiIgb3BhY2l0eT0iMC44NSIvPgogIDxwYXRoIGQ9Ik0xNDYwIDMwMCBMMTUyMCAzMDAgTDE0OTAgMzMwIEwxNDg2IDMwMCBaIiBmaWxsPSIjMTIzYTUyIiBvcGFjaXR5PSIwLjciLz4KICA8cGF0aCBkPSJNMTQ2MiAzMDAgTDE0ODggMzAwIEwxNDc1IDMyMCBaIiBmaWxsPSIjMTIzYTUyIiBvcGFjaXR5PSIwLjU1Ii8+Cjwvc3ZnPgo=" }, { name: "云海群峰", url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIwIDEwODAiIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIHNsaWNlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0ic2t5IiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzdmYTNjNCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNiIgc3RvcC1jb2xvcj0iI2JjZDJlNCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuODUiIHN0b3AtY29sb3I9IiNmMGUzY2QiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZjdlY2Q5Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPHJhZGlhbEdyYWRpZW50IGlkPSJzdW4iIGN4PSIwLjUiIGN5PSIwLjUiIHI9IjAuNSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmZjZlMCIgc3RvcC1vcGFjaXR5PSIwLjk1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMC40NSIgc3RvcC1jb2xvcj0iI2ZjZTNiOCIgc3RvcC1vcGFjaXR5PSIwLjQiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmNlM2I4IiBzdG9wLW9wYWNpdHk9IjAiLz4KICAgIDwvcmFkaWFsR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImNsb3VkIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmZmZmZiIgc3RvcC1vcGFjaXR5PSIwIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMC41IiBzdG9wLWNvbG9yPSIjZmRmNmVjIiBzdG9wLW9wYWNpdHk9IjAuODUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmRmNmVjIiBzdG9wLW9wYWNpdHk9IjAuMSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxmaWx0ZXIgaWQ9InNvZnQiIHg9Ii00MCUiIHk9Ii00MCUiIHdpZHRoPSIxODAlIiBoZWlnaHQ9IjE4MCUiPgogICAgICA8ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIyNiIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjEwODAiIGZpbGw9InVybCgjc2t5KSIvPgogIDxjaXJjbGUgY3g9IjEwODAiIGN5PSI1NjAiIHI9IjMwMCIgZmlsbD0idXJsKCNzdW4pIi8+CiAgPHBhdGggZD0iTTAgNjIwIEwxNjAgNTAwIEwzMzAgNTkwIEw1MjAgNDcwIEw3MDAgNTcwIEw5MDAgNDgwIEwxMTAwIDU5MCBMMTMyMCA1MDAgTDE1MDAgNTgwIEwxNzAwIDQ5MCBMMTkyMCA2MDAgTDE5MjAgMTA4MCBMMCAxMDgwIFoiIGZpbGw9IiM4ZmE5YzQiIG9wYWNpdHk9IjAuNzUiIGZpbHRlcj0idXJsKCNzb2Z0KSIvPgogIDxyZWN0IHg9IjAiIHk9IjYyMCIgd2lkdGg9IjE5MjAiIGhlaWdodD0iMjQwIiBmaWxsPSJ1cmwoI2Nsb3VkKSIvPgogIDxwYXRoIGQ9Ik0wIDcyMCBMMjQwIDYwMCBMNDYwIDcwMCBMNjgwIDU4MCBMOTAwIDY5MCBMMTEyMCA2MDAgTDEzNDAgNzAwIEwxNTYwIDU5MCBMMTc4MCA2OTAgTDE5MjAgNjIwIEwxOTIwIDEwODAgTDAgMTA4MCBaIiBmaWxsPSIjNmU4N2E2IiBvcGFjaXR5PSIwLjkiLz4KICA8cmVjdCB4PSIwIiB5PSI3NjAiIHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjE2MCIgZmlsbD0idXJsKCNjbG91ZCkiLz4KICA8cGF0aCBkPSJNMCA4NjAgTDI4MCA3NDAgTDU0MCA4NTAgTDgwMCA3MzAgTDEwNjAgODQwIEwxMzIwIDc0MCBMMTU4MCA4NTAgTDE4NDAgNzUwIEwxOTIwIDgxMCBMMTkyMCAxMDgwIEwwIDEwODAgWiIgZmlsbD0iIzRjNjM4NCIvPgogIDxwYXRoIGQ9Ik0wIDk4MCBMMzIwIDg4MCBMNjIwIDk3MCBMOTAwIDg3MCBMMTE4MCA5NjAgTDE0NjAgODgwIEwxNzQwIDk3MCBMMTkyMCA5MDAgTDE5MjAgMTA4MCBMMCAxMDgwIFoiIGZpbGw9IiMzMzQ4NmEiLz4KPC9zdmc+Cg==" }];

        var REMOTE = [
          { name: "雪峰晨光",   url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1920&q=80" },
          { name: "云海日出",   url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=80" },
          { name: "群山晨雾",   url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=80" },
          { name: "山峦叠嶂",   url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1920&q=80" },
          { name: "雪山连绵",   url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80" },
          { name: "星夜之山",   url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80" },
          { name: "碧海微波",   url: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1920&q=80" },
          { name: "海上航迹",   url: "https://images.unsplash.com/photo-1439405326854-014607f694d7?auto=format&fit=crop&w=1920&q=80" },
          { name: "海天一色",   url: "https://images.unsplash.com/photo-1476673160081-cf065607f449?auto=format&fit=crop&w=1920&q=80" },
          { name: "海岸晴空",   url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80" },
          { name: "碧蓝海湾",   url: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1920&q=80" },
          { name: "惊涛拍岸",   url: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=1920&q=80" }
        ];

        var IMAGES = LOCAL.concat(REMOTE);

        var STORE_KEY = "dsh-scenery-bg-v1";
        var SLIDESHOW_MS = 30000;
        var VERSION = "plugin-v1";

        /* ---------- 注入样式 ---------- */
        // Keep sidebar and workspace labels legible over both photos and SVGs.
        CSS += `
body:not([data-ds-dark-theme]) #dsh-scenery-bg::after { background: rgba(248,250,255,.72); }
body[data-bg-vivid="soft"]:not([data-ds-dark-theme]) #dsh-scenery-bg::after { background: rgba(248,250,255,.84); }
body[data-ds-dark-theme] #dsh-scenery-bg::after { background: rgba(5,12,24,.62); }
body[data-bg-vivid="soft"][data-ds-dark-theme] #dsh-scenery-bg::after { background: rgba(5,12,24,.72); }
body:not([data-ds-dark-theme]) { --dsw-alias-label-secondary: #24384d !important; --dsw-alias-label-tertiary: #24384d !important; }
body[data-ds-dark-theme] { --dsw-alias-label-secondary: #e0e8f1 !important; --dsw-alias-label-tertiary: #d0dbe7 !important; }
`;
        var style = document.createElement("style");
        style.setAttribute("data-plugin-css", "dsh-scenery-background");
        style.textContent = CSS;
        document.head.appendChild(style);

        /* ---------- 本地存储 ---------- */
        function readStore() {
          try {
            var raw = localStorage.getItem(STORE_KEY);
            if (raw) {
              var parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") return parsed;
            }
          } catch (e) { /* ignore */ }
          return {};
        }
        function writeStore(patch) {
          try {
            var s = readStore();
            for (var k in patch) s[k] = patch[k];
            localStorage.setItem(STORE_KEY, JSON.stringify(s));
          } catch (e) { /* ignore */ }
        }

        var store = readStore();
        var mode = store.mode === "slideshow" ? "slideshow" : "daily";
        var hidden = !!store.hidden;
        var dim = store.dim === "soft" ? "soft" : "vivid";
        document.body.setAttribute("data-bg-vivid", dim);

        /* ---------- 工具 ---------- */
        function dayNumber() {
          var n = new Date();
          return n.getFullYear() * 372 + (n.getMonth() + 1) * 31 + n.getDate();
        }
        function el(tag, cls, html) {
          var e = document.createElement(tag);
          if (cls) e.className = cls;
          if (html != null) e.innerHTML = html;
          return e;
        }

        /* ---------- 背景层 ---------- */
        var bg = el("div", null, '<div class="slide"></div><div class="slide"></div>');
        bg.id = "dsh-scenery-bg";
        document.body.insertBefore(bg, document.body.firstChild);
        var slides = bg.querySelectorAll(".slide");
        var activeSlide = 1;
        var ready = [];
        var ptr = 0;
        var timer = null;
        var lastUrl = "";

        function show(img) {
          var next = 1 - activeSlide;
          var s = slides[next];
          s.style.backgroundImage = 'url("' + img.url + '")';
          s.classList.remove("kenburns");
          void s.offsetWidth;
          s.classList.add("on");
          s.classList.add("kenburns");
          var prev = slides[activeSlide];
          setTimeout(function () {
            prev.classList.remove("on");
            prev.classList.remove("kenburns");
          }, 2100);
          activeSlide = next;
          lastUrl = img.url;
        }

        function pickDaily() {
          var day = dayNumber();
          var offset = 0;
          if (store.day === day && typeof store.offset === "number") offset = store.offset;
          var list = ready.length ? ready : null;
          var n = list ? list.length : IMAGES.length;
          var i = (((day + offset) % n) + n) % n;
          return list ? IMAGES[list[i]] : IMAGES[i];
        }

        function applyCurrent() {
          if (!ready.length) return;
          var img;
          if (mode === "daily") {
            img = pickDaily();
          } else {
            ptr = ptr % ready.length;
            img = IMAGES[ready[ptr]];
          }
          if (img.url !== lastUrl) show(img);
        }

        function startSlideshow() {
          stopTimer();
          timer = setInterval(function () {
            if (ready.length > 1) {
              ptr = (ptr + 1) % ready.length;
              show(IMAGES[ready[ptr]]);
            }
          }, SLIDESHOW_MS);
        }
        function stopTimer() {
          if (timer !== null) {
            clearInterval(timer);
            timer = null;
          }
        }

        function setMode(nextMode) {
          if (mode === nextMode) return;
          mode = nextMode;
          writeStore({ mode: mode });
          syncUi();
          stopTimer();
          if (mode === "slideshow") {
            var cur = indexOfUrl(lastUrl);
            if (cur >= 0) ptr = cur;
            applyCurrent();
            startSlideshow();
          } else {
            applyCurrent();
          }
        }

        function indexOfUrl(url) {
          if (!url) return -1;
          for (var i = 0; i < ready.length; i++) {
            if (IMAGES[ready[i]].url === url) return i;
          }
          return -1;
        }

        function manualNext() {
          if (mode === "slideshow") {
            if (ready.length > 1) {
              ptr = (ptr + 1) % ready.length;
              show(IMAGES[ready[ptr]]);
            }
          } else {
            var day = dayNumber();
            var offset = (store.day === day ? store.offset || 0 : 0) + 1;
            writeStore({ day: day, offset: offset });
            store.day = day;
            store.offset = offset;
            applyCurrent();
          }
        }

        /* ---------- 悬浮按钮与面板 ---------- */
        var toggleBtn = el("button", null, "🏔");
        toggleBtn.id = "dsh-bg-toggle";
        toggleBtn.title = "山海背景设置";
        toggleBtn.type = "button";
        document.body.appendChild(toggleBtn);

        var panel = el(
          "div",
          null,
          '<h4>山海背景</h4>' +
            '<div class="row">' +
            '<button data-mode="daily">每日一图</button>' +
            '<button data-mode="slideshow">循环轮播</button>' +
            "</div>" +
            '<div class="row"><button id="dsh-bg-next">换一张</button></div>' +
            '<div class="row">' +
            '<button data-dim="vivid">更清晰</button>' +
            '<button data-dim="soft">更柔和</button>' +
            "</div>" +
            '<div class="meta" id="dsh-bg-meta"></div>' +
            '<label><input type="checkbox" id="dsh-bg-hidebtn" /> 隐藏悬浮按钮（Alt+B 恢复）</label>' +
            '<div class="credits">图片来自 <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash</a></div>'
        );
        panel.id = "dsh-bg-panel";
        document.body.appendChild(panel);

        var modeBtns = panel.querySelectorAll("[data-mode]");
        var dimBtns = panel.querySelectorAll("[data-dim]");
        var nextBtn = panel.querySelector("#dsh-bg-next");
        var metaEl = panel.querySelector("#dsh-bg-meta");
        var hideBtnChk = panel.querySelector("#dsh-bg-hidebtn");
        hideBtnChk.checked = hidden;

        function syncUi() {
          for (var i = 0; i < modeBtns.length; i++) {
            var b = modeBtns[i];
            b.classList.toggle("active", b.getAttribute("data-mode") === mode);
          }
          for (var j = 0; j < dimBtns.length; j++) {
            var d = dimBtns[j];
            d.classList.toggle("active", d.getAttribute("data-dim") === dim);
          }
          if (mode === "daily") {
            metaEl.textContent = "每日一图：每天自动更换一张，点击「换一张」可手动切换。";
          } else {
            metaEl.textContent = "循环轮播：每 " + (SLIDESHOW_MS / 1000) + " 秒交叉淡入淡出，循环滚动全部图片。";
          }
        }

        toggleBtn.addEventListener("click", function () {
          panel.classList.toggle("open");
        });

        for (var i = 0; i < modeBtns.length; i++) {
          modeBtns[i].addEventListener("click", function () {
            setMode(this.getAttribute("data-mode"));
          });
        }
        nextBtn.addEventListener("click", manualNext);

        for (var k = 0; k < dimBtns.length; k++) {
          dimBtns[k].addEventListener("click", function () {
            dim = this.getAttribute("data-dim");
            document.body.setAttribute("data-bg-vivid", dim);
            writeStore({ dim: dim });
            syncUi();
          });
        }

        hideBtnChk.addEventListener("change", function () {
          hidden = this.checked;
          writeStore({ hidden: hidden });
          if (hidden) {
            toggleBtn.classList.add("hidden");
            panel.classList.remove("open");
          } else {
            toggleBtn.classList.remove("hidden");
          }
        });

        document.addEventListener("keydown", function (ev) {
          if (ev.altKey && (ev.key === "b" || ev.key === "B")) {
            hidden = !hidden;
            writeStore({ hidden: hidden });
            hideBtnChk.checked = hidden;
            toggleBtn.classList.toggle("hidden", hidden);
            if (!hidden) panel.classList.remove("open");
          }
        });

        if (hidden) toggleBtn.classList.add("hidden");

        /* ---------- 图片预加载 ---------- */
        var first = true;
        for (var i = 0; i < IMAGES.length; i++) {
          (function (idx) {
            var im = new Image();
            im.onload = function () {
              ready.push(idx);
              if (first) {
                first = false;
                if (mode === "slideshow") {
                  applyCurrent();
                  startSlideshow();
                } else {
                  applyCurrent();
                }
                syncUi();
              }
            };
            im.onerror = function () { /* 跳过 */ };
            im.src = IMAGES[idx].url;
          })(i);
        }

        setTimeout(function () {
          if (!ready.length && !first) return;
          if (!ready.length) {
            metaEl.textContent = "场景加载失败：当前显示内置渐变背景。";
          }
        }, 8000);

        syncUi();

        /* 调试/扩展入口 */
        try {
          window.__DSH_BG__ = {
            get mode() { return mode; },
            setMode: setMode,
            next: manualNext,
            images: IMAGES,
            reload: function () { applyCurrent(); }
          };
        } catch (e) { /* ignore */ }

        try { console.log("[dsh-scenery-background] " + VERSION + " 已加载（山海背景插件）"); } catch (e) { /* ignore */ }
      } catch (e) {
        /* 任何运行时错误都不允许影响 harness 启动 */
        try { console.error("[dsh-scenery-background] apply error:", e); } catch (_) { /* ignore */ }
      }
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
