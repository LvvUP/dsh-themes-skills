window.__ModuleLoader__.load({
	id: "dsh-milestone",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region src/client/MilestoneOverlay.tsx
		/**
		* @param props - runtime share (root kit) + the narrowed renderSlot and the
		*   framework-injected SessionProvider for the session child seat.
		*/
		function MilestoneOverlay({ SessionProvider, renderSlot }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SessionProvider, {
				empty: () => null,
				children: () => renderSlot("milestone.rail", {})
			});
		}
		//#endregion
		//#region src/client/accent-utils.ts
		/** True for a canonical 6-digit hex color (`#4d7cfd`, `#4D7CFD`). */
		function isHexColor(value) {
			return /^#[0-9a-fA-F]{6}$/.test(value);
		}
		/**
		* Parse a hex color into channels.
		* @param hex - `#rrggbb` (case-insensitive).
		* @returns the RGB channels, or null when `hex` is not a canonical hex color.
		*/
		function hexToRgb(hex) {
			if (!isHexColor(hex)) return null;
			const n = parseInt(hex.slice(1), 16);
			return {
				r: n >> 16 & 255,
				g: n >> 8 & 255,
				b: n & 255
			};
		}
		/** Format an alpha to the short decimal form the rail's inline styles use (0.55, 0.2). */
		function formatAlpha(alpha) {
			return Math.round(Math.max(0, Math.min(1, alpha)) * 100) / 100;
		}
		/**
		* Color with alpha as a CSS `rgba(r, g, b, a)` string; alpha clamps to [0, 1].
		* @returns the rgba() string, or null when `hex` is invalid.
		*/
		function rgbaString(hex, alpha) {
			const rgb = hexToRgb(hex);
			if (rgb === null) return null;
			return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${formatAlpha(alpha)})`;
		}
		/**
		* Linear mix of two hex colors in RGB space.
		* @param a - start color (t = 0).
		* @param b - end color (t = 1).
		* @param t - mix factor, clamped to [0, 1].
		* @returns the mixed `#rrggbb`, or null when either input is invalid.
		*/
		function mixHex(a, b, t) {
			const ca = hexToRgb(a);
			const cb = hexToRgb(b);
			if (ca === null || cb === null) return null;
			const k = Math.max(0, Math.min(1, t));
			const channel = (from, to) => Math.round(from + (to - from) * k).toString(16).padStart(2, "0");
			return `#${channel(ca.r, cb.r)}${channel(ca.g, cb.g)}${channel(ca.b, cb.b)}`;
		}
		/**
		* Lighten a hex color toward white — the rail's "accent soft" text shade
		* (t = 0 keeps the color, t = 1 is white).
		*/
		function lighten(hex, t) {
			return mixHex(hex, "#ffffff", t);
		}
		/**
		* Convert a hex color to HSL. Double-checked against the standard RGB→HSL
		* formulas; saturation/lightness are percentages, hue is degrees.
		* @returns the HSL channels, or null when `hex` is invalid.
		*/
		function hexToHsl(hex) {
			const rgb = hexToRgb(hex);
			if (rgb === null) return null;
			const r = rgb.r / 255;
			const g = rgb.g / 255;
			const b = rgb.b / 255;
			const max = Math.max(r, g, b);
			const min = Math.min(r, g, b);
			const delta = max - min;
			let h = 0;
			if (delta !== 0) if (max === r) h = 60 * ((g - b) / delta % 6);
			else if (max === g) h = 60 * ((b - r) / delta + 2);
			else h = 60 * ((r - g) / delta + 4);
			if (h < 0) h += 360;
			const l = (max + min) / 2;
			const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
			return {
				h,
				s: s * 100,
				l: l * 100
			};
		}
		//#endregion
		//#region src/client/badge-logic.ts
		/**
		* Pure turn-health badge derivation + styling for the milestone rail: given
		* the harness snapshot signals, decide which (if any) colored glow a mark's
		* dot should wear, plus the style tokens for that badge.
		*
		* Rendering contract (M-design change): a badge is NO LONGER a hard 2px ring
		* (border) — it is a concentric "soft glow" made of three layered box-shadows
		* (a crisp inner ring at 55% alpha, then two blurred blooms), and the
		* running/awaiting pulse breathes opacity + shadow intensity instead of
		* expanding a ring. The `data-badge` value and the semantic color of every
		* kind are unchanged.
		*
		* All functions are side-effect free (no React, no DOM) so the rail component
		* can consume them directly and tests can exercise them in isolation.
		*/
		/**
		* Derive the badge for one mark.
		*
		* Precedence: error > max-tokens > retry > running > awaiting. Node-derived
		* badges ('turn-error' -> error, 'turn-max-tokens' -> max-tokens,
		* 'model-retry' -> retry) fire regardless of `lastMark`; the transient badges
		* (running, awaiting) only apply to the newest mark. Callers must already
		* exclude cancelled retries — a bare 'model-retry' kind is treated as retry.
		*
		* @param input - the mark's snapshot signals.
		* @returns the winning badge kind, or null when no signal applies.
		*/
		function deriveBadge(input) {
			if (input.nodeKinds.includes("turn-error")) return "error";
			if (input.nodeKinds.includes("turn-max-tokens")) return "max-tokens";
			if (input.nodeKinds.includes("model-retry")) return "retry";
			if (input.lastMark) {
				if (input.running) return "running";
				if (input.awaitingInput) return "awaiting";
			}
			return null;
		}
		/** Ring colors and pulse flag per badge kind; running/awaiting pulse. */
		const RING_STYLES = {
			error: {
				color: "#ef4444",
				pulse: false
			},
			"max-tokens": {
				color: "#f59e0b",
				pulse: false
			},
			retry: {
				color: "#f97316",
				pulse: false
			},
			running: {
				color: "#4d7cfe",
				pulse: true
			},
			awaiting: {
				color: "#f59e0b",
				pulse: true
			}
		};
		/** Build the layered soft-glow shadow for a badge color. */
		function glowShadow(color) {
			const layer = (alpha) => rgbaString(color, alpha) ?? "currentColor";
			return [
				`0 0 0 2px ${layer(.55)}`,
				`0 0 8px 2px ${layer(.45)}`,
				`0 0 16px 5px ${layer(.2)}`
			].join(", ");
		}
		/**
		* Style tokens for a badge kind.
		* @param badge - the derived badge kind.
		* @returns the glow color, whether the dot should pulse (breathing glow), and
		*   the static multi-layer box-shadow string for the badge span.
		*/
		function badgeRingStyle(badge) {
			const base = RING_STYLES[badge];
			return {
				...base,
				shadow: glowShadow(base.color)
			};
		}
		/**
		* Breathing-glow keyframes for one badge color. The rail injects this (via an
		* inline <style>) only while a pulsing badge is on screen — the color is baked
		* into the alphas, so the animation needs no runtime var lookups. Both stops
		* keep the SAME three-layer shape (only alpha/blur breathe), so the glow never
		* looks like the old expanding ring.
		*/
		function badgePulseCss(color) {
			const layer = (alpha) => rgbaString(color, alpha) ?? "currentColor";
			return `@keyframes milestone-badge-pulse {
  0%, 100% { opacity: 0.95; box-shadow: ${`0 0 0 2px ${layer(.55)}, 0 0 8px 2px ${layer(.45)}, 0 0 16px 5px ${layer(.2)}`}; }
  50% { opacity: 0.45; box-shadow: ${`0 0 0 2px ${layer(.35)}, 0 0 4px 1px ${layer(.25)}, 0 0 9px 3px ${layer(.12)}`}; }
}`;
		}
		//#endregion
		//#region src/client/bookmark-logic.ts
		/**
		* Pure bookmark logic for the milestone rail: membership, immutable
		* append/remove toggling, bookmark filtering of a mark list, and count.
		*
		* All functions are side-effect free (no React, no DOM) so the rail component
		* can consume them directly and tests can exercise them in isolation. The
		* persisted store engine lives in bookmarkStore.ts; this module only shapes
		* values.
		*/
		/**
		* Whether a key is currently bookmarked.
		* @param keys - the bookmark key list (in toggle order).
		* @param key - the key to look up.
		* @returns true when the key is present.
		*/
		function isBookmarked(keys, key) {
			return keys.includes(key);
		}
		/**
		* Immutable toggle: append the key when it is not bookmarked, remove it when
		* it is. Never mutates the input; returns a fresh list (order preserved).
		* @param keys - the bookmark key list (in toggle order).
		* @param key - the key to flip.
		* @returns a new list with the key toggled.
		*/
		function toggleKey(keys, key) {
			return isBookmarked(keys, key) ? keys.filter((k) => k !== key) : [...keys, key];
		}
		/**
		* Filter a mark list down to the bookmarked marks.
		* @param marks - marks in rail order (only `key` is consulted).
		* @param bookmarked - the bookmark key list.
		* @returns `visible` (ascending indices of marks whose key is bookmarked;
		* empty whenever there are no bookmarks) and `isFiltered` (true exactly when
		* any bookmark exists — callers treat it as "filter active").
		*/
		function filterByBookmarks(marks, bookmarked) {
			if (bookmarked.length === 0) return {
				visible: [],
				isFiltered: false
			};
			const set = new Set(bookmarked);
			return {
				visible: marks.reduce((acc, mark, i) => {
					if (set.has(mark.key)) acc.push(i);
					return acc;
				}, []),
				isFiltered: true
			};
		}
		//#endregion
		//#region src/client/clipboard-logic.ts
		/**
		* Clipboard helper for the milestone rail: copies text to the system
		* clipboard via the async Clipboard API. Resolves false (never throws) when
		* the API is unavailable or the write is rejected, so callers can treat the
		* result as a plain boolean.
		*/
		/**
		* Copy text to the system clipboard.
		* @param text - the text to copy.
		* @returns a promise resolving to true when the clipboard write succeeded,
		* false when the Clipboard API is unavailable or the write was rejected.
		*/
		async function copyText(text) {
			if (typeof navigator === "undefined" || navigator.clipboard?.writeText === void 0) return false;
			try {
				await navigator.clipboard.writeText(text);
				return true;
			} catch {
				return false;
			}
		}
		//#endregion
		//#region src/client/deep-link-logic.ts
		/**
		* Pure deep-link helpers for the milestone rail: parse the `#msg=<key>` URL
		* hash and rebuild it.
		*
		* The conversation anchor key is treated as an OPAQUE string — it is a
		* length-prefixed node key like `13:input-message<messageId>` or
		* `14:assistant-step3:2` (the length prefix makes naive splitting ambiguous),
		* so the parser never inspects or splits the key itself. Callers match the
		* returned key against the session's marks, which is the real validity check.
		*
		* Percent-encoding: the URL fragment parser percent-encodes `"` `<` `>` `` ` ``
		* and lone `%`, so a hash built with a RAW `<`-containing key would read back
		* from `location.hash` percent-encoded (`13:user%3Cdl-2%3E`) and never match
		* a mark after a refresh. `buildMessageHash` therefore percent-encodes those
		* characters itself (a byte-exact URL), and `parseDeepLinkHash` decodes them
		* back — the key round-trips through the URL untouched.
		*/
		/** The URL hash fragment prefix that carries a message anchor key. */
		const MSG_HASH_PREFIX = "msg=";
		/**
		* Characters the WHATWG URL fragment parser cannot round-trip raw (they are
		* percent-encoded on parse): `"` (0x22), `<` (0x3C), `>` (0x3E), backtick
		* (0x60), and `%` (0x25, so a literal `%` never reads as an escape start).
		*/
		const FRAGMENT_UNSAFE = /["<>\u0060%]/g;
		/**
		* Parse a `location.hash` fragment into the message anchor key it references.
		* @param hash - the raw `location.hash` value: `''` or a fragment starting
		*   with `#` (e.g. `#msg=13:input-messageabc`).
		* @returns the anchor key (percent-escapes decoded), or null when the
		*   fragment is not a message deep link: empty hash, `#msg=` with an empty
		*   value, a `#msg` prefix without the `=`, any other hash shape, a hash
		*   missing the leading `#`, or a malformed percent escape.
		*/
		function parseDeepLinkHash(hash) {
			if (!hash.startsWith(`#${MSG_HASH_PREFIX}`)) return null;
			const encoded = hash.slice(5);
			if (encoded === "") return null;
			try {
				return decodeURIComponent(encoded);
			} catch {
				return null;
			}
		}
		/**
		* Build the URL hash fragment that deep-links to a message anchor key.
		* @param key - the conversation node key (opaque, never parsed here).
		*/
		function buildMessageHash(key) {
			return `#${MSG_HASH_PREFIX}${key.replace(FRAGMENT_UNSAFE, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
		}
		//#endregion
		//#region src/client/label-logic.ts
		const MINUTE_MS = 6e4;
		const HOUR_MS = 36e5;
		const DAY_MS = 864e5;
		/**
		* Bucket an elapsed duration into a relative-time label.
		*
		* Buckets on `now - time` in milliseconds: below 60s -> justNow (n=0), below
		* 3600s -> minutes, below 86400s -> hours, otherwise days. `n` is the whole
		* count of the bucket unit (floor). Deterministic for a given `now`.
		*
		* @param time - the event timestamp in ms since epoch.
		* @param now - the reference clock in ms since epoch.
		* @returns the label key and bucket count.
		*/
		function relativeTimeParts(time, now) {
			const diff = now - time;
			if (diff < MINUTE_MS) return {
				key: "time.justNow",
				n: 0
			};
			if (diff < HOUR_MS) return {
				key: "time.minutes",
				n: Math.floor(diff / MINUTE_MS)
			};
			if (diff < DAY_MS) return {
				key: "time.hours",
				n: Math.floor(diff / HOUR_MS)
			};
			return {
				key: "time.days",
				n: Math.floor(diff / DAY_MS)
			};
		}
		/**
		* Map a harness end-reason string to a stable i18n key.
		* @param kind - the raw end-reason string (e.g. 'max-tokens').
		* @returns the i18n key, or the raw kind unchanged when unknown.
		*/
		function reasonKeyOf(kind) {
			switch (kind) {
				case "completed": return "reason.completed";
				case "aborted": return "reason.aborted";
				case "error": return "reason.error";
				case "max-tokens": return "reason.maxTokens";
				case "interrupted": return "reason.interrupted";
				case "blocked": return "reason.blocked";
				default: return kind;
			}
		}
		//#endregion
		//#region src/client/tooltip-logic.ts
		const EMPTY_META = {
			model: null,
			purpose: null,
			inputTokens: null,
			outputTokens: null
		};
		/** True when the value is a plain (non-array, non-null) object. */
		function isRecord(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value);
		}
		/**
		* Decode a `usage` payload structurally: only numeric `inputTokens` /
		* `outputTokens` survive; anything else (absent, malformed, wrong types)
		* degrades to null — the boundary owns trust, the callers get plain numbers.
		* @param usage - untrusted usage payload (typed `unknown` at runtime).
		* @returns the token counts with null for every missing/malformed field.
		*/
		function decodeUsage(usage) {
			if (!isRecord(usage)) return {
				inputTokens: null,
				outputTokens: null
			};
			return {
				inputTokens: typeof usage.inputTokens === "number" ? usage.inputTokens : null,
				outputTokens: typeof usage.outputTokens === "number" ? usage.outputTokens : null
			};
		}
		/** Resolve model/purpose from a request config, falling back to provenance. */
		function metaFromRecord(record) {
			return {
				model: record.requestConfig?.model ?? record.provenance?.model ?? null,
				purpose: record.requestConfig?.purpose ?? null,
				...decodeUsage(record.usage)
			};
		}
		/**
		* Derive the hover metadata for one turn. Sources, in priority order:
		* 1. the `assistant-step` chat node(s) of the turn — their `data.finalNode`
		*    carries the recorded `requestConfig` / `provenance` / `usage`;
		* 2. `trajectoryRequests` — the latest entry whose `turn` matches (used when
		*    no assistant-step node yields a model or purpose);
		* 3. all-null when the turn is absent, no node matches, or everything is
		*    malformed. Never throws.
		* @param nodes - stable per-key chat node reader (as exposed by the snapshot).
		* @param locations - turn -> ordered node keys index.
		* @param turn - owning turn; undefined yields all-null.
		* @param trajectoryRequests - optional fallback request log.
		* @returns the turn's metadata, null where unknown.
		*/
		function deriveTurnMeta(nodes, locations, turn, trajectoryRequests) {
			if (turn === void 0) return EMPTY_META;
			for (const key of locations.getTurn(turn)) {
				const node = nodes.get(key);
				if (node === void 0 || node.kind !== "assistant-step") continue;
				const finalNode = (isRecord(node.data) ? node.data : void 0)?.finalNode;
				if (!isRecord(finalNode)) continue;
				const meta = metaFromRecord(finalNode);
				if (meta.model !== null || meta.purpose !== null) return meta;
			}
			if (trajectoryRequests !== void 0) {
				let latest;
				for (const request of trajectoryRequests) if (request.turn === turn) latest = request;
				if (latest !== void 0) return metaFromRecord(latest);
			}
			return EMPTY_META;
		}
		//#endregion
		//#region src/client/rail-keyboard.ts
		/**
		* Pure roving-tabindex index math for the milestone rail.
		*
		* The dots list becomes a single roving-tabindex widget (ArrowUp/Down moves
		* focus, Home/End jumps to first/last). This module only owns the pure index
		* arithmetic; the widget wiring lives in the component.
		*/
		/**
		* Move `current` by `delta` (1 = forward, -1 = backward), wrapping around
		* `[0, count - 1]`. Returns `-1` when there are no focusable dots.
		*/
		function nextFocusIndex(current, count, delta) {
			if (count <= 0) return -1;
			return (current + delta + count) % count;
		}
		/**
		* Clamp `current` into `[0, count - 1]` — e.g. when the visible dot list
		* shrinks and the focused index no longer exists. Returns `-1` when there
		* are no focusable dots.
		*/
		function clampIndex(current, count) {
			if (count <= 0) return -1;
			return Math.min(Math.max(current, 0), count - 1);
		}
		//#endregion
		//#region src/client/rail-logic.ts
		/**
		* Pure rail logic for the milestone rail: full-text search matching, current-
		* position highlight, match-cycle navigation, mark visual state, and dot color.
		*
		* All functions are side-effect free (no React, no DOM) so the rail component
		* can consume them directly and tests can exercise them in isolation.
		*/
		/**
		* Extract the FULL plain text of a ContentBlock[] payload: the `text` of every
		* `{ type: 'text', text: string }` block, joined with a single space and
		* trimmed. Unlike the rail's hover preview this is NOT truncated — callers use
		* it for search matching, so the entire message must be searchable.
		* @param content - untrusted payload; anything that is not an array yields ''.
		*/
		function extractText(content) {
			if (!Array.isArray(content)) return "";
			const parts = [];
			for (const block of content) if (block !== null && typeof block === "object" && block.type === "text") {
				const text = block.text;
				if (typeof text === "string") parts.push(text);
			}
			return parts.join(" ").trim();
		}
		/**
		* Case-insensitive substring filter over mark texts.
		* @param marks - marks in rail order.
		* @param query - the search query; empty/whitespace matches everything.
		* @returns `matches` (ascending indices whose text includes the lowercased
		* query; all indices when the query is blank) and `active` (the first match
		* index, or -1 when the query is blank or nothing matches).
		*/
		function filterMarks(marks, query) {
			const q = query.trim();
			if (q === "") return {
				matches: marks.map((_, i) => i),
				active: -1
			};
			const lower = q.toLowerCase();
			const matches = marks.reduce((acc, mark, i) => {
				if (mark.text.toLowerCase().includes(lower)) acc.push(i);
				return acc;
			}, []);
			return {
				matches,
				active: matches.length > 0 ? matches[0] : -1
			};
		}
		/**
		* Wrap-around match navigation.
		* @param current - the currently active match index (any number; used raw).
		* @param count - number of matches; `<= 0` yields -1.
		* @param delta - +1 to advance, -1 to go back.
		* @returns `(current + delta + count) % count`, or -1 when count <= 0.
		*/
		function nextMatchIndex(current, count, delta) {
			if (count <= 0) return -1;
			return (current + delta + count) % count;
		}
		/**
		* Key of the row the viewport top currently sits in: the last row whose top is
		* at or just above the viewport top (within a 0.5px epsilon).
		* @param rows - rows in document order (ascending top).
		* @param viewportTop - scrollport's current scroll offset.
		* @returns that row's key; the first row's key when every row is below the
		* viewport; undefined when there are no rows.
		*/
		function currentIndexOf(rows, viewportTop) {
			if (rows.length === 0) return void 0;
			let current = rows[0];
			for (const row of rows) if (row.top <= viewportTop + .5) current = row;
			else break;
			return current.key;
		}
		/**
		* Compute a mark's visual state from search + position signals.
		* Precedence: `current` (row at viewport top) > `active` (first query match) >
		* `match` (any query match) > `dimmed` (query active, not a match) > `normal`.
		* @param opts - the mark's signals (key is kept for caller symmetry).
		*/
		function markState(opts) {
			if (opts.isCurrent) return "current";
			if (opts.isActive) return "active";
			if (opts.isMatch) return "match";
			if (opts.hasQuery) return "dimmed";
			return "normal";
		}
		/** The default accent (the classic milestone blue) — dotColor's fallback. */
		const DEFAULT_DOT_ACCENT = "#4d7cfd";
		/**
		* Accent-driven gradient dot color: hue/saturation come from the user's
		* accent (settings 强调色), lightness walks 72% → 45% (newest/highest index
		* deepest, oldest lightest — the original gradient shape). Invalid accents
		* degrade to the default blue.
		* @param index - dot position in the rail (0 = oldest).
		* @param total - number of dots.
		* @param accent - the accent hex (`#rrggbb`); defaults to the classic blue.
		*/
		function dotColor(index, total, accent = DEFAULT_DOT_ACCENT) {
			const hsl = hexToHsl(accent) ?? hexToHsl("#4d7cfd");
			const lightness = 72 - (total <= 1 ? 0 : index / (total - 1)) * 27;
			return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${lightness}%)`;
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* UI strings for the milestone rail, keyed flat (single-language-per-key,
		* no nesting) so the later i18n threading stays a mechanical
		* `value.replace('{name}', n)` substitution.
		*
		* `zh` is the source of truth and the key registry: it byte-matches the
		* current hardcoded output of MilestoneRail / MilestoneRailTooltip /
		* MilestoneRailSearch exactly (each `{n}`/`{m}`/`{name}` slot stands in for
		* the interpolated number or label), so swapping in these templates is
		* behavior-preserving. `en` is typed `Record<MilestoneKey, string>` so a
		* missing English translation is a compile error, not a runtime miss.
		*/
		const zh = {
			/** aria-label on each dot: `跳转到第 ${i + 1} 条消息`. */
			"jump.to": "跳转到第 {n} 条消息",
			/** Load-older coverage hint: `已显示 {marks.length} 条 · 还有更早`. */
			"window.hint": "已显示 {n} 条 · 还有更早",
			/** Hover turn badge: `第 ${mark.turn} 轮`. */
			"turn.label": "第 {n} 轮",
			/** Hover position: `第 {hover.index + 1} / {hover.total} 条`. */
			"pos.of": "第 {n} / {m} 条",
			/** Hover position of a collapsed-turn summary dot: `第 {a}–{b} / {m} 条`
			* (the range of messages the summary dot represents). */
			"pos.range": "第 {a}–{b} / {m} 条",
			/** Search input placeholder. */
			"search.placeholder": "搜索消息内容",
			/** aria-label on the search toggle button and the search input. */
			"search.label": "搜索消息",
			/** aria-label on the bookmarks-only filter toggle. */
			"bookmark.filter": "只看收藏",
			/** aria-label + title on the focus-mode toggle when focus is OFF (arm it). */
			"focus.on": "聚焦模式",
			/** aria-label + title on the focus-mode toggle when focus is ON (disarm it). */
			"focus.off": "退出聚焦",
			/** aria-label on the hover tooltip star toggle. */
			"bookmark.star": "收藏此消息",
			/** aria-label on the search clear button. */
			"search.clear": "清空搜索",
			/** title + aria-label on the load-older `···` button. */
			"load.older": "加载更早消息",
			/** aria-label on the rail root. */
			"rail.label": "会话里程碑",
			/** aria-label on the dot list. */
			"rail.list": "会话里程碑列表",
			/** Hover preview fallback for empty message text. */
			"no.text": "（无文本）",
			/** Relative time: `< 60s`. */
			"time.justNow": "刚刚",
			/** Relative time: `< 1h`. */
			"time.minutes": "{n} 分钟前",
			/** Relative time: `< 1d`. */
			"time.hours": "{n} 小时前",
			/** Relative time: `>= 1d`. */
			"time.days": "{n} 天前",
			/** Hover duration: `用时 {durationLabel}`. */
			"duration.label": "用时 {name}",
			/** Hover TTFT: `首字 {ttftLabel}`. */
			"ttft.label": "首字 {name}",
			/** TurnEndReason `completed`. */
			"reason.completed": "已完成",
			/** TurnEndReason `aborted`. */
			"reason.aborted": "已中止",
			/** TurnEndReason `error`. */
			"reason.error": "出错",
			/** TurnEndReason `max-tokens`. */
			"reason.maxTokens": "达到上限",
			/** TurnEndReason `interrupted`. */
			"reason.interrupted": "已中断",
			/** TurnEndReason `blocked`. */
			"reason.blocked": "已阻塞",
			/** Copy-message tooltip action. */
			"copy.message": "复制消息",
			/** Fork-from-here tooltip action. */
			"fork.here": "从此处 fork",
			/** Collapse-turn tooltip action. */
			"collapse.turn": "折叠此轮",
			/** Expand-turn tooltip action. */
			"expand.turn": "展开此轮",
			/** aria-label + title on the milestone-list toggle when the panel is CLOSED. */
			"list.open": "打开列表",
			/** aria-label + title on the milestone-list toggle when the panel is OPEN. */
			"list.close": "收起列表",
			/** Header title of the all-prompts list panel. */
			"list.label": "全部提问",
			/** Bottom hint of the all-prompts list while it drains older pages. */
			"list.loading": "正在加载更早消息…",
			/** Header title + input placeholder of the cross-session search panel. */
			"search.cross": "跨会话搜索",
			/** aria-label + title on the cross-session search toggle when the panel is CLOSED. */
			"search.cross.open": "打开跨会话搜索",
			/** aria-label + title on the cross-session search toggle when the panel is OPEN. */
			"search.cross.close": "收起跨会话搜索",
			/** Cross-session result row title fallback for sessions with no display title. */
			"search.untitled": "（无标题）",
			/** Cross-session search failure notice. */
			"search.error": "搜索失败，请重试",
			/** Cross-session search footer hint when the harness capped the result list. */
			"search.more": "结果已截断，请细化关键词",
			/** aria-label on the toolbar expand arrow while the toolbar is COLLAPSED (expand it). */
			"toolbar.expand": "展开工具栏",
			/** aria-label on the toolbar expand arrow while the toolbar is EXPANDED (collapse it). */
			"toolbar.collapse": "收起工具栏",
			/** aria-label on the toolbar settings gear while the settings menu is CLOSED. */
			"toolbar.settings.open": "打开设置",
			/** aria-label on the toolbar settings gear while the settings menu is OPEN. */
			"toolbar.settings.close": "关闭设置",
			/** Header title of the toolbar settings menu. */
			"settings.title": "设置",
			/** Per-feature toggle label inside the settings menu: keep visible while collapsed. */
			"settings.pin": "在折叠外显示",
			/** Settings: feature-section hint explaining what the pin switch does. */
			"settings.pin.hint": "开启后，工具栏折叠时该功能仍显示在箭头旁",
			/** Settings action that clears every pinned feature. */
			"settings.reset": "恢复默认",
			/** Settings footer heading above the project links. */
			"settings.support": "支持我们",
			/** Settings footer link: the GitHub repository. */
			"settings.repo": "GitHub 仓库",
			/** Settings footer link: star the repository. */
			"settings.star": "欢迎 Star ★",
			/** Settings footer link: file an issue. */
			"settings.issues": "提交 Issue",
			/** Settings footer link: the npm install channel. */
			"settings.npm": "npm 安装渠道",
			/** Settings: feature-row name of the settings key itself (registry row). */
			"settings.label": "设置",
			/** aria-label on the settings modal close button. */
			"settings.close": "关闭",
			/** Settings modal: section heading for the feature pin rows. */
			"settings.section.features": "功能与快捷区",
			/** Settings modal: section heading for the personalization controls. */
			"settings.section.personal": "个性化",
			/** Settings modal: section heading for the focus-mode controls (0.6.3). */
			"settings.section.focus": "聚焦",
			/** Settings: personalization-section hint shown inside the expanded block. */
			"settings.personal.hint": "圆点、强调色与位置，即调即存",
			/** Settings: aria-label on the personalization block toggle while COLLAPSED. */
			"settings.personal.expand": "展开个性化设置",
			/** Settings: aria-label on the personalization block toggle while EXPANDED. */
			"settings.personal.collapse": "收起个性化设置",
			/** Settings: live value summary on the collapsed personalization header. */
			"settings.personal.summary": "{accent} · 图标 {icon}px · {side}",
			/** Settings: hover description — in-rail search. */
			"settings.desc.search": "按完整消息内容过滤并跳转到对应消息",
			/** Settings: hover description — all-prompts list. */
			"settings.desc.list": "本会话全部提问一览",
			/** Settings: hover description — cross-session search. */
			"settings.desc.sessionSearch": "跨会话搜索所有会话",
			/** Settings: hover description — bookmarks filter. */
			"settings.desc.bookmarks": "只显示已收藏的消息",
			/** Settings: hover description — focus mode. */
			"settings.desc.focus": "淡化 AI 思考块，阅读更清爽",
			/** Settings: hover description — update check. */
			"settings.desc.updateCheck": "检查 npm 是否有新版本",
			/** Settings: hover description — the settings key itself. */
			"settings.desc.settings": "自定义工具栏与外观",
			/** Settings personalization: accent color row label. */
			"settings.accent": "强调色",
			/** Settings personalization: custom color swatch label. */
			"settings.custom": "自定义",
			/** Settings personalization: icon/dot size slider label. */
			"settings.iconSize": "图标 / 圆点大小",
			/** Settings personalization: edge-distance slider label. */
			"settings.inset": "距侧边距离",
			/** Settings personalization: rail side row label. */
			"settings.side": "位置",
			/** Settings personalization: side radio — hug the left edge. */
			"settings.side.left": "左侧",
			/** Settings personalization: side radio — hug the right edge. */
			"settings.side.right": "右侧",
			/** Settings: focus block — hint shown inside the expanded block. */
			"settings.focus.hint": "这些选项自由组合成你的「聚焦搭配」；总开关仍是工具栏的眼睛按钮",
			/** Settings: aria-label on the focus block toggle while COLLAPSED. */
			"settings.focus.expand": "展开聚焦设置",
			/** Settings: aria-label on the focus block toggle while EXPANDED. */
			"settings.focus.collapse": "收起聚焦设置",
			/** Settings: focus option — dim the think reasoning disclosures. */
			"settings.focus.dimThink": "淡化 think 推理区",
			/** Settings: focus option — dim the tool-call cards. */
			"settings.focus.dimTools": "淡化工具调用卡片",
			/** Settings: focus option — compress think disclosures to a hover strip. */
			"settings.focus.collapseThink": "折叠 think",
			/** Settings: focus option — dim strength slider label. */
			"settings.focus.opacity": "淡化强度",
			/** Settings: live value summary on the collapsed focus header. */
			"settings.focus.summary": "{opts} · 强度 {opacity}%",
			/** Settings: focus summary — short label for the think-dim option. */
			"settings.focus.summary.think": "think 淡化",
			/** Settings: focus summary — short label for the tool-dim option. */
			"settings.focus.summary.tools": "工具淡化",
			/** Settings: focus summary — short label for the think-collapse option. */
			"settings.focus.summary.collapse": "折叠 think",
			/** Settings: focus summary — placeholder when every option is off. */
			"settings.focus.summary.none": "未启用",
			/** B4 update-check: toolbar button label + title/aria-label. */
			"update.check": "检查更新",
			/** B4 update-check: popover title. */
			"update.title": "更新检测",
			/** B4 update-check: installed-version row label. */
			"update.current": "当前版本",
			/** B4 update-check: newest-published-version row label. */
			"update.latest": "最新版本",
			/** B4 update-check: conclusion when the installed version is current. */
			"update.upToDate": "已是最新版本",
			/** B4 update-check: conclusion when a newer version exists. */
			"update.available": "发现新版本",
			/** B4 update-check: link text for the npm upgrade channel. */
			"update.goNpm": "去 npm 升级",
			/** B4 update-check: supported-host-lines metadata row label. */
			"update.hostLines": "已适配官方版本线",
			/** B4 update-check: in-flight state of the manual check button. */
			"update.checking": "检查中…",
			/** B4 update-check: failed state heading. */
			"update.failed": "检查失败",
			/** B4 update-check: retry action inside the failed state. */
			"update.retry": "重试",
			/** Settings modal section title: language. */
			"settings.language": "语言",
			/** Language option: follow the harness UI language. */
			"settings.lang.system": "跟随系统",
			/** Language option: force Chinese copy. */
			"settings.lang.zh": "中文",
			/** Language option: force English copy. */
			"settings.lang.en": "English",
			/** 0.6.5 tour: bubble 0 title (also the bubble's aria-label). */
			"tour.welcome.title": "欢迎使用 dsh-milestone",
			/** 0.6.5 tour: bubble 0 description — the REAL rail list anchor. */
			"tour.welcome.desc": "这是你的会话导航条：每条提问一个圆点，点击跳转，悬停查看元信息。",
			/** 0.6.5 tour: bubble 1 title — the expand arrow. */
			"tour.step1.title": "展开工具栏",
			/** 0.6.5 tour: bubble 1 description — what clicking REALLY does (auto-advance on the real click). */
			"tour.step1.desc": "点这里展开全部功能键：搜索、列表、收藏、聚焦、更新检测与设置都在里面。",
			/** 0.6.5 tour: bubble 2 title — the settings gear. */
			"tour.step2.title": "打开设置",
			/** 0.6.5 tour: bubble 2 description — what opening settings contains (auto-advance on the real open). */
			"tour.step2.desc": "打开设置：钉住常用键、个性化外观、切换语言、搭配「聚焦」。",
			/** 0.6.5 tour: bubble 3 title — the dots (real hover/click behavior). */
			"tour.step3.title": "圆点导航",
			/** 0.6.5 tour: bubble 3 description. */
			"tour.step3.desc": "每个圆点 = 一条提问——点击跳转，悬停查看时间、模型与用量。",
			/** 0.6.5 tour: bubble 4 title — done. */
			"tour.step4.title": "开始使用",
			/** 0.6.5 tour: bubble 4 description — finish line. */
			"tour.step4.desc": "去试试吧；有问题欢迎到 GitHub 提 Issue。",
			/** 0.6.5 tour: primary action on bubble 0 (begin) and bubble 4 (finish). */
			"tour.start": "开始使用",
			/** 0.6.5 tour: forward navigation (bubbles 1–3; the real-click auto-advance comes first). */
			"tour.next": "下一步",
			/** 0.6.5 tour: back navigation (bubbles 1–4). */
			"tour.prev": "上一步",
			/** 0.6.5 tour: corner skip — every bubble, persists the flag. */
			"tour.skip": "跳过",
			/** 0.6.5 tour: progress text `第 n / 5 步`. */
			"tour.step.label": "第 {n} / 5 步",
			/** 0.6.5 tour: aria-label on one progress dot. */
			"tour.step.short": "第 {n} 步",
			/** 0.6.5 settings footer action: replay the tour (data-onboarding-reopen kept). */
			"tour.reopen": "重新查看教程"
		};
		const en = {
			"jump.to": "Jump to message {n}",
			"window.hint": "Showing {n} messages · more below",
			"turn.label": "Turn {n}",
			"pos.of": "Message {n} of {m}",
			/** Collapsed-summary dot position: the message RANGE the dot represents. */
			"pos.range": "Messages {a}–{b} of {m}",
			"search.placeholder": "Search message content",
			"search.label": "Search messages",
			"bookmark.filter": "Bookmarks only",
			"focus.on": "Focus mode",
			"focus.off": "Exit focus",
			"bookmark.star": "Bookmark this message",
			"search.clear": "Clear search",
			"load.older": "Load older messages",
			"rail.label": "Session milestones",
			"rail.list": "Session milestone list",
			"no.text": "(no text)",
			"time.justNow": "Just now",
			"time.minutes": "{n} minutes ago",
			"time.hours": "{n} hours ago",
			"time.days": "{n} days ago",
			"duration.label": "Duration {name}",
			"ttft.label": "First token {name}",
			"reason.completed": "Completed",
			"reason.aborted": "Aborted",
			"reason.error": "Error",
			"reason.maxTokens": "Max tokens reached",
			"reason.interrupted": "Interrupted",
			"reason.blocked": "Blocked",
			"copy.message": "Copy message",
			"fork.here": "Fork from here",
			"collapse.turn": "Collapse turn",
			"expand.turn": "Expand turn",
			"list.open": "Open list",
			"list.close": "Close list",
			"list.label": "All prompts",
			/** Bottom hint of the all-prompts list while it drains older pages. */
			"list.loading": "Loading earlier messages…",
			"search.cross": "Cross-session search",
			"search.cross.open": "Open cross-session search",
			"search.cross.close": "Close cross-session search",
			"search.untitled": "(untitled)",
			"search.error": "Search failed, retry",
			"search.more": "Results truncated — refine your query",
			"toolbar.expand": "Expand toolbar",
			"toolbar.collapse": "Collapse toolbar",
			"toolbar.settings.open": "Open settings",
			"toolbar.settings.close": "Close settings",
			"settings.title": "Settings",
			"settings.pin": "Show outside collapse",
			"settings.pin.hint": "When on, the feature stays beside the arrow while the toolbar is folded",
			"settings.reset": "Restore defaults",
			"settings.support": "Support us",
			"settings.repo": "GitHub repo",
			"settings.star": "Give us a Star ★",
			"settings.issues": "Report an Issue",
			"settings.npm": "Install via npm",
			"settings.label": "Settings",
			"settings.close": "Close",
			"settings.section.features": "Features & Shortcuts",
			"settings.section.personal": "Personalization",
			"settings.section.focus": "Focus",
			"settings.personal.hint": "Dot size, accent color, and position — saved as you adjust",
			"settings.personal.expand": "Expand personalization",
			"settings.personal.collapse": "Collapse personalization",
			"settings.personal.summary": "{accent} · Icon {icon}px · {side}",
			"settings.desc.search": "Filter by full message text and jump to the match",
			"settings.desc.list": "Overview of every prompt in this session",
			"settings.desc.sessionSearch": "Search across all sessions",
			"settings.desc.bookmarks": "Show bookmarked messages only",
			"settings.desc.focus": "Dim AI thinking blocks for a cleaner read",
			"settings.desc.updateCheck": "Check npm for a newer release",
			"settings.desc.settings": "Customize the toolbar and appearance",
			"settings.accent": "Accent color",
			"settings.custom": "Custom",
			"settings.iconSize": "Icon / dot size",
			"settings.inset": "Distance from the edge",
			"settings.side": "Position",
			"settings.side.left": "Left",
			"settings.side.right": "Right",
			"settings.focus.hint": "Combine these options into your own focus recipe; the eye button on the toolbar stays the master switch",
			"settings.focus.expand": "Expand focus settings",
			"settings.focus.collapse": "Collapse focus settings",
			"settings.focus.dimThink": "Dim think reasoning",
			"settings.focus.dimTools": "Dim tool call cards",
			"settings.focus.collapseThink": "Collapse think",
			"settings.focus.opacity": "Dim strength",
			"settings.focus.summary": "{opts} · Strength {opacity}%",
			"settings.focus.summary.think": "Think dim",
			"settings.focus.summary.tools": "Tools dim",
			"settings.focus.summary.collapse": "Think collapse",
			"settings.focus.summary.none": "Off",
			"update.check": "Check updates",
			"update.title": "Update check",
			"update.current": "Current version",
			"update.latest": "Latest version",
			"update.upToDate": "You are up to date",
			"update.available": "Update available",
			"update.goNpm": "Upgrade on npm",
			"update.hostLines": "Supported official version lines",
			"update.checking": "Checking…",
			"update.failed": "Check failed",
			"update.retry": "Retry",
			"settings.language": "Language",
			"settings.lang.system": "Follow system",
			"settings.lang.zh": "Chinese",
			"settings.lang.en": "English",
			"tour.welcome.title": "Welcome to dsh-milestone",
			"tour.welcome.desc": "This is your session milestone rail: every prompt is a dot — click to jump, hover for metadata.",
			"tour.step1.title": "Expand the toolbar",
			"tour.step1.desc": "Click to reveal every function key: search, list, bookmarks, focus, update check, and settings.",
			"tour.step2.title": "Open settings",
			"tour.step2.desc": "Open settings: pin your favorite keys, personalize the look, switch language, and tune focus.",
			"tour.step3.title": "Dot navigation",
			"tour.step3.desc": "Each dot is one prompt — click to jump, hover for time, model, and usage.",
			"tour.step4.title": "Get started",
			"tour.step4.desc": "Go try it — questions and issues are welcome on GitHub.",
			"tour.start": "Get started",
			"tour.next": "Next",
			"tour.prev": "Back",
			"tour.skip": "Skip",
			"tour.step.label": "Step {n} of 5",
			"tour.step.short": "Step {n}",
			"tour.reopen": "Replay the tour"
		};
		/**
		* Interpolate `{name}` placeholders with params, matching the harness t seat's
		* substitution shape; an unknown parameter leaves the placeholder verbatim.
		*/
		function interpolate(template, params) {
			if (params === void 0) return template;
			return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (slot, name) => name in params ? String(params[name]) : slot);
		}
		/**
		* Dictionary-backed translate for the forced-language override (locale prefs
		* 'zh' / 'en'): resolves a key against the plugin's own dictionaries with
		* placeholder interpolation; unknown keys pass through unchanged (same
		* degradation as the harness seat).
		*/
		function translateDict(dict, key, params) {
			const template = dict[key];
			return template === void 0 ? key : interpolate(template, params);
		}
		//#endregion
		//#region src/client/turn-group-logic.ts
		/**
		* Renumber the raw harness turn numbers into a compact 1-based DISPLAY
		* sequence over the marks that actually render. The harness numbers every
		* engine turn (subagent/injected turns included), so the raw numbers show
		* gaps (turns that produced no user mark) and repeats (several marks sharing
		* one turn); labels fed through this map read as clean 1, 2, 3, … rounds.
		*
		* Grouping and collapse logic keep operating on the RAW turn (same-turn marks
		* are contiguous in rail order, so first-appearance ranking preserves the
		* partition) — only labels consume this map.
		*
		* @param marks - marks in rail order (only `turn` is consulted).
		* @returns raw turn -> display round (1-based), in first-appearance order;
		*   turns that never appear (or marks without turn info) get no entry.
		*/
		function buildDisplayTurns(marks) {
			const display = /* @__PURE__ */ new Map();
			let rank = 0;
			for (const mark of marks) {
				if (mark.turn === void 0) continue;
				if (display.has(mark.turn)) continue;
				display.set(mark.turn, ++rank);
			}
			return display;
		}
		/**
		* Partition consecutive marks by turn. Marks with the same numeric turn that
		* appear one after another share a group; each mark with `turn === undefined`
		* becomes its own singleton group with `turn: null`.
		* @param marks - marks in rail order.
		* @returns the groups, in original order, partitioning `marks` exactly.
		*/
		function buildTurnGroups(marks) {
			const groups = [];
			let current;
			for (const mark of marks) {
				if (mark.turn === void 0) {
					current = void 0;
					groups.push({
						turn: null,
						marks: [mark]
					});
					continue;
				}
				if (current !== void 0 && current.turn === mark.turn) current.marks.push(mark);
				else {
					current = {
						turn: mark.turn,
						marks: [mark]
					};
					groups.push(current);
				}
			}
			return groups;
		}
		/**
		* Flatten groups into render items, collapsing collapsed turns to their last
		* mark and reporting where separators belong.
		* @param groups - groups from {@link buildTurnGroups} (they partition the
		* original marks array in order, so a running count yields original indices).
		* @param collapsed - turns whose group should collapse to its LAST mark.
		* @returns `items` (one RenderItem per visible dot, in group order) and
		* `separatorsAt` (the index in `items` before which a separator should be
		* inserted at each non-first group boundary; never includes 0).
		*/
		function buildRenderList(groups, collapsed) {
			const items = [];
			const separatorsAt = [];
			let counter = 0;
			for (const group of groups) {
				const startIndex = items.length;
				if (group.turn !== null && collapsed.has(group.turn) && group.marks.length > 1) {
					const last = group.marks[group.marks.length - 1];
					items.push({
						mark: last,
						displayIndex: counter + group.marks.length - 1
					});
				} else for (let i = 0; i < group.marks.length; i++) items.push({
					mark: group.marks[i],
					displayIndex: counter + i
				});
				counter += group.marks.length;
				if (startIndex > 0) separatorsAt.push(startIndex);
			}
			return {
				items,
				separatorsAt
			};
		}
		//#endregion
		//#region src/client/useOutsideDismiss.ts
		/**
		* useOutsideDismiss: the shared "click outside to dismiss" contract behind the
		* rail's floating panels (in-rail search / all-prompts list / cross-session
		* search). While a panel is open, a pointerdown anywhere OUTSIDE it calls the
		* caller's close handler; a pointerdown inside the panel (or on an excluded
		* element) is left untouched.
		*
		* Event choice — window `pointerdown`:
		*   - `pointerdown` unifies mouse / touch / pen, so dismissal works for every
		*     input the harness surfaces; a `mousedown`-only listener would miss
		*     touch taps entirely.
		*   - Closing on the DOWN side of the gesture feels instant — the panel is
		*     gone before the pointer is released, which is the expected behaviour
		*     for fixed floating layers.
		*
		* Lifecycle: the listener is attached ONLY while `open` and removed on close
		* / unmount, so a closed panel never intercepts events and no listener leaks.
		*
		* Opening-gesture guard: hooks arm their listener in an effect, which React
		* runs AFTER the toggle's pointerdown/click that opened the panel — that
		* gesture can therefore never reach the listener by construction. As
		* defense-in-depth the hook also records its arming time and drops any
		* pointerdown whose `timeStamp` STRICTLY predates it (an event still in
		* flight from the opening gesture). Same-tick and later events pass through,
		* and synthetic test events with `timeStamp === 0` (which carry no real
		* timestamp) are kept — the guard never swallows a legitimate dispatch.
		*
		* `options.exclude` names targets the caller keeps for its own handler — the
		* panel's own toggle button is the canonical case: its click owns the
		* open/close flip, so a pointerdown on it must NOT also dismiss through the
		* hook, or clicking an armed toggle would close on pointerdown and re-open on
		* click.
		*/
		/**
		* True when `target` is (or sits inside) an element matching `selector`.
		* Panels use it to exclude their own rail-top toggle from dismissal (the
		* toggle's data attribute is the established rail DOM contract, so the
		* exclusion is just another access to it).
		*/
		function outsideDismissMatches(target, selector) {
			return target instanceof Element && target.closest(selector) !== null;
		}
		/**
		* @param panelRef - the floating panel's root element (only mounted while open).
		* @param open - whether the panel is open; the window listener arms only when true.
		* @param onClose - called once per outside pointerdown. `undefined` keeps the
		*   hook inert — used while a call site still has no close path wired.
		* @param options - optional exclusion predicate (see {@link OutsideDismissOptions}).
		*/
		function useOutsideDismiss(panelRef, open, onClose, options) {
			const onCloseRef = (0, react.useRef)(onClose);
			const excludeRef = (0, react.useRef)(options?.exclude);
			(0, react.useEffect)(() => {
				onCloseRef.current = onClose;
				excludeRef.current = options?.exclude;
			});
			(0, react.useEffect)(() => {
				if (!open) return;
				const armedAt = performance.now();
				const onPointerDown = (e) => {
					const onClose = onCloseRef.current;
					if (onClose === void 0) return;
					if (e.timeStamp > 0 && e.timeStamp < armedAt) return;
					if (excludeRef.current?.(e.target)) return;
					const panel = panelRef.current;
					if (panel !== null && e.target instanceof Node && panel.contains(e.target)) return;
					onClose();
				};
				window.addEventListener("pointerdown", onPointerDown);
				return () => window.removeEventListener("pointerdown", onPointerDown);
			}, [open, panelRef]);
		}
		//#endregion
		//#region src/client/MilestoneRailSearch.tsx
		/**
		* RailSearchUi: the in-rail search chrome (F1) — the magnifier toggle pinned
		* to the rail's top and the compact search panel to its left (input, match
		* counter, clear button).
		*
		* Pure presentation: it owns no state. MilestoneRail holds the search state
		* and handlers and feeds them in as props, so the search lifecycle (query,
		* match cycle, escape semantics) stays component-local in the rail. Splitting
		* the chrome into its own file keeps the rail component under the size
		* ceiling while the two still render one DOM contract
		* (`data-search-toggle` / `data-rail-search` / `data-match-count` /
		* `data-search-clear`).
		*
		* Outside dismissal: while the panel is open, a pointerdown anywhere outside
		* it closes it (shared useOutsideDismiss hook). The toggle's own click keeps
		* its flip semantics — a pointerdown on `[data-search-toggle]` is excluded
		* from the hook and left to the rail's onToggle. Without a dedicated onClose
		* prop the fallback is the toggle-off path (query retained, same as clicking
		* the toggle), matching the rail's current call site; a dedicated onClose
		* (clearSearch-equivalent) takes precedence once MilestoneRail feeds one.
		*/
		/** Dot diameter (px) — matches the rail's DOT_HIT so the toggle aligns. */
		const DOT_HIT$1 = 28;
		/**
		* @param props - the search state slice plus the rail's event handlers.
		*/
		function RailSearchUi({ panelTop, panelRight, query, panelOpen, matches, total, onToggle, onQueryChange, onSearchKeyDown, onClear, onClose, t }) {
			const panelRef = (0, react.useRef)(null);
			useOutsideDismiss(panelRef, panelOpen, onClose ?? (() => onToggle()), { exclude: (target) => outsideDismissMatches(target, "[data-search-toggle]") });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				"data-search-toggle": true,
				"aria-label": t("search.label"),
				"aria-pressed": panelOpen,
				onClick: onToggle,
				style: {
					width: DOT_HIT$1,
					height: DOT_HIT$1,
					flexShrink: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: panelOpen ? "rgba(77, 124, 254, 0.18)" : "transparent",
					border: "none",
					padding: 0,
					cursor: "pointer",
					color: panelOpen ? "#9db8ff" : "#8b96ab"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					width: "16",
					height: "16",
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "2.5",
					strokeLinecap: "round",
					"aria-hidden": "true",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "11",
						cy: "11",
						r: "7"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m21 21-4.3-4.3" })]
				})
			}), panelOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: panelRef,
				style: {
					position: "fixed",
					top: panelTop,
					right: panelRight,
					width: "min(220px, calc(100vw - 48px))",
					padding: "10px 12px",
					background: "rgba(20, 24, 32, 0.97)",
					color: "#e6e8ee",
					borderRadius: 8,
					boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
					zIndex: 102
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 6
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						"data-rail-search": true,
						"aria-label": t("search.label"),
						placeholder: t("search.placeholder"),
						value: query,
						onChange: (e) => onQueryChange(e.target.value),
						onKeyDown: onSearchKeyDown,
						autoFocus: true,
						style: {
							flex: 1,
							minWidth: 0,
							padding: "6px 10px",
							fontSize: 14,
							lineHeight: 1.4,
							color: "#e6e8ee",
							background: "rgba(255, 255, 255, 0.08)",
							border: "1px solid rgba(255, 255, 255, 0.16)",
							borderRadius: 6,
							outline: "none"
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"data-search-clear": true,
						"aria-label": t("search.clear"),
						onClick: onClear,
						style: {
							width: 22,
							height: 22,
							flexShrink: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							background: "transparent",
							border: "none",
							padding: 0,
							cursor: "pointer",
							color: "#8b96ab"
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							width: "12",
							height: "12",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "3",
							strokeLinecap: "round",
							"aria-hidden": "true",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 6 6 18" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 6 12 12" })]
						})
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-match-count": true,
					style: {
						marginTop: 6,
						fontSize: 13,
						color: "#8b96ab"
					},
					children: [
						matches,
						"/",
						total
					]
				})]
			})] });
		}
		//#endregion
		//#region src/client/MilestoneListPanel.tsx
		/**
		* MilestoneListPanel: the expandable all-prompts panel (P3) — the compact
		* list chrome pinned to the rail's top that enumerates EVERY user-prompt
		* milestone (序号 + turn + preview), independent of the search/bookmarks
		* filters. Clicking an entry jumps to that message through the rail's own
		* `jump` handler (the same path the dots use).
		*
		* Pure presentation: it owns no state. MilestoneRail holds the `listOpen`
		* boolean (the toggle and the Escape/close semantics live there) and feeds
		* the panel its anchor, the full marks array, and the jump handler as props
		* — same split as RailSearchUi. Renders one DOM contract
		* (`data-milestone-list` root / `data-list-item` rows with `data-jump-key`).
		*
		* Outside dismissal: while the panel is mounted (it only renders while open),
		* a pointerdown anywhere outside it calls the rail-fed `onClose` (shared
		* useOutsideDismiss hook; the toggle's own click keeps its flip semantics
		* through a `[data-list-toggle]` exclusion). MilestoneRail.tsx does NOT pass
		* onClose in the current tree (its owner is wiring it separately) — until
		* then the hook is inert and the panel keeps its existing behaviour.
		*/
		/**
		* @param props - the panel anchor, the full marks array, and the rail's jump handler.
		*/
		function MilestoneListPanel({ panelTop, panelRight, marks, onJump, onClose, loading = false, t }) {
			const panelRef = (0, react.useRef)(null);
			useOutsideDismiss(panelRef, true, onClose, { exclude: (target) => outsideDismissMatches(target, "[data-list-toggle]") });
			const displayTurns = (0, react.useMemo)(() => buildDisplayTurns(marks), [marks]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: panelRef,
				"data-milestone-list": true,
				style: {
					position: "fixed",
					top: panelTop,
					right: panelRight,
					width: "min(280px, calc(100vw - 48px))",
					padding: "10px 12px",
					background: "rgba(20, 24, 32, 0.97)",
					color: "#e6e8ee",
					borderRadius: 8,
					boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
					zIndex: 103
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: `[data-list-item]:hover { background: rgba(77, 124, 254, 0.18); }` }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 6,
							marginBottom: 6
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 13,
								fontWeight: 600,
								color: "#e6e8ee"
							},
							children: t("list.label")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 12,
								color: "#8b96ab"
							},
							children: marks.length
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							maxHeight: 300,
							overflowY: "auto",
							display: "flex",
							flexDirection: "column",
							gap: 2
						},
						children: [marks.map((mark, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							"data-list-item": true,
							"data-jump-key": mark.key,
							onClick: () => onJump(mark.key),
							title: mark.preview,
							style: {
								display: "block",
								width: "100%",
								minWidth: 0,
								padding: "6px 8px",
								background: "transparent",
								border: "none",
								borderRadius: 6,
								cursor: "pointer",
								color: "#e6e8ee",
								textAlign: "left"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									fontSize: 12,
									color: "#8b96ab",
									whiteSpace: "nowrap"
								},
								children: [t("pos.of", {
									n: i + 1,
									m: marks.length
								}), mark.turn !== void 0 ? ` · ${t("turn.label", { n: displayTurns.get(mark.turn) ?? mark.turn })}` : null]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontSize: 13,
									lineHeight: 1.4,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap"
								},
								children: mark.preview || t("no.text")
							})]
						}, mark.key)), loading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							"data-list-loading": true,
							style: {
								fontSize: 12,
								color: "#8b96ab",
								textAlign: "center",
								padding: "6px 8px"
							},
							children: t("list.loading")
						})]
					})
				]
			});
		}
		const MODAL_FG = "#e6e8ee";
		const MODAL_TITLE = "#c7cede";
		const MODAL_TEXT = "#b9c2d4";
		const MODAL_HINT = "#8b96ab";
		const MODAL_BORDER = "rgba(255, 255, 255, 0.14)";
		const MODAL_TIP_BG = "#222834";
		//#endregion
		//#region src/client/onboarding-store.ts
		/**
		* onboarding-store: the persistence layer for the 0.6.4 first-run tutorial —
		* a single "has the user seen it" flag with NO payload.
		*
		* Storage contract: one localStorage key (`dsh-milestone.onboarded`) whose
		* VALUE is exactly the string `'1'` when the tutorial was completed or
		* skipped. Anything else (absent key, `'0'`, `'true'`, garbage) means "never
		* shown" and re-triggers the tutorial.
		*
		* Both accessors swallow storage failures silently (SSR, sandboxed iframe,
		* quota): the tutorial is a best-effort enhancement — a broken storage must
		* never crash the rail, and a user in that environment simply sees the
		* tutorial once per page load instead of once ever.
		*/
		/** The single localStorage key holding the onboarding "seen" flag. */
		const ONBOARDED_KEY = "dsh-milestone.onboarded";
		/**
		* True when the user already completed or skipped the tutorial (the stored
		* value is exactly `'1'`). Storage unavailability degrades to `false`.
		*/
		function readOnboardedFlag() {
			try {
				return localStorage.getItem(ONBOARDED_KEY) === "1";
			} catch {
				return false;
			}
		}
		/**
		* Persist the tutorial as seen/completed by writing the literal string `'1'`.
		* Storage failures are swallowed — the flag simply will not survive a reload.
		*/
		function writeOnboardedFlag() {
			try {
				localStorage.setItem(ONBOARDED_KEY, "1");
			} catch {}
		}
		//#endregion
		//#region src/client/MilestoneTour.tsx
		/**
		* MilestoneTour: the 0.6.5 first-run coach-bubble tutorial.
		*
		* Unlike the deleted 0.6.4 MilestoneOnboarding modal (built-in toy demos on a
		* fake overlay), this tour never fakes anything. Each of the 5 bubbles anchors
		* a REAL rail element (`data-rail-list`, `data-toolbar-expand`,
		* `data-toolbar-settings`, the first `data-rail-dot`, the rail root), explains
		* what clicking that control ACTUALLY does, and auto-advances by OBSERVING the
		* live state the rail already owns:
		*   - bubble 1 (expand arrow) waits for `toolbarExpanded` → true — the user
		*     really clicked the arrow (「下一步」 remains a fallback);
		*   - bubble 2 (settings gear) waits for `settingsOpen` → true — the settings
		*     panel appearing IS the proof — and SUSPENDS while the modal is open
		*     (state is kept; closing settings resumes the bubble at the current step);
		*   - bubble 3 (dots) needs no interaction — hover/click are explained.
		*
		* Trigger/ownership lives in MilestoneRail (mount timer + settings reopen);
		* this component is presentation + state machine only. It persists the
		* `dsh-milestone.onboarded` flag itself via onboarding-store on IMPRESSION
		* (showing bubble 0 is enough) and on every close path (skip / Esc / finish).
		*
		* Positioning: `position: fixed`, opened on the target's FREE side (rail on
		* the right → bubble left of the target; rail on the left → bubble right of
		* it), measured with getBoundingClientRect and clamped to the viewport.
		* Re-measured on step changes, whenever the anchor may have (un)mounted (the
		* forced toolbar expansion), and on window resize. There is NO overlay and the
		* bubble never covers its own target — the user is supposed to CLICK the real
		* controls, so pointer-events live only on the bubble box itself.
		*
		* Anchor guarantee: entering any step ≥ 2 calls `onSetToolbarExpanded(true)`
		* because `data-toolbar-settings` renders only while the toolbar is expanded
		* (or the gear pinned) — the 「下一步」 fallback path lands there un-expanded.
		*
		* Visual language reuses modal-tokens (MODAL_TIP_BG panel, one border tone,
		* the 12/8px radius scale, three text tiers) and the rail root's inherited
		* `--ms-accent*` CSS variables. The highlight ring is zero-asset: a
		* `data-tour-highlight` attribute + one injected CSS rule.
		*/
		/** The tour bubble floats above every other rail layer (settings overlay 105). */
		const TOUR_Z = 106;
		/** Gap between the target element and the bubble (px). */
		const TOUR_GAP = 12;
		/** Bubble width (px) — the left-edge positioning math clamps against it. */
		const TOUR_WIDTH = 280;
		/** Minimum padding between the bubble and the viewport edges (px). */
		const VIEWPORT_PAD = 8;
		/** Fallback bubble height used when the layout has not settled (px). */
		const TOUR_HEIGHT_FALLBACK = 120;
		/** Progress-dot count — the 5 bubble steps (0 = welcome … 4 = done). */
		const STEP_COUNT = [
			0,
			1,
			2,
			3,
			4
		];
		/**
		* Static tour styling that `:hover`/`:focus-visible`/reduced-motion need (the
		* `:focus-visible` ring and the base-state backgrounds inline styles cannot
		* duplicate). BASE-states first — the UA default button face must never flood
		* through on the dark bubble (that exact bug already shipped once).
		*/
		const TOUR_CSS = `
@keyframes ms-tour-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
[data-tour-bubble] { animation: ms-tour-fade 160ms ease; }
/* BASE-state backgrounds for every bubble control (transparent or themed). */
[data-tour-skip] { background: transparent; }
[data-tour-prev] { background: rgba(255, 255, 255, 0.06); }
[data-tour-primary] { background: var(--ms-accent-bg); color: var(--ms-accent-soft); }
/* Hover washes on top of the explicit base states. */
[data-tour-skip]:hover { background: rgba(255, 255, 255, 0.08); }
[data-tour-prev]:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); }
[data-tour-primary]:hover { background: rgba(255, 255, 255, 0.14); }
/* ONE accent focus ring for keyboard use. */
[data-tour-skip]:focus-visible, [data-tour-prev]:focus-visible, [data-tour-primary]:focus-visible {
  box-shadow: 0 0 0 2px var(--ms-accent-soft);
}
/* The real-target highlight ring: accent halo + a subtle scale hint. */
[data-tour-highlight] {
  box-shadow: 0 0 0 2px var(--ms-accent-soft), 0 0 0 4px var(--ms-accent);
  transform: scale(1.04);
  transition: box-shadow 140ms ease, transform 140ms ease;
}
@media (prefers-reduced-motion: reduce) {
  [data-tour-bubble] { animation: none; }
  [data-tour-highlight] { transform: none; transition: none; }
  [data-tour-skip], [data-tour-prev], [data-tour-primary] { transition: none; }
}
`;
		/** Rail root — every step's fallback anchor and bubble 4's target. */
		function railRoot() {
			return document.querySelector("[data-side]");
		}
		const STEP_DEFS = [
			{
				titleKey: "tour.welcome.title",
				descKey: "tour.welcome.desc",
				anchor: () => document.querySelector("[data-rail-list]")
			},
			{
				titleKey: "tour.step1.title",
				descKey: "tour.step1.desc",
				anchor: () => document.querySelector("[data-toolbar-expand]")
			},
			{
				titleKey: "tour.step2.title",
				descKey: "tour.step2.desc",
				anchor: () => document.querySelector("[data-toolbar-settings]")
			},
			{
				titleKey: "tour.step3.title",
				descKey: "tour.step3.desc",
				anchor: () => document.querySelector("[data-rail-dot]") ?? railRoot()
			},
			{
				titleKey: "tour.step4.title",
				descKey: "tour.step4.desc",
				anchor: () => railRoot()
			}
		];
		/** Clamp `value` into [min, max], never letting min exceed max. */
		function clamp(value, min, max) {
			return Math.min(Math.max(value, min), Math.max(min, max));
		}
		function MilestoneTour({ t, side, toolbarExpanded, settingsOpen, onSetToolbarExpanded, onClose }) {
			const [step, setStep] = (0, react.useState)(0);
			const [pos, setPos] = (0, react.useState)(null);
			const bubbleRef = (0, react.useRef)(null);
			const primaryRef = (0, react.useRef)(null);
			const stepDef = STEP_DEFS[step];
			(0, react.useEffect)(() => {
				writeOnboardedFlag();
			}, []);
			/** Skip / finish / Escape converge here: persist, then close. */
			const finish = (0, react.useCallback)(() => {
				writeOnboardedFlag();
				onClose();
			}, [onClose]);
			(0, react.useEffect)(() => {
				if (settingsOpen) return;
				const onKey = (e) => {
					if (e.key !== "Escape") return;
					finish();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [finish, settingsOpen]);
			(0, react.useEffect)(() => {
				if (step === 1 && toolbarExpanded) setStep(2);
			}, [step, toolbarExpanded]);
			(0, react.useEffect)(() => {
				if (step === 2 && settingsOpen) setStep(3);
			}, [step, settingsOpen]);
			(0, react.useEffect)(() => {
				if (step >= 2 && !toolbarExpanded) onSetToolbarExpanded(true);
			}, [
				step,
				toolbarExpanded,
				onSetToolbarExpanded
			]);
			/** Measure the current anchor and place the bubble on its free side. */
			const measure = (0, react.useCallback)(() => {
				const anchor = STEP_DEFS[step].anchor();
				const bubble = bubbleRef.current;
				if (anchor === null || bubble === null) {
					setPos(null);
					return;
				}
				const rect = anchor.getBoundingClientRect();
				const bw = bubble.offsetWidth || TOUR_WIDTH;
				const bh = bubble.offsetHeight || TOUR_HEIGHT_FALLBACK;
				const left = clamp(side === "left" ? rect.right + TOUR_GAP : rect.left - TOUR_GAP - bw, VIEWPORT_PAD, window.innerWidth - bw - VIEWPORT_PAD);
				const top = clamp(rect.top + rect.height / 2 - bh / 2, VIEWPORT_PAD, window.innerHeight - bh - VIEWPORT_PAD);
				setPos({
					left,
					top
				});
			}, [step, side]);
			(0, react.useLayoutEffect)(() => {
				measure();
				window.addEventListener("resize", measure);
				return () => window.removeEventListener("resize", measure);
			}, [
				measure,
				toolbarExpanded,
				settingsOpen
			]);
			(0, react.useEffect)(() => {
				document.querySelectorAll("[data-tour-highlight]").forEach((el) => el.removeAttribute("data-tour-highlight"));
				const anchor = STEP_DEFS[step].anchor();
				if (anchor !== null) anchor.setAttribute("data-tour-highlight", "");
				return () => {
					document.querySelectorAll("[data-tour-highlight]").forEach((el) => el.removeAttribute("data-tour-highlight"));
				};
			}, [
				step,
				toolbarExpanded,
				settingsOpen
			]);
			(0, react.useEffect)(() => {
				if (settingsOpen) return;
				primaryRef.current?.focus();
			}, [step, settingsOpen]);
			const goNext = () => setStep((s) => Math.min(STEP_COUNT.length - 1, s + 1));
			const goPrev = () => setStep((s) => Math.max(0, s - 1));
			if (settingsOpen) return null;
			const isLast = step === STEP_COUNT.length - 1;
			const primaryLabel = step === 0 || isLast ? t("tour.start") : t("tour.next");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: bubbleRef,
				"data-tour-bubble": true,
				"data-tour-step": step,
				role: "dialog",
				"aria-label": t(stepDef.titleKey),
				style: {
					position: "fixed",
					left: pos?.left,
					top: pos?.top,
					width: TOUR_WIDTH,
					maxWidth: "calc(100vw - 24px)",
					boxSizing: "border-box",
					zIndex: TOUR_Z,
					padding: 14,
					background: MODAL_TIP_BG,
					color: MODAL_FG,
					borderRadius: 12,
					border: `1px solid ${MODAL_BORDER}`,
					boxShadow: "0 12px 36px rgba(0, 0, 0, 0.45)"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: TOUR_CSS }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "flex-start",
							justifyContent: "space-between",
							gap: 8
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							"data-tour-title": true,
							style: {
								fontSize: 14,
								fontWeight: 700,
								color: MODAL_FG,
								lineHeight: 1.35
							},
							children: t(stepDef.titleKey)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							"data-tour-skip": true,
							onClick: finish,
							style: {
								flexShrink: 0,
								background: "transparent",
								border: "none",
								padding: "2px 6px",
								borderRadius: 8,
								cursor: "pointer",
								color: MODAL_HINT,
								fontSize: 12,
								lineHeight: 1.4
							},
							children: t("tour.skip")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-tour-desc": true,
						style: {
							marginTop: 6,
							fontSize: 12.5,
							lineHeight: 1.5,
							color: MODAL_TEXT
						},
						children: t(stepDef.descKey)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
						style: {
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: 10,
							marginTop: 12
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-tour-prev": true,
								disabled: step === 0,
								onClick: goPrev,
								style: {
									flexShrink: 0,
									background: "rgba(255, 255, 255, 0.06)",
									border: `1px solid ${MODAL_BORDER}`,
									borderRadius: 8,
									padding: "5px 12px",
									cursor: step === 0 ? "default" : "pointer",
									color: step === 0 ? MODAL_HINT : MODAL_TEXT,
									fontSize: 12,
									lineHeight: 1.4,
									opacity: step === 0 ? .55 : 1
								},
								children: t("tour.prev")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 5,
									minWidth: 74
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									"data-tour-progress": true,
									style: {
										fontSize: 11.5,
										color: MODAL_HINT,
										lineHeight: 1.2
									},
									children: t("tour.step.label", { n: step + 1 })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										display: "flex",
										gap: 4
									},
									children: STEP_COUNT.map((n) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"data-tour-progress-dot": true,
										"data-active": step === n ? "true" : void 0,
										"aria-label": t("tour.step.short", { n: n + 1 }),
										"aria-current": step === n ? "step" : void 0,
										style: {
											width: 14,
											height: 4,
											borderRadius: 2,
											background: step === n ? "var(--ms-accent)" : "rgba(255, 255, 255, 0.18)"
										}
									}, n))
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								ref: primaryRef,
								"data-tour-primary": true,
								onClick: isLast ? finish : goNext,
								style: {
									flexShrink: 0,
									background: "var(--ms-accent-bg)",
									color: "var(--ms-accent-soft)",
									border: "1px solid var(--ms-accent)",
									borderRadius: 8,
									padding: "5px 14px",
									cursor: "pointer",
									fontSize: 12.5,
									fontWeight: 600,
									lineHeight: 1.4
								},
								children: primaryLabel
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/MilestoneRailTooltip.tsx
		/**
		* @param props - the hovered mark + bookmark wiring (see {@link MilestoneRailTooltipProps}).
		*/
		function MilestoneRailTooltip({ hover, bookmarked, onToggleBookmark, onCopy, onFork, copied, forked, turnCollapsed, onToggleCollapse, onMouseEnter, onMouseLeave, panelRight, t }) {
			const relativeTime = relativeTimeParts(hover.mark.time, Date.now());
			const turn = hover.mark.turn;
			const showCollapse = turn !== void 0 && hover.turnMarkCount !== null && hover.turnMarkCount > 1;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				onMouseEnter,
				onMouseLeave,
				style: {
					position: "fixed",
					right: panelRight,
					top: hover.top,
					transform: "translateY(-50%)",
					maxWidth: "min(300px, calc(100vw - 120px))",
					minWidth: 180,
					padding: "8px 12px",
					background: "rgba(20, 24, 32, 0.96)",
					color: "#e6e8ee",
					borderRadius: 8,
					fontSize: "var(--dsw-font-s-14, 14px)",
					lineHeight: 1.5,
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
					boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
					zIndex: 101,
					pointerEvents: "auto"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							flexWrap: "wrap",
							gap: 8,
							color: "#9aa4b8",
							fontSize: 13,
							lineHeight: 1.4,
							marginBottom: 4
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: hover.posLabel }),
							hover.turnLabel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: hover.turnLabel }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-star": true,
								"aria-label": t("bookmark.star"),
								"aria-pressed": bookmarked,
								"data-starred": bookmarked ? "true" : void 0,
								onClick: (e) => {
									e.stopPropagation();
									onToggleBookmark();
								},
								style: {
									marginLeft: "auto",
									width: 22,
									height: 22,
									flexShrink: 0,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "transparent",
									border: "none",
									padding: 0,
									cursor: "pointer",
									color: bookmarked ? "#ffd166" : "#8b96ab"
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									width: "14",
									height: "14",
									viewBox: "0 0 24 24",
									fill: bookmarked ? "currentColor" : "none",
									stroke: "currentColor",
									strokeWidth: "2",
									strokeLinejoin: "round",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" })
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-copy-message": true,
								"data-copied": copied ? "true" : void 0,
								onClick: (e) => {
									e.stopPropagation();
									onCopy(hover.mark);
								},
								style: {
									flexShrink: 0,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "transparent",
									border: "none",
									padding: "3px 8px",
									cursor: "pointer",
									whiteSpace: "nowrap",
									color: copied ? "#7ee2a8" : "#8b96ab"
								},
								children: t("copy.message")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-fork-here": true,
								"data-forked": forked ? "true" : void 0,
								onClick: (e) => {
									e.stopPropagation();
									onFork(hover.mark);
								},
								style: {
									flexShrink: 0,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "transparent",
									border: "none",
									padding: "3px 8px",
									cursor: "pointer",
									whiteSpace: "nowrap",
									color: forked ? "#7ee2a8" : "#8b96ab"
								},
								children: t("fork.here")
							}),
							showCollapse && turn !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"data-toggle-collapse": true,
								"aria-pressed": turnCollapsed,
								"data-collapsed": turnCollapsed ? "true" : void 0,
								onClick: (e) => {
									e.stopPropagation();
									onToggleCollapse(turn);
								},
								style: {
									flexShrink: 0,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "transparent",
									border: "none",
									padding: "3px 8px",
									cursor: "pointer",
									whiteSpace: "nowrap",
									color: turnCollapsed ? "#7ee2a8" : "#8b96ab"
								},
								children: turnCollapsed ? t("expand.turn") : t("collapse.turn")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { color: "#c7cede" },
						children: hover.mark.preview !== "" ? hover.mark.preview : t("no.text")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexWrap: "wrap",
							gap: 8,
							color: "#8b96ab",
							fontSize: 13,
							lineHeight: 1.4,
							marginTop: 4
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(relativeTime.key, { n: relativeTime.n }) }),
							hover.durationLabel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("duration.label", { name: hover.durationLabel }) }),
							hover.reasonLabel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: hover.reasonLabel }),
							hover.ttftLabel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("ttft.label", { name: hover.ttftLabel }) }),
							hover.tpsLabel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: hover.tpsLabel })
						]
					}),
					(hover.modelLabel !== null || hover.purposeLabel !== null || hover.tokensLabel !== null) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexWrap: "wrap",
							gap: 8,
							color: "#8b96ab",
							fontSize: 13,
							lineHeight: 1.4,
							marginTop: 4
						},
						children: [
							hover.modelLabel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"data-model": hover.modelLabel,
								children: hover.modelLabel
							}),
							hover.purposeLabel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"data-purpose": hover.purposeLabel,
								children: hover.purposeLabel
							}),
							hover.tokensLabel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"data-tokens": hover.tokensLabel,
								children: hover.tokensLabel
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/MilestoneSessionSearch.tsx
		/**
		* MilestoneSessionSearch: the cross-session search panel (P3) — the fixed
		* chrome pinned to the rail's top that searches EVERY session's message
		* content through the injected `searchSessions` action (the harness
		* `session.search` RPC), lists ranked hits (display title + snippet), and
		* opens the clicked session via `openSession` (the same selection path the
		* sidebar uses).
		*
		* Owns its search lifecycle — debounce + AbortController + status — unlike
		* the rail's in-session search (RailSearchUi), which is a pure presentation
		* slice of MilestoneRail's own state. Mirrors MilestoneListPanel's
		* fixed-panel styling. Renders one DOM contract
		* (`data-session-search` root / `data-session-search-input` /
		* `data-session-search-result` rows / `data-session-search-error` /
		* `data-session-search-more`).
		*
		* Outside dismissal: while the panel is mounted (it only renders while open),
		* a pointerdown anywhere outside it calls the rail-fed `onClose` (shared
		* useOutsideDismiss hook; the toggle's own click keeps its flip semantics
		* through a `[data-session-search-toggle]` exclusion).
		*/
		/** Debounce window for the cross-session query (ms). */
		const SEARCH_DEBOUNCE_MS = 250;
		/**
		* @param props - the panel anchor, the close/open/search actions, and the locale interpreter.
		*/
		function MilestoneSessionSearch({ panelTop, panelRight, onClose, searchSessions, openSession, t }) {
			const [query, setQuery] = (0, react.useState)("");
			const [status, setStatus] = (0, react.useState)("idle");
			const [hits, setHits] = (0, react.useState)([]);
			const [hasMore, setHasMore] = (0, react.useState)(false);
			const panelRef = (0, react.useRef)(null);
			useOutsideDismiss(panelRef, true, onClose, { exclude: (target) => outsideDismissMatches(target, "[data-session-search-toggle]") });
			(0, react.useEffect)(() => {
				const trimmed = query.trim();
				if (trimmed === "") {
					setStatus("idle");
					return;
				}
				const controller = new AbortController();
				setStatus("loading");
				const timer = window.setTimeout(() => {
					searchSessions(trimmed, controller.signal).then((result) => {
						if (controller.signal.aborted) return;
						setHits(result.items);
						setHasMore(result.hasMore);
						setStatus(result.items.length > 0 ? "results" : "empty");
					}, () => {
						if (controller.signal.aborted) return;
						setStatus("error");
					});
				}, SEARCH_DEBOUNCE_MS);
				return () => {
					window.clearTimeout(timer);
					controller.abort();
				};
			}, [query, searchSessions]);
			const onInputKeyDown = (e) => {
				if (e.key === "Escape") onClose();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: panelRef,
				"data-session-search": true,
				style: {
					position: "fixed",
					top: panelTop,
					right: panelRight,
					width: "min(280px, calc(100vw - 48px))",
					padding: "10px 12px",
					background: "rgba(20, 24, 32, 0.97)",
					color: "#e6e8ee",
					borderRadius: 8,
					boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
					zIndex: 103
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: `[data-session-search-result]:hover { background: rgba(77, 124, 254, 0.18); }` }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 6,
							marginBottom: 6
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 13,
								fontWeight: 600,
								color: "#e6e8ee"
							},
							children: t("search.cross")
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						"data-session-search-input": true,
						"aria-label": t("search.cross"),
						placeholder: t("search.cross"),
						value: query,
						onChange: (e) => setQuery(e.target.value),
						onKeyDown: onInputKeyDown,
						autoFocus: true,
						style: {
							boxSizing: "border-box",
							width: "100%",
							padding: "6px 10px",
							fontSize: 14,
							lineHeight: 1.4,
							color: "#e6e8ee",
							background: "rgba(255, 255, 255, 0.08)",
							border: "1px solid rgba(255, 255, 255, 0.16)",
							borderRadius: 6,
							outline: "none"
						}
					}),
					status === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-session-search-error": true,
						style: {
							marginTop: 8,
							fontSize: 13,
							color: "#f07c7c"
						},
						children: t("search.error")
					}),
					status === "results" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							maxHeight: 300,
							overflowY: "auto",
							display: "flex",
							flexDirection: "column",
							gap: 2,
							marginTop: 8
						},
						children: hits.map((hit) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							"data-session-search-result": true,
							onClick: () => {
								openSession(hit.sessionId);
								onClose();
							},
							title: hit.snippet,
							style: {
								display: "block",
								width: "100%",
								minWidth: 0,
								padding: "6px 8px",
								background: "transparent",
								border: "none",
								borderRadius: 6,
								cursor: "pointer",
								color: "#e6e8ee",
								textAlign: "left"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontSize: 12,
									color: "#9db8ff",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis"
								},
								children: hit.title ?? t("search.untitled")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontSize: 13,
									lineHeight: 1.4,
									color: "#c6ccd8",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap"
								},
								children: hit.snippet
							})]
						}, hit.sessionId))
					}), hasMore && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-session-search-more": true,
						style: {
							marginTop: 6,
							fontSize: 12,
							color: "#8b96ab"
						},
						children: t("search.more")
					})] })
				]
			});
		}
		//#endregion
		//#region src/client/useCurrentAnchor.ts
		/**
		* useCurrentAnchor: tracks which user-message row sits at/just above the
		* conversation scrollport's top, so the rail can light the corresponding dot
		* (F2 current-position highlight).
		*
		* Resolves the harness DOM shape (`[data-conversation-scroll]` containing
		* `[data-chat-anchor-key]` rows), computes each row's offset top within the
		* scrollport, and feeds them to `rail-logic.currentIndexOf(rows, 0)` — the
		* viewport top is 0 in scrollport-relative coordinates.
		*
		* Recomputes on scrollport `scroll` events; when `IntersectionObserver` exists
		* (real browsers) rows are also observed (root = scrollport, threshold 0) so
		* layout changes that move a row across the top without a scroll event still
		* refresh. In jsdom tests the observer stub is a no-op, so the scroll listener
		* is the path component tests drive.
		*
		* Pure observation: no timers, no polling; geometry is read only on events.
		*/
		/**
		* @param order - the ordered chat node keys; a change re-resolves the DOM
		*   rows (new messages appended, load-older prepends, ...).
		* @returns the anchor key of the row at/just above the scrollport top, or
		*   undefined when the scrollport is missing or has no rows.
		*/
		function useCurrentAnchor(order) {
			const [current, setCurrent] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				const scrollport = document.querySelector("[data-conversation-scroll]");
				if (scrollport === null) {
					setCurrent(void 0);
					return;
				}
				const rows = [...scrollport.querySelectorAll("[data-chat-anchor-key]")];
				const compute = () => {
					const viewportTop = scrollport.getBoundingClientRect().top;
					const positioned = rows.map((row) => ({
						key: row.dataset.chatAnchorKey ?? "",
						top: row.getBoundingClientRect().top - viewportTop
					}));
					setCurrent(currentIndexOf(positioned, 0));
				};
				compute();
				scrollport.addEventListener("scroll", compute, { passive: true });
				if (typeof IntersectionObserver !== "undefined") {
					const observer = new IntersectionObserver(compute, {
						root: scrollport,
						threshold: [0]
					});
					for (const row of rows) observer.observe(row);
					return () => {
						observer.disconnect();
						scrollport.removeEventListener("scroll", compute);
					};
				}
				return () => {
					scrollport.removeEventListener("scroll", compute);
				};
			}, [order]);
			return current;
		}
		//#endregion
		//#region src/client/toolbar-prefs.ts
		/**
		* toolbar-prefs: the persistence layer for the milestone rail's toolbar
		* personalization — WHICH function keys stay visible outside the collapse
		* (pinned) plus the settings-module appearance prefs (accent color, icon/dot
		* size, distance from the rail's screen edge, and rail side).
		*
		* Storage contract: one localStorage key (`dsh-milestone.toolbar`) holding a
		* JSON object:
		*
		*   { "pinned": string[], "accent": "#rrggbb", "iconSize": number,
		*     "inset": number, "side": "left" | "right", "locale": "system"|"zh"|"en",
		*     "focus": { "dimThink": boolean, "dimTools": boolean,
		*                "collapseThink": boolean, "opacity": number } }
		*
		* Backward compatibility: the pre-personalization blob `{ "pinned": string[] }`
		* (and an entirely absent value) parses to the DEFAULT prefs with the new
		* fields at their defaults — old users keep their pins untouched. The same
		* rule covers the `focus` object: a blob stored before 0.6.3 (no `focus`
		* field) gains the default focus mix.
		*
		* All reads are sanitized per field:
		*   - `pinned`: whitelisted ids only (`TOOLBAR_PIN_IDS`), duplicates dropped,
		*     first-seen (pin) order preserved;
		*   - `accent`: a canonical `#rrggbb` hex, lowercased; anything else falls
		*     back to the default blue;
		*   - `iconSize` / `inset`: finite numbers snapped to the slider step
		*     (even values) and clamped to the slider range;
		*   - `side`: exactly `'left'` or `'right'`;
		*   - `focus`: three booleans (`dimThink` / `dimTools` / `collapseThink`)
		*     defaulting to `true` / `false` / `false`, plus the dim `opacity`
		*     snapped to the 0.1 step and clamped to [0.2, 0.8].
		*
		* The whitelist lives HERE (not in MilestoneRail) so the pure functions stay
		* dependency-free and unit-testable; MilestoneRail's feature registry keys
		* itself against the same `ToolbarPinId` type, so id drift is a compile error.
		*/
		/** The single localStorage key holding the toolbar preference blob. */
		const TOOLBAR_PREFS_KEY = "dsh-milestone.toolbar";
		/**
		* Canonical function-key ids that may be pinned outside the collapse, in
		* render order. `settings` is a REGULAR feature since the B-design move: the
		* gear left the always-visible chrome and now sits at the end of the expanded
		* feature queue (default unpinned). Adding a feature here (plus its registry
		* entry in MilestoneRail) is the whole "pin it" extension point.
		*/
		const TOOLBAR_PIN_IDS = [
			"search",
			"list",
			"sessionSearch",
			"bookmarks",
			"focus",
			"updateCheck",
			"settings"
		];
		/** The default accent (the classic milestone blue). */
		const DEFAULT_ACCENT = "#4d7cfd";
		/** Slider domain for the focus dim strength (0.2 = 20% .. 0.8 = 80%). */
		const FOCUS_OPACITY_MIN = .2;
		const FOCUS_OPACITY_MAX = .8;
		/** The canonical default focus mix (dim think at 40%; tools/collapse off). */
		const DEFAULT_FOCUS_PREFS = {
			dimThink: true,
			dimTools: false,
			collapseThink: false,
			opacity: .4
		};
		/** The canonical default prefs ("恢复默认" target; also the read fallback). */
		const DEFAULT_PREFS = {
			pinned: [],
			accent: DEFAULT_ACCENT,
			iconSize: 28,
			inset: 14,
			side: "right",
			locale: "system",
			focus: { ...DEFAULT_FOCUS_PREFS }
		};
		/** Type guard for registry ids — unknown strings never survive a parse. */
		function isToolbarPinId(id) {
			return TOOLBAR_PIN_IDS.includes(id);
		}
		/** Whitelist + dedupe + first-seen-order sanitizer for the pinned list. */
		function sanitizePinned(raw) {
			if (!Array.isArray(raw)) return [];
			const seen = /* @__PURE__ */ new Set();
			const result = [];
			for (const id of raw) {
				if (typeof id !== "string" || !isToolbarPinId(id) || seen.has(id)) continue;
				seen.add(id);
				result.push(id);
			}
			return result;
		}
		/**
		* Snap a finite number to the nearest `step` inside [min, max]; any non-finite
		* or non-number input falls back to `fallback`. Used for both sliders so a
		* hand-edited blob (e.g. `iconSize: 21`) converges on a legal slider value.
		*/
		function clampStep(value, min, max, step, fallback) {
			if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
			const snapped = Math.round(Math.min(max, Math.max(min, value)) / step) * step;
			return Math.min(max, Math.max(min, snapped));
		}
		/** Boolean sanitizer for the focus mix flags: only `true`/`false` survive. */
		function sanitizeBoolean(value, fallback) {
			return typeof value === "boolean" ? value : fallback;
		}
		/**
		* Focus-mix sanitizer: `dimTools`/`collapseThink` default off, `dimThink`
		* defaults ON (the classic pre-0.6.3 behavior), and `opacity` snaps to the
		* 0.1 step inside [0.2, 0.8]. Snapping works in tenths (step × 10 = integer)
		* instead of a raw division so hand-edited floats like `0.30000000000000004`
		* always converge on exactly `0.3`.
		*/
		function sanitizeFocus(raw) {
			if (typeof raw !== "object" || raw === null) return { ...DEFAULT_FOCUS_PREFS };
			const { dimThink, dimTools, collapseThink, opacity } = raw;
			const clamped = typeof opacity === "number" && Number.isFinite(opacity) ? Math.min(FOCUS_OPACITY_MAX, Math.max(FOCUS_OPACITY_MIN, opacity)) : DEFAULT_FOCUS_PREFS.opacity;
			const tenths = Math.round(clamped * 10);
			const snapped = Math.min(FOCUS_OPACITY_MAX, Math.max(FOCUS_OPACITY_MIN, tenths / 10));
			return {
				dimThink: sanitizeBoolean(dimThink, DEFAULT_FOCUS_PREFS.dimThink),
				dimTools: sanitizeBoolean(dimTools, DEFAULT_FOCUS_PREFS.dimTools),
				collapseThink: sanitizeBoolean(collapseThink, DEFAULT_FOCUS_PREFS.collapseThink),
				opacity: snapped
			};
		}
		/**
		* Parse + sanitize the raw persisted blob: `null` (nothing stored), invalid
		* JSON, or a non-object shape all degrade to the DEFAULT prefs. Each field is
		* sanitized independently, so a half-corrupt blob keeps its valid parts
		* (e.g. an old `{pinned}`-only blob gains the default accent/size/inset/side
		* AND the default focus mix).
		*/
		function parsePrefs(raw) {
			if (raw === null) return { ...DEFAULT_PREFS };
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return { ...DEFAULT_PREFS };
			}
			if (typeof parsed !== "object" || parsed === null) return { ...DEFAULT_PREFS };
			const { pinned, accent, iconSize, inset, side, locale, focus } = parsed;
			return {
				pinned: sanitizePinned(pinned),
				accent: typeof accent === "string" && isHexColor(accent) ? accent.toLowerCase() : DEFAULT_PREFS.accent,
				iconSize: clampStep(iconSize, 20, 36, 2, DEFAULT_PREFS.iconSize),
				inset: clampStep(inset, 0, 40, 2, DEFAULT_PREFS.inset),
				side: side === "left" || side === "right" ? side : DEFAULT_PREFS.side,
				locale: locale === "zh" || locale === "en" || locale === "system" ? locale : DEFAULT_PREFS.locale,
				focus: sanitizeFocus(focus)
			};
		}
		/**
		* Read + sanitize the persisted toolbar prefs from localStorage. Degrades to
		* the DEFAULT prefs when storage is unavailable (SSR, sandboxed iframe) —
		* personalization is a best-effort enhancement, never a render blocker.
		*/
		function loadPrefs() {
			try {
				return parsePrefs(localStorage.getItem(TOOLBAR_PREFS_KEY));
			} catch {
				return { ...DEFAULT_PREFS };
			}
		}
		/**
		* Persist the full prefs (sanitized on the way out so a corrupt in-memory
		* value is never written). Swallows storage failures for the same best-effort
		* reason as {@link loadPrefs}.
		*/
		function savePrefs(prefs) {
			const cleaned = parsePrefs(JSON.stringify(prefs));
			try {
				localStorage.setItem(TOOLBAR_PREFS_KEY, JSON.stringify(cleaned));
			} catch {}
		}
		/**
		* Pure toggle: adds `id` to the pinned set when absent, removes it when
		* present. Unknown ids are ignored (prefs returned unchanged) and the pinned
		* set is always deduped via the sanitizer, so callers can feed the result
		* straight back into {@link savePrefs}.
		*/
		function togglePin(prefs, id) {
			if (!isToolbarPinId(id)) return { ...prefs };
			const next = new Set(prefs.pinned);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return {
				...prefs,
				pinned: sanitizePinned([...next])
			};
		}
		//#endregion
		//#region src/client/version-logic.ts
		/**
		* Pure update-check logic for dsh-milestone, deliberately free of React, the
		* harness runtime, and any node-only API so it runs identically in the browser
		* bundle, vitest (jsdom), and future shells.
		*
		* Design intent:
		* - `compareVersions` / `needsUpdate` are pure, side-effect-free functions that
		*   follow npm semver precedence for the shapes this plugin actually publishes
		*   (`x.y.z` plus optional `-rc.N` / `-beta.N` prereleases). Anything else is
		*   an explicit error rather than a silent mis-comparison.
		* - `fetchLatestVersion` is the only I/O: it reads the `latest` dist-tag from
		*   npmmirror's cheap dist-tags endpoint first (it CORS-echoes this page's
		*   Origin), then falls back to the full npm packument (ACAO: *). Every
		*   request carries an internal 8s timeout combined with the caller's signal —
		*   whichever aborts first wins — and every failure degrades to a structured
		*   `{ ok: false }` result, never a throw.
		* - `SUPPORTED_HOST_LINES` is a SELF-DECLARED compatibility list, not a probe:
		*   the harness reports no trustworthy host version in the browser
		*   (`host.describe().version` is a stub), so the plugin declares which npm
		*   `latest` host-version lines it supports and the UI renders that as-is.
		*/
		/** Host-version lines this plugin declares support for (npm official latest
		* line; bump it as the peer/dependency ranges move). */
		const SUPPORTED_HOST_LINES = ["0.1.1-rc.2"];
		/** Internal per-request timeout for the network attempts. */
		const REQUEST_TIMEOUT_MS = 8e3;
		/** npmmirror dist-tags endpoint: lean JSON (`{"latest":"0.6.0", ...}`),
		* echoes this page's Origin in `Access-Control-Allow-Origin`. */
		const NPMIRROR_DIST_TAGS_URL = "https://registry.npmmirror.com/-/package/dsh-milestone/dist-tags";
		/** npm full packument; `dist-tags.latest` sits at the JSON root, and the
		* endpoint sends `Access-Control-Allow-Origin: *`. */
		const NPM_PACKUMENT_URL = "https://registry.npmjs.org/dsh-milestone";
		/** Numeric identifier test shared by core and prerelease segments. */
		const NUMERIC_RE = /^\d+$/;
		/**
		* Parse a version string into comparable parts.
		* Accepts `major[.minor[.patch]][-prerelease][+build]`; missing core segments
		* pad with 0 and `+build` metadata is ignored (per semver precedence).
		* @throws {Error} with the offending input when the shape is not parseable.
		*/
		function parseVersion(input) {
			if (typeof input !== "string" || input.trim() === "") throw new Error(`Invalid semantic version: ${JSON.stringify(input)} (expected "x.y.z" with optional "-pre" suffix)`);
			const s = input.trim();
			const plus = s.indexOf("+");
			const withoutBuild = plus === -1 ? s : s.slice(0, plus);
			const dash = withoutBuild.indexOf("-");
			const corePart = dash === -1 ? withoutBuild : withoutBuild.slice(0, dash);
			const prePart = dash === -1 ? void 0 : withoutBuild.slice(dash + 1);
			const segments = corePart.split(".");
			if (segments.length < 1 || segments.length > 3 || !segments.every((seg) => NUMERIC_RE.test(seg))) throw new Error(`Invalid semantic version: ${JSON.stringify(input)} (expected "x.y.z" with optional "-pre" suffix)`);
			const core = segments.map(Number);
			let pre = [];
			if (prePart !== void 0) {
				if (prePart === "" || !prePart.split(".").every((id) => /^[0-9A-Za-z-]+$/.test(id))) throw new Error(`Invalid semantic version: ${JSON.stringify(input)} (bad prerelease suffix)`);
				pre = prePart.split(".");
			}
			return {
				core,
				pre
			};
		}
		/**
		* Compare two version strings per npm semver precedence.
		* @param a - first version (`x.y.z` with optional `-pre` suffix; build
		* metadata ignored; missing core segments pad with 0).
		* @param b - second version, same grammar.
		* @returns -1 when `a < b`, 0 when equal, 1 when `a > b`. Prereleases sort
		* below their same-number release; prerelease identifiers compare numerically
		* when both are numeric, lexically when both are alphanumeric, and numeric
		* identifiers always sort before alphanumeric ones.
		* @throws {Error} for inputs that do not match the grammar.
		*/
		function compareVersions(a, b) {
			const pa = parseVersion(a);
			const pb = parseVersion(b);
			for (let i = 0; i < 3; i++) {
				const x = pa.core[i] ?? 0;
				const y = pb.core[i] ?? 0;
				if (x < y) return -1;
				if (x > y) return 1;
			}
			if (pa.pre.length === 0 && pb.pre.length === 0) return 0;
			if (pa.pre.length === 0) return 1;
			if (pb.pre.length === 0) return -1;
			const len = Math.max(pa.pre.length, pb.pre.length);
			for (let i = 0; i < len; i++) {
				const x = pa.pre[i];
				const y = pb.pre[i];
				if (x === void 0) return -1;
				if (y === void 0) return 1;
				const xNum = NUMERIC_RE.test(x);
				const yNum = NUMERIC_RE.test(y);
				if (xNum && yNum) {
					if (x !== y) return Number(x) < Number(y) ? -1 : 1;
				} else if (xNum) return -1;
				else if (yNum) return 1;
				else if (x !== y) return x < y ? -1 : 1;
			}
			return 0;
		}
		/**
		* Whether the installed plugin should offer an update.
		* @param current - installed version.
		* @param latest - newest published version.
		* @returns true only when `latest` is strictly greater than `current`
		* (identical versions, or a newer installed version, return false).
		* @throws {Error} when either input is not a parseable version.
		*/
		function needsUpdate(current, latest) {
			return compareVersions(current, latest) < 0;
		}
		/**
		* Build a request signal: a fresh AbortController aborted by EITHER the
		* caller's external signal (which wins when it fires first) OR an internal
		* timeout. Uses `AbortSignal.timeout` when the environment provides it and
		* falls back to a manual `setTimeout` + abort otherwise (jsdom older
		* versions expose no `AbortSignal.timeout`).
		* @param external - caller signal; when already aborted the request fires
		* immediately with an aborted signal.
		* @param timeoutMs - internal timeout in ms.
		* @returns the combined signal plus a cleanup that detaches all listeners
		* (must be called so no listener outlives the request).
		*/
		function createRequestSignal(external, timeoutMs) {
			const controller = new AbortController();
			const abort = () => controller.abort();
			const detach = [];
			if (external) if (external.aborted) controller.abort();
			else {
				external.addEventListener("abort", abort, { once: true });
				detach.push(() => external.removeEventListener("abort", abort));
			}
			if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
				const t = AbortSignal.timeout(timeoutMs);
				t.addEventListener("abort", abort, { once: true });
				detach.push(() => t.removeEventListener("abort", abort));
			} else {
				const timer = setTimeout(abort, timeoutMs);
				detach.push(() => clearTimeout(timer));
			}
			return {
				signal: controller.signal,
				cleanup: () => {
					for (const fn of detach) fn();
					detach.length = 0;
				}
			};
		}
		/** Extract `latest` from the npmmirror dist-tags JSON root. */
		function extractFromDistTags(data) {
			if (data === null || typeof data !== "object") return null;
			const latest = data.latest;
			return typeof latest === "string" && latest.length > 0 ? latest : null;
		}
		/** Extract `latest` from the npm packument's root `dist-tags` object. */
		function extractFromPackument(data) {
			if (data === null || typeof data !== "object") return null;
			const distTags = data["dist-tags"];
			if (distTags === null || typeof distTags !== "object") return null;
			const latest = distTags.latest;
			return typeof latest === "string" && latest.length > 0 ? latest : null;
		}
		/** Human-readable failure detail for one endpoint attempt. */
		function describeError(source, cause) {
			const name = cause instanceof Error ? cause.name : "";
			const message = cause instanceof Error ? cause.message : String(cause);
			if (name === "AbortError") return `${source}: aborted (${message})`;
			return `${source}: ${message}`;
		}
		/**
		* One attempt at fetching the `latest` dist-tag from an endpoint.
		* @returns ok with the tag, or ok:false with a per-source error description.
		*/
		async function tryFetchLatest(url, extract, source, external) {
			try {
				const { signal, cleanup } = createRequestSignal(external, REQUEST_TIMEOUT_MS);
				try {
					const res = await fetch(url, { signal });
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const latest = extract(await res.json());
					if (latest === null) throw new Error("unexpected response shape (no \"latest\" dist-tag)");
					return {
						ok: true,
						latest,
						source
					};
				} finally {
					cleanup();
				}
			} catch (cause) {
				return {
					ok: false,
					error: describeError(source, cause)
				};
			}
		}
		/**
		* Query npm for the newest published version of `dsh-milestone`.
		*
		* Strategy: npmmirror's dist-tags endpoint first (lightweight and CORS-open
		* to this Origin); if that fails or its shape is wrong, the full npm
		* packument fallback (`dist-tags.latest` at the JSON root). Each request
		* aborts after 8s via `AbortSignal.timeout` (manual timer fallback when the
		* environment lacks it) OR immediately when the passed-in signal aborts.
		* @param signal - optional caller abort signal; aborts the in-flight attempt
		* with priority over the internal timeout.
		* @returns the latest version and which registry answered, or a structured
		* error when both endpoints fail. Never throws.
		*/
		async function fetchLatestVersion(signal) {
			const viaMirror = await tryFetchLatest(NPMIRROR_DIST_TAGS_URL, extractFromDistTags, "npmmirror", signal);
			if (viaMirror.ok) return viaMirror;
			const viaNpm = await tryFetchLatest(NPM_PACKUMENT_URL, extractFromPackument, "npm", signal);
			if (viaNpm.ok) return viaNpm;
			return {
				ok: false,
				error: `${viaMirror.error}; ${viaNpm.error}`
			};
		}
		/** localStorage key holding the last successful update check. */
		const UPDATE_CACHE_KEY = "dsh-milestone.update-cache";
		/**
		* Pure parse + freshness check of a stored blob: `null` for `null`/invalid
		* JSON, a wrong shape, or an entry older than {@link UPDATE_CACHE_TTL_MS}.
		* A `checkedAt` in the future (clock skew) is treated as fresh — it decays
		* naturally once wall time catches up. Never throws.
		* @param raw - the raw `localStorage` value (or null when absent).
		* @param now - wall-clock epoch ms to judge freshness against (injectable for
		* tests; defaults to `Date.now()`).
		*/
		function parseUpdateCache(raw, now = Date.now()) {
			if (raw === null) return null;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return null;
			}
			if (typeof parsed !== "object" || parsed === null) return null;
			const { latest, source, checkedAt } = parsed;
			if (typeof latest !== "string" || latest === "") return null;
			if (source !== "npmmirror" && source !== "npm") return null;
			if (typeof checkedAt !== "number" || !Number.isFinite(checkedAt)) return null;
			if (now - checkedAt >= 216e5) return null;
			return {
				latest,
				source,
				checkedAt
			};
		}
		/**
		* Read + parse the persisted cache entry from localStorage. Any storage
		* failure degrades to `null` (cache miss) — the update check is best-effort.
		* @param now - wall-clock epoch ms for freshness (see {@link parseUpdateCache}).
		*/
		function readUpdateCache(now = Date.now()) {
			try {
				return parseUpdateCache(localStorage.getItem(UPDATE_CACHE_KEY), now);
			} catch {
				return null;
			}
		}
		/**
		* Persist a successful check result (the caller supplies `checkedAt`, usually
		* `Date.now()`). Silently ignores storage failures — the cache is an
		* optimization, never a hard dependency.
		*/
		function writeUpdateCache(entry) {
			try {
				localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(entry));
			} catch {}
		}
		/**
		* The cache-aware entry point for the UI: reuse an unexpired cached result
		* when one exists, otherwise query npm (npmmirror → packument fallback) and
		* persist a successful result for the next {@link UPDATE_CACHE_TTL_MS}.
		* Never throws; failures return the same structured `{ ok: false }` result as
		* {@link fetchLatestVersion}.
		* @param signal - optional caller abort signal, forwarded to the network
		* attempt only (a cache hit needs no signal).
		*/
		async function loadCachedLatest(signal) {
			const cached = readUpdateCache();
			if (cached !== null) return {
				ok: true,
				latest: cached.latest,
				source: cached.source
			};
			const fresh = await fetchLatestVersion(signal);
			if (fresh.ok) writeUpdateCache({
				latest: fresh.latest,
				source: fresh.source,
				checkedAt: Date.now()
			});
			return fresh;
		}
		//#endregion
		//#region src/client/version-meta.ts
		/**
		* Installed plugin version. Injected at build time as
		* `__DSH_MILESTONE_VERSION__`; falls back to `0.0.0-dev` when unbuilt.
		*/
		const PLUGIN_VERSION = "0.6.6";
		//#endregion
		//#region src/client/MilestoneRail.tsx
		/**
		* MilestoneRail: the milestone.rail entry (session scope). Renders a fixed
		* side vertical scrubber as a **fixed-pitch dot list** (like a git commit
		* graph), NOT a minimap: one dot per user message, equal spacing regardless of
		* conversation length. The list itself scrolls with the wheel when it outgrows
		* the viewport; hovering a dot shows rich metadata (time, turn, duration, end
		* reason, TTFT, tokens/sec) and clicking jumps the chat to that message.
		*
		* Data sources (all from the session-scoped `useSession` snapshot):
		*   - chat.order + chat.nodes.get(key)  -> user-message nodes (key/id/location)
		*   - chat.timeline.turns.get(turn)     -> turn start/end time, status, reason,
		*                                          and the ui-conversation 'turn-tail'
		*                                          location data (ttftMs/tokensPerSecond)
		*
		* Positioning: the rail hugs the conversation scrollport's chosen screen edge
		* (settings 位置: left or right), offset a little inward so it clears the
		* native scrollbar and sits near the prose.
		*
		* In-rail search (F1): a magnifier toggle at the rail top opens a compact
		* panel on the rail's free side with a message-text search input; matches
		* light up the dots (non-matches dim), Enter cycles the active match
		* (wrapping) and jumps to it, Escape clears and closes. Matching runs over the
		* FULL message text (`text` from rail-logic.extractText), not the truncated
		* hover preview.
		*
		* Current-position highlight (F2): the dot for the user message at/just above
		* the conversation viewport top carries a white ring (`useCurrentAnchor`
		* observes the scrollport, no polling).
		*
		* Load-older + window coverage (F3): when the session still has earlier pages
		* (`hasMore`) a slim `···` button sits at the rail top and triggers the
		* injected `loadOlder` action (disabled + `data-loading-older` while
		* `loadingOlder`), and a compact hint on the rail's free side states how many
		* messages the current window covers.
		*
		* Settings (B-design): the gear is a REGULAR toolbar feature ("settings",
		* registry last, default unpinned) — the collapsed rail shows only the expand
		* arrow plus the user's pinned keys, and expanding reveals the gear at the end
		* of the queue. The gear opens a CENTERED modal dialog (function-key pins /
		* hover descriptions, the personalization controls, and the support-us card
		* grid); everything the modal changes persists under `dsh-milestone.toolbar`.
		*/
		/**
		* Settings modal shared palette + geometry — ONE source in modal-tokens.ts,
		* also consumed by the 0.6.4 onboarding tutorial modal so the two dialogs
		* cannot drift. Dark panel on a dark host, three text tiers (primary /
		* section title / hint + muted), one border tone, a 12px panel / 8px control
		* radius scale and a 4-unit spacing scale (4 / 8 / 12 / 16 / 20).
		*/
		/** Minimum user messages before the rail adds value. */
		const MIN_MARKS = 2;
		const PREVIEW_LENGTH = 80;
		/** Stable no-bookmarks fallback for render paths without the store seat. */
		const NO_BOOKMARKS = [];
		/** Stable no-kinds fallback for marks whose turn carries no badge nodes. */
		const NO_KINDS = [];
		/** Visual dot diameter at the default icon size (px). */
		const DOT_SIZE = 14;
		/** Hit area per dot at the default icon size (px) — larger than the dot. */
		const DOT_HIT = 28;
		/** Vertical gap between dot hit areas at the default icon size (px). */
		const DOT_GAP = 14;
		/**
		* Extra top margin a new turn group's FIRST dot gets (replaces the old
		* `data-turn-separator` line): same-group pitch stays DOT_GAP, a group
		* boundary opens another GROUP_GAP_EXTRA px (14 → 18 at default size),
		* expressed purely as spacing — no line element.
		*/
		const GROUP_GAP_EXTRA = 4;
		/**
		* Preset accent swatches for the settings 强调色 row (default blue first).
		* The custom color input accepts any #rrggbb.
		*/
		const ACCENT_PRESETS = [
			"#4d7cfd",
			"#22c55e",
			"#f59e0b",
			"#ef4444",
			"#a855f7",
			"#06b6d4",
			"#ec4899",
			"#f97316"
		];
		/** Known floating-panel widths (px) used to anchor side=left panels to the
		* rail's free (right) side — the panel components take a viewport `right`
		* offset, so a left rail must back-calculate it from the panel width. */
		const PANEL_WIDTH_SEARCH = 220;
		const PANEL_WIDTH_STANDARD = 280;
		/** Tooltip anchor width: its maxWidth cap, so a tooltip never overlaps the rail. */
		const TOOLTIP_ANCHOR_WIDTH = 300;
		/**
		* P3 focus mode (0.6.3: user-tuned "聚焦搭配"): when the eye toggle is armed,
		* an inline <style> (zero-asset, same pattern as the original FOCUS_CSS)
		* dims/collapses the harness content classes the USER opted into, at the
		* strength the user picked. Which content to dim and whether to additionally
		* collapse think is a persisted `prefs.focus` mix; the master on/off switch
		* stays the toolbar eye button.
		*
		* STABLE SELECTORS — researched against the rc.2 official build products:
		*
		*  - think: `dsh-client-ui-conversation` renders every assistant reasoning
		*    disclosure as a root `div[data-variant="think"][data-state="running|ok"]`
		*    (ReasoningRow). The reasoning body lives INSIDE that root — the
		*    DisclosureRow's children — so the root is a single clampable container:
		*    CSS `max-height` + `overflow: hidden` collapses exactly the body while
		*    the header row ("Think · summary") stays visible. → collapseThink is
		*    feasible with pure CSS (no JS, no harness-internal interaction).
		*
		*  - tool calls: `dsh-client-ui-tool` wraps EVERY atomic call (all ToolRow
		*    presentation variants AND the bash-sample row) in
		*    `div[data-chat-call-id]` (with `data-chat-anchor-key="call:<callId>"`);
		*    no other card type in the harness uses that attribute (verified across
		*    the whole @deepseek-ai install). → `[data-chat-call-id]` is the stable,
		*    variant-independent tool-call-card selector.
		*
		* Hover/open restore mirrors the classic rule: `:hover` restores, and the
		* DisclosureRow inside the collapsed target sets `[data-open]` when the user
		* opens it (the DESCENDANT form `target [data-open]` is required — same as
		* pre-0.6.3). The collapse strip releases on hover AND on `[data-open]` so
		* an opened think disclosure never stays crushed.
		*/
		const FOCUS_SELECTOR_THINK = "[data-variant=\"think\"]";
		const FOCUS_SELECTOR_TOOL = "[data-chat-call-id]";
		/** Restored height when hovering/opening a collapsed think disclosure. */
		const FOCUS_THINK_MAX_HEIGHT = "78vh";
		/**
		* Compose the focus-mode stylesheet from the persisted focus mix. Pure —
		* exported so unit tests can pin the exact rule text. `''` when no option is
		* armed (the master switch simply injects nothing).
		*/
		function buildFocusCss(focus) {
			const { dimThink, dimTools, collapseThink } = focus;
			const strength = focus.opacity.toFixed(1);
			const rules = [];
			if (dimThink || collapseThink) {
				const decls = [];
				if (dimThink) decls.push(`opacity: ${strength}`);
				if (collapseThink) decls.push(`max-height: 36px`, "overflow: hidden");
				rules.push(`${FOCUS_SELECTOR_THINK} { ${decls.join("; ")}; transition: opacity 0.2s${collapseThink ? ", max-height 0.2s" : ""}; }`);
				rules.push(`${FOCUS_SELECTOR_THINK}:hover, ${FOCUS_SELECTOR_THINK} [data-open] { opacity: 1;${collapseThink ? ` max-height: ${FOCUS_THINK_MAX_HEIGHT};` : ""} }`);
			}
			if (dimTools) {
				rules.push(`${FOCUS_SELECTOR_TOOL} { opacity: ${strength}; transition: opacity 0.2s; }`);
				rules.push(`${FOCUS_SELECTOR_TOOL}:hover, ${FOCUS_SELECTOR_TOOL} [data-open] { opacity: 1; }`);
			}
			return rules.join("\n");
		}
		/** Near-row description tip: how far its right edge sits from the row's right
		* edge — clears the 32px switch + its 10px padding. */
		const MODAL_TIP_RIGHT = 54;
		/**
		* Static settings-modal styling that needs `:hover`/`:focus-visible` (which
		* inline styles cannot express): the support-us card grid (micro-lift +
		* accent highlight), the pin-row / personal-header hover washes, one accent
		* focus ring for every modal control, the near-row tip's little arrow, the
		* personalization body's reveal, and a themed thin scrollbar. Accent values
		* come from the rail root's CSS variables (`--ms-accent*`), so one block
		* serves every accent. Inline styles keep these elements background-free
		* (except where noted) so the `:hover` washes below actually win. The
		* search-toggle recolor rule makes the EXTERNAL RailSearchUi chrome follow
		* the accent too (that file is owned by an earlier phase and cannot change);
		* `!important` is required because that toggle's own inline styles win
		* otherwise.
		*/
		const MODAL_CSS = `
[data-support-card] {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 10px 12px; border-radius: 8px;
  background: rgba(255, 255, 255, 0.05); border: 1px solid ${MODAL_BORDER};
  color: #c7cede; text-decoration: none; font-size: 12.5px; line-height: 1.4;
  transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
}
[data-support-card]:hover { transform: translateY(-2px); border-color: var(--ms-accent); background: rgba(255, 255, 255, 0.09); }
/* Row and header washes (the inline styles deliberately leave backgrounds
   unset so these rules win over the default padding-box background). */
[data-toolbar-pin-toggle]:hover, [data-toolbar-pin-toggle]:focus-visible { background: rgba(255, 255, 255, 0.06); }
[data-personal-toggle]:hover, [data-focus-toggle-settings]:hover { background: rgba(255, 255, 255, 0.05); }
[data-focus-option]:hover { background: rgba(255, 255, 255, 0.04); }
[data-toolbar-settings-close]:hover { background: rgba(255, 255, 255, 0.08); }
[data-toolbar-settings-reset], [data-onboarding-reopen] { background: rgba(255, 255, 255, 0.06); }
[data-toolbar-settings-reset]:hover, [data-onboarding-reopen]:hover { background: rgba(255, 255, 255, 0.1); }
/* BASE state reset: every modal surface must sit transparent on the dark
   panel — without it the UA default button face (light gray) floods through
   and rows become unreadable light-on-light. Hover washes above take over
   on interaction. */
[data-toolbar-pin-toggle], [data-personal-toggle], [data-focus-toggle-settings],
[data-toolbar-settings-close], [data-focus-option] {
  background: transparent;
}
/* ONE accent ring for keyboard focus on every modal control. */
[data-toolbar-pin-toggle]:focus-visible, [data-personal-toggle]:focus-visible,
[data-focus-toggle-settings]:focus-visible,
[data-toolbar-settings-close]:focus-visible, [data-toolbar-settings-reset]:focus-visible,
[data-onboarding-reopen]:focus-visible {
  box-shadow: 0 0 0 2px var(--ms-accent-soft);
}
/* Near-row description tip: a rotated square peeks out of the LEFT edge so
   the apex points back at the row's label. */
[data-settings-tip]::before {
  content: ''; position: absolute; left: -3px; top: 50%;
  width: 7px; height: 7px; transform: translateY(-50%) rotate(45deg);
  background: ${MODAL_TIP_BG};
  border-left: 1px solid ${MODAL_BORDER};
  border-bottom: 1px solid ${MODAL_BORDER};
}
/* Tip + chevron motion lives here (not inline) so reduced-motion can kill it. */
[data-settings-tip] { transition: opacity 140ms ease, transform 140ms ease, visibility 140ms; }
[data-personal-toggle] svg, [data-focus-toggle-settings] svg { transition: transform 150ms ease; }
/* One authored reveal: the personalization/focus bodies fade in on expand. */
@keyframes ms-settings-fade { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: none; } }
[data-settings-personal-body], [data-settings-focus-body] { animation: ms-settings-fade 140ms ease; }
/* Thin themed scrollbar for the scrollable modal panel. */
[data-toolbar-settings-panel]::-webkit-scrollbar { width: 10px; }
[data-toolbar-settings-panel]::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.16); border-radius: 6px; border: 3px solid transparent; background-clip: padding-box;
}
[data-toolbar-settings-panel]::-webkit-scrollbar-track { background: transparent; }
@media (prefers-reduced-motion: reduce) {
  [data-settings-tip], [data-personal-toggle] svg, [data-focus-toggle-settings] svg, [data-support-card] { transition: none; }
  [data-settings-personal-body], [data-settings-focus-body] { animation: none; }
}
[data-search-toggle] { color: #8b96ab !important; }
[data-search-toggle][aria-pressed="true"] { background: var(--ms-accent-bg) !important; color: var(--ms-accent-soft) !important; }
`;
		/**
		* Shared collapsible-section chrome (personalization + focus blocks): the
		* header button (chevron + title + live summary) and the summary text span.
		* One source so the two settings blocks cannot drift.
		*/
		const SECTION_TOGGLE_STYLE = {
			display: "flex",
			alignItems: "center",
			gap: 8,
			width: "100%",
			padding: "8px 10px",
			border: "none",
			borderRadius: 8,
			cursor: "pointer",
			color: MODAL_TITLE,
			fontSize: 13,
			fontWeight: 600,
			textAlign: "left"
		};
		const SECTION_SUMMARY_STYLE = {
			flex: 1,
			minWidth: 0,
			textAlign: "right",
			fontWeight: 400,
			fontSize: 12,
			color: MODAL_HINT,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		};
		/**
		* P3 deep links (`#msg=<anchor-key>`): initial delay before the first
		* deep-link attempt — the harness scrolls the conversation to the bottom on
		* load, so the deep link must land AFTER the view mounts.
		*/
		const DEEP_LINK_INITIAL_DELAY = 100;
		/** P3: interval between DOM-row polls while waiting for the target to render. */
		const DEEP_LINK_POLL_DELAY = 150;
		/** P3: polls before falling back to a single `loadOlder` fetch. */
		const DEEP_LINK_MAX_POLLS = 5;
		/** P3: bounded polls after `loadOlder`, then the deep link gives up silently. */
		const DEEP_LINK_MAX_RETRY_POLLS = 5;
		/** B4 update-check: mount-time silent check delay (ms) — give the harness
		* time to settle before hitting the registry. */
		const UPDATE_CHECK_MOUNT_DELAY = 1500;
		/** 0.6.5 first-run coach tour: mount-time show delay (ms) — let the rail settle
		* before the first bubble pops. */
		const ONBOARDING_MOUNT_DELAY = 800;
		/** Initial state: no check has completed yet, nothing to show. */
		const NO_UPDATE_CHECK = {
			phase: "idle",
			latest: null,
			source: null,
			error: null,
			available: false
		};
		/**
		* B4 display label for one supported host line: strips the fixed
		* `x.y.z` prefix and appends "line" — `0.1.1-rc.2` → `rc.2 line`,
		* `0.1.1` → `0.1.1 line`. Pure presentation metadata.
		*/
		function hostLineLabel(line) {
			const suffix = line.replace(/^\d+\.\d+\.\d+-?/, "");
			return suffix === "" ? `${line} line` : `${suffix} line`;
		}
		/**
		* Find a chat row by its node key, avoiding CSS.escape pitfalls on keys that
		* contain `<`/`>`/`:` (the node key is `13:input-message<messageId>`).
		*/
		function findRow(key) {
			for (const row of document.querySelectorAll("[data-chat-anchor-key]")) if (row.dataset.chatAnchorKey === key) return row;
			return null;
		}
		/** Extract a plain-text hover preview (first 80 chars) from a ContentBlock[]. */
		function extractPreview(content) {
			return extractText(content).slice(0, PREVIEW_LENGTH);
		}
		/** Compact duration label (ms). */
		function formatDuration(ms) {
			if (ms < 1e3) return `${ms}ms`;
			if (ms < 6e4) return `${(ms / 1e3).toFixed(1)}s`;
			return `${Math.floor(ms / 6e4)}m${Math.floor(ms % 6e4 / 1e3)}s`;
		}
		/** Read the ui-conversation 'turn-tail' location data (ttftMs/tokensPerSecond). */
		function turnTailOf(turn) {
			const data = turn.data;
			if (data?.get === void 0) return void 0;
			return data.get("turn-tail");
		}
		/**
		* @param props - session standard kit (useSession, sessionId, useProjection),
		* the injected loadOlder/forkAt actions, the bookmarks store pair (useStore +
		* actions, injected by the framework from the declared store seat), and the
		* framework-synthesized `t` locale interpreter (registered via the entry's
		* `locale: 'dsh-milestone'`; defaults to a key-pass fallback for renders
		* outside the slot machinery).
		*/
		function MilestoneRail({ useSession, loadOlder, forkAt, useStore, actions, searchSessions = async () => ({
			items: [],
			hasMore: false
		}), openSession = () => {}, t: frameworkT = (key) => key }) {
			const order = useSession((s) => s.chat.order);
			const nodes = useSession((s) => s.chat.nodes);
			const locations = useSession((s) => s.chat.locations);
			const timeline = useSession((s) => s.chat.timeline);
			const trajectoryRequests = useSession((s) => s.views.get("trajectory")?.requests);
			const hasMore = useSession((s) => s.hasMore);
			const loadingOlder = useSession((s) => s.loadingOlder);
			const bookmarkedKeys = useStore?.((s) => s.keys) ?? NO_BOOKMARKS;
			const marks = (0, react.useMemo)(() => {
				const result = [];
				for (const key of order) {
					const node = nodes.get(key);
					if (node === void 0 || node.kind !== "user") continue;
					const data = node.data;
					const turn = node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn.turn : void 0;
					result.push({
						key,
						turn,
						seq: data.seq ?? 0,
						time: data.time ?? 0,
						text: extractText(data.content),
						preview: extractPreview(data.content)
					});
				}
				return result;
			}, [order, nodes]);
			const kindsByTurn = (0, react.useMemo)(() => {
				const result = /* @__PURE__ */ new Map();
				for (const node of nodes.values()) {
					if (node.kind !== "turn-error" && node.kind !== "turn-max-tokens" && node.kind !== "model-retry") continue;
					if (node.kind === "model-retry") {
						if (node.data?.retryState === "cancelled") continue;
					}
					if (node.location.kind !== "turn" && node.location.kind !== "step") continue;
					const kinds = result.get(node.location.turn.turn) ?? [];
					kinds.push(node.kind);
					result.set(node.location.turn.turn, kinds);
				}
				return result;
			}, [order, nodes]);
			const running = useSession((s) => s.running);
			const awaitingInput = useSession((s) => s.pending).length > 0;
			const [railBox, setRailBox] = (0, react.useState)(null);
			const [hover, setHover] = (0, react.useState)(null);
			const [search, setSearch] = (0, react.useState)({
				query: "",
				activePos: 0,
				panelOpen: false
			});
			const [bookmarksOnly, setBookmarksOnly] = (0, react.useState)(false);
			const [focusActive, setFocusActive] = (0, react.useState)(false);
			const [listOpen, setListOpen] = (0, react.useState)(false);
			const [drainPage, setDrainPage] = (0, react.useState)(false);
			const [drainFailed, setDrainFailed] = (0, react.useState)(false);
			const [crossOpen, setCrossOpen] = (0, react.useState)(false);
			const [copiedKey, setCopiedKey] = (0, react.useState)(null);
			const [forkedKey, setForkedKey] = (0, react.useState)(null);
			const [collapsedTurns, setCollapsedTurns] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [focusIndex, setFocusIndex] = (0, react.useState)(0);
			const listRef = (0, react.useRef)(null);
			const currentKey = useCurrentAnchor(order);
			/**
			* P3: jump to the chat row with the given node key — smooth-scroll it into
			* view and write the position back into the URL hash (`#msg=<key>`) so
			* refresh and share preserve it. `history.replaceState` (not a
			* `location.hash` assignment) keeps the history stack clean, and it never
			* fires `hashchange`, so the deep-link listeners below never echo the
			* rail's own updates. No-op when the row is not (yet) rendered — the
			* deep-link mount retry and the load-older flow cover that case.
			*/
			const jump = (key) => {
				const row = findRow(key);
				if (row === null) return;
				row.scrollIntoView({
					behavior: "smooth",
					block: "start"
				});
				history.replaceState(null, "", buildMessageHash(key));
			};
			const displayMarks = (0, react.useMemo)(() => {
				if (!bookmarksOnly) return marks;
				return filterByBookmarks(marks, bookmarkedKeys).visible.map((i) => marks[i]);
			}, [
				bookmarksOnly,
				marks,
				bookmarkedKeys
			]);
			const { matches } = (0, react.useMemo)(() => filterMarks(displayMarks, search.query), [displayMarks, search.query]);
			const hasQuery = search.query.trim() !== "";
			const activeMarkIndex = hasQuery && matches.length > 0 ? matches[Math.min(search.activePos, matches.length - 1)] : -1;
			const groups = (0, react.useMemo)(() => buildTurnGroups(displayMarks), [displayMarks]);
			const render = (0, react.useMemo)(() => buildRenderList(groups, collapsedTurns), [groups, collapsedTurns]);
			const separatorIndices = (0, react.useMemo)(() => new Set(render.separatorsAt), [render]);
			const collapsedSummaries = (0, react.useMemo)(() => {
				const summaries = /* @__PURE__ */ new Map();
				for (const group of groups) if (group.turn !== null && group.marks.length > 1 && collapsedTurns.has(group.turn)) summaries.set(group.marks[group.marks.length - 1].key, group.marks.length);
				return summaries;
			}, [groups, collapsedTurns]);
			const turnMarkCounts = (0, react.useMemo)(() => {
				const counts = /* @__PURE__ */ new Map();
				for (const mark of displayMarks) {
					if (mark.turn === void 0) continue;
					counts.set(mark.turn, (counts.get(mark.turn) ?? 0) + 1);
				}
				return counts;
			}, [displayMarks]);
			const displayTurns = (0, react.useMemo)(() => buildDisplayTurns(marks), [marks]);
			const [prefs, setPrefs] = (0, react.useState)(() => loadPrefs());
			const { pinned, accent, iconSize, inset, side } = prefs;
			const scale = iconSize / DOT_HIT;
			const hit = iconSize;
			const size = DOT_SIZE * scale;
			const gap = DOT_GAP * scale;
			const accentSoft = lighten(accent, .42) ?? "#9db8ff";
			const accentBg = rgbaString(accent, .18) ?? "rgba(77, 124, 254, 0.18)";
			const accentStrong = rgbaString(accent, .55) ?? "rgba(77, 124, 254, 0.55)";
			/**
			* Language override (settings → 语言): `system` delegates to the harness
			* `t` seat (the framework-synthesized interpreter for the registered
			* `dsh-milestone` namespace); `zh`/`en` force the plugin's own dictionaries
			* so the rail copy switches independently of the host UI language. Every
			* call site below — rail chrome, panels, tooltip and the settings modal —
			* already resolves through this binding, so the override is global to the
			* rail without threading a second translate prop anywhere.
			*/
			const t = prefs.locale === "system" ? frameworkT : prefs.locale === "en" ? (key, params) => translateDict(en, key, params) : (key, params) => translateDict(zh, key, params);
			/** Write a patch of prefs through to state + localStorage. */
			const updatePrefs = (patch) => {
				setPrefs((prev) => {
					const next = {
						...prev,
						...patch
					};
					savePrefs(next);
					return next;
				});
			};
			/** 0.6.3: patch ONE focus-mix flag/strength (nested field, same write-through). */
			const updateFocus = (patch) => {
				updatePrefs({ focus: {
					...prefs.focus,
					...patch
				} });
			};
			/**
			* 0.6.3: the focus block's live summary — the armed options joined into a
			* "聚焦搭配" line, plus the strength percentage. e.g. `think 淡化 · 强度 40%`.
			*/
			const focusSummary = (() => {
				const parts = [
					prefs.focus.dimThink ? t("settings.focus.summary.think") : null,
					prefs.focus.dimTools ? t("settings.focus.summary.tools") : null,
					prefs.focus.collapseThink ? t("settings.focus.summary.collapse") : null
				].filter((part) => part !== null);
				return t("settings.focus.summary", {
					opts: parts.length > 0 ? parts.join(" · ") : t("settings.focus.summary.none"),
					opacity: Math.round(prefs.focus.opacity * 100)
				});
			})();
			/** B1: flip one feature's pin — state and the persisted blob update together. */
			const onTogglePin = (id) => {
				setPrefs((prev) => {
					const next = togglePin(prev, id);
					savePrefs(next);
					return next;
				});
			};
			/** B-design: 恢复默认 resets EVERYTHING — pins AND personalization. */
			const onResetAll = () => {
				const next = { ...DEFAULT_PREFS };
				setPrefs(next);
				savePrefs(next);
			};
			const [toolbarExpanded, setToolbarExpanded] = (0, react.useState)(false);
			const [expandHovered, setExpandHovered] = (0, react.useState)(false);
			const [settingsHovered, setSettingsHovered] = (0, react.useState)(false);
			const [settingsOpen, setSettingsOpen] = (0, react.useState)(false);
			const [tourOpen, setTourOpen] = (0, react.useState)(false);
			const [tourRun, setTourRun] = (0, react.useState)(0);
			/** The feature whose near-row description tip is currently visible
			* (`null` = none — tips only appear on hover/focus of their own row). */
			const [descFeature, setDescFeature] = (0, react.useState)(null);
			/** B-design: the personalization block collapsess by default so only a
			* value summary leads the section; expanding reveals the controls. */
			const [personalOpen, setPersonalOpen] = (0, react.useState)(false);
			/** B-design (0.6.3): the focus block mirrors the personalization block —
			* collapsed by default, the header leads with a live option summary. */
			const [focusOpen, setFocusOpen] = (0, react.useState)(false);
			const settingsRef = (0, react.useRef)(null);
			const settingsBtnRef = (0, react.useRef)(null);
			const [updateOpen, setUpdateOpen] = (0, react.useState)(false);
			const [updateCheck, setUpdateCheck] = (0, react.useState)(NO_UPDATE_CHECK);
			const updatePanelRef = (0, react.useRef)(null);
			const updateBtnRef = (0, react.useRef)(null);
			/**
			* B1 settings modal: outside-pointerdown dismisses it (shared
			* useOutsideDismiss contract) with focus returning to the gear afterwards.
			* The modal's full-screen overlay wraps the dialog, so a pointerdown on the
			* backdrop (or anywhere outside the dialog) closes it; the gear's own click
			* keeps its flip semantics through a `[data-toolbar-settings]` exclusion —
			* pointerdown on an armed gear must not double-close.
			*/
			useOutsideDismiss(settingsRef, settingsOpen, () => {
				setSettingsOpen(false);
				settingsBtnRef.current?.focus();
			}, { exclude: (target) => outsideDismissMatches(target, "[data-toolbar-settings]") });
			(0, react.useEffect)(() => {
				if (!settingsOpen) return;
				const onKey = (e) => {
					if (e.key !== "Escape") return;
					setSettingsOpen(false);
					settingsBtnRef.current?.focus();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [settingsOpen]);
			(0, react.useEffect)(() => {
				if (!settingsOpen) return;
				(settingsRef.current?.querySelector("[data-toolbar-settings-close]"))?.focus();
			}, [settingsOpen]);
			/**
			* B4: run one update check. Cache-aware (`loadCachedLatest` reuses an
			* unexpired cached result without any network traffic) and never throws:
			* a network failure lands in the `failed` phase with the structured error,
			* and an unparseable `latest` (registry anomaly) is treated as "not
			* available" rather than crashing the panel.
			*/
			const runUpdateCheck = () => {
				setUpdateCheck((prev) => ({
					...prev,
					phase: "checking"
				}));
				loadCachedLatest().then((result) => {
					if (result.ok) {
						let available = false;
						try {
							available = needsUpdate(PLUGIN_VERSION, result.latest);
						} catch {
							available = false;
						}
						setUpdateCheck({
							phase: "ok",
							latest: result.latest,
							source: result.source,
							error: null,
							available
						});
					} else setUpdateCheck((prev) => ({
						...prev,
						phase: "failed",
						error: result.error
					}));
				});
			};
			(0, react.useEffect)(() => {
				const timer = window.setTimeout(runUpdateCheck, UPDATE_CHECK_MOUNT_DELAY);
				return () => window.clearTimeout(timer);
			}, []);
			(0, react.useEffect)(() => {
				const timer = window.setTimeout(() => {
					if (!readOnboardedFlag()) setTourOpen(true);
				}, ONBOARDING_MOUNT_DELAY);
				return () => window.clearTimeout(timer);
			}, []);
			useOutsideDismiss(updatePanelRef, updateOpen, () => {
				setUpdateOpen(false);
				updateBtnRef.current?.focus();
			}, { exclude: (target) => outsideDismissMatches(target, "[data-update-check]") });
			(0, react.useEffect)(() => {
				if (!updateOpen) return;
				const onKey = (e) => {
					if (e.key !== "Escape") return;
					setUpdateOpen(false);
					updateBtnRef.current?.focus();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [updateOpen]);
			const marksRef = (0, react.useRef)(marks);
			(0, react.useEffect)(() => {
				marksRef.current = marks;
			});
			(0, react.useEffect)(() => {
				const key = parseDeepLinkHash(window.location.hash);
				if (key === null) return;
				let cancelled = false;
				let timer;
				const attempt = (pollsLeft, canLoadOlder) => {
					if (cancelled) return;
					if (findRow(key) !== null) {
						jump(key);
						return;
					}
					if (marksRef.current.length > 0 && !marksRef.current.some((m) => m.key === key)) return;
					if (pollsLeft > 0) {
						timer = window.setTimeout(() => attempt(pollsLeft - 1, canLoadOlder), DEEP_LINK_POLL_DELAY);
						return;
					}
					if (canLoadOlder) {
						loadOlder().then(() => {
							timer = window.setTimeout(() => attempt(DEEP_LINK_MAX_RETRY_POLLS, false), DEEP_LINK_POLL_DELAY);
						}, () => {});
						return;
					}
				};
				timer = window.setTimeout(() => attempt(DEEP_LINK_MAX_POLLS, true), DEEP_LINK_INITIAL_DELAY);
				return () => {
					cancelled = true;
					if (timer !== void 0) window.clearTimeout(timer);
				};
			}, []);
			(0, react.useEffect)(() => {
				const onHashChange = () => {
					const key = parseDeepLinkHash(window.location.hash);
					if (key === null) return;
					if (marksRef.current.some((m) => m.key === key)) jump(key);
				};
				window.addEventListener("hashchange", onHashChange);
				return () => window.removeEventListener("hashchange", onHashChange);
			}, []);
			(0, react.useLayoutEffect)(() => {
				if (marks.length < MIN_MARKS) {
					setRailBox(null);
					return;
				}
				const scrollport = document.querySelector("[data-conversation-scroll]");
				if (scrollport === null) return;
				const compute = () => {
					const sp = scrollport.getBoundingClientRect();
					setRailBox({
						top: sp.top,
						height: sp.height,
						right: Math.max(0, window.innerWidth - sp.right + inset),
						left: Math.max(0, sp.left + inset)
					});
				};
				compute();
				const observer = new ResizeObserver(compute);
				observer.observe(scrollport);
				window.addEventListener("resize", compute);
				return () => {
					observer.disconnect();
					window.removeEventListener("resize", compute);
				};
			}, [marks.length, inset]);
			(0, react.useLayoutEffect)(() => {
				setFocusIndex((f) => clampIndex(f, render.items.length));
			}, [render.items.length]);
			const lastBadge = (0, react.useMemo)(() => {
				if (displayMarks.length === 0) return null;
				const last = displayMarks[displayMarks.length - 1];
				return deriveBadge({
					nodeKinds: last.turn === void 0 ? NO_KINDS : kindsByTurn.get(last.turn) ?? NO_KINDS,
					lastMark: true,
					running,
					awaitingInput
				});
			}, [
				displayMarks,
				kindsByTurn,
				running,
				awaitingInput
			]);
			const pulseCss = (0, react.useMemo)(() => {
				if (lastBadge === null) return null;
				const style = badgeRingStyle(lastBadge);
				return style.pulse ? badgePulseCss(style.color) : null;
			}, [lastBadge]);
			(0, react.useEffect)(() => {
				if (!listOpen && !crossOpen) return;
				const onKey = (e) => {
					if (e.key !== "Escape") return;
					setListOpen(false);
					setCrossOpen(false);
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [listOpen, crossOpen]);
			const listDraining = listOpen && (drainPage || hasMore && !drainFailed);
			(0, react.useEffect)(() => {
				if (!listOpen) return;
				setDrainFailed(false);
			}, [listOpen]);
			(0, react.useEffect)(() => {
				if (!listOpen || !hasMore || drainPage || drainFailed) return;
				setDrainPage(true);
				loadOlder().catch(() => setDrainFailed(true)).finally(() => setDrainPage(false));
			}, [
				listOpen,
				hasMore,
				drainPage,
				drainFailed,
				loadOlder
			]);
			if (railBox === null || marks.length < MIN_MARKS) return null;
			const updateQuery = (query) => {
				setSearch({
					query,
					activePos: 0,
					panelOpen: true
				});
			};
			const clearSearch = () => {
				setSearch((s) => ({
					...s,
					query: "",
					activePos: 0
				}));
			};
			const closeSearch = () => {
				setSearch({
					query: "",
					activePos: 0,
					panelOpen: false
				});
			};
			/** Enter: cycle to the next match (wrapping) and jump to that dot's row. */
			const advanceMatch = () => {
				if (matches.length === 0) return;
				const next = nextMatchIndex(search.activePos, matches.length, 1);
				setSearch((s) => ({
					...s,
					activePos: next
				}));
				jump(displayMarks[matches[next]].key);
			};
			const onSearchKeyDown = (e) => {
				if (e.key === "Enter") advanceMatch();
				if (e.key === "Escape") closeSearch();
			};
			/**
			* B-design: viewport `right` offset for the floating layers. On the classic
			* right-side rail the panels sit left of the rail (their right edge at
			* railBox.right + hit + 8); on a LEFT rail every layer flips to the rail's
			* OTHER side — its left edge at railBox.left + hit + 8, which means its
			* viewport `right` must be backed out from the (known) panel width.
			*/
			const panelRightFor = (panelWidth) => side === "left" ? window.innerWidth - (railBox.left + hit + 8 + panelWidth) : railBox.right + hit + 8;
			/** Close the settings modal via its backdrop/close button paths. */
			const closeSettings = () => {
				setSettingsOpen(false);
				settingsBtnRef.current?.focus();
			};
			/** 0.6.5: settings → 重新查看教程 — close settings and replay the coach
			* tour immediately (the flag may or may not be set; skipping/completing it
			* re-persists the flag anyway). The `tourRun` bump remounts the tour so the
			* replay always restarts from bubble 0. */
			const reopenTour = () => {
				setSettingsOpen(false);
				setTourRun((n) => n + 1);
				setTourOpen(true);
			};
			/** B1: a feature renders while the toolbar is EXPANDED or while it is pinned. */
			const featureVisible = (id) => toolbarExpanded || pinned.includes(id);
			/** Base chrome-button style: accent-defined active tint, scaled hit area. */
			const chromeButtonStyle = (active) => ({
				width: hit,
				height: hit,
				flexShrink: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				background: active ? accentBg : "transparent",
				border: "none",
				padding: 0,
				cursor: "pointer",
				color: active ? accentSoft : "#8b96ab",
				transition: "background 120ms ease, color 120ms ease"
			});
			/**
			* B1: the data-driven feature registry. Each entry's render is the feature's
			* rail-top chrome (data attributes / aria semantics preserved), moved
			* verbatim from the previous static button block; `search` is the whole
			* RailSearchUi (toggle + panel) so its lifecycle stays component-local in
			* the rail (search state lives in the rail and survives unmount). `settings`
			* lives LAST in the queue — the gear is a regular, default-unpinned feature;
			* the modal must stay reachable via 展开→齿轮.
			* Registry order = settings-menu order (站内搜索/全部提问/跨会话搜索/只看收藏/聚焦模式/检查更新/设置).
			*
			* EXTENSION POINT: push a new feature here (+ its id in toolbar-prefs.ts's
			* TOOLBAR_PIN_IDS and its locale keys) and pinning/settings/expand all
			* follow automatically — see the ToolbarFeatureDef doc above.
			*/
			const toolbarFeatures = [
				{
					id: "search",
					labelKey: "search.label",
					render: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RailSearchUi, {
						panelTop: railBox.top,
						panelRight: panelRightFor(PANEL_WIDTH_SEARCH),
						query: search.query,
						panelOpen: search.panelOpen,
						matches: matches.length,
						total: displayMarks.length,
						onToggle: () => setSearch((s) => ({
							...s,
							panelOpen: !s.panelOpen
						})),
						onQueryChange: updateQuery,
						onSearchKeyDown,
						onClear: clearSearch,
						t
					})
				},
				{
					id: "list",
					labelKey: "list.label",
					render: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"data-list-toggle": true,
						"aria-label": listOpen ? t("list.close") : t("list.open"),
						title: listOpen ? t("list.close") : t("list.open"),
						"aria-pressed": listOpen,
						onClick: () => setListOpen((v) => !v),
						style: chromeButtonStyle(listOpen),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2.5",
							strokeLinecap: "round",
							"aria-hidden": "true",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 6h18" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 12h18" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 18h18" })
							]
						})
					})
				},
				{
					id: "sessionSearch",
					labelKey: "search.cross",
					render: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"data-session-search-toggle": true,
						"aria-label": crossOpen ? t("search.cross.close") : t("search.cross.open"),
						title: crossOpen ? t("search.cross.close") : t("search.cross.open"),
						"aria-pressed": crossOpen,
						onClick: () => setCrossOpen((v) => !v),
						style: chromeButtonStyle(crossOpen),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 6h9" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 12h9" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 18h9" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: "17",
									cy: "7",
									r: "3.5"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m19.5 9.5 2.5 2.5" })
							]
						})
					})
				},
				{
					id: "bookmarks",
					labelKey: "bookmark.filter",
					render: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"data-bookmarks-toggle": true,
						"aria-label": t("bookmark.filter"),
						"aria-pressed": bookmarksOnly,
						"data-active": bookmarksOnly ? "true" : void 0,
						onClick: () => setBookmarksOnly((v) => !v),
						style: chromeButtonStyle(bookmarksOnly),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: bookmarksOnly ? "currentColor" : "none",
							stroke: "currentColor",
							strokeWidth: "2",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" })
						})
					})
				},
				{
					id: "focus",
					labelKey: "focus.on",
					render: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"data-focus-toggle": true,
						"aria-label": focusActive ? t("focus.off") : t("focus.on"),
						title: focusActive ? t("focus.off") : t("focus.on"),
						"aria-pressed": focusActive,
						onClick: () => setFocusActive((v) => !v),
						style: chromeButtonStyle(focusActive),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								cx: "12",
								cy: "12",
								r: "3"
							})]
						})
					})
				},
				{
					id: "updateCheck",
					labelKey: "update.check",
					render: () => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						ref: updateBtnRef,
						"data-update-check": true,
						"aria-expanded": updateOpen,
						"aria-label": t("update.check"),
						title: t("update.check"),
						onClick: () => setUpdateOpen((v) => !v),
						style: {
							position: "relative",
							width: hit,
							height: hit,
							flexShrink: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							background: updateCheck.available ? "rgba(245, 197, 66, 0.14)" : updateOpen ? accentBg : "transparent",
							border: "none",
							padding: 0,
							cursor: "pointer",
							color: updateCheck.available ? "#f5c542" : updateOpen ? accentSoft : "#8b96ab"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 3v5h-5" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 16H3v5" })
							]
						}), updateCheck.available && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"data-update-available": true,
							style: {
								position: "absolute",
								top: -2,
								right: -2,
								width: 8,
								height: 8,
								borderRadius: "50%",
								background: "#f5c542",
								border: "2px solid rgba(20, 24, 32, 0.95)",
								pointerEvents: "none"
							}
						})]
					})
				},
				{
					id: "settings",
					labelKey: "settings.label",
					render: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						ref: settingsBtnRef,
						"data-toolbar-settings": true,
						"aria-pressed": settingsOpen,
						"aria-label": settingsOpen ? t("toolbar.settings.close") : t("toolbar.settings.open"),
						title: settingsOpen ? t("toolbar.settings.close") : t("toolbar.settings.open"),
						onClick: () => setSettingsOpen((v) => !v),
						onMouseEnter: () => setSettingsHovered(true),
						onMouseLeave: () => setSettingsHovered(false),
						onFocus: () => setSettingsHovered(true),
						onBlur: () => setSettingsHovered(false),
						style: chromeButtonStyle(settingsOpen || settingsHovered),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								cx: "12",
								cy: "12",
								r: "3"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" })]
						})
					})
				}
			];
			/** Focus the dot at `index` (no-op while the list is unmounted). */
			const focusDotAt = (index) => {
				listRef.current?.querySelectorAll("[data-rail-dot]")[index]?.focus();
			};
			/** Tab lands on the list itself: hand focus to the dot owning the tab stop. */
			const onListFocus = (e) => {
				if (e.target !== e.currentTarget) return;
				focusDotAt(clampIndex(focusIndex, render.items.length));
			};
			/**
			* Roving-tabindex keys: ArrowDown/ArrowUp move focus (wrapping), Home/End
			* jump to first/last. Enter/Space are deliberately NOT handled — the dots
			* are real buttons, so native activation fires the jump click untouched
			* (preventDefault here would swallow it). The rover counts RENDERED dots
			* (collapsed turns shrink the list).
			*/
			const onListKeyDown = (e) => {
				const count = render.items.length;
				let next = null;
				switch (e.key) {
					case "ArrowDown":
						next = nextFocusIndex(focusIndex, count, 1);
						break;
					case "ArrowUp":
						next = nextFocusIndex(focusIndex, count, -1);
						break;
					case "Home":
						next = 0;
						break;
					case "End":
						next = count - 1;
						break;
					default: return;
				}
				e.preventDefault();
				const target = clampIndex(next, count);
				setFocusIndex(target);
				focusDotAt(target);
			};
			const buildHover = (mark, index) => {
				if (copiedKey !== null && mark.key !== copiedKey) setCopiedKey(null);
				if (forkedKey !== null && mark.key !== forkedKey) setForkedKey(null);
				const turn = mark.turn !== void 0 ? timeline.turns.get(mark.turn) : void 0;
				let durationLabel = null;
				let reasonLabel = null;
				let ttftLabel = null;
				let tpsLabel = null;
				if (turn !== void 0) {
					if (turn.start !== void 0 && turn.end !== void 0) durationLabel = formatDuration(turn.end.time - turn.start.time);
					if (turn.end !== void 0) {
						const reason = turn.end.data.reason;
						if (reason?.kind !== void 0) reasonLabel = t(reasonKeyOf(reason.kind));
					}
					const tail = turnTailOf(turn);
					if (tail !== void 0) {
						if (tail.ttftMs !== void 0) ttftLabel = formatDuration(tail.ttftMs);
						if (tail.tokensPerSecond !== void 0) tpsLabel = `${tail.tokensPerSecond.toFixed(1)} tok/s`;
					}
				}
				const meta = deriveTurnMeta(nodes, locations, mark.turn, trajectoryRequests);
				const summaryCount = collapsedSummaries.get(mark.key);
				return {
					mark,
					index,
					total: displayMarks.length,
					posLabel: summaryCount !== void 0 ? t("pos.range", {
						a: index - summaryCount + 2,
						b: index + 1,
						m: displayMarks.length
					}) : t("pos.of", {
						n: index + 1,
						m: displayMarks.length
					}),
					turnLabel: mark.turn !== void 0 ? t("turn.label", { n: displayTurns.get(mark.turn) ?? mark.turn }) : null,
					durationLabel,
					reasonLabel,
					ttftLabel,
					tpsLabel,
					modelLabel: meta.model,
					purposeLabel: meta.purpose,
					tokensLabel: meta.inputTokens !== null && meta.outputTokens !== null ? `${meta.inputTokens} / ${meta.outputTokens} tok` : null,
					turnMarkCount: mark.turn !== void 0 ? turnMarkCounts.get(mark.turn) ?? 0 : null
				};
			};
			/**
			* C4: collapse/expand the hovered mark's turn in the rail. The set is
			* replaced immutably (a turn toggles out when already present); collapsing
			* keeps the turn's LAST mark visible via buildRenderList.
			*/
			const onToggleCollapse = (turn) => {
				setCollapsedTurns((prev) => {
					const next = new Set(prev);
					if (next.has(turn)) next.delete(turn);
					else next.add(turn);
					return next;
				});
			};
			/**
			* T10: flip a mark's bookmark in the persisted store. The store action is
			* the write path (the engine persists synchronously). The hover re-assert
			* forces a re-render so the star reflects the toggled state — production
			* re-renders through the framework's uSES-bound useStore; the component
			* test harness injects an unsubscribed selector, so this local re-render is
			* what syncs the DOM there. Both paths converge on the same fresh snapshot.
			*/
			const onToggleBookmark = (key) => {
				actions?.toggle(key);
				setHover((h) => h === null ? h : { ...h });
			};
			/**
			* C3: copy the hovered mark's FULL message text to the system clipboard.
			* The acknowledgement only shows when the write actually succeeded.
			*/
			const onCopy = async (mark) => {
				if (await copyText(mark.text)) setCopiedKey(mark.key);
			};
			/**
			* C3: fork the session at the hovered mark, anchoring the cut at its event
			* seq. The acknowledgement only shows once the fork resolved.
			*/
			const onFork = (mark) => {
				forkAt(mark.seq).then(() => setForkedKey(mark.key));
			};
			const showLoadOlder = hasMore && marks.length >= MIN_MARKS;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					position: "fixed",
					top: railBox.top,
					...side === "left" ? { left: railBox.left } : { right: railBox.right },
					height: railBox.height,
					width: hit,
					pointerEvents: "auto",
					zIndex: 100,
					display: "flex",
					flexDirection: "column",
					gap: 6,
					paddingTop: 6,
					"--ms-accent": accent,
					"--ms-accent-soft": accentSoft,
					"--ms-accent-bg": accentBg,
					"--ms-icon": `${iconSize}px`,
					"--ms-inset": `${inset}px`
				},
				"aria-label": t("rail.label"),
				"data-focus-active": focusActive ? "true" : void 0,
				"data-accent": accent,
				"data-side": side,
				"data-icon-size": String(iconSize),
				"data-inset": String(inset),
				children: [
					pulseCss !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: pulseCss }),
					focusActive && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: buildFocusCss(prefs.focus) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: MODAL_CSS }),
					showLoadOlder && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"data-load-older": true,
						"data-loading-older": loadingOlder ? "true" : void 0,
						title: t("load.older"),
						"aria-label": t("load.older"),
						disabled: loadingOlder,
						onClick: () => {
							loadOlder();
						},
						style: {
							width: hit,
							height: hit,
							flexShrink: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							background: "transparent",
							border: "none",
							padding: 0,
							cursor: loadingOlder ? "default" : "pointer",
							color: loadingOlder ? "#5a6375" : "#8b96ab",
							fontSize: 13,
							lineHeight: 1,
							letterSpacing: 1
						},
						children: "···"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						"data-toolbar-expand": true,
						"aria-expanded": toolbarExpanded,
						"aria-label": toolbarExpanded ? t("toolbar.collapse") : t("toolbar.expand"),
						title: toolbarExpanded ? t("toolbar.collapse") : t("toolbar.expand"),
						onClick: () => setToolbarExpanded((v) => !v),
						onMouseEnter: () => setExpandHovered(true),
						onMouseLeave: () => setExpandHovered(false),
						onFocus: () => setExpandHovered(true),
						onBlur: () => setExpandHovered(false),
						style: chromeButtonStyle(expandHovered),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							width: "16",
							height: "16",
							viewBox: "0 0 24 24",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2.5",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: toolbarExpanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m18 15-6-6-6 6" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 9 6 6 6-6" })
						})
					}),
					toolbarFeatures.map((feature) => featureVisible(feature.id) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react.Fragment, { children: feature.render() }, feature.id) : null),
					settingsOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-toolbar-settings-overlay": true,
						onClick: closeSettings,
						style: {
							position: "fixed",
							inset: 0,
							background: "rgba(8, 10, 15, 0.55)",
							zIndex: 105,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: 16
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							ref: settingsRef,
							"data-toolbar-settings-panel": true,
							role: "dialog",
							"aria-modal": "true",
							"aria-label": t("settings.title"),
							onClick: (e) => e.stopPropagation(),
							style: {
								width: "min(600px, 92vw)",
								maxHeight: "78vh",
								overflowY: "auto",
								padding: 20,
								background: "rgba(20, 24, 32, 0.98)",
								color: "#e6e8ee",
								borderRadius: 12,
								boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55)",
								scrollbarWidth: "thin",
								scrollbarColor: "rgba(255, 255, 255, 0.2) transparent"
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: 8,
										marginBottom: 18
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										"data-toolbar-settings-title": true,
										style: {
											fontSize: 15,
											fontWeight: 600,
											color: "#e6e8ee"
										},
										children: t("settings.title")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"data-toolbar-settings-close": true,
										"aria-label": t("settings.close"),
										title: t("settings.close"),
										onClick: closeSettings,
										style: {
											width: 28,
											height: 28,
											flexShrink: 0,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											border: "none",
											padding: 0,
											cursor: "pointer",
											color: "#8b96ab",
											borderRadius: 8,
											lineHeight: 1
										},
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
											width: "14",
											height: "14",
											viewBox: "0 0 24 24",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "2",
											strokeLinecap: "round",
											"aria-hidden": "true",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 6 6 18" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 6 12 12" })]
										})
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									"data-settings-section": true,
									style: { marginBottom: 20 },
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											"data-settings-section-title": true,
											style: {
												fontSize: 13,
												fontWeight: 600,
												color: "#c7cede",
												marginBottom: 4
											},
											children: t("settings.section.features")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											"data-settings-pin-hint": true,
											style: {
												fontSize: 12,
												color: "#8b96ab",
												lineHeight: 1.5,
												marginBottom: 10
											},
											children: t("settings.pin.hint")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											style: {
												display: "flex",
												flexDirection: "column",
												gap: 2
											},
											children: toolbarFeatures.map((feature) => {
												const checked = pinned.includes(feature.id);
												const active = descFeature === feature.id;
												const tipId = `ms-settings-tip-${feature.id}`;
												return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													"data-toolbar-pin-row": true,
													"data-row-id": feature.id,
													style: { position: "relative" },
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
														type: "button",
														role: "switch",
														"data-toolbar-pin-toggle": true,
														"data-pin-id": feature.id,
														"aria-checked": checked,
														"aria-label": t(feature.labelKey),
														"aria-describedby": tipId,
														onMouseEnter: () => setDescFeature(feature.id),
														onMouseLeave: () => setDescFeature((prev) => prev === feature.id ? null : prev),
														onFocus: () => setDescFeature(feature.id),
														onBlur: () => setDescFeature((prev) => prev === feature.id ? null : prev),
														onClick: () => onTogglePin(feature.id),
														style: {
															display: "flex",
															alignItems: "center",
															justifyContent: "space-between",
															gap: 10,
															width: "100%",
															padding: "8px 10px",
															border: "none",
															borderRadius: 8,
															cursor: "pointer",
															color: "#e6e8ee",
															fontSize: 13,
															textAlign: "left"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: {
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap"
															},
															children: t(feature.labelKey)
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															"aria-hidden": "true",
															style: {
																position: "relative",
																width: 32,
																height: 18,
																flexShrink: 0,
																borderRadius: 9,
																background: checked ? accentStrong : "rgba(255, 255, 255, 0.16)",
																transition: "background 120ms ease"
															},
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
																position: "absolute",
																top: 2,
																left: checked ? 16 : 2,
																width: 14,
																height: 14,
																borderRadius: "50%",
																background: "#ffffff",
																transition: "left 120ms ease"
															} })
														})]
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														id: tipId,
														role: "tooltip",
														"data-settings-tip": true,
														"data-tip-for": feature.id,
														"data-tip-visible": active ? "true" : void 0,
														style: {
															position: "absolute",
															right: MODAL_TIP_RIGHT,
															top: "50%",
															maxWidth: "55%",
															transform: `translateY(-50%) translateX(${active ? 0 : 4}px)`,
															padding: "5px 10px",
															borderRadius: 8,
															background: "#222834",
															border: `1px solid rgba(255, 255, 255, 0.14)`,
															boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
															color: "#b9c2d4",
															fontSize: 12,
															lineHeight: 1.45,
															opacity: active ? 1 : 0,
															visibility: active ? "visible" : "hidden",
															pointerEvents: "none",
															zIndex: 4
														},
														children: t(`settings.desc.${feature.id}`)
													})]
												}, feature.id);
											})
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									"data-settings-section": true,
									"data-settings-personal": true,
									style: { marginBottom: 20 },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										"data-personal-toggle": true,
										"aria-expanded": personalOpen,
										"aria-label": personalOpen ? t("settings.personal.collapse") : t("settings.personal.expand"),
										title: personalOpen ? t("settings.personal.collapse") : t("settings.personal.expand"),
										onClick: () => setPersonalOpen((v) => !v),
										style: SECTION_TOGGLE_STYLE,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
												width: "14",
												height: "14",
												viewBox: "0 0 24 24",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2.5",
												strokeLinecap: "round",
												strokeLinejoin: "round",
												"aria-hidden": "true",
												style: {
													flexShrink: 0,
													transform: personalOpen ? "rotate(90deg)" : "none"
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m9 18 6-6-6-6" })
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"data-settings-section-title": true,
												style: { flexShrink: 0 },
												children: t("settings.section.personal")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"data-settings-personal-summary": true,
												style: SECTION_SUMMARY_STYLE,
												children: t("settings.personal.summary", {
													accent,
													icon: iconSize,
													side: side === "left" ? t("settings.side.left") : t("settings.side.right")
												})
											})
										]
									}), personalOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										"data-settings-personal-body": true,
										style: {
											padding: "10px 4px 8px",
											display: "flex",
											flexDirection: "column",
											gap: 12
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												"data-settings-personal-hint": true,
												style: {
													fontSize: 12,
													color: "#8b96ab",
													lineHeight: 1.5,
													padding: "0 6px"
												},
												children: t("settings.personal.hint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "center",
													gap: 10,
													flexWrap: "wrap"
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: 12.5,
														color: "#8b96ab",
														width: 90,
														flexShrink: 0
													},
													children: t("settings.accent")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													"data-accent-swatches": true,
													style: {
														display: "flex",
														alignItems: "center",
														gap: 6,
														flexWrap: "wrap"
													},
													children: [ACCENT_PRESETS.map((preset) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														"data-accent-swatch": true,
														"data-accent": preset,
														"aria-label": preset,
														"aria-pressed": accent === preset,
														onClick: () => updatePrefs({ accent: preset }),
														style: {
															width: 22,
															height: 22,
															borderRadius: "50%",
															background: preset,
															border: accent === preset ? "2px solid #ffffff" : "2px solid rgba(255, 255, 255, 0.25)",
															boxShadow: accent === preset ? `0 0 0 2px ${preset}` : "none",
															padding: 0,
															cursor: "pointer",
															transition: "border-color 120ms ease, box-shadow 120ms ease"
														}
													}, preset)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														"data-accent-custom": true,
														style: {
															display: "inline-flex",
															alignItems: "center",
															gap: 6,
															fontSize: 12.5,
															color: "#b9c2d4",
															cursor: "pointer"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "color",
															value: accent,
															onChange: (e) => updatePrefs({ accent: e.target.value }),
															"aria-label": `${t("settings.custom")} ${t("settings.accent")}`,
															style: {
																width: 26,
																height: 26,
																padding: 0,
																border: "none",
																background: "transparent",
																cursor: "pointer"
															}
														}), t("settings.custom")]
													})]
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "center",
													gap: 10,
													flexWrap: "wrap"
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															fontSize: 12.5,
															color: "#8b96ab",
															width: 90,
															flexShrink: 0
														},
														children: t("settings.iconSize")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "range",
														"data-icon-size": true,
														min: 20,
														max: 36,
														step: 2,
														value: iconSize,
														onChange: (e) => updatePrefs({ iconSize: Number(e.target.value) }),
														style: {
															flex: 1,
															minWidth: 140,
															maxWidth: 260
														}
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														"data-icon-size-value": true,
														style: {
															fontSize: 12.5,
															color: "#b9c2d4",
															width: 40
														},
														children: [iconSize, "px"]
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "center",
													gap: 10,
													flexWrap: "wrap"
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															fontSize: 12.5,
															color: "#8b96ab",
															width: 90,
															flexShrink: 0
														},
														children: t("settings.inset")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "range",
														"data-inset": true,
														min: 0,
														max: 40,
														step: 2,
														value: inset,
														onChange: (e) => updatePrefs({ inset: Number(e.target.value) }),
														style: {
															flex: 1,
															minWidth: 140,
															maxWidth: 260
														}
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														"data-inset-value": true,
														style: {
															fontSize: 12.5,
															color: "#b9c2d4",
															width: 40
														},
														children: [inset, "px"]
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												role: "radiogroup",
												"aria-label": t("settings.side"),
												style: {
													display: "flex",
													alignItems: "center",
													gap: 10,
													flexWrap: "wrap"
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															fontSize: 12.5,
															color: "#8b96ab",
															width: 90,
															flexShrink: 0
														},
														children: t("settings.side")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: {
															display: "inline-flex",
															alignItems: "center",
															gap: 5,
															fontSize: 13,
															color: "#e6e8ee",
															cursor: "pointer"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "radio",
															name: "ms-rail-side",
															"data-side-radio": true,
															value: "left",
															checked: side === "left",
															onChange: () => updatePrefs({ side: "left" })
														}), t("settings.side.left")]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														style: {
															display: "inline-flex",
															alignItems: "center",
															gap: 5,
															fontSize: 13,
															color: "#e6e8ee",
															cursor: "pointer"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "radio",
															name: "ms-rail-side",
															"data-side-radio": true,
															value: "right",
															checked: side === "right",
															onChange: () => updatePrefs({ side: "right" })
														}), t("settings.side.right")]
													})
												]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									"data-settings-section": true,
									"data-focus-settings": true,
									style: { marginBottom: 20 },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										"data-focus-toggle-settings": true,
										"aria-expanded": focusOpen,
										"aria-label": focusOpen ? t("settings.focus.collapse") : t("settings.focus.expand"),
										title: focusOpen ? t("settings.focus.collapse") : t("settings.focus.expand"),
										onClick: () => setFocusOpen((v) => !v),
										style: SECTION_TOGGLE_STYLE,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
												width: "14",
												height: "14",
												viewBox: "0 0 24 24",
												fill: "none",
												stroke: "currentColor",
												strokeWidth: "2.5",
												strokeLinecap: "round",
												strokeLinejoin: "round",
												"aria-hidden": "true",
												style: {
													flexShrink: 0,
													transform: focusOpen ? "rotate(90deg)" : "none"
												},
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m9 18 6-6-6-6" })
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"data-settings-section-title": true,
												style: { flexShrink: 0 },
												children: t("settings.section.focus")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"data-focus-summary": true,
												style: SECTION_SUMMARY_STYLE,
												children: focusSummary
											})
										]
									}), focusOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										"data-settings-focus-body": true,
										style: {
											padding: "10px 4px 8px",
											display: "flex",
											flexDirection: "column",
											gap: 12
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												"data-settings-focus-hint": true,
												style: {
													fontSize: 12,
													color: "#8b96ab",
													lineHeight: 1.5,
													padding: "0 6px"
												},
												children: t("settings.focus.hint")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												"data-focus-option": true,
												style: {
													display: "flex",
													alignItems: "center",
													gap: 8,
													padding: "6px 8px",
													borderRadius: 8,
													fontSize: 13,
													color: "#e6e8ee",
													cursor: "pointer"
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													"data-focus-dim-think": true,
													checked: prefs.focus.dimThink,
													onChange: (e) => updateFocus({ dimThink: e.target.checked })
												}), t("settings.focus.dimThink")]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												"data-focus-option": true,
												style: {
													display: "flex",
													alignItems: "center",
													gap: 8,
													padding: "6px 8px",
													borderRadius: 8,
													fontSize: 13,
													color: "#e6e8ee",
													cursor: "pointer"
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													"data-focus-dim-tools": true,
													checked: prefs.focus.dimTools,
													onChange: (e) => updateFocus({ dimTools: e.target.checked })
												}), t("settings.focus.dimTools")]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												"data-focus-option": true,
												style: {
													display: "flex",
													alignItems: "center",
													gap: 8,
													padding: "6px 8px",
													borderRadius: 8,
													fontSize: 13,
													color: "#e6e8ee",
													cursor: "pointer"
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													"data-focus-collapse-think": true,
													checked: prefs.focus.collapseThink,
													onChange: (e) => updateFocus({ collapseThink: e.target.checked })
												}), t("settings.focus.collapseThink")]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "center",
													gap: 10,
													flexWrap: "wrap"
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															fontSize: 12.5,
															color: "#8b96ab",
															width: 90,
															flexShrink: 0
														},
														children: t("settings.focus.opacity")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "range",
														"data-focus-opacity": true,
														min: .2,
														max: .8,
														step: .1,
														value: prefs.focus.opacity,
														onChange: (e) => updateFocus({ opacity: Number(e.target.value) }),
														style: {
															flex: 1,
															minWidth: 140,
															maxWidth: 260
														}
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														"data-focus-opacity-value": true,
														style: {
															fontSize: 12.5,
															color: "#b9c2d4",
															width: 44
														},
														children: [Math.round(prefs.focus.opacity * 100), "%"]
													})
												]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									"data-settings-section": true,
									"data-settings-lang": true,
									style: { marginBottom: 20 },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										"data-settings-section-title": true,
										style: {
											fontSize: 13,
											fontWeight: 600,
											color: "#c7cede",
											marginBottom: 8
										},
										children: t("settings.language")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										role: "radiogroup",
										"aria-label": t("settings.language"),
										style: {
											display: "flex",
											alignItems: "center",
											gap: 18,
											flexWrap: "wrap"
										},
										children: [
											"system",
											"zh",
											"en"
										].map((value) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											style: {
												display: "inline-flex",
												alignItems: "center",
												gap: 5,
												fontSize: 13,
												color: "#e6e8ee",
												cursor: "pointer"
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "radio",
												name: "ms-rail-locale",
												"data-locale-pref": true,
												value,
												checked: prefs.locale === value,
												onChange: () => updatePrefs({ locale: value })
											}), t(`settings.lang.${value}`)]
										}, value))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									"data-toolbar-settings-footer": true,
									style: { textAlign: "center" },
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											fontSize: 12,
											color: "#8b96ab",
											marginBottom: 10
										},
										children: t("settings.support")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										"data-support-grid": true,
										style: {
											display: "grid",
											gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
											gap: 10,
											maxWidth: 460,
											margin: "0 auto"
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
												href: "https://github.com/SnowCrescenter-tech/dsh-milestone",
												target: "_blank",
												rel: "noreferrer",
												"data-support-card": true,
												"data-card": "repo",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
													width: "14",
													height: "14",
													viewBox: "0 0 24 24",
													fill: "none",
													stroke: "currentColor",
													strokeWidth: "2",
													strokeLinecap: "round",
													strokeLinejoin: "round",
													"aria-hidden": "true",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" })
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.repo") })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
												href: "https://github.com/SnowCrescenter-tech/dsh-milestone",
												target: "_blank",
												rel: "noreferrer",
												"data-support-card": true,
												"data-card": "star",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
													width: "14",
													height: "14",
													viewBox: "0 0 24 24",
													fill: "currentColor",
													stroke: "none",
													"aria-hidden": "true",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" })
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.star") })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
												href: `https://github.com/SnowCrescenter-tech/dsh-milestone/issues`,
												target: "_blank",
												rel: "noreferrer",
												"data-support-card": true,
												"data-card": "issues",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
													width: "14",
													height: "14",
													viewBox: "0 0 24 24",
													fill: "none",
													stroke: "currentColor",
													strokeWidth: "2",
													"aria-hidden": "true",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
															cx: "12",
															cy: "12",
															r: "9"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
															d: "M12 8v4",
															strokeLinecap: "round"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
															cx: "12",
															cy: "16",
															r: "0.5",
															fill: "currentColor"
														})
													]
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.issues") })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
												href: "https://www.npmjs.com/package/dsh-milestone",
												target: "_blank",
												rel: "noreferrer",
												"data-support-card": true,
												"data-card": "npm",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
													width: "14",
													height: "14",
													viewBox: "0 0 24 24",
													fill: "currentColor",
													stroke: "none",
													"aria-hidden": "true",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2 8.5h20V15h-6v2.5h-3V15H2V8.5zm1.5 1.5v3.5H6V11.5h1.5v3.5h1.5V10h-4.5zm6 0v5h3V13h2v2h1.5v-5h-6.5z" })
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("settings.npm") })]
											})
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									"data-toolbar-settings-actions": true,
									style: {
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										gap: 10,
										margin: "16px auto 2px"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"data-toolbar-settings-reset": true,
										onClick: onResetAll,
										style: {
											padding: "7px 16px",
											border: `1px solid rgba(255, 255, 255, 0.14)`,
											borderRadius: 8,
											cursor: "pointer",
											color: "#b9c2d4",
											fontSize: 12.5
										},
										children: t("settings.reset")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										"data-onboarding-reopen": true,
										onClick: reopenTour,
										style: {
											padding: "7px 16px",
											border: `1px solid rgba(255, 255, 255, 0.14)`,
											borderRadius: 8,
											cursor: "pointer",
											color: "#b9c2d4",
											fontSize: 12.5
										},
										children: t("tour.reopen")
									})]
								})
							]
						})
					}),
					tourOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MilestoneTour, {
						t,
						side,
						toolbarExpanded,
						settingsOpen,
						onSetToolbarExpanded: setToolbarExpanded,
						onClose: () => setTourOpen(false)
					}, tourRun),
					updateOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: updatePanelRef,
						"data-update-panel": true,
						style: {
							position: "fixed",
							top: railBox.top,
							right: panelRightFor(PANEL_WIDTH_STANDARD),
							width: "min(280px, calc(100vw - 48px))",
							padding: "10px 12px",
							background: "rgba(20, 24, 32, 0.97)",
							color: "#e6e8ee",
							borderRadius: 8,
							boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
							zIndex: 104
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							"data-update-title": true,
							style: {
								fontSize: 13,
								fontWeight: 600,
								color: "#e6e8ee",
								marginBottom: 8
							},
							children: t("update.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexDirection: "column",
								gap: 6,
								fontSize: 12,
								lineHeight: 1.5
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: { color: "#8b96ab" },
									children: [t("update.current"), ": "]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "0.6.6" })] }),
								updateCheck.phase === "ok" && updateCheck.latest !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									"data-update-latest": true,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: { color: "#8b96ab" },
											children: [t("update.latest"), ": "]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: updateCheck.latest }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											style: { color: "#8b96ab" },
											children: [
												" (",
												updateCheck.source,
												")"
											]
										})
									]
								}),
								updateCheck.phase === "checking" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									"data-update-status": true,
									style: { color: "#8b96ab" },
									children: t("update.checking")
								}),
								updateCheck.phase === "failed" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									"data-update-failed": true,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [t("update.failed"), ":"] }),
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: { color: "#8b96ab" },
											children: updateCheck.error
										}),
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											"data-update-retry": true,
											onClick: runUpdateCheck,
											style: {
												background: "transparent",
												border: "none",
												padding: 0,
												cursor: "pointer",
												color: accentSoft,
												fontSize: 12,
												textDecoration: "underline"
											},
											children: t("update.retry")
										})
									]
								}),
								updateCheck.phase === "ok" && updateCheck.latest !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									"data-update-conclusion": true,
									children: updateCheck.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
										t("update.available"),
										" v",
										updateCheck.latest,
										" → "
									] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										href: "https://www.npmjs.com/package/dsh-milestone",
										target: "_blank",
										rel: "noreferrer",
										style: {
											color: accentSoft,
											textDecoration: "none"
										},
										children: t("update.goNpm")
									})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: { color: "#7ee2a8" },
										children: t("update.upToDate")
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									"data-update-host-lines": true,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: { color: "#8b96ab" },
										children: [t("update.hostLines"), ": "]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: SUPPORTED_HOST_LINES.map(hostLineLabel).join("、") })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"data-update-manual": true,
									disabled: updateCheck.phase === "checking",
									onClick: runUpdateCheck,
									style: {
										marginTop: 4,
										padding: "6px 10px",
										background: updateCheck.phase === "checking" ? "transparent" : accentBg,
										border: "none",
										borderRadius: 6,
										cursor: updateCheck.phase === "checking" ? "default" : "pointer",
										color: updateCheck.phase === "checking" ? "#5a6375" : accentSoft,
										fontSize: 12,
										alignSelf: "flex-start"
									},
									children: updateCheck.phase === "checking" ? t("update.checking") : t("update.check")
								})
							]
						})]
					}),
					listOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MilestoneListPanel, {
						panelTop: railBox.top,
						panelRight: panelRightFor(PANEL_WIDTH_STANDARD),
						marks,
						onJump: jump,
						onClose: () => setListOpen(false),
						loading: listDraining,
						t
					}),
					crossOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MilestoneSessionSearch, {
						panelTop: railBox.top,
						panelRight: panelRightFor(PANEL_WIDTH_STANDARD),
						onClose: () => setCrossOpen(false),
						searchSessions,
						openSession,
						t
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: listRef,
						"data-rail-list": true,
						tabIndex: 0,
						"aria-label": t("rail.list"),
						onFocus: onListFocus,
						onKeyDown: onListKeyDown,
						style: {
							flex: 1,
							minHeight: 0,
							overflowY: "auto",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap,
							padding: "6px 0",
							scrollbarWidth: "none"
						},
						children: render.items.map((item, i) => {
							const showGroupGap = separatorIndices.has(i) && i > 0;
							const mark = displayMarks[item.displayIndex];
							const summaryCount = collapsedSummaries.get(mark.key);
							const bookmarked = isBookmarked(bookmarkedKeys, mark.key);
							const dotState = markState({
								key: mark.key,
								hasQuery,
								isMatch: matches.includes(item.displayIndex),
								isActive: item.displayIndex === activeMarkIndex,
								isCurrent: !hasQuery && mark.key === currentKey
							});
							const isHovered = hover?.mark.key === mark.key;
							const boxShadow = isHovered ? `0 0 0 3px ${rgbaString(accent, .35) ?? "rgba(77, 124, 254, 0.35)"}` : dotState === "active" ? `0 0 0 3px rgba(255, 255, 255, 0.9), 0 0 10px 2px ${rgbaString(accent, .55) ?? "rgba(77, 124, 254, 0.55)"}` : dotState === "current" ? "0 0 0 3px rgba(255, 255, 255, 0.75)" : dotState === "match" ? `0 0 0 2px ${rgbaString(accent, .45) ?? "rgba(77, 124, 254, 0.45)"}` : "none";
							const badge = deriveBadge({
								nodeKinds: mark.turn === void 0 ? NO_KINDS : kindsByTurn.get(mark.turn) ?? NO_KINDS,
								lastMark: item.displayIndex === displayMarks.length - 1,
								running,
								awaitingInput
							});
							const ringStyle = badge === null ? null : badgeRingStyle(badge);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									width: hit,
									height: hit,
									flexShrink: 0,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "transparent",
									border: "none",
									padding: 0,
									cursor: "pointer",
									marginTop: showGroupGap ? GROUP_GAP_EXTRA : 0
								},
								onMouseEnter: (e) => {
									const rect = e.currentTarget.getBoundingClientRect();
									setHover({
										...buildHover(mark, item.displayIndex),
										top: rect.top + rect.height / 2
									});
								},
								onClick: () => jump(mark.key),
								"data-rail-dot": true,
								"data-turn-gap": showGroupGap ? "true" : void 0,
								"data-turn": showGroupGap && mark.turn !== void 0 ? mark.turn : void 0,
								"data-collapsed-summary": summaryCount !== void 0 ? "true" : void 0,
								"data-collapsed-count": summaryCount,
								tabIndex: focusIndex === i ? 0 : -1,
								onFocus: () => setFocusIndex(i),
								"aria-label": t("jump.to", { n: item.displayIndex + 1 }),
								"aria-current": dotState === "active" ? "true" : void 0,
								"data-current": dotState === "current" ? "true" : void 0,
								"data-dimmed": dotState === "dimmed" ? "true" : void 0,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										position: "relative",
										width: size,
										height: size,
										borderRadius: "50%",
										background: dotColor(item.displayIndex, marks.length, accent),
										boxShadow,
										transition: "transform 120ms ease, opacity 120ms ease",
										transform: `scale(${isHovered ? 1.35 : dotState === "active" || dotState === "current" ? 1.25 : 1})`,
										opacity: isHovered || dotState !== "dimmed" ? 1 : .22
									},
									"data-bookmarked": bookmarked ? "true" : void 0,
									children: [ringStyle !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"data-badge": badge,
										style: {
											position: "absolute",
											inset: -3,
											borderRadius: "50%",
											boxShadow: ringStyle.shadow,
											color: ringStyle.color,
											pointerEvents: "none",
											animation: ringStyle.pulse ? "milestone-badge-pulse 2s ease-in-out infinite" : void 0
										}
									}), summaryCount !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										"data-collapsed-badge": true,
										style: {
											position: "absolute",
											top: -5,
											right: -7,
											minWidth: 15,
											height: 15,
											padding: "0 3px",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											borderRadius: 8,
											background: "rgba(20, 24, 32, 0.96)",
											border: `1px solid ${accentSoft}`,
											boxSizing: "border-box",
											color: "#e6e8ee",
											fontSize: 9,
											lineHeight: 1,
											fontWeight: 600,
											whiteSpace: "nowrap",
											pointerEvents: "none"
										},
										children: ["×", summaryCount]
									})]
								})
							}) }, mark.key);
						})
					}),
					hover !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MilestoneRailTooltip, {
						panelRight: panelRightFor(TOOLTIP_ANCHOR_WIDTH),
						hover,
						bookmarked: isBookmarked(bookmarkedKeys, hover.mark.key),
						onToggleBookmark: () => onToggleBookmark(hover.mark.key),
						onCopy,
						onFork,
						copied: copiedKey === hover.mark.key,
						forked: forkedKey === hover.mark.key,
						turnCollapsed: hover.mark.turn !== void 0 && collapsedTurns.has(hover.mark.turn),
						onToggleCollapse,
						onMouseEnter: () => setHover((h) => h),
						onMouseLeave: () => setHover(null),
						t
					}),
					showLoadOlder && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						"data-window-hint": true,
						style: {
							position: "absolute",
							bottom: 6,
							...side === "left" ? {
								left: "100%",
								marginLeft: 8
							} : {
								right: "100%",
								marginRight: 8
							},
							whiteSpace: "nowrap",
							fontSize: 12,
							lineHeight: 1,
							color: "rgba(139, 150, 171, 0.9)",
							pointerEvents: "none",
							userSelect: "none"
						},
						children: t("window.hint", { n: marks.length })
					})
				]
			});
		}
		//#endregion
		//#region src/client/bookmarkStore.ts
		/**
		* Persisted per-session bookmarks store for the milestone rail.
		*
		* A thin declarative shell over the harness snapshot-store engine: pure
		* draft-mutator actions, persisted to localStorage under the key
		* `dsh-milestone.bookmarks` (+ `.${scopeKey}` for session-scope instances,
		* resolved by the engine's `create(scopeKey)`). Consumers must call the
		* FACTORY (never a module-level handle — module-cache identity is a disguised
		* singleton across plugin reloads).
		*/
		/**
		* Declare the bookmarks store handle. Returns a fresh handle per call; the
		* framework (or tests) create per-session instances via `create(scopeKey)`.
		*/
		function createBookmarksStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({ keys: [] }),
				persist: "dsh-milestone.bookmarks",
				actions: {
					toggle: (draft, key) => {
						draft.keys = toggleKey(draft.keys, key);
					},
					clear: (draft) => {
						draft.keys = [];
					}
				}
			});
		}
		//#endregion
		//#region src/client/railInject.ts
		/**
		* Wrap the `session.search` RPC into a safe cross-session search action.
		*
		* - `ok: true` unwraps the value and joins each hit's human display title
		*   from the session list snapshot (a session outside the list keeps no
		*   title — the caller falls back to `search.untitled`).
		* - `ok: false` throws `new Error(error.message)` so the caller can surface
		*   the business/transport error as the `search.error` state.
		* - A rejected RPC propagates unchanged.
		*
		* The list read happens inside the returned closure (never at factory time),
		* so the title join always reflects the current list snapshot.
		*
		* @param sessions - the injected sessions service (`ctx.sessions`).
		* @returns an action that searches all sessions' message content.
		*/
		function createSessionSearch(sessions) {
			return async (query, signal) => {
				const result = await sessions.search(query, signal);
				if (!result.ok) throw new Error(result.error.message);
				const byId = sessions.list.getSnapshot().byId;
				return {
					items: result.value.items.map((item) => ({
						...item,
						title: byId[item.sessionId]?.displayTitle
					})),
					hasMore: result.value.hasMore
				};
			};
		}
		/**
		* Wrap a session `open` call into a safe action that selects a listed session
		* as current — the exact selection path the sidebar uses on click.
		*
		* @param sessions - the injected sessions service (`ctx.sessions`).
		* @returns an action that opens the given session.
		*/
		function createOpenSession(sessions) {
			return (id) => sessions.open(id);
		}
		/**
		* Wrap a session-bound `loadOlder` call into a safe action closure.
		*
		* - Missing binding: resolves (never throws on an unlisted/unscoped session).
		* - Bound session: delegates to `session.loadOlder()`; a rejection propagates
		*   unchanged so callers can surface the transport error.
		*
		* @param sessions - the injected sessions service (`ctx.sessions`).
		* @param sessionId - the session the rail is scoped to.
		* @returns an action that loads the previous message page for that session.
		*/
		function createLoadOlder(sessions, sessionId) {
			return async () => {
				const binding = sessions.binding(sessionId);
				if (binding === void 0) return;
				await binding.session.loadOlder();
			};
		}
		/**
		* Wrap a session `fork` call into a safe action closure that anchors the cut
		* at an event seq and always bumps the inherited title.
		*
		* - Delegates to `sessions.fork({ sessionId, atSeq, increaseTitle: true })`;
		*   the resolved child id is passed through.
		* - A rejection propagates unchanged so callers can surface the fork error.
		*
		* @param sessions - the injected sessions service (`ctx.sessions`).
		* @param sessionId - the session the rail is scoped to.
		* @returns an action that forks that session at a given event seq.
		*/
		function createForkAt(sessions, sessionId) {
			return (atSeq) => sessions.fork({
				sessionId,
				atSeq,
				increaseTitle: true
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"sessions",
			"locale"
		];
		/**
		* Register the overlay and rail once their slot declarations are on the
		* ledger. The overlay registers directly against the shipped shell.overlay
		* declaration; the rail registers against our own child declaration, which
		* appears exactly when the overlay entry mounts.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("dsh-milestone", {
				zh,
				en
			}), "dsh-milestone: dictionaries");
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "milestone",
				order: 100,
				children: { "milestone.rail": {
					kind: "single",
					scope: "session"
				} }
			}, MilestoneOverlay));
			ctx.slots.inject("milestone.rail", () => ctx.slots.register({
				name: "milestone.rail",
				store: createBookmarksStore,
				locale: "dsh-milestone",
				inject: (sessionId) => ({
					loadOlder: createLoadOlder(ctx.sessions, sessionId),
					forkAt: createForkAt(ctx.sessions, sessionId),
					searchSessions: createSessionSearch(ctx.sessions),
					openSession: createOpenSession(ctx.sessions)
				})
			}, MilestoneRail));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map