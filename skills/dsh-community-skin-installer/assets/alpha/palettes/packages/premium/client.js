window.__ModuleLoader__.load({id:"@dsh-themes-community/premium-alpha",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from2, except, desc) => {
  if (from2 && typeof from2 === "object" || typeof from2 === "function") {
    for (let key of __getOwnPropNames(from2))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from2[key], enumerable: !(desc = __getOwnPropDesc(from2, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.js
var require_clsx = __commonJS({
  "node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.js"(exports, module2) {
    function r(e2) {
      var o, t, f = "";
      if ("string" == typeof e2 || "number" == typeof e2) f += e2;
      else if ("object" == typeof e2) if (Array.isArray(e2)) {
        var n = e2.length;
        for (o = 0; o < n; o++) e2[o] && (t = r(e2[o])) && (f && (f += " "), f += t);
      } else for (t in e2) e2[t] && (f && (f += " "), f += t);
      return f;
    }
    function e() {
      for (var e2, o, t = 0, f = "", n = arguments.length; t < n; t++) (e2 = arguments[t]) && (o = r(e2)) && (f && (f += " "), f += o);
      return f;
    }
    module2.exports = e, module2.exports.clsx = e;
  }
});

// themes/community-alpha/upstream/premium/src/client/index.ts
var index_exports = {};
__export(index_exports, {
  PREMIUM_PALETTES: () => PREMIUM_PALETTES,
  ROW_ID: () => ROW_ID,
  SETTINGS_NS: () => SETTINGS_NS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// themes/community-alpha/upstream/premium/src/client/PaletteRow.tsx
var import_clsx = __toESM(require_clsx(), 1);
var import_react2 = require("react");

// themes/community-alpha/upstream/premium/src/palettes.ts
var PREMIUM_PALETTES = [
  {
    id: "dsh-alpha-premium-tokyo-night",
    colorScheme: "dark",
    labelKey: "palette.tokyoNight",
    swatchAccent: "#7aa2f7",
    swatchBackground: "#16161e",
    tokens: {
      "--dsw-alias-bg-base": "#16161e",
      "--dsw-alias-bg-layer-1": "#16161e",
      "--dsw-alias-bg-layer-2": "#1a1b26",
      "--dsw-alias-bg-layer-3": "#1f2335",
      "--dsw-alias-bg-overlay": "#292e42",
      "--dsw-alias-bg-module-platform": "#1f2335",
      "--dsw-alias-bg-multi-select": "#1a1b26",
      "--dsw-alias-bg-skeleton": "rgba(192, 202, 245, 0.08)",
      "--dsw-alias-bg-mask-drop": "rgba(22, 22, 30, 0.72)",
      "--dsw-alias-border-l1": "rgba(122, 162, 247, 0.1)",
      "--dsw-alias-border-l2": "rgba(122, 162, 247, 0.16)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(122, 162, 247, 0.1)",
      "--dsw-alias-border-l3": "rgba(122, 162, 247, 0.24)",
      "--dsw-alias-border-l4": "rgba(122, 162, 247, 0.32)",
      "--dsw-alias-border-inverted": "rgba(0, 0, 0, 0.2)",
      "--dsw-alias-border-inverted2": "rgba(0, 0, 0, 0.34)",
      "--dsw-alias-brand-primary": "#7aa2f7",
      "--dsw-alias-brand-primary-invert": "#16161e",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#7aa2f7",
      "--dsw-alias-brand-text": "#c0caf5",
      "--dsw-alias-button-primary-fill": "#7aa2f7",
      "--dsw-alias-button-primary-hover": "#89b1ff",
      "--dsw-alias-button-primary-dimmed": "#1f2335",
      "--dsw-alias-button-info-fill": "#7aa2f7",
      "--dsw-alias-button-info-hover": "#89b1ff",
      "--dsw-alias-button-contrast-fill": "#c0caf5",
      "--dsw-alias-button-elevated-fill": "#1f2335",
      "--dsw-alias-button-floating-fill": "#292e42",
      "--dsw-alias-button-floating-hover": "#343b58",
      "--dsw-alias-button-ghost-active-border": "#565f89",
      "--dsw-alias-button-ghost-active-fill": "#1f2335",
      "--dsw-alias-button-ghost-active-hover": "#292e42",
      "--dsw-alias-interactive-bg-hover": "rgba(122, 162, 247, 0.1)",
      "--dsw-alias-interactive-bg-active": "rgba(122, 162, 247, 0.16)",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(187, 154, 247, 0.18)",
      "--dsw-alias-interactive-bg-hover-solid": "#292e42",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(247, 118, 142, 0.15)",
      "--dsw-alias-label-primary": "#c0caf5",
      "--dsw-alias-label-secondary": "#a9b1d6",
      "--dsw-alias-label-tertiary": "#565f89",
      "--dsw-alias-label-caption": "#565f89",
      "--dsw-alias-label-dimmed": "#343b58",
      "--dsw-alias-label-primary-foreground": "#16161e",
      "--dsw-alias-label-primary-inverted": "#16161e",
      "--dsw-alias-label-primary-bluish": "#c0caf5",
      "--dsw-alias-label-primary-dimmed": "#343b58",
      "--dsw-alias-markdown-code-block": "#1a1b26",
      "--dsw-alias-markdown-code-block-banner": "#1f2335",
      "--dsw-alias-markdown-inline-code": "#1f2335",
      "--dsw-alias-markdown-citation": "#292e42",
      "--dsw-alias-markdown-tag": "#1f2335",
      "--dsw-alias-markdown-placeholder": "#1f2335",
      "--dsw-alias-markdown-code-segment-selected": "#1f2335",
      "--dsw-alias-markdown-code-segment-unselected": "#16161e",
      "--dsw-alias-scrollbar-bg-l1": "#292e42",
      "--dsw-alias-scrollbar-bg-l2": "#343b58",
      "--dsw-alias-scrollbar-hover-l1": "#343b58",
      "--dsw-alias-scrollbar-hover-l2": "#414868",
      "--dsw-alias-state-business-primary": "#7aa2f7",
      "--dsw-alias-state-business-tertiary": "#1f2335",
      "--dsw-alias-toast-bg": "#343b58",
      "--dsw-alias-tooltip-bg": "#343b58",
      "--dsw-specific-bubble": "#1a1b26",
      "--dsw-specific-bubble-highlight": "#1f2335",
      "--dsw-specific-input-major": "#1a1b26",
      "--dsw-specific-login-input": "#16161e",
      "--dsw-specific-selector": "#1f2335",
      "--dsw-specific-sidebar-fill": "#16161e",
      "--dsw-specific-sidebar-nav-item-active": "#1f2335",
      "--dsw-specific-sidebar-nav-item-active-accent": "#292e42",
      "--dsw-specific-sidebar-nav-item-hover": "#1a1b26",
      "--dsw-specific-tip": "#1f2335"
    }
  },
  {
    id: "dsh-alpha-premium-nord",
    colorScheme: "dark",
    labelKey: "palette.nord",
    swatchAccent: "#88c0d0",
    swatchBackground: "#2e3440",
    tokens: {
      "--dsw-alias-bg-base": "#2e3440",
      "--dsw-alias-bg-layer-1": "#2e3440",
      "--dsw-alias-bg-layer-2": "#3b4252",
      "--dsw-alias-bg-layer-3": "#434c5e",
      "--dsw-alias-bg-overlay": "#4c566a",
      "--dsw-alias-bg-module-platform": "#3b4252",
      "--dsw-alias-bg-multi-select": "#2e3440",
      "--dsw-alias-bg-skeleton": "rgba(236, 239, 244, 0.08)",
      "--dsw-alias-bg-mask-drop": "rgba(46, 52, 64, 0.72)",
      "--dsw-alias-border-l1": "rgba(236, 239, 244, 0.08)",
      "--dsw-alias-border-l2": "rgba(236, 239, 244, 0.14)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(236, 239, 244, 0.08)",
      "--dsw-alias-border-l3": "rgba(236, 239, 244, 0.2)",
      "--dsw-alias-border-l4": "rgba(236, 239, 244, 0.28)",
      "--dsw-alias-border-inverted": "rgba(0, 0, 0, 0.2)",
      "--dsw-alias-border-inverted2": "rgba(0, 0, 0, 0.34)",
      "--dsw-alias-brand-primary": "#88c0d0",
      "--dsw-alias-brand-primary-invert": "#2e3440",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#88c0d0",
      "--dsw-alias-brand-text": "#eceff4",
      "--dsw-alias-button-primary-fill": "#88c0d0",
      "--dsw-alias-button-primary-hover": "#9ed1dd",
      "--dsw-alias-button-primary-dimmed": "#3b4252",
      "--dsw-alias-button-info-fill": "#5e81ac",
      "--dsw-alias-button-info-hover": "#7093bd",
      "--dsw-alias-button-contrast-fill": "#eceff4",
      "--dsw-alias-button-elevated-fill": "#3b4252",
      "--dsw-alias-button-floating-fill": "#434c5e",
      "--dsw-alias-button-floating-hover": "#4c566a",
      "--dsw-alias-button-ghost-active-border": "#7b88a1",
      "--dsw-alias-button-ghost-active-fill": "#3b4252",
      "--dsw-alias-button-ghost-active-hover": "#434c5e",
      "--dsw-alias-interactive-bg-hover": "rgba(236, 239, 244, 0.07)",
      "--dsw-alias-interactive-bg-active": "rgba(236, 239, 244, 0.12)",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(136, 192, 208, 0.16)",
      "--dsw-alias-interactive-bg-hover-solid": "#434c5e",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(191, 97, 106, 0.15)",
      "--dsw-alias-label-primary": "#eceff4",
      "--dsw-alias-label-secondary": "#d8dee9",
      "--dsw-alias-label-tertiary": "#7b88a1",
      "--dsw-alias-label-caption": "#7b88a1",
      "--dsw-alias-label-dimmed": "#4c566a",
      "--dsw-alias-label-primary-foreground": "#2e3440",
      "--dsw-alias-label-primary-inverted": "#2e3440",
      "--dsw-alias-label-primary-bluish": "#eceff4",
      "--dsw-alias-label-primary-dimmed": "#4c566a",
      "--dsw-alias-markdown-code-block": "#3b4252",
      "--dsw-alias-markdown-code-block-banner": "#3b4252",
      "--dsw-alias-markdown-inline-code": "#3b4252",
      "--dsw-alias-markdown-citation": "#434c5e",
      "--dsw-alias-markdown-tag": "#3b4252",
      "--dsw-alias-markdown-placeholder": "#434c5e",
      "--dsw-alias-markdown-code-segment-selected": "#434c5e",
      "--dsw-alias-markdown-code-segment-unselected": "#2e3440",
      "--dsw-alias-scrollbar-bg-l1": "#434c5e",
      "--dsw-alias-scrollbar-bg-l2": "#4c566a",
      "--dsw-alias-scrollbar-hover-l1": "#4c566a",
      "--dsw-alias-scrollbar-hover-l2": "#5a6577",
      "--dsw-alias-state-business-primary": "#88c0d0",
      "--dsw-alias-state-business-tertiary": "#3b4252",
      "--dsw-alias-toast-bg": "#4c566a",
      "--dsw-alias-tooltip-bg": "#4c566a",
      "--dsw-specific-bubble": "#3b4252",
      "--dsw-specific-bubble-highlight": "#434c5e",
      "--dsw-specific-input-major": "#3b4252",
      "--dsw-specific-login-input": "#2e3440",
      "--dsw-specific-selector": "#3b4252",
      "--dsw-specific-sidebar-fill": "#2b313c",
      "--dsw-specific-sidebar-nav-item-active": "#3b4252",
      "--dsw-specific-sidebar-nav-item-active-accent": "#434c5e",
      "--dsw-specific-sidebar-nav-item-hover": "#333b48",
      "--dsw-specific-tip": "#3b4252"
    }
  },
  {
    id: "dsh-alpha-premium-catppuccin-mocha",
    colorScheme: "dark",
    labelKey: "palette.catppuccinMocha",
    swatchAccent: "#cba6f7",
    swatchBackground: "#1e1e2e",
    tokens: {
      "--dsw-alias-bg-base": "#1e1e2e",
      "--dsw-alias-bg-layer-1": "#1e1e2e",
      "--dsw-alias-bg-layer-2": "#181825",
      "--dsw-alias-bg-layer-3": "#313244",
      "--dsw-alias-bg-overlay": "#45475a",
      "--dsw-alias-bg-module-platform": "#313244",
      "--dsw-alias-bg-multi-select": "#181825",
      "--dsw-alias-bg-skeleton": "rgba(205, 214, 244, 0.08)",
      "--dsw-alias-bg-mask-drop": "rgba(30, 30, 46, 0.72)",
      "--dsw-alias-border-l1": "rgba(205, 214, 244, 0.08)",
      "--dsw-alias-border-l2": "rgba(205, 214, 244, 0.14)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(205, 214, 244, 0.08)",
      "--dsw-alias-border-l3": "rgba(205, 214, 244, 0.2)",
      "--dsw-alias-border-l4": "rgba(205, 214, 244, 0.28)",
      "--dsw-alias-border-inverted": "rgba(0, 0, 0, 0.2)",
      "--dsw-alias-border-inverted2": "rgba(0, 0, 0, 0.34)",
      "--dsw-alias-brand-primary": "#cba6f7",
      "--dsw-alias-brand-primary-invert": "#1e1e2e",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#cba6f7",
      "--dsw-alias-brand-text": "#cdd6f4",
      "--dsw-alias-button-primary-fill": "#cba6f7",
      "--dsw-alias-button-primary-hover": "#d7bdfa",
      "--dsw-alias-button-primary-dimmed": "#313244",
      "--dsw-alias-button-info-fill": "#89b4fa",
      "--dsw-alias-button-info-hover": "#9dc0fb",
      "--dsw-alias-button-contrast-fill": "#cdd6f4",
      "--dsw-alias-button-elevated-fill": "#313244",
      "--dsw-alias-button-floating-fill": "#45475a",
      "--dsw-alias-button-floating-hover": "#585b70",
      "--dsw-alias-button-ghost-active-border": "#6c7086",
      "--dsw-alias-button-ghost-active-fill": "#313244",
      "--dsw-alias-button-ghost-active-hover": "#45475a",
      "--dsw-alias-interactive-bg-hover": "rgba(205, 214, 244, 0.07)",
      "--dsw-alias-interactive-bg-active": "rgba(205, 214, 244, 0.12)",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(203, 166, 247, 0.16)",
      "--dsw-alias-interactive-bg-hover-solid": "#45475a",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(243, 139, 168, 0.15)",
      "--dsw-alias-label-primary": "#cdd6f4",
      "--dsw-alias-label-secondary": "#a6adc8",
      "--dsw-alias-label-tertiary": "#6c7086",
      "--dsw-alias-label-caption": "#6c7086",
      "--dsw-alias-label-dimmed": "#45475a",
      "--dsw-alias-label-primary-foreground": "#1e1e2e",
      "--dsw-alias-label-primary-inverted": "#1e1e2e",
      "--dsw-alias-label-primary-bluish": "#cdd6f4",
      "--dsw-alias-label-primary-dimmed": "#45475a",
      "--dsw-alias-markdown-code-block": "#181825",
      "--dsw-alias-markdown-code-block-banner": "#313244",
      "--dsw-alias-markdown-inline-code": "#313244",
      "--dsw-alias-markdown-citation": "#45475a",
      "--dsw-alias-markdown-tag": "#313244",
      "--dsw-alias-markdown-placeholder": "#313244",
      "--dsw-alias-markdown-code-segment-selected": "#313244",
      "--dsw-alias-markdown-code-segment-unselected": "#181825",
      "--dsw-alias-scrollbar-bg-l1": "#45475a",
      "--dsw-alias-scrollbar-bg-l2": "#585b70",
      "--dsw-alias-scrollbar-hover-l1": "#585b70",
      "--dsw-alias-scrollbar-hover-l2": "#6c7086",
      "--dsw-alias-state-business-primary": "#89b4fa",
      "--dsw-alias-state-business-tertiary": "#313244",
      "--dsw-alias-toast-bg": "#45475a",
      "--dsw-alias-tooltip-bg": "#45475a",
      "--dsw-specific-bubble": "#181825",
      "--dsw-specific-bubble-highlight": "#313244",
      "--dsw-specific-input-major": "#181825",
      "--dsw-specific-login-input": "#1e1e2e",
      "--dsw-specific-selector": "#313244",
      "--dsw-specific-sidebar-fill": "#1e1e2e",
      "--dsw-specific-sidebar-nav-item-active": "#313244",
      "--dsw-specific-sidebar-nav-item-active-accent": "#45475a",
      "--dsw-specific-sidebar-nav-item-hover": "#26263a",
      "--dsw-specific-tip": "#313244"
    }
  },
  {
    id: "dsh-alpha-premium-everforest",
    colorScheme: "dark",
    labelKey: "palette.everforest",
    swatchAccent: "#a7c080",
    swatchBackground: "#2d353b",
    tokens: {
      "--dsw-alias-bg-base": "#2d353b",
      "--dsw-alias-bg-layer-1": "#2d353b",
      "--dsw-alias-bg-layer-2": "#333c43",
      "--dsw-alias-bg-layer-3": "#3a454d",
      "--dsw-alias-bg-overlay": "#465258",
      "--dsw-alias-bg-module-platform": "#333c43",
      "--dsw-alias-bg-multi-select": "#2d353b",
      "--dsw-alias-bg-skeleton": "rgba(211, 198, 170, 0.08)",
      "--dsw-alias-bg-mask-drop": "rgba(45, 53, 59, 0.72)",
      "--dsw-alias-border-l1": "rgba(211, 198, 170, 0.09)",
      "--dsw-alias-border-l2": "rgba(211, 198, 170, 0.15)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(211, 198, 170, 0.09)",
      "--dsw-alias-border-l3": "rgba(211, 198, 170, 0.22)",
      "--dsw-alias-border-l4": "rgba(211, 198, 170, 0.3)",
      "--dsw-alias-border-inverted": "rgba(0, 0, 0, 0.2)",
      "--dsw-alias-border-inverted2": "rgba(0, 0, 0, 0.34)",
      "--dsw-alias-brand-primary": "#a7c080",
      "--dsw-alias-brand-primary-invert": "#2d353b",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#a7c080",
      "--dsw-alias-brand-text": "#d3c6aa",
      "--dsw-alias-button-primary-fill": "#a7c080",
      "--dsw-alias-button-primary-hover": "#b5cc92",
      "--dsw-alias-button-primary-dimmed": "#333c43",
      "--dsw-alias-button-info-fill": "#7fbbb3",
      "--dsw-alias-button-info-hover": "#92c5bf",
      "--dsw-alias-button-contrast-fill": "#d3c6aa",
      "--dsw-alias-button-elevated-fill": "#333c43",
      "--dsw-alias-button-floating-fill": "#3a454d",
      "--dsw-alias-button-floating-hover": "#465258",
      "--dsw-alias-button-ghost-active-border": "#859289",
      "--dsw-alias-button-ghost-active-fill": "#333c43",
      "--dsw-alias-button-ghost-active-hover": "#3a454d",
      "--dsw-alias-interactive-bg-hover": "rgba(211, 198, 170, 0.07)",
      "--dsw-alias-interactive-bg-active": "rgba(211, 198, 170, 0.12)",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(167, 192, 128, 0.16)",
      "--dsw-alias-interactive-bg-hover-solid": "#3a454d",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(230, 126, 128, 0.15)",
      "--dsw-alias-label-primary": "#d3c6aa",
      "--dsw-alias-label-secondary": "#a5b0a5",
      "--dsw-alias-label-tertiary": "#859289",
      "--dsw-alias-label-caption": "#859289",
      "--dsw-alias-label-dimmed": "#465258",
      "--dsw-alias-label-primary-foreground": "#2d353b",
      "--dsw-alias-label-primary-inverted": "#2d353b",
      "--dsw-alias-label-primary-bluish": "#d3c6aa",
      "--dsw-alias-label-primary-dimmed": "#465258",
      "--dsw-alias-markdown-code-block": "#333c43",
      "--dsw-alias-markdown-code-block-banner": "#333c43",
      "--dsw-alias-markdown-inline-code": "#333c43",
      "--dsw-alias-markdown-citation": "#3a454d",
      "--dsw-alias-markdown-tag": "#333c43",
      "--dsw-alias-markdown-placeholder": "#3a454d",
      "--dsw-alias-markdown-code-segment-selected": "#3a454d",
      "--dsw-alias-markdown-code-segment-unselected": "#2d353b",
      "--dsw-alias-scrollbar-bg-l1": "#3a454d",
      "--dsw-alias-scrollbar-bg-l2": "#465258",
      "--dsw-alias-scrollbar-hover-l1": "#465258",
      "--dsw-alias-scrollbar-hover-l2": "#525f66",
      "--dsw-alias-state-business-primary": "#a7c080",
      "--dsw-alias-state-business-tertiary": "#333c43",
      "--dsw-alias-toast-bg": "#465258",
      "--dsw-alias-tooltip-bg": "#465258",
      "--dsw-specific-bubble": "#333c43",
      "--dsw-specific-bubble-highlight": "#3a454d",
      "--dsw-specific-input-major": "#333c43",
      "--dsw-specific-login-input": "#2d353b",
      "--dsw-specific-selector": "#333c43",
      "--dsw-specific-sidebar-fill": "#293137",
      "--dsw-specific-sidebar-nav-item-active": "#333c43",
      "--dsw-specific-sidebar-nav-item-active-accent": "#3a454d",
      "--dsw-specific-sidebar-nav-item-hover": "#303b42",
      "--dsw-specific-tip": "#333c43"
    }
  },
  {
    id: "dsh-alpha-premium-rose-pine",
    colorScheme: "dark",
    labelKey: "palette.rosePine",
    swatchAccent: "#ebbcba",
    swatchBackground: "#191724",
    tokens: {
      "--dsw-alias-bg-base": "#191724",
      "--dsw-alias-bg-layer-1": "#191724",
      "--dsw-alias-bg-layer-2": "#1f1d2e",
      "--dsw-alias-bg-layer-3": "#26233a",
      "--dsw-alias-bg-overlay": "#403d52",
      "--dsw-alias-bg-module-platform": "#1f1d2e",
      "--dsw-alias-bg-multi-select": "#191724",
      "--dsw-alias-bg-skeleton": "rgba(224, 222, 244, 0.08)",
      "--dsw-alias-bg-mask-drop": "rgba(25, 23, 36, 0.72)",
      "--dsw-alias-border-l1": "rgba(224, 222, 244, 0.08)",
      "--dsw-alias-border-l2": "rgba(224, 222, 244, 0.14)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(224, 222, 244, 0.08)",
      "--dsw-alias-border-l3": "rgba(224, 222, 244, 0.2)",
      "--dsw-alias-border-l4": "rgba(224, 222, 244, 0.28)",
      "--dsw-alias-border-inverted": "rgba(0, 0, 0, 0.2)",
      "--dsw-alias-border-inverted2": "rgba(0, 0, 0, 0.34)",
      "--dsw-alias-brand-primary": "#ebbcba",
      "--dsw-alias-brand-primary-invert": "#191724",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#ebbcba",
      "--dsw-alias-brand-text": "#e0def4",
      "--dsw-alias-button-primary-fill": "#ebbcba",
      "--dsw-alias-button-primary-hover": "#f0cfcd",
      "--dsw-alias-button-primary-dimmed": "#1f1d2e",
      "--dsw-alias-button-info-fill": "#c4a7e7",
      "--dsw-alias-button-info-hover": "#cfb5ed",
      "--dsw-alias-button-contrast-fill": "#e0def4",
      "--dsw-alias-button-elevated-fill": "#1f1d2e",
      "--dsw-alias-button-floating-fill": "#26233a",
      "--dsw-alias-button-floating-hover": "#403d52",
      "--dsw-alias-button-ghost-active-border": "#6e6a86",
      "--dsw-alias-button-ghost-active-fill": "#1f1d2e",
      "--dsw-alias-button-ghost-active-hover": "#26233a",
      "--dsw-alias-interactive-bg-hover": "rgba(224, 222, 244, 0.07)",
      "--dsw-alias-interactive-bg-active": "rgba(224, 222, 244, 0.12)",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(235, 188, 186, 0.16)",
      "--dsw-alias-interactive-bg-hover-solid": "#26233a",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(235, 111, 146, 0.15)",
      "--dsw-alias-label-primary": "#e0def4",
      "--dsw-alias-label-secondary": "#908caa",
      "--dsw-alias-label-tertiary": "#6e6a86",
      "--dsw-alias-label-caption": "#6e6a86",
      "--dsw-alias-label-dimmed": "#403d52",
      "--dsw-alias-label-primary-foreground": "#191724",
      "--dsw-alias-label-primary-inverted": "#191724",
      "--dsw-alias-label-primary-bluish": "#e0def4",
      "--dsw-alias-label-primary-dimmed": "#403d52",
      "--dsw-alias-markdown-code-block": "#1f1d2e",
      "--dsw-alias-markdown-code-block-banner": "#1f1d2e",
      "--dsw-alias-markdown-inline-code": "#1f1d2e",
      "--dsw-alias-markdown-citation": "#26233a",
      "--dsw-alias-markdown-tag": "#1f1d2e",
      "--dsw-alias-markdown-placeholder": "#26233a",
      "--dsw-alias-markdown-code-segment-selected": "#26233a",
      "--dsw-alias-markdown-code-segment-unselected": "#191724",
      "--dsw-alias-scrollbar-bg-l1": "#26233a",
      "--dsw-alias-scrollbar-bg-l2": "#403d52",
      "--dsw-alias-scrollbar-hover-l1": "#403d52",
      "--dsw-alias-scrollbar-hover-l2": "#555169",
      "--dsw-alias-state-business-primary": "#f6c177",
      "--dsw-alias-state-business-tertiary": "#1f1d2e",
      "--dsw-alias-toast-bg": "#403d52",
      "--dsw-alias-tooltip-bg": "#403d52",
      "--dsw-specific-bubble": "#1f1d2e",
      "--dsw-specific-bubble-highlight": "#26233a",
      "--dsw-specific-input-major": "#1f1d2e",
      "--dsw-specific-login-input": "#191724",
      "--dsw-specific-selector": "#1f1d2e",
      "--dsw-specific-sidebar-fill": "#191724",
      "--dsw-specific-sidebar-nav-item-active": "#1f1d2e",
      "--dsw-specific-sidebar-nav-item-active-accent": "#26233a",
      "--dsw-specific-sidebar-nav-item-hover": "#1c1a29",
      "--dsw-specific-tip": "#1f1d2e"
    }
  },
  {
    id: "dsh-alpha-premium-ayu-mirage",
    colorScheme: "dark",
    labelKey: "palette.ayuMirage",
    swatchAccent: "#ffcc66",
    swatchBackground: "#1f2430",
    tokens: {
      "--dsw-alias-bg-base": "#1f2430",
      "--dsw-alias-bg-layer-1": "#1f2430",
      "--dsw-alias-bg-layer-2": "#171b24",
      "--dsw-alias-bg-layer-3": "#242936",
      "--dsw-alias-bg-overlay": "#2a3040",
      "--dsw-alias-bg-module-platform": "#242936",
      "--dsw-alias-bg-multi-select": "#171b24",
      "--dsw-alias-bg-skeleton": "rgba(203, 204, 198, 0.08)",
      "--dsw-alias-bg-mask-drop": "rgba(31, 36, 48, 0.72)",
      "--dsw-alias-border-l1": "rgba(203, 204, 198, 0.08)",
      "--dsw-alias-border-l2": "rgba(203, 204, 198, 0.14)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(203, 204, 198, 0.08)",
      "--dsw-alias-border-l3": "rgba(203, 204, 198, 0.2)",
      "--dsw-alias-border-l4": "rgba(203, 204, 198, 0.28)",
      "--dsw-alias-border-inverted": "rgba(0, 0, 0, 0.2)",
      "--dsw-alias-border-inverted2": "rgba(0, 0, 0, 0.34)",
      "--dsw-alias-brand-primary": "#ffcc66",
      "--dsw-alias-brand-primary-invert": "#1f2430",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#ffcc66",
      "--dsw-alias-brand-text": "#cbccc6",
      "--dsw-alias-button-primary-fill": "#ffcc66",
      "--dsw-alias-button-primary-hover": "#ffd580",
      "--dsw-alias-button-primary-dimmed": "#242936",
      "--dsw-alias-button-info-fill": "#39bae6",
      "--dsw-alias-button-info-hover": "#5ccfe6",
      "--dsw-alias-button-contrast-fill": "#cbccc6",
      "--dsw-alias-button-elevated-fill": "#242936",
      "--dsw-alias-button-floating-fill": "#2a3040",
      "--dsw-alias-button-floating-hover": "#343c4f",
      "--dsw-alias-button-ghost-active-border": "#6c7380",
      "--dsw-alias-button-ghost-active-fill": "#242936",
      "--dsw-alias-button-ghost-active-hover": "#2a3040",
      "--dsw-alias-interactive-bg-hover": "rgba(203, 204, 198, 0.07)",
      "--dsw-alias-interactive-bg-active": "rgba(203, 204, 198, 0.12)",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(255, 204, 102, 0.16)",
      "--dsw-alias-interactive-bg-hover-solid": "#2a3040",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(255, 102, 102, 0.15)",
      "--dsw-alias-label-primary": "#cbccc6",
      "--dsw-alias-label-secondary": "#9aa2ad",
      "--dsw-alias-label-tertiary": "#6c7380",
      "--dsw-alias-label-caption": "#6c7380",
      "--dsw-alias-label-dimmed": "#2a3040",
      "--dsw-alias-label-primary-foreground": "#171b24",
      "--dsw-alias-label-primary-inverted": "#171b24",
      "--dsw-alias-label-primary-bluish": "#cbccc6",
      "--dsw-alias-label-primary-dimmed": "#2a3040",
      "--dsw-alias-markdown-code-block": "#171b24",
      "--dsw-alias-markdown-code-block-banner": "#242936",
      "--dsw-alias-markdown-inline-code": "#242936",
      "--dsw-alias-markdown-citation": "#2a3040",
      "--dsw-alias-markdown-tag": "#242936",
      "--dsw-alias-markdown-placeholder": "#242936",
      "--dsw-alias-markdown-code-segment-selected": "#242936",
      "--dsw-alias-markdown-code-segment-unselected": "#171b24",
      "--dsw-alias-scrollbar-bg-l1": "#2a3040",
      "--dsw-alias-scrollbar-bg-l2": "#343c4f",
      "--dsw-alias-scrollbar-hover-l1": "#343c4f",
      "--dsw-alias-scrollbar-hover-l2": "#414a61",
      "--dsw-alias-state-business-primary": "#ffcc66",
      "--dsw-alias-state-business-tertiary": "#242936",
      "--dsw-alias-toast-bg": "#2a3040",
      "--dsw-alias-tooltip-bg": "#2a3040",
      "--dsw-specific-bubble": "#171b24",
      "--dsw-specific-bubble-highlight": "#242936",
      "--dsw-specific-input-major": "#171b24",
      "--dsw-specific-login-input": "#1f2430",
      "--dsw-specific-selector": "#242936",
      "--dsw-specific-sidebar-fill": "#1b202b",
      "--dsw-specific-sidebar-nav-item-active": "#242936",
      "--dsw-specific-sidebar-nav-item-active-accent": "#2a3040",
      "--dsw-specific-sidebar-nav-item-hover": "#1f2531",
      "--dsw-specific-tip": "#242936"
    }
  },
  {
    id: "dsh-alpha-premium-catppuccin-latte",
    colorScheme: "light",
    labelKey: "palette.catppuccinLatte",
    swatchAccent: "#8839ef",
    swatchBackground: "#eff1f5",
    tokens: {
      "--dsw-alias-bg-base": "#eff1f5",
      "--dsw-alias-bg-layer-1": "#eff1f5",
      "--dsw-alias-bg-layer-2": "#e6e9ef",
      "--dsw-alias-bg-layer-3": "#ccd0da",
      "--dsw-alias-bg-overlay": "#e6e9ef",
      "--dsw-alias-bg-module-platform": "#e6e9ef",
      "--dsw-alias-bg-multi-select": "#e6e9ef",
      "--dsw-alias-bg-skeleton": "rgba(76, 79, 105, 0.05)",
      "--dsw-alias-bg-mask-drop": "rgba(239, 241, 245, 0.72)",
      "--dsw-alias-border-l1": "rgba(76, 79, 105, 0.08)",
      "--dsw-alias-border-l2": "rgba(76, 79, 105, 0.14)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(76, 79, 105, 0.08)",
      "--dsw-alias-border-l3": "rgba(76, 79, 105, 0.2)",
      "--dsw-alias-border-l4": "rgba(76, 79, 105, 0.28)",
      "--dsw-alias-border-inverted": "rgba(255, 255, 255, 0.4)",
      "--dsw-alias-border-inverted2": "rgba(255, 255, 255, 0.6)",
      "--dsw-alias-brand-primary": "#8839ef",
      "--dsw-alias-brand-primary-invert": "#eff1f5",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#8839ef",
      "--dsw-alias-brand-text": "#4c4f69",
      "--dsw-alias-button-primary-fill": "#8839ef",
      "--dsw-alias-button-primary-hover": "#9a55f1",
      "--dsw-alias-button-primary-dimmed": "#e6e9ef",
      "--dsw-alias-button-info-fill": "#1e66f5",
      "--dsw-alias-button-info-hover": "#4a82f7",
      "--dsw-alias-button-contrast-fill": "#4c4f69",
      "--dsw-alias-button-elevated-fill": "#ffffff",
      "--dsw-alias-button-floating-fill": "#ffffff",
      "--dsw-alias-button-floating-hover": "#e6e9ef",
      "--dsw-alias-button-ghost-active-border": "#9ca0b0",
      "--dsw-alias-button-ghost-active-fill": "#e6e9ef",
      "--dsw-alias-button-ghost-active-hover": "#ccd0da",
      "--dsw-alias-interactive-bg-hover": "rgba(76, 79, 105, 0.06)",
      "--dsw-alias-interactive-bg-active": "rgba(76, 79, 105, 0.1)",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(136, 57, 239, 0.1)",
      "--dsw-alias-interactive-bg-hover-solid": "#e6e9ef",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(210, 15, 57, 0.05)",
      "--dsw-alias-label-primary": "#4c4f69",
      "--dsw-alias-label-secondary": "#6c6f85",
      "--dsw-alias-label-tertiary": "#9ca0b0",
      "--dsw-alias-label-caption": "#9ca0b0",
      "--dsw-alias-label-dimmed": "#ccd0da",
      "--dsw-alias-label-primary-foreground": "#eff1f5",
      "--dsw-alias-label-primary-inverted": "#ffffff",
      "--dsw-alias-label-primary-bluish": "#1e66f5",
      "--dsw-alias-label-primary-dimmed": "#ccd0da",
      "--dsw-alias-markdown-code-block": "#e6e9ef",
      "--dsw-alias-markdown-code-block-banner": "#e6e9ef",
      "--dsw-alias-markdown-inline-code": "#e6e9ef",
      "--dsw-alias-markdown-citation": "#ccd0da",
      "--dsw-alias-markdown-tag": "#e6e9ef",
      "--dsw-alias-markdown-placeholder": "#e6e9ef",
      "--dsw-alias-markdown-code-segment-selected": "#ffffff",
      "--dsw-alias-markdown-code-segment-unselected": "#e6e9ef",
      "--dsw-alias-scrollbar-bg-l1": "#ccd0da",
      "--dsw-alias-scrollbar-bg-l2": "#bcc0cc",
      "--dsw-alias-scrollbar-hover-l1": "#bcc0cc",
      "--dsw-alias-scrollbar-hover-l2": "#acb0be",
      "--dsw-alias-state-business-primary": "#8839ef",
      "--dsw-alias-state-business-tertiary": "#e6e9ef",
      "--dsw-alias-toast-bg": "#4c4f69",
      "--dsw-alias-tooltip-bg": "#4c4f69",
      "--dsw-specific-bubble": "#e6e9ef",
      "--dsw-specific-bubble-highlight": "#ccd0da",
      "--dsw-specific-input-major": "#eff1f5",
      "--dsw-specific-login-input": "#e6e9ef",
      "--dsw-specific-selector": "#e6e9ef",
      "--dsw-specific-sidebar-fill": "#e6e9ef",
      "--dsw-specific-sidebar-nav-item-active": "#ccd0da",
      "--dsw-specific-sidebar-nav-item-active-accent": "#d6dae3",
      "--dsw-specific-sidebar-nav-item-hover": "#e0e3ea",
      "--dsw-specific-tip": "#e6e9ef"
    }
  },
  {
    id: "dsh-alpha-premium-paper-gold",
    colorScheme: "light",
    labelKey: "palette.paperGold",
    swatchAccent: "#9c7a3c",
    swatchBackground: "#f6f3ec",
    tokens: {
      "--dsw-alias-bg-base": "#f6f3ec",
      "--dsw-alias-bg-layer-1": "#f6f3ec",
      "--dsw-alias-bg-layer-2": "#efeae0",
      "--dsw-alias-bg-layer-3": "#e6dfd1",
      "--dsw-alias-bg-overlay": "#efeae0",
      "--dsw-alias-bg-module-platform": "#efeae0",
      "--dsw-alias-bg-multi-select": "#efeae0",
      "--dsw-alias-bg-skeleton": "rgba(35, 32, 26, 0.05)",
      "--dsw-alias-bg-mask-drop": "rgba(246, 243, 236, 0.72)",
      "--dsw-alias-border-l1": "rgba(35, 32, 26, 0.08)",
      "--dsw-alias-border-l2": "rgba(35, 32, 26, 0.16)",
      "--dsw-alias-border-l2-darkmode-thin": "rgba(35, 32, 26, 0.08)",
      "--dsw-alias-border-l3": "rgba(35, 32, 26, 0.24)",
      "--dsw-alias-border-l4": "rgba(35, 32, 26, 0.34)",
      "--dsw-alias-border-inverted": "rgba(255, 255, 255, 0.45)",
      "--dsw-alias-border-inverted2": "rgba(255, 255, 255, 0.65)",
      "--dsw-alias-brand-primary": "#9c7a3c",
      "--dsw-alias-brand-primary-invert": "#f6f3ec",
      "--dsw-alias-brand-primary-new-colorprimary-new-color": "#9c7a3c",
      "--dsw-alias-brand-text": "#23201a",
      "--dsw-alias-button-primary-fill": "#9c7a3c",
      "--dsw-alias-button-primary-hover": "#ab8a4a",
      "--dsw-alias-button-primary-dimmed": "#efeae0",
      "--dsw-alias-button-info-fill": "#9c7a3c",
      "--dsw-alias-button-info-hover": "#ab8a4a",
      "--dsw-alias-button-contrast-fill": "#23201a",
      "--dsw-alias-button-elevated-fill": "#fdfbf7",
      "--dsw-alias-button-floating-fill": "#fdfbf7",
      "--dsw-alias-button-floating-hover": "#efeae0",
      "--dsw-alias-button-ghost-active-border": "#8a8275",
      "--dsw-alias-button-ghost-active-fill": "#efeae0",
      "--dsw-alias-button-ghost-active-hover": "#e6dfd1",
      "--dsw-alias-interactive-bg-hover": "rgba(35, 32, 26, 0.05)",
      "--dsw-alias-interactive-bg-active": "rgba(35, 32, 26, 0.09)",
      "--dsw-alias-interactive-bg-hover-accent": "rgba(156, 122, 60, 0.12)",
      "--dsw-alias-interactive-bg-hover-solid": "#efeae0",
      "--dsw-alias-interactive-bg-hover-danger": "rgba(236, 19, 19, 0.05)",
      "--dsw-alias-label-primary": "#23201a",
      "--dsw-alias-label-secondary": "#5c554a",
      "--dsw-alias-label-tertiary": "#8a8275",
      "--dsw-alias-label-caption": "#8a8275",
      "--dsw-alias-label-dimmed": "#e6dfd1",
      "--dsw-alias-label-primary-foreground": "#f6f3ec",
      "--dsw-alias-label-primary-inverted": "#fdfbf7",
      "--dsw-alias-label-primary-bluish": "#9c7a3c",
      "--dsw-alias-label-primary-dimmed": "#e6dfd1",
      "--dsw-alias-markdown-code-block": "#efeae0",
      "--dsw-alias-markdown-code-block-banner": "#efeae0",
      "--dsw-alias-markdown-inline-code": "#efeae0",
      "--dsw-alias-markdown-citation": "#e6dfd1",
      "--dsw-alias-markdown-tag": "#efeae0",
      "--dsw-alias-markdown-placeholder": "#efeae0",
      "--dsw-alias-markdown-code-segment-selected": "#fdfbf7",
      "--dsw-alias-markdown-code-segment-unselected": "#efeae0",
      "--dsw-alias-scrollbar-bg-l1": "#e6dfd1",
      "--dsw-alias-scrollbar-bg-l2": "#d8cfbd",
      "--dsw-alias-scrollbar-hover-l1": "#d8cfbd",
      "--dsw-alias-scrollbar-hover-l2": "#c9bea8",
      "--dsw-alias-state-business-primary": "#9c7a3c",
      "--dsw-alias-state-business-tertiary": "#efeae0",
      "--dsw-alias-toast-bg": "#2c281f",
      "--dsw-alias-tooltip-bg": "#2c281f",
      "--dsw-specific-bubble": "#efeae0",
      "--dsw-specific-bubble-highlight": "#e6dfd1",
      "--dsw-specific-input-major": "#fdfbf7",
      "--dsw-specific-login-input": "#f6f3ec",
      "--dsw-specific-selector": "#efeae0",
      "--dsw-specific-sidebar-fill": "#efeae0",
      "--dsw-specific-sidebar-nav-item-active": "#e6dfd1",
      "--dsw-specific-sidebar-nav-item-active-accent": "#dcd3c2",
      "--dsw-specific-sidebar-nav-item-hover": "#eae3d6",
      "--dsw-specific-tip": "#efeae0"
    }
  }
];

// ../../../.dsh-themes/runtimes/0.1.3-alpha.1/vendor/cosmokit/src/misc.ts
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key of keys) {
    if (forced || source[key] !== void 0) result[key] = source[key];
  }
  return result;
}

// ../../../.dsh-themes/runtimes/0.1.3-alpha.1/vendor/cosmokit/src/types.ts
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
((Binary2) => {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) {
      return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    } else {
      return source;
    }
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") {
      return Buffer.from(source).toString("base64");
    }
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0; i < hex.length; i += 2) {
      buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    }
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
    if ("value" in descriptor) {
      descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    }
    Reflect.defineProperty(result, key, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  if (a === b) return true;
  if (!strict && isNullable(a) && isNullable(b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (!a || !b) return false;
  function check(test, then) {
    return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
  }
  return check(Array.isArray, (a2, b2) => a2.length === b2.length && a2.every((item, index) => deepEqual(item, b2[index]))) ?? check(is("Date"), (a2, b2) => a2.valueOf() === b2.valueOf()) ?? check(is("RegExp"), (a2, b2) => a2.source === b2.source && a2.flags === b2.flags) ?? check(isArrayBufferLike, (a2, b2) => {
    if (a2.byteLength !== b2.byteLength) return false;
    const viewA = new Uint8Array(a2);
    const viewB = new Uint8Array(b2);
    for (let i = 0; i < viewA.length; i++) {
      if (viewA[i] !== viewB[i]) return false;
    }
    return true;
  }) ?? Object.keys({ ...a, ...b }).every((key) => deepEqual(a[key], b[key], strict));
}

// ../../../.dsh-themes/runtimes/0.1.3-alpha.1/vendor/cosmokit/src/time.ts
var Time;
((Time2) => {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) {
      date2 = Date.now() + parsed;
    } else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) {
      date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    } else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) {
      date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    }
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) {
      return Math.round(ms / Time2.day) + "d";
    } else if (abs >= Time2.hour - Time2.minute / 2) {
      return Math.round(ms / Time2.hour) + "h";
    } else if (abs >= Time2.minute - Time2.second / 2) {
      return Math.round(ms / Time2.minute) + "m";
    } else if (abs >= Time2.second) {
      return Math.round(ms / Time2.second) + "s";
    }
    return ms + "ms";
  }
  Time2.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// ../../../.dsh-themes/runtimes/0.1.3-alpha.1/vendor/schemastery/lib/index.mjs
var kSchema = /* @__PURE__ */ Symbol.for("schemastery");
var kValidationError = /* @__PURE__ */ Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
    else if (typeof segment === "number") prefix += "[" + segment + "]";
    else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError];
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key in refs) {
      const options2 = refs[key];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") try {
    schema.callback = new Function("return " + schema.callback)();
  } catch {
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError.is(error)) return { issues: [{
          message: error.message,
          path: error.options.path
        }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key, value) {
  this.dict[key] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
    return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
  });
  if (schema.list) schema.list = schema.list.map((inner, index) => {
    return inner.i18n(mapValues(messages, (data = {}) => {
      if (Array.isArray(getInner(data))) return getInner(data)[index];
      if (Array.isArray(data)) return data[index];
      return extractKeys(data);
    }));
  });
  if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
    if (getInner(data)) return getInner(data);
    return extractKeys(data);
  }));
  if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
};
for (const key of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern: pattern2
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key in value) {
      const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
      if (this.type === "dict" || !isNullable(item)) result[key] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union") for (const schema of this.list) try {
    Schema.resolve(value, schema, {});
    return schema.simplify(value);
  } catch {
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra: extra2
  };
  return schema;
};
for (const key of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
]) Object.assign(Schema.prototype, { [key](value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key]: value
  };
  return schema;
} });
var resolvers = {};
Schema.extend = function extend(type, resolve2) {
  resolvers[type] = resolve2;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source)) return Schema.const(source).required();
  else if (source[kSchema]) return source;
  else if (typeof source === "function") switch (source) {
    case String:
      return Schema.string().required();
    case Number:
      return Schema.number().required();
    case Boolean:
      return Schema.boolean().required();
    case Function:
      return Schema.function().required();
    default:
      return Schema.is(source).required();
  }
  else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON: toJSON2 }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date2 = new Date(value);
    if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
    return date2;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key in bits) if (data & bits[key]) keys.push(key);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key of keys) {
      if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
      if (key in bits) value |= bits[key];
    }
  } else throw new ValidationError(`expected number or array but got ${data}`, options);
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key], schema, {
      ...options,
      path: [...options.path || [], key]
    });
    if (adapted !== void 0) data[key] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key];
    return schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key, inner, options);
    data[rKey] = data[key];
    if (key !== rKey) delete data[key];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key in data) {
    if (key in result) continue;
    result[key] = data[key];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key in dict) {
    const value = property(data, key, dict[key], options);
    if (!isNullable(value) || key in data) result[key] = value;
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner of list) try {
    return Schema.resolve(data, inner, options, strict);
  } catch (error) {
    messages.push(error);
  }
  throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) result = value;
    else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object") merge(result ??= {}, value);
    else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve) return [callback(result)];
  else return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name, keys, format) {
  formatters[name] = format;
  Object.assign(Schema, { [name](...args) {
    const schema = new Schema({ type: name });
    keys.forEach((key, index) => {
      switch (key) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key2 in args[index]) {
            if (typeof args[index][key2] !== "number") continue;
            schema.bits[key2] = args[index][key2];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key] = args[index];
      }
    });
    if (name === "object" || name === "dict") schema.meta.default = {};
    else if (name === "array" || name === "tuple") schema.meta.default = [];
    else if (name === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") return constructor.name;
  else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key, inner]) => {
    return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner }, isInner) => inner.toString(isInner));

// themes/community-alpha/upstream/premium/src/theme-settings.ts
var PALETTE_FIELD = "palette";
var BASE_FIELD = "base";
var CUSTOM_FIELD = "customPalettes";
var OFF = "off";
var CUSTOM_PREFIX = "dsh-alpha-premium-custom-";
var CUSTOM_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
var CUSTOM_THEME_ID_PATTERN = /^dsh-alpha-premium-custom-[a-z0-9-]{1,40}$/;
function customThemeId(rawId) {
  return `${CUSTOM_PREFIX}${rawId}`;
}
function isCustomThemeId(value) {
  return CUSTOM_THEME_ID_PATTERN.test(value);
}
var PALETTE_PREFERENCES = [
  "dsh-alpha-premium-tokyo-night",
  "dsh-alpha-premium-nord",
  "dsh-alpha-premium-catppuccin-mocha",
  "dsh-alpha-premium-everforest",
  "dsh-alpha-premium-rose-pine",
  "dsh-alpha-premium-ayu-mirage",
  "dsh-alpha-premium-catppuccin-latte",
  "dsh-alpha-premium-paper-gold"
];
var DEFAULT_SELECTION = OFF;
var DEFAULT_BASE = "system";
var DEFAULT_CUSTOMS = {};
var CustomPaletteSchema = Schema.object({
  id: Schema.string().pattern(CUSTOM_ID_PATTERN),
  name: Schema.string(),
  colorScheme: Schema.union(["light", "dark"]),
  colors: Schema.object({
    base: Schema.string(),
    accent: Schema.string(),
    text: Schema.string(),
    surface: Schema.string()
  }),
  tokens: Schema.dict(Schema.string())
});
var PremiumThemesSettingsSchema = Schema.object({
  [PALETTE_FIELD]: Schema.union([
    "off",
    "dsh-alpha-premium-tokyo-night",
    "dsh-alpha-premium-nord",
    "dsh-alpha-premium-catppuccin-mocha",
    "dsh-alpha-premium-everforest",
    "dsh-alpha-premium-rose-pine",
    "dsh-alpha-premium-ayu-mirage",
    "dsh-alpha-premium-catppuccin-latte",
    "dsh-alpha-premium-paper-gold",
    Schema.string().pattern(CUSTOM_THEME_ID_PATTERN)
  ]).default(DEFAULT_SELECTION),
  [BASE_FIELD]: Schema.union(["light", "dark", "system"]).default(DEFAULT_BASE),
  [CUSTOM_FIELD]: Schema.dict(CustomPaletteSchema).default(DEFAULT_CUSTOMS)
});
function isPaletteSelection(value) {
  if (typeof value !== "string") return false;
  if (value === OFF) return true;
  if (PALETTE_PREFERENCES.some((preference) => preference === value)) return true;
  return isCustomThemeId(value);
}
var PALETTE_ROUTE_PATH = "/api/dsh-community-palettes/premium/palette";
var CUSTOM_ROUTE_PATH = "/api/dsh-community-palettes/premium/custom";

// themes/community-alpha/upstream/premium/src/client/ImportPaletteDialog.tsx
var import_react = require("react");

// themes/community-alpha/upstream/premium/src/client/ImportPaletteDialog.module.css
var ImportPaletteDialog_default = { "actions": "zWrixq_actions", "backdrop": "zWrixq_backdrop", "cancelButton": "zWrixq_cancelButton", "colorInput": "zWrixq_colorInput", "colorRow": "zWrixq_colorRow", "deleteButton": "zWrixq_deleteButton", "dialog": "zWrixq_dialog", "error": "zWrixq_error", "existingDot": "zWrixq_existingDot", "existingName": "zWrixq_existingName", "existingRow": "zWrixq_existingRow", "existingTitle": "zWrixq_existingTitle", "field": "zWrixq_field", "input": "zWrixq_input", "label": "zWrixq_label", "none": "zWrixq_none", "schemeOption": "zWrixq_schemeOption", "schemeRow": "zWrixq_schemeRow", "schemeSelected": "zWrixq_schemeSelected", "submitButton": "zWrixq_submitButton", "textarea": "zWrixq_textarea", "title": "zWrixq_title" };

// themes/community-alpha/upstream/premium/src/client/ImportPaletteDialog.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function ImportPaletteDialog({ t, chips, importPalette, removePalette, onClose }) {
  const [name, setName] = (0, import_react.useState)("");
  const [scheme, setScheme] = (0, import_react.useState)("dark");
  const [base, setBase] = (0, import_react.useState)("#1a1b26");
  const [accent, setAccent] = (0, import_react.useState)("#7aa2f7");
  const [advanced, setAdvanced] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)();
  const [busy, setBusy] = (0, import_react.useState)(false);
  const submit = async () => {
    if (name.trim() === "") {
      setError(t("import.nameRequired"));
      return;
    }
    let extra2 = {};
    if (advanced.trim() !== "") {
      try {
        extra2 = JSON.parse(advanced);
        if (typeof extra2 !== "object" || extra2 === null) throw new Error("not an object");
      } catch {
        setError(t("import.invalidJson"));
        return;
      }
    }
    setBusy(true);
    setError(void 0);
    const failure = await importPalette({
      name: name.trim(),
      colorScheme: scheme,
      colors: {
        base,
        accent,
        text: typeof extra2.text === "string" ? extra2.text : "",
        surface: typeof extra2.surface === "string" ? extra2.surface : ""
      },
      tokens: typeof extra2.tokens === "object" && extra2.tokens !== null ? { ...extra2.tokens } : {}
    });
    setBusy(false);
    if (failure === void 0) onClose();
    else setError(failure);
  };
  const schemeButton = (value, labelKey) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      className: scheme === value ? ImportPaletteDialog_default.schemeSelected : ImportPaletteDialog_default.schemeOption,
      "aria-pressed": scheme === value,
      onClick: () => {
        setScheme(value);
      },
      children: t(labelKey)
    },
    value
  );
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: ImportPaletteDialog_default.backdrop, onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: ImportPaletteDialog_default.dialog,
      role: "dialog",
      "aria-label": t("import.title"),
      onClick: (event) => {
        event.stopPropagation();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: ImportPaletteDialog_default.title, children: t("import.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: ImportPaletteDialog_default.field, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: ImportPaletteDialog_default.label, children: t("import.name") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: ImportPaletteDialog_default.input, value: name, onChange: (event) => {
            setName(event.target.value);
          } })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: ImportPaletteDialog_default.field, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: ImportPaletteDialog_default.label, children: t("import.scheme") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: ImportPaletteDialog_default.schemeRow, children: [
            schemeButton("dark", "import.dark"),
            schemeButton("light", "import.light")
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: ImportPaletteDialog_default.field, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: ImportPaletteDialog_default.label, children: t("import.base") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: ImportPaletteDialog_default.colorRow, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "color", className: ImportPaletteDialog_default.colorInput, value: base, onChange: (event) => {
              setBase(event.target.value);
            } }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: ImportPaletteDialog_default.input, value: base, onChange: (event) => {
              setBase(event.target.value);
            } })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: ImportPaletteDialog_default.field, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: ImportPaletteDialog_default.label, children: t("import.accent") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: ImportPaletteDialog_default.colorRow, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "color", className: ImportPaletteDialog_default.colorInput, value: accent, onChange: (event) => {
              setAccent(event.target.value);
            } }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { className: ImportPaletteDialog_default.input, value: accent, onChange: (event) => {
              setAccent(event.target.value);
            } })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: ImportPaletteDialog_default.field, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: ImportPaletteDialog_default.label, children: t("import.advanced") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", { className: ImportPaletteDialog_default.textarea, rows: 3, value: advanced, onChange: (event) => {
            setAdvanced(event.target.value);
          } })
        ] }),
        error !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: ImportPaletteDialog_default.error, children: error }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: ImportPaletteDialog_default.actions, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: ImportPaletteDialog_default.cancelButton, onClick: onClose, children: t("import.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: ImportPaletteDialog_default.submitButton, disabled: busy, onClick: () => {
            void submit();
          }, children: t("import.submit") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: ImportPaletteDialog_default.existingTitle, children: t("import.existing") }),
        chips.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: ImportPaletteDialog_default.none, children: t("import.none") }) : chips.map((chip) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: ImportPaletteDialog_default.existingRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              className: ImportPaletteDialog_default.existingDot,
              style: { background: `linear-gradient(135deg, ${chip.swatchBackground} 50%, ${chip.swatchAccent} 50%)` }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: ImportPaletteDialog_default.existingName, children: chip.label }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: ImportPaletteDialog_default.deleteButton,
              onClick: () => {
                void removePalette(chip.id);
              },
              children: t("import.delete")
            }
          )
        ] }, chip.id))
      ]
    }
  ) });
}

// themes/community-alpha/upstream/premium/src/client/PaletteRow.module.css
var PaletteRow_default = { "group": "_2rD3WG_group", "importChip": "_2rD3WG_importChip", "paletteChip": "_2rD3WG_paletteChip", "paletteRow": "_2rD3WG_paletteRow", "selected": "_2rD3WG_selected", "swatchDot": "_2rD3WG_swatchDot", "title": "_2rD3WG_title" };

// themes/community-alpha/upstream/premium/src/client/PaletteRow.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var OFF_SWATCH = "linear-gradient(135deg, #f5f5f5 50%, #9e9e9e 50%)";
function PaletteRow({ t, setPalette, importPalette, removePalette, useStore }) {
  const palette = useStore((s) => s.palette);
  const chips = useStore((s) => s.chips);
  const [dialogOpen, setDialogOpen] = (0, import_react2.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: PaletteRow_default.group, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: PaletteRow_default.title, children: t("palette.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: PaletteRow_default.paletteRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          type: "button",
          className: (0, import_clsx.default)(PaletteRow_default.paletteChip, palette === OFF && PaletteRow_default.selected),
          "aria-pressed": palette === OFF,
          onClick: () => {
            setPalette(OFF);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: PaletteRow_default.swatchDot, style: { background: OFF_SWATCH } }),
            t("palette.off")
          ]
        }
      ),
      PREMIUM_PALETTES.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          type: "button",
          className: (0, import_clsx.default)(PaletteRow_default.paletteChip, palette === entry.id && PaletteRow_default.selected),
          "aria-pressed": palette === entry.id,
          onClick: () => {
            setPalette(entry.id);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "span",
              {
                className: PaletteRow_default.swatchDot,
                style: {
                  background: `linear-gradient(135deg, ${entry.swatchBackground} 50%, ${entry.swatchAccent} 50%)`
                }
              }
            ),
            t(entry.labelKey)
          ]
        },
        entry.id
      )),
      chips.map((chip) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "button",
        {
          type: "button",
          className: (0, import_clsx.default)(PaletteRow_default.paletteChip, palette === chip.id && PaletteRow_default.selected),
          "aria-pressed": palette === chip.id,
          onClick: () => {
            setPalette(chip.id);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "span",
              {
                className: PaletteRow_default.swatchDot,
                style: {
                  background: `linear-gradient(135deg, ${chip.swatchBackground} 50%, ${chip.swatchAccent} 50%)`
                }
              }
            ),
            chip.label
          ]
        },
        chip.id
      )),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: PaletteRow_default.importChip, onClick: () => {
        setDialogOpen(true);
      }, children: t("palette.import") })
    ] }),
    dialogOpen ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      ImportPaletteDialog,
      {
        t,
        chips,
        importPalette,
        removePalette,
        onClose: () => {
          setDialogOpen(false);
        }
      }
    ) : null
  ] });
}

// themes/community-alpha/upstream/premium/src/client/settings-store.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function createPaletteRowStore() {
  return (0, import_dsh_client_store.defineStore)({
    init: () => ({ palette: DEFAULT_SELECTION, chips: [], revision: -1 }),
    actions: {
      sync: (d, palette, chips, revision) => {
        if (revision <= d.revision) return;
        d.palette = palette;
        d.chips = chips;
        d.revision = revision;
      }
    }
  });
}

// themes/community-alpha/upstream/premium/src/client/locales.ts
var zh = {
  "palette.title": "\u914D\u8272",
  "palette.off": "\u9ED8\u8BA4",
  "palette.tokyoNight": "\u4E1C\u4EAC\u591C",
  "palette.nord": "\u5317\u5883",
  "palette.catppuccinMocha": "\u6469\u5361",
  "palette.everforest": "\u68EE\u6797",
  "palette.rosePine": "\u73AB\u7470\u677E",
  "palette.ayuMirage": "\u938F\u91D1",
  "palette.catppuccinLatte": "\u62FF\u94C1",
  "palette.paperGold": "\u7F8A\u76AE\u7EB8\u91D1",
  "palette.import": "\u5BFC\u5165\u914D\u8272",
  "import.title": "\u5BFC\u5165\u81EA\u5B9A\u4E49\u914D\u8272",
  "import.name": "\u540D\u79F0",
  "import.scheme": "\u660E\u6697",
  "import.light": "\u6D45\u8272",
  "import.dark": "\u6DF1\u8272",
  "import.base": "\u5E95\u8272",
  "import.accent": "\u5F3A\u8C03\u8272",
  "import.advanced": "\u9AD8\u7EA7(\u53EF\u9009 JSON:text / surface \u989C\u8272,tokens \u8986\u76D6)",
  "import.submit": "\u5BFC\u5165",
  "import.cancel": "\u53D6\u6D88",
  "import.existing": "\u5DF2\u5BFC\u5165\u7684\u914D\u8272",
  "import.delete": "\u5220\u9664",
  "import.none": "\u8FD8\u6CA1\u6709\u5BFC\u5165\u7684\u914D\u8272",
  "import.invalidJson": "\u9AD8\u7EA7 JSON \u89E3\u6790\u5931\u8D25",
  "import.nameRequired": "\u8BF7\u8F93\u5165\u540D\u79F0"
};
var en = {
  "palette.title": "Palette",
  "palette.off": "Default",
  "palette.tokyoNight": "Tokyo Night",
  "palette.nord": "Nord",
  "palette.catppuccinMocha": "Mocha",
  "palette.everforest": "Everforest",
  "palette.rosePine": "Ros\xE9 Pine",
  "palette.ayuMirage": "Ayu Mirage",
  "palette.catppuccinLatte": "Latte",
  "palette.paperGold": "Paper Gold",
  "palette.import": "Import palette",
  "import.title": "Import custom palette",
  "import.name": "Name",
  "import.scheme": "Scheme",
  "import.light": "Light",
  "import.dark": "Dark",
  "import.base": "Background",
  "import.accent": "Accent",
  "import.advanced": "Advanced (optional JSON: text / surface colors, token overrides)",
  "import.submit": "Import",
  "import.cancel": "Cancel",
  "import.existing": "Imported palettes",
  "import.delete": "Delete",
  "import.none": "No imported palettes yet",
  "import.invalidJson": "Advanced JSON failed to parse",
  "import.nameRequired": "Enter a name"
};

// themes/community-alpha/upstream/premium/src/derive.ts
function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (match === null) {
    throw new TypeError(`premium-themes: "${hex}" is not a #rrggbb color`);
  }
  const value = Number.parseInt(match[1], 16);
  return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
}
function rgbToHex({ r, g, b }) {
  const channel = (value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
function mix(from2, to, t) {
  const a = hexToRgb(from2);
  const b = hexToRgb(to);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  });
}
function luminance({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrastInk(color) {
  return luminance(hexToRgb(color)) > 0.45 ? "#161616" : "#ffffff";
}
function alpha(color, a) {
  const { r, g, b } = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function lift(color, t, scheme) {
  return mix(color, scheme === "dark" ? "#ffffff" : "#000000", t);
}
function deriveCustomTokens(def) {
  const base = def.colors.base;
  const accent = def.colors.accent;
  hexToRgb(base);
  hexToRgb(accent);
  if (def.colors.text !== "") hexToRgb(def.colors.text);
  if (def.colors.surface !== "") hexToRgb(def.colors.surface);
  const scheme = def.colorScheme;
  const layer1 = base;
  const layer2 = def.colors.surface !== "" ? def.colors.surface : lift(base, 0.04, scheme);
  const layer3 = lift(base, 0.1, scheme);
  const overlay = lift(base, 0.16, scheme);
  const deeper = lift(base, 0.24, scheme);
  const text1 = def.colors.text !== "" ? def.colors.text : lift(base, 0.88, scheme);
  const text2 = lift(base, 0.7, scheme);
  const text3 = lift(base, 0.46, scheme);
  const dimmed = lift(base, 0.3, scheme);
  const accentHover = mix(accent, scheme === "dark" ? "#ffffff" : "#000000", 0.12);
  const onAccent = contrastInk(accent);
  const toast = scheme === "dark" ? deeper : mix(base, "#000000", 0.72);
  const whiteOverBlack = scheme === "dark";
  const tokens = {
    "--dsw-alias-bg-base": base,
    "--dsw-alias-bg-layer-1": layer1,
    "--dsw-alias-bg-layer-2": layer2,
    "--dsw-alias-bg-layer-3": layer3,
    "--dsw-alias-bg-overlay": overlay,
    "--dsw-alias-bg-module-platform": layer3,
    "--dsw-alias-bg-multi-select": layer2,
    "--dsw-alias-bg-skeleton": alpha(text1, scheme === "dark" ? 0.08 : 0.05),
    "--dsw-alias-bg-mask-drop": alpha(base, 0.72),
    "--dsw-alias-border-l1": alpha(text1, 0.08),
    "--dsw-alias-border-l2": alpha(text1, 0.14),
    "--dsw-alias-border-l2-darkmode-thin": alpha(text1, 0.08),
    "--dsw-alias-border-l3": alpha(text1, 0.2),
    "--dsw-alias-border-l4": alpha(text1, 0.28),
    "--dsw-alias-border-inverted": whiteOverBlack ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.4)",
    "--dsw-alias-border-inverted2": whiteOverBlack ? "rgba(0, 0, 0, 0.34)" : "rgba(255, 255, 255, 0.6)",
    "--dsw-alias-brand-primary": accent,
    "--dsw-alias-brand-primary-invert": base,
    "--dsw-alias-brand-primary-new-colorprimary-new-color": accent,
    "--dsw-alias-brand-text": text1,
    "--dsw-alias-button-primary-fill": accent,
    "--dsw-alias-button-primary-hover": accentHover,
    "--dsw-alias-button-primary-dimmed": layer3,
    "--dsw-alias-button-info-fill": accent,
    "--dsw-alias-button-info-hover": accentHover,
    "--dsw-alias-button-contrast-fill": text1,
    "--dsw-alias-button-elevated-fill": scheme === "dark" ? layer3 : "#ffffff",
    "--dsw-alias-button-floating-fill": overlay,
    "--dsw-alias-button-floating-hover": deeper,
    "--dsw-alias-button-ghost-active-border": text3,
    "--dsw-alias-button-ghost-active-fill": layer3,
    "--dsw-alias-button-ghost-active-hover": overlay,
    "--dsw-alias-interactive-bg-hover": alpha(accent, 0.1),
    "--dsw-alias-interactive-bg-active": alpha(accent, 0.16),
    "--dsw-alias-interactive-bg-hover-accent": alpha(accent, 0.18),
    "--dsw-alias-interactive-bg-hover-solid": overlay,
    "--dsw-alias-interactive-bg-hover-danger": scheme === "dark" ? "rgba(242, 90, 90, 0.15)" : "rgba(236, 19, 19, 0.05)",
    "--dsw-alias-label-primary": text1,
    "--dsw-alias-label-secondary": text2,
    "--dsw-alias-label-tertiary": text3,
    "--dsw-alias-label-caption": text3,
    "--dsw-alias-label-dimmed": dimmed,
    "--dsw-alias-label-primary-foreground": onAccent,
    "--dsw-alias-label-primary-inverted": onAccent,
    "--dsw-alias-label-primary-bluish": accent,
    "--dsw-alias-label-primary-dimmed": dimmed,
    "--dsw-alias-markdown-code-block": layer2,
    "--dsw-alias-markdown-code-block-banner": layer3,
    "--dsw-alias-markdown-inline-code": layer3,
    "--dsw-alias-markdown-citation": overlay,
    "--dsw-alias-markdown-tag": layer3,
    "--dsw-alias-markdown-placeholder": layer2,
    "--dsw-alias-markdown-code-segment-selected": scheme === "dark" ? layer3 : "#ffffff",
    "--dsw-alias-markdown-code-segment-unselected": scheme === "dark" ? base : layer2,
    "--dsw-alias-scrollbar-bg-l1": overlay,
    "--dsw-alias-scrollbar-bg-l2": deeper,
    "--dsw-alias-scrollbar-hover-l1": deeper,
    "--dsw-alias-scrollbar-hover-l2": lift(base, 0.34, scheme),
    "--dsw-alias-state-business-primary": accent,
    "--dsw-alias-state-business-tertiary": layer3,
    "--dsw-alias-toast-bg": toast,
    "--dsw-alias-tooltip-bg": toast,
    "--dsw-specific-bubble": layer2,
    "--dsw-specific-bubble-highlight": layer3,
    "--dsw-specific-input-major": layer2,
    "--dsw-specific-login-input": base,
    "--dsw-specific-selector": layer3,
    "--dsw-specific-sidebar-fill": scheme === "dark" ? base : layer2,
    "--dsw-specific-sidebar-nav-item-active": layer3,
    "--dsw-specific-sidebar-nav-item-active-accent": overlay,
    "--dsw-specific-sidebar-nav-item-hover": lift(base, 0.06, scheme),
    "--dsw-specific-tip": layer3
  };
  return { ...tokens, ...def.tokens };
}

// themes/community-alpha/upstream/premium/src/client/index.ts
var SETTINGS_NS = "settings.premiumThemes";
var ROW_ID = "premium-palettes";
var BASE_THEME_NAMESPACE = "ui-theme";
var BASE_THEME_FIELD = "preference";
var inject = ["theme", "slots", "locale", "settingsScope"];
var FALLBACK = {
  palette: DEFAULT_SELECTION,
  base: "system",
  customs: {}
};
function narrowSnapshot(body) {
  const customs = typeof body[CUSTOM_FIELD] === "object" && body[CUSTOM_FIELD] !== null ? { ...body[CUSTOM_FIELD] } : {};
  return {
    palette: isPaletteSelection(body[PALETTE_FIELD]) ? body[PALETTE_FIELD] : DEFAULT_SELECTION,
    base: body[BASE_FIELD] === "light" || body[BASE_FIELD] === "dark" || body[BASE_FIELD] === "system" ? body[BASE_FIELD] : "system",
    customs
  };
}
async function fetchSelection() {
  try {
    const response = await fetch(PALETTE_ROUTE_PATH);
    if (!response.ok) return FALLBACK;
    return narrowSnapshot(await response.json());
  } catch {
    return FALLBACK;
  }
}
async function persistSelection(logger, selection) {
  try {
    await fetch(PALETTE_ROUTE_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [PALETTE_FIELD]: selection.palette, [BASE_FIELD]: selection.base })
    });
  } catch (error) {
    logger.warn(`premium-themes: palette write failed (selection stays session-local): ${String(error)}`);
  }
}
function apply(ctx) {
  const theme = ctx.theme;
  const unregisterAll = PREMIUM_PALETTES.map((palette) => theme.register({
    id: palette.id,
    colorScheme: palette.colorScheme,
    tokens: { ...palette.tokens }
  }));
  const imported = /* @__PURE__ */ new Map();
  ctx.effect(() => () => {
    for (const dispose of imported.values()) dispose();
    unregisterAll.forEach((dispose) => dispose());
  }, "premium-themes: palette registry");
  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), "premium-themes: row dictionaries");
  const store = createPaletteRowStore();
  let bound;
  let revision = 0;
  let current = DEFAULT_SELECTION;
  let chips = [];
  const sync = (palette) => {
    current = palette;
    bound?.sync(palette, chips, ++revision);
  };
  let restoreBase = "system";
  let adopted = false;
  const applyCustoms = (customs) => {
    const wanted = new Set(Object.keys(customs).map((rawId) => customThemeId(rawId)));
    for (const themeId of [...imported.keys()]) {
      if (!wanted.has(themeId)) {
        imported.get(themeId)();
        imported.delete(themeId);
      }
    }
    const nextChips = [];
    for (const [rawId, def] of Object.entries(customs)) {
      const themeId = customThemeId(rawId);
      if (!imported.has(themeId)) {
        imported.set(themeId, theme.register({
          id: themeId,
          colorScheme: def.colorScheme,
          tokens: deriveCustomTokens(def)
        }));
      }
      nextChips.push({
        id: themeId,
        label: def.name,
        swatchAccent: def.colors.accent,
        swatchBackground: def.colors.base
      });
    }
    chips = nextChips;
    bound?.sync(current, chips, ++revision);
  };
  const applySelection = (palette, base) => {
    restoreBase = base;
    if (palette === OFF) {
      if (theme.getTheme().preference !== restoreBase) theme.setTheme(restoreBase);
    } else if (theme.getTheme().preference !== palette) {
      theme.setTheme(palette);
    }
    sync(palette);
  };
  const clearPalette = () => {
    sync(OFF);
    void persistSelection(ctx.logger, { palette: OFF, base: restoreBase });
  };
  const baseScope = ctx.settingsScope.bind({ namespace: BASE_THEME_NAMESPACE });
  let baseSettled = false;
  let previousBase;
  let adoptingBase = false;
  let active = true;
  ctx.effect(() => () => {
    active = false;
  }, "premium: async lifecycle");
  const adoptBase = () => {
    const snapshot = baseScope.getSnapshot();
    if (snapshot.status !== "ready" || snapshot.value === void 0) return;
    const base = snapshot.value[BASE_THEME_FIELD] ?? "system";
    const preserve = !baseSettled || previousBase === base;
    previousBase = base;
    baseSettled = true;
    restoreBase = base;
    if (preserve) {
      adoptingBase = true;
      queueMicrotask(() => {
        if (active && adopted && current !== OFF && theme.getTheme().preference !== current) theme.setTheme(current);
        adoptingBase = false;
      });
    }
  };
  ctx.effect(() => baseScope.subscribe(adoptBase), "premium: Alpha base adoption");
  adoptBase();
  ctx.on("theme/change", () => {
    if (!adopted || !baseSettled || current === OFF) return;
    queueMicrotask(() => {
      if (!active || adoptingBase || theme.getTheme().preference === current) return;
      const preference = theme.getTheme().preference;
      if (preference === "light" || preference === "dark" || preference === "system") restoreBase = preference;
      clearPalette();
    });
  });
  const injected = (actions) => {
    bound = actions;
    bound.sync(current, chips, ++revision);
    return {
      setPalette: (id) => {
        adopted = true;
        if (id === OFF) {
          applySelection(OFF, restoreBase);
          void persistSelection(ctx.logger, { palette: OFF, base: restoreBase });
        } else {
          const preference = theme.getTheme().preference;
          const base = preference === "light" || preference === "dark" || preference === "system" ? preference : restoreBase;
          applySelection(id, base);
          void persistSelection(ctx.logger, { palette: id, base });
        }
      },
      importPalette: async (input) => {
        try {
          const response = await fetch(CUSTOM_ROUTE_PATH, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input)
          });
          const body = await response.json();
          if (!response.ok) {
            return typeof body.error === "string" ? body.error : "import failed";
          }
          const snapshot = narrowSnapshot(body);
          applyCustoms(snapshot.customs);
          adopted = true;
          const preference = theme.getTheme().preference;
          const base = preference === "light" || preference === "dark" || preference === "system" ? preference : restoreBase;
          const importedRaw = typeof body.imported === "string" ? body.imported : void 0;
          const themeId = importedRaw !== void 0 ? customThemeId(importedRaw) : void 0;
          applySelection(themeId ?? snapshot.palette, base);
          void persistSelection(ctx.logger, { palette: themeId ?? snapshot.palette, base });
          return void 0;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
      removePalette: async (themeId) => {
        if (!isCustomThemeId(themeId)) return;
        try {
          const response = await fetch(CUSTOM_ROUTE_PATH, {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: themeId.slice("dsh-alpha-premium-custom-".length) })
          });
          const body = await response.json();
          if (!response.ok) {
            ctx.logger.warn(`premium-themes: palette removal failed: ${String(body.error ?? response.status)}`);
            return;
          }
          const snapshot = narrowSnapshot(body);
          applyCustoms(snapshot.customs);
          adopted = true;
          if (snapshot.palette === OFF) applySelection(OFF, restoreBase);
          else sync(snapshot.palette);
        } catch (error) {
          ctx.logger.warn(`premium-themes: palette removal failed: ${String(error)}`);
        }
      }
    };
  };
  ctx.slots.inject("settings.general.item", () => ctx.slots.register({
    name: "settings.general.item",
    id: ROW_ID,
    order: 20,
    store,
    locale: SETTINGS_NS,
    inject: injected
  }, PaletteRow));
  void fetchSelection().then(({ palette, base, customs }) => {
    if (!active) return;
    applyCustoms(customs);
    if (!adopted) {
      adopted = true;
      restoreBase = base;
      sync(palette);
      if (palette !== OFF && baseSettled) applySelection(palette, base);
    }
  }).catch(() => {
  });
}

const upstreamApply=module.exports.apply; const adaptedExports={...module.exports,apply:(ctx)=>{ctx.effect(()=>{const tag=document.createElement('style');tag.dataset.plugin="@dsh-themes-community/premium-alpha";tag.textContent=".zWrixq_backdrop{background:var(--dsw-alias-bg-mask-1);z-index:40;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.zWrixq_dialog{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:420px;max-width:calc(100vw - 48px);max-height:calc(100vh - 96px);box-shadow:0 12px 40px var(--dsw-alias-bg-mask-3);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:16px;flex-direction:column;gap:12px;padding:20px;display:flex;overflow-y:auto}.zWrixq_title{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:22px}.zWrixq_field{flex-direction:column;gap:6px;display:flex}.zWrixq_label{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.zWrixq_input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-input-major);width:100%;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:7px 10px;font-size:14px;line-height:20px}.zWrixq_colorRow{align-items:center;gap:8px;display:flex}.zWrixq_colorInput{border:1px solid var(--dsw-alias-border-l2);cursor:pointer;background:0 0;border-radius:8px;flex:none;width:34px;height:34px;padding:0}.zWrixq_schemeRow{gap:8px;display:flex}.zWrixq_schemeOption,.zWrixq_schemeSelected{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:8px;flex:1;padding:6px 12px;font-size:14px;line-height:20px}.zWrixq_schemeSelected{background:var(--dsw-alias-bg-module-platform);border-color:var(--dsw-static-neutral-bluish-400)}.zWrixq_textarea{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-input-major);width:100%;color:var(--dsw-alias-label-primary);font:inherit;resize:vertical;border-radius:8px;padding:7px 10px;font-size:13px;line-height:20px}.zWrixq_error{color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:20px}.zWrixq_actions{justify-content:flex-end;gap:8px;display:flex}.zWrixq_cancelButton,.zWrixq_submitButton{font:inherit;cursor:pointer;border-radius:8px;padding:6px 16px;font-size:14px;line-height:20px}.zWrixq_cancelButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);background:0 0}.zWrixq_submitButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);border:1px solid #0000}.zWrixq_submitButton:disabled{opacity:.6;cursor:default}.zWrixq_existingTitle{color:var(--dsw-alias-label-primary);margin-top:4px;font-size:13px;font-weight:600;line-height:20px}.zWrixq_none{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}.zWrixq_existingRow{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;align-items:center;gap:8px;padding:6px 8px;display:flex}.zWrixq_existingDot{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3);border-radius:50%;flex:none;width:14px;height:14px}.zWrixq_existingName{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:14px;line-height:20px;overflow:hidden}.zWrixq_deleteButton{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-state-error-primary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:2px 10px;font-size:13px;line-height:20px}.zWrixq_deleteButton:hover{background:var(--dsw-alias-interactive-bg-hover-danger)}\n._2rD3WG_group{border-bottom:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:8px;padding:16px 0;display:flex}._2rD3WG_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}._2rD3WG_paletteRow{flex-wrap:wrap;align-items:stretch;gap:8px;display:flex}._2rD3WG_paletteChip{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border-radius:8px;align-items:center;gap:6px;padding:6px 12px;font-size:14px;line-height:22px;display:flex}._2rD3WG_paletteChip:hover:not(._2rD3WG_selected){background:var(--dsw-alias-interactive-bg-hover)}._2rD3WG_selected{background:var(--dsw-alias-bg-module-platform);border-color:var(--dsw-static-neutral-bluish-400)}._2rD3WG_swatchDot{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3);border-radius:50%;flex:none;width:14px;height:14px}._2rD3WG_importChip{box-sizing:border-box;border:1px dashed var(--dsw-alias-border-l3);font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:8px;align-items:center;gap:6px;padding:6px 12px;font-size:14px;line-height:22px;display:flex}._2rD3WG_importChip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}";document.head.appendChild(tag);return()=>tag.remove();},'premium: owned styles');return upstreamApply(ctx);}};
return adaptedExports;}});
