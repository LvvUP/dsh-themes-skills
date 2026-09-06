// dsh-homepage-skin — browser half.
//
// Renders the DeepSeek Harness homepage-style background (WebGL fluid,
// 90px dot grid, digital point-cloud whale) into the `dsh web` UI.
// Dark theme keeps the original deep-blue palette; light theme gets an
// adapted variant (light fluid ramp, dark slate grid and whale).
// A settings toggle lives in Settings → General (on by default); turning
// it off or uninstalling removes every canvas, style and listener.
window.__ModuleLoader__.load({
	id: "@dsh-themes/community-dsh-homepage-skin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let _runtime_client = require("@deepseek-ai/dsh-client-store");

		const SETTINGS_NS = "settings.homepage-skin";
		const STORAGE_KEY = "dsh-homepage-skin:enabled";
		const STYLE_ID = "dsh-homepage-skin-style";
		const FRAME_SEL = "[class*=_frame]:has(> [class*=_sidebarCol])";
		const MASK = "linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)";

		/* ----------------------------------------------------------------
		   CSS. Skin rules are gated by body[data-dsh-homepage-skin], which
		   the engine sets only AFTER its canvases are mounted, and removes
		   on stop/timeout. Without a running engine no rule can apply.
		   ---------------------------------------------------------------- */
		const CSS = [
			/* shared layout(仅让背景透出,输入区/卡片/排队条全部保持出厂原样) */
			"body[data-dsh-homepage-skin] [class*=_frame]:has(> [class*=_sidebarCol]) { background: transparent; isolation: isolate; }",
			"body[data-dsh-homepage-skin] [class*=_centerCol], body[data-dsh-homepage-skin] [class*=_centerCol] > [data-slot=conversation] > [class*=_root] { background: transparent; }",
			"html:has(body[data-dsh-homepage-skin][data-ds-dark-theme]) { background-color: #0a0a0a; }",
			"html:has(body[data-dsh-homepage-skin]:not([data-ds-dark-theme])) { background-color: #f9f8f8; }",
			/* dark */
			"body[data-dsh-homepage-skin][data-ds-dark-theme] { background-color: #0a0a0a; background-image: none; }",
			"body[data-dsh-homepage-skin][data-ds-dark-theme] [class*=_sidebarCol] { background: rgba(9, 19, 32, 0.62); }",
			/* light */
			"body[data-dsh-homepage-skin]:not([data-ds-dark-theme]) { background-color: #f9f8f8; background-image: none; }",
			"body[data-dsh-homepage-skin]:not([data-ds-dark-theme]) [class*=_sidebarCol] { background: rgba(255, 255, 255, 0.55); }",
			/* settings toggle buttons (style element is always present) */
			".dsh-homepage-skin-btn {",
			"  height: 36px;",
			"  padding: 0 14px;",
			"  border: none;",
			"  border-radius: 18px;",
			"  cursor: pointer;",
			"  font: inherit;",
			"  font-size: 14px;",
			"  line-height: 22px;",
			"  display: inline-flex;",
			"  align-items: center;",
			"}",
			".dsh-homepage-skin-btn-close {",
			"  background: var(--dsw-alias-bg-module-platform);",
			"  color: var(--dsw-alias-label-primary);",
			"}",
			".dsh-homepage-skin-btn-close:hover {",
			"  background: var(--dsw-alias-interactive-bg-hover);",
			"}",
			".dsh-homepage-skin-btn-open {",
			"  background: #4D6BFE;",
			"  color: #ffffff;",
			"}"
		].join("\n");

		const zh = {
			"title": "首页皮肤",
			"hint": "给界面铺上 DeepSeek Harness 首页同款背景：流体光效、点线网格和数字鲸鱼。深色 / 亮色各有配色，跟随系统外观。",
			"open": "打开",
			"close": "关闭",
			"statusOn": "已开启"
		};

		const en = {
			"title": "Homepage Skin",
			"hint": "Adds the DeepSeek Harness homepage background: fluid light, dot grid and digital whale. Separate palettes for dark and light, following the built-in appearance.",
			"open": "Turn on",
			"close": "Turn off",
			"statusOn": "On"
		};

		function readEnabled() {
			try {
				const value = window.localStorage.getItem(STORAGE_KEY);
				if (value === null) return true;
				return value !== "0";
			} catch {
				return true;
			}
		}

		function writeEnabled(enabled) {
			try {
				window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
			} catch {
				// quota / private mode — stay process-local
			}
		}

		function injectStyle() {
			let style = document.getElementById(STYLE_ID);
			if (style === null) {
				style = document.createElement("style");
				style.id = STYLE_ID;
				document.head.appendChild(style);
			}
			style.textContent = CSS;
		}

		function removeStyle() {
			document.getElementById(STYLE_ID)?.remove();
		}

		/* ----------------------------------------------------------------
		   Theme palettes.
		   dark  — official homepage values.
		   light — adapted variant: light fluid ramp, dark slate grid/whale.
		   ---------------------------------------------------------------- */
		const THEMES = {
			dark: {
				fluidC: [
					[0.0, 0.0, 0.0],
					[0.102, 0.220, 0.439],
					[0.125, 0.290, 0.494],
					[0.933, 0.847, 0.667],
					[0.0, 0.0, 0.0]
				],
				fluidGlow: [[1.0, 0.969, 0.820], [0.325, 0.553, 0.792], [0.176, 0.267, 0.545]],
				lightCore: 0.14, lightHalo: 0.2, vignette: 0.38, grain: 0.005,
				bloomThreshold: 0.61, bloomRange: 0.18, bloomStrength: 0.4,
				gridLine: "rgba(255, 255, 255,", lineOpacity: 0.08, dotOpacity: 0.16,
				whaleBlend: "screen", whaleComp: "lighter",
				whaleColor: [0.75, 0.8, 0.9], whaleGlowRGB: [0.2, 0.3, 0.5],
				whaleWarm: [1.07, 1.02, 0.94],
				whaleShadeMin: 0.2, whaleShadeMax: 1.116
			},
			light: {
				fluidC: [
					[1.0, 1.0, 1.0],
					[0.859, 0.906, 1.0],
					[0.725, 0.804, 0.961],
					[0.949, 0.914, 0.847],
					[1.0, 1.0, 1.0]
				],
				fluidGlow: [[1.0, 0.969, 0.820], [0.561, 0.702, 0.910], [0.478, 0.584, 0.816]],
				lightCore: 0.07, lightHalo: 0.1, vignette: 0.16, grain: 0.003,
				bloomThreshold: 0.75, bloomRange: 0.2, bloomStrength: 0.18,
				gridLine: "rgba(62, 82, 130,", lineOpacity: 0.16, dotOpacity: 0.3,
				whaleBlend: "normal", whaleComp: "source-over",
				whaleColor: [0.22, 0.3, 0.45], whaleGlowRGB: [-0.12, -0.18, -0.28],
				whaleWarm: [1.0, 1.0, 1.0],
				whaleShadeMin: 0.62, whaleShadeMax: 1.3
			}
		};

		/* ----------------------------------------------------------------
		   Background engine (fluid + grid + whale canvases).
		   createEngine() returns { start, stop }; stop() reverses everything.
		   ---------------------------------------------------------------- */
		function createEngine() {
			let started = false;
			let stopped = false;
			let disposed = [];
			let iv = null;
			let rafId = 0;
			let themeObserver = null;
			let resizeObserver = null;

			let currentTheme = document.body && document.body.hasAttribute("data-ds-dark-theme") ? "dark" : "light";
			let fluidCanvas = null, gridCanvas = null, whaleCanvas = null;
			let gctx = null, wctx = null;

			let W = 0, H = 0;
			let gridPts = [], gridCols = 0, gridRows = 0;
			let contentCX = 0;

			let whalePts = [], whaleCount = 0;
			let WHALE_PATH = null;

			let gl = null;
			let glPrograms = null;
			let glQuad = null;
			let glFbo = null;
			let glTexSize = { w: 0, h: 0 };
			let glPing = 0;
			let glTimeStart = 0;

			let mx = -9999, my = -9999;
			let mouseHasMoved = false, mouseActive = false, lastMove = 0;
			let smoothMouseX = 0, smoothMouseY = 0, mouseStrength = 0;
			let scrollE = 0, scrollR = 0;
			let gridIdle = false;
			let lastT = 0, mountT = -1, lastGrid = 0, lastWhale = 0, lastWhaleT = -1;
			let canvasMounted = false;
			let frameErrorLogged = false;

			const FLUID = {
				mouseRadius: 0.09, mouseStrength: 1.8, mouseSmoothing: 0.1, mouseVelocity: 0.2,
				decay: 0.925, distortBoost: 2.2, swirlBoost: 0.8, glowIntensity: 0.13,
				speed: 28, scale: 1.77, offsetX: -124, offsetY: -48,
				lightX: 0.89, lightY: 0.46, lightFollow: 0.63,
				dprCap: 1.5, fps: 30, brushEnabled: true
			};
			const GRID = {
				spacing: 90, lineWidth: 0.5, dotSize: 1.8,
				mouseRadius: 140, mouseForce: 30, spring: 0.05, damping: 0.85,
				lineInset: 10, minGap: 20, dprCap: 2, fps: 30, idleStop: 0.01, minWidth: 768,
				enabled: true /* 粗指针设备按官网整体不渲染 */
			};
			const WHALE = {
				spin: false, loose: 1,
				light: { x: 4.5, y: 5.5, z: 3, range: 14, followX: 1.05 },
				mouse: { radius: 4.9, strength: 0.8, decay: 0.2, distort: 5 },
				viewport: 16.786, dprCap: 1.5, fps: 30,
				assemblyDelay: 0.3, assemblyDuration: 2.5,
				sampleSize: 60, sampleScale: 0.18, sampleThreshold: 0.2, scatterRadius: 3,
				baseAlpha0: 0.45, baseAlpha1: 0.75,
				glowRadius: 8, glowAmp: 0.3,
				boxSize: 0.06, scatterAmount: 1.6,
				/* 官方 z 向波动参数(组装后 pos.z 波动),2D 移植中不可见,保留备查 */
				waveSpeed: 1.5, waveAmount: 0.06,
				containerPx: 800, whaleRatio: 0.643, baseY: 0.45, minWidth: 768
			};
			const HERO = {
				fluidBlur: 20, fadeInDuration: 1.8, blurScrollRange: 0.6, waitMs: 20000
			};

			const WHALE_PATH_D = "M22.9168 1.43018C22.6713 1.31018 22.5658 1.53918 22.4223 1.65519C22.3733 1.69269 22.3318 1.74169 22.2903 1.78669C21.9317 2.1697 21.5127 2.42121 20.9657 2.39121C20.1657 2.34621 19.4827 2.59771 18.8787 3.20973C18.7502 2.45521 18.3236 2.0047 17.6746 1.71569C17.3351 1.56568 16.9916 1.41518 16.7536 1.08867C16.5876 0.856163 16.5421 0.597155 16.4591 0.341647C16.4061 0.187643 16.3536 0.0301382 16.1761 0.00363739C15.9836 -0.0263635 15.9081 0.135141 15.8326 0.270145C15.5306 0.822162 15.4136 1.43018 15.4251 2.0462C15.4516 3.43174 16.0366 4.53527 17.1991 5.3203C17.3311 5.4103 17.3651 5.5003 17.3236 5.63181C17.2441 5.90231 17.1501 6.16482 17.0671 6.43533C17.0141 6.60784 16.9351 6.64584 16.7501 6.57033C16.1121 6.30383 15.5611 5.90931 15.074 5.4328C14.2475 4.63328 13.5 3.75075 12.568 3.05973C12.349 2.89822 12.13 2.74822 11.9034 2.60522C10.9524 1.68169 12.028 0.923165 12.277 0.833162C12.5375 0.739159 12.3675 0.41615 11.5259 0.42015C10.6844 0.42365 9.91439 0.705658 8.93286 1.08117C8.78935 1.13767 8.63835 1.17867 8.48384 1.21267C7.59332 1.04367 6.66829 1.00617 5.70226 1.11517C3.88321 1.31768 2.43016 2.1777 1.36213 3.64575C0.0790928 5.4103 -0.222916 7.41536 0.146595 9.50642C0.535106 11.7105 1.66014 13.535 3.38869 14.9616C5.18125 16.4406 7.24581 17.1657 9.60138 17.0266C11.0319 16.9441 12.6245 16.7526 14.421 15.2321C14.874 15.4576 15.3496 15.5476 16.1381 15.6151C16.7456 15.6716 17.3306 15.5851 17.7836 15.4911C18.4931 15.3411 18.4441 14.6841 18.1876 14.5636C16.1081 13.595 16.5646 13.9891 16.1496 13.67C17.2061 12.42 18.8202 10.1979 19.3182 7.17235C19.3672 6.83834 19.4297 6.36783 19.4222 6.09732C19.4182 5.93231 19.4562 5.86831 19.6447 5.84931C20.1657 5.78931 20.6712 5.64681 21.1357 5.3913C22.4833 4.65528 23.0268 3.44624 23.1548 1.9972C23.1738 1.77569 23.1508 1.54668 22.9168 1.43018ZM11.1749 14.4736C9.15936 12.889 8.18184 12.3675 7.77832 12.39C7.40081 12.4125 7.46881 12.8445 7.55182 13.126C7.63882 13.404 7.75182 13.5955 7.91033 13.8396C8.01983 14.0011 8.09533 14.2411 7.80083 14.4216C7.15181 14.8231 6.02327 14.2866 5.97027 14.2601C4.65673 13.4865 3.5587 12.4655 2.78467 11.069C2.03715 9.72493 1.60314 8.28289 1.53164 6.74384C1.51264 6.37233 1.62214 6.24082 1.99215 6.17332C2.47916 6.08332 2.98118 6.06432 3.46769 6.13582C5.52476 6.43633 7.27581 7.35586 8.74385 8.8129C9.58188 9.64243 10.2159 10.634 10.8689 11.6025C11.5634 12.631 12.3105 13.611 13.262 14.4146C13.598 14.6961 13.866 14.9101 14.1225 15.0681C13.349 15.1546 12.058 15.1731 11.1749 14.4746V14.4736ZM12.141 8.25988C12.141 8.09488 12.273 7.96338 12.439 7.96338C12.4765 7.96338 12.5105 7.97088 12.541 7.98188C12.5825 7.99688 12.6205 8.01938 12.6505 8.05338C12.7035 8.10588 12.7335 8.18088 12.7335 8.25988C12.7335 8.42489 12.6015 8.55639 12.4355 8.55639C12.2695 8.55639 12.141 8.42489 12.141 8.25988ZM15.1415 9.79893C14.949 9.87793 14.7565 9.94544 14.5715 9.95294C14.2845 9.96794 13.9715 9.85143 13.8015 9.70893C13.5375 9.48742 13.3485 9.36342 13.2695 8.97691C13.2355 8.8119 13.2545 8.55639 13.2845 8.40989C13.3525 8.09438 13.277 7.89187 13.0545 7.70787C12.8735 7.55786 12.643 7.51636 12.39 7.51636C12.2955 7.51636 12.209 7.47486 12.1445 7.44136C12.039 7.38886 11.9519 7.25735 12.035 7.09585C12.0615 7.04335 12.19 6.91584 12.22 6.89334C12.5635 6.69784 12.9595 6.76184 13.326 6.90834C13.6655 7.04735 13.9225 7.30236 14.292 7.66287C14.6695 8.09838 14.7375 8.21838 14.9525 8.54539C15.1225 8.8009 15.277 9.06341 15.3831 9.36392C15.4471 9.55142 15.3641 9.70493 15.1415 9.79893Z";

			const VERT_SRC = '#version 300 es\nin vec4 a_position;\nout vec2 vUv;\nvoid main() {\n  vUv = a_position.xy * 0.5 + 0.5;\n  gl_Position = a_position;\n}\n';

			var FLOW_SRC = '#version 300 es\nprecision mediump float;\nin vec2 vUv;\nuniform sampler2D u_prev;\nuniform vec2 u_mouse;\nuniform vec2 u_velocity;\nuniform float u_brushRadius;\nuniform float u_brushStrength;\nuniform float u_decay;\nout vec4 fragColor;\n\nvoid main() {\n  vec4 prev = texture(u_prev, vUv);\n\n  prev.r *= u_decay;\n  prev.gb = mix(vec2(0.5), prev.gb, u_decay);\n\n  float dist = distance(vUv, u_mouse);\n\n  float influence = exp(-dist * dist / (u_brushRadius * u_brushRadius * 0.5));\n  influence = max(0.0, influence - 0.01);\n\n  float speed = length(u_velocity);\n  float presenceStrength = u_brushStrength * 0.3;\n  float velBonus = min(speed * 3.0, 0.7) * u_brushStrength;\n  float totalStrength = presenceStrength + velBonus;\n\n  prev.r = max(prev.r, influence * totalStrength);\n  float blendAmt = influence * min(totalStrength, 0.4) * 0.3;\n  prev.g = mix(prev.g, clamp(u_velocity.x * 2.0 + 0.5, 0.0, 1.0), blendAmt);\n  prev.b = mix(prev.b, clamp(u_velocity.y * 2.0 + 0.5, 0.0, 1.0), blendAmt);\n\n  fragColor = prev;\n}\n';

			var FLUID_SRC = '#version 300 es\nprecision mediump float;\nin vec2 vUv;\nuniform float u_time;\nuniform vec2 u_resolution;\nuniform vec3 u_c1, u_c2, u_c3, u_c4, u_c5;\nuniform float u_scale;\nuniform vec2 u_offset;\nuniform float u_grain;\nuniform float u_speed;\nuniform sampler2D u_flowmap;\nuniform float u_distortBoost;\nuniform float u_swirlBoost;\nuniform float u_glowIntensity;\nuniform vec3 u_glowColor1;\nuniform vec3 u_glowColor2;\nuniform vec3 u_glowColor3;\nuniform vec2 u_lightPos;\nuniform float u_lightCore;\nuniform float u_lightHalo;\nuniform float u_vignette;\nuniform float u_bloomThreshold;\nuniform float u_bloomRange;\nuniform float u_bloomStrength;\nout vec4 fragColor;\n\nvec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}\nvec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}\nvec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}\nvec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}\n\nfloat snoise(vec3 v){\n  const vec2 C=vec2(1./6.,1./3.);\n  const vec4 D=vec4(0.,.5,1.,2.);\n  vec3 i=floor(v+dot(v,C.yyy));\n  vec3 x0=v-i+dot(i,C.xxx);\n  vec3 g=step(x0.yzx,x0.xyz);\n  vec3 l=1.-g;\n  vec3 i1=min(g.xyz,l.zxy);\n  vec3 i2=max(g.xyz,l.zxy);\n  vec3 x1=x0-i1+C.xxx;\n  vec3 x2=x0-i2+C.yyy;\n  vec3 x3=x0-D.yyy;\n  i=mod289v3(i);\n  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));\n  float n_=.142857142857;\n  vec3 ns=n_*D.wyz-D.xzx;\n  vec4 j=p-49.*floor(p*ns.z*ns.z);\n  vec4 x_=floor(j*ns.z);\n  vec4 y_=floor(j-7.*x_);\n  vec4 x=x_*ns.x+ns.yyyy;\n  vec4 y=y_*ns.x+ns.yyyy;\n  vec4 h=1.-abs(x)-abs(y);\n  vec4 b0=vec4(x.xy,y.xy);\n  vec4 b1=vec4(x.zw,y.zw);\n  vec4 s0=floor(b0)*2.+1.;\n  vec4 s1=floor(b1)*2.+1.;\n  vec4 sh=-step(h,vec4(0.));\n  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;\n  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;\n  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);\n  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);\n  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));\n  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;\n  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);\n  m=m*m;\n  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));\n}\n\nfloat hash(vec2 p){\n  vec3 p3=fract(vec3(p.xyx)*.1031);\n  p3+=dot(p3,p3.yzx+33.33);\n  return fract((p3.x+p3.y)*p3.z);\n}\n\nfloat fbm(vec3 p){\n  float v=0.,amp=.6;vec3 shift=vec3(100.);\n  for(int i=0;i<1;i++){v+=amp*snoise(p);p=p*2.+shift;amp*=.4;}\n  return v;\n}\n\nfloat fluidNoise(vec2 uv,float t){\n  float n1=fbm(vec3(uv*.6,t*.06));\n  float n2=fbm(vec3(uv*.6+5.2,t*.06+1.3));\n  vec2 w1=vec2(n1,n2)*.6;\n  float n3=fbm(vec3((uv+w1)*.7+1.7,t*.05+3.1));\n  float n4=fbm(vec3((uv+w1)*.7+9.2,t*.05+5.7));\n  vec2 w2=vec2(n3,n4)*.5;\n  return fbm(vec3((uv+w1+w2)*.5,t*.04));\n}\n\nvec2 curlish(vec2 uv,float t){\n  float eps=.02;\n  float n=snoise(vec3(uv*.8,t));\n  float nx=snoise(vec3((uv+vec2(eps,0.))*.8,t));\n  float ny=snoise(vec3((uv+vec2(0.,eps))*.8,t));\n  return vec2(-(ny-n)/eps,(nx-n)/eps)*.003;\n}\n\nvoid main(){\n  float aspect=u_resolution.x/u_resolution.y;\n  vec2 uv=gl_FragCoord.xy/u_resolution;\n  vec2 suv=vec2(uv.x*aspect, uv.y) * u_scale + u_offset;\n  float t=u_time;\n\n  // Mouse interaction via flowmap\n  vec4 flow = texture(u_flowmap, uv);\n  float influence = flow.r;\n  vec2 flowDir = (flow.gb - 0.5) * 2.0;\n\n  // Apply mouse distortion to UV\n  suv += flowDir * influence * u_distortBoost * 0.8;\n  // Apply mouse swirl\n  float swirlAngle = influence * u_swirlBoost * 2.5;\n  float cs = cos(swirlAngle), sn = sin(swirlAngle);\n  vec2 delta = suv - vec2(uv.x * aspect, uv.y) * u_scale;\n  suv += (mat2(cs, sn, -sn, cs) * delta - delta) * influence;\n\n  vec2 curl=curlish(suv,t*.04);\n  vec2 uvD=suv+curl*12.;\n  float f=fluidNoise(uvD,t);\n  float swirl=snoise(vec3(uvD*.8+f*1.5,t*.035))*.5+.5;\n  float n=f*.5+.5;\n  vec3 col=mix(u_c1,u_c2,smoothstep(.2,.5,n));\n  col=mix(col,u_c3,smoothstep(.35,.65,n+swirl*.25));\n  col=mix(col,u_c4,smoothstep(.6,.85,swirl)*.55);\n  col=mix(col,u_c5,smoothstep(.5,.8,n*swirl)*.35);\n\n  // Mouse proximity color shift: 3-color glow blended by distance + noise\n  float glow = smoothstep(0.0, 0.8, influence);\n  float glowNoise = snoise(vec3(uvD * 1.5, t * 0.08)) * 0.5 + 0.5;\n  float glowDist = smoothstep(0.0, 1.0, influence);\n  vec3 glowMix = mix(u_glowColor3, u_glowColor2, glowDist);\n  glowMix = mix(glowMix, u_glowColor1, glowDist * glowNoise);\n  col = mix(col, glowMix, glow * u_glowIntensity);\n\n  if(u_grain>0.0){\n    vec2 flowOffset = (uvD - suv) * u_resolution.y;\n    vec2 gp = floor((gl_FragCoord.xy + flowOffset) / 5.0);\n    float gr=hash(gp)*2.-1.;\n    col+=gr*u_grain;\n  }\n\n  // Self-luminance bloom: bright fluid regions become their own light spots,\n  // so glow follows the flow and mouse disturbance instead of a fixed point\n  float luma=dot(col,vec3(.299,.587,.114));\n  float bloom=smoothstep(u_bloomThreshold-u_bloomRange,u_bloomThreshold+u_bloomRange,luma);\n  col+=(col*.85+vec3(.15,.145,.13))*bloom*u_bloomStrength;\n\n  // Virtual light source: soft warm core (same side as helm lighting)\n  float ld=length((uv-u_lightPos)*vec2(aspect,1.));\n  float core=exp(-ld*ld*4.5);\n  float halo=exp(-ld*1.8);\n  col+=vec3(1.,.97,.9)*core*u_lightCore+vec3(.72,.8,1.)*halo*u_lightHalo;\n\n  float vig=1.-smoothstep(.35,.75,length(uv-.5));\n  col=mix(col*(1.-u_vignette),col,vig);\n  fragColor=vec4(col,1.);\n}\n';

			function on(ev, fn, target, opts) {
				(target || window).addEventListener(ev, fn, opts);
				disposed.push(() => (target || window).removeEventListener(ev, fn, opts));
			}

			function smoothstep(a, b, x) {
				const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
				return t * t * (3 - 2 * t);
			}
			function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

			function theme() { return THEMES[currentTheme]; }

			function findFrame() {
				const f = document.querySelector(FRAME_SEL);
				if (f && typeof f.insertBefore === "function") return f;
				return null;
			}

			function makeWhalePath() {
				try { return new Path2D(WHALE_PATH_D); } catch (e) { return null; }
			}

			function boot() {
				if (started || stopped) return true;
				const frame = findFrame();
				if (!frame) return false;
				started = true;
				try {
					start(frame);
					if (window.__dshHomepageSkin) window.__dshHomepageSkin.state = "ok";
				} catch (err) {
					started = false;
					if (window.__dshHomepageSkin) window.__dshHomepageSkin.state = "error:" + err.message;
				}
				return true;
			}

			/* ---------------- fluid (WebGL2) ---------------- */
			function initFluid() {
				try {
					gl = fluidCanvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, powerPreference: "low-power" });
				} catch (e) { gl = null; }
				if (!gl) return;
				function compile(type, src) {
					const sh = gl.createShader(type);
					gl.shaderSource(sh, src);
					gl.compileShader(sh);
					if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
						console.error("homepage-skin fluid shader:", gl.getShaderInfoLog(sh));
						gl.deleteShader(sh);
						return null;
					}
					return sh;
				}
				function program(fragSrc) {
					const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
					const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
					if (!vs || !fs) return null;
					const p = gl.createProgram();
					gl.attachShader(p, vs);
					gl.attachShader(p, fs);
					gl.linkProgram(p);
					if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
						console.error("homepage-skin fluid link:", gl.getProgramInfoLog(p));
						return null;
					}
					return p;
				}
				const flowProg = program(FLOW_SRC);
				const fluidProg = program(FLUID_SRC);
				if (!flowProg || !fluidProg) { gl = null; return; }
				glPrograms = { flow: flowProg, fluid: fluidProg, flowU: {}, fluidU: {} };
				["u_prev", "u_mouse", "u_velocity", "u_brushRadius", "u_brushStrength", "u_decay"].forEach((n) => {
					glPrograms.flowU[n.replace("u_", "")] = gl.getUniformLocation(flowProg, n);
				});
				["u_time", "u_resolution", "u_c1", "u_c2", "u_c3", "u_c4", "u_c5", "u_scale", "u_offset", "u_grain", "u_speed", "u_flowmap", "u_distortBoost", "u_swirlBoost", "u_glowIntensity", "u_glowColor1", "u_glowColor2", "u_glowColor3", "u_lightPos", "u_lightCore", "u_lightHalo", "u_vignette", "u_bloomThreshold", "u_bloomRange", "u_bloomStrength"].forEach((n) => {
					glPrograms.fluidU[n.replace("u_", "")] = gl.getUniformLocation(fluidProg, n);
				});
				glQuad = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, glQuad);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
				glTimeStart = performance.now();
				fluidResize();
			}

			function fluidResize() {
				if (!gl || !glPrograms) return;
				const dpr = Math.min(window.devicePixelRatio || 1, FLUID.dprCap);
				const w = Math.max(1, Math.round(W * dpr));
				const h = Math.max(1, Math.round(H * dpr));
				fluidCanvas.width = w;
				fluidCanvas.height = h;
				gl.viewport(0, 0, w, h);
				const tw = Math.round(w / 4), th = Math.round(h / 4);
				if (glFbo) {
					glFbo.forEach((f) => { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); });
				}
				const init = new Uint8Array(tw * th * 4);
				for (let i = 0; i < tw * th; i++) { init[4 * i] = 0; init[4 * i + 1] = 128; init[4 * i + 2] = 128; init[4 * i + 3] = 255; }
				glFbo = [makeFbo(tw, th, init), makeFbo(tw, th, init)];
				glTexSize = { w: tw, h: th };
				glPing = 0;
			}

			function makeFbo(w, h, data) {
				const tex = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, tex);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				const fbo = gl.createFramebuffer();
				gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				return { fbo, tex };
			}

			function bindQuad() {
				gl.bindBuffer(gl.ARRAY_BUFFER, glQuad);
				const loc = gl.getAttribLocation(gl.getParameter(gl.CURRENT_PROGRAM), "a_position");
				gl.enableVertexAttribArray(loc);
				gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
			}

			const fluidMouse = { x: 0.5, y: 0.5, smoothX: 0.5, smoothY: 0.5, svx: 0, svy: 0 };

			function fluidFrame() {
				if (!gl || !glPrograms || !glFbo) return;
				const P = theme();
				const k = fluidMouse;
				k.smoothX += (k.x - k.smoothX) * FLUID.mouseSmoothing;
				k.smoothY += (k.y - k.smoothY) * FLUID.mouseSmoothing;
				k.svx += ((k.x - k.smoothX) * 0.5 - k.svx) * FLUID.mouseVelocity;
				k.svy += ((k.y - k.smoothY) * 0.5 - k.svy) * FLUID.mouseVelocity;
				const N = glPing ? glFbo[0] : glFbo[1];
				const T = glPing ? glFbo[1] : glFbo[0];
				glPing = glPing ? 0 : 1;

				/* flowmap brush pass */
				gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo);
				gl.viewport(0, 0, glTexSize.w, glTexSize.h);
				gl.useProgram(glPrograms.flow);
				bindQuad();
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, N.tex);
				gl.uniform1i(glPrograms.flowU.prev, 0);
				gl.uniform2f(glPrograms.flowU.mouse, k.smoothX, k.smoothY);
				gl.uniform2f(glPrograms.flowU.velocity, k.svx, k.svy);
				gl.uniform1f(glPrograms.flowU.brushRadius, FLUID.mouseRadius);
				gl.uniform1f(glPrograms.flowU.brushStrength, FLUID.brushEnabled ? FLUID.mouseStrength : 0);
				gl.uniform1f(glPrograms.flowU.decay, FLUID.decay);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

				/* fluid render pass */
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, fluidCanvas.width, fluidCanvas.height);
				gl.useProgram(glPrograms.fluid);
				bindQuad();
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, T.tex);
				const U = glPrograms.fluidU;
				const Rt = (performance.now() - glTimeStart) * 0.001 * (FLUID.speed / 100);
				const cs = P.fluidC;
				gl.uniform1i(U.flowmap, 0);
				gl.uniform1f(U.time, Rt);
				gl.uniform2f(U.resolution, fluidCanvas.width, fluidCanvas.height);
				gl.uniform3f(U.c1, cs[0][0], cs[0][1], cs[0][2]);
				gl.uniform3f(U.c2, cs[1][0], cs[1][1], cs[1][2]);
				gl.uniform3f(U.c3, cs[2][0], cs[2][1], cs[2][2]);
				gl.uniform3f(U.c4, cs[3][0], cs[3][1], cs[3][2]);
				gl.uniform3f(U.c5, cs[4][0], cs[4][1], cs[4][2]);
				gl.uniform1f(U.scale, FLUID.scale);
				gl.uniform2f(U.offset, FLUID.offsetX / 100, FLUID.offsetY / 100);
				gl.uniform1f(U.grain, P.grain);
				gl.uniform1f(U.distortBoost, FLUID.distortBoost);
				gl.uniform1f(U.swirlBoost, FLUID.swirlBoost);
				gl.uniform2f(U.lightPos, FLUID.lightX + (k.smoothX - FLUID.lightX) * FLUID.lightFollow, FLUID.lightY);
				gl.uniform1f(U.lightCore, P.lightCore);
				gl.uniform1f(U.lightHalo, P.lightHalo);
				gl.uniform1f(U.vignette, P.vignette);
				gl.uniform1f(U.bloomThreshold, P.bloomThreshold);
				gl.uniform1f(U.bloomRange, P.bloomRange);
				gl.uniform1f(U.bloomStrength, P.bloomStrength);
				gl.uniform1f(U.glowIntensity, FLUID.glowIntensity);
				const gc = P.fluidGlow;
				gl.uniform3f(U.glowColor1, gc[0][0], gc[0][1], gc[0][2]);
				gl.uniform3f(U.glowColor2, gc[1][0], gc[1][1], gc[1][2]);
				gl.uniform3f(U.glowColor3, gc[2][0], gc[2][1], gc[2][2]);
				gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			}

			/* ---------------- whale point cloud ---------------- */
			function buildWhaleData() {
				whalePts = [];
				if (!WHALE_PATH) return;
				const SIZE = WHALE.sampleSize;
				const off = document.createElement("canvas");
				off.width = SIZE; off.height = SIZE;
				const octx = off.getContext("2d");
				octx.fillStyle = "#000";
				octx.fillRect(0, 0, SIZE, SIZE);
				octx.fillStyle = "#fff";
				const sc = SIZE / 24;
				octx.translate((SIZE - 24 * sc) / 2, (SIZE - 18 * sc) / 2);
				octx.scale(sc, sc);
				octx.fill(WHALE_PATH);
				const img = octx.getImageData(0, 0, SIZE, SIZE).data;
				const lum = new Float32Array(SIZE * SIZE);
				for (let e = 0; e < SIZE * SIZE; e++) {
					lum[e] = (0.299 * img[4 * e] + 0.587 * img[4 * e + 1] + 0.114 * img[4 * e + 2]) / 255;
				}
				const isInterior = (n, e2) => {
					for (let a = -2; a <= 2; a++) for (let r = -2; r <= 2; r++) {
						if (r === 0 && a === 0) continue;
						const o = n + r, s = e2 + a;
						if (o >= 0 && s >= 0 && o < SIZE && s < SIZE && lum[s * SIZE + o] > WHALE.sampleThreshold) return false;
					}
					return true;
				};
				const d = SIZE / 2;
				for (let y = 0; y < SIZE; y++) {
					for (let x = 0; x < SIZE; x++) {
						const l = lum[y * SIZE + x];
						if (l > WHALE.sampleThreshold && !isInterior(x, y)) {
							const sx = (x - d) * WHALE.sampleScale;
							/* Canvas y 向下：y < d(图像上方)取负值 → 画在中心上方,保持鲸鱼正立 */
							const sy = (y - d) * WHALE.sampleScale;
							let edge = 0;
							for (let a2 = -1; a2 <= 1; a2++) for (let r2 = -1; r2 <= 1; r2++) {
								if (r2 === 0 && a2 === 0) continue;
								const o2 = x + r2, s2 = y + a2;
								if (o2 < 0 || s2 < 0 || o2 >= SIZE || s2 >= SIZE || lum[s2 * SIZE + o2] <= WHALE.sampleThreshold) edge++;
							}
							const ang = Math.random() * Math.PI * 2;
							const phi = Math.acos(2 * Math.random() - 1);
							const rad = WHALE.scatterRadius * (0.4 + 0.6 * Math.random());
							whalePts.push({
								sx, sy,
								opacity: l,
								edge: edge / 8,
								scx: Math.sin(phi) * Math.cos(ang) * rad,
								scy: Math.sin(phi) * Math.sin(ang) * rad,
								randScale: 0.5 + 1 * Math.random(),
								idx: whalePts.length
							});
						}
					}
				}
				whaleCount = whalePts.length;
			}

			/* ---------------- grid ---------------- */
			function gridRebuild() {
				gridCols = Math.ceil(W / GRID.spacing) + 1;
				gridRows = Math.ceil(H / GRID.spacing) + 1;
				const ox = (W - (gridCols - 1) * GRID.spacing) / 2;
				const oy = (H - (gridRows - 1) * GRID.spacing) / 2;
				gridPts = [];
				for (let n = 0; n < gridRows; n++) {
					for (let r = 0; r < gridCols; r++) {
						const rx = ox + GRID.spacing * r, ry = oy + GRID.spacing * n;
						gridPts.push({ restX: rx, restY: ry, x: rx, y: ry, vx: 0, vy: 0 });
					}
				}
			}

			function measureContentCX() {
				const sb = document.querySelector("[class*=_sidebarCol]");
				const sw = sb ? sb.getBoundingClientRect().width : 0;
				contentCX = sw + (W - sw) / 2;
			}

			function updateScrollState() {
				const sy = window.scrollY || (document.documentElement && document.documentElement.scrollTop) || 0;
				scrollE = Math.min(1, sy / Math.max(1, H));
				scrollR = Math.min(1, Math.max(0, sy / (HERO.blurScrollRange * Math.max(1, H))));
				fluidCanvas.style.filter = "blur(" + (HERO.fluidBlur * (1 - scrollR)).toFixed(2) + "px)";
			}

			function applyThemeToCanvases() {
				const P = theme();
				whaleCanvas.style.mixBlendMode = P.whaleBlend;
			}

			function resize() {
				W = window.innerWidth;
				H = window.innerHeight;
				const fluidDPR = Math.min(window.devicePixelRatio || 1, FLUID.dprCap);
				const gridDPR = Math.min(window.devicePixelRatio || 1, GRID.dprCap);
				const whaleDPR = Math.min(window.devicePixelRatio || 1, WHALE.dprCap);
				gridCanvas.width = Math.max(1, Math.round(W * gridDPR));
				gridCanvas.height = Math.max(1, Math.round(H * gridDPR));
				gctx.setTransform(gridDPR, 0, 0, gridDPR, 0, 0);
				whaleCanvas.width = Math.max(1, Math.round(W * whaleDPR));
				whaleCanvas.height = Math.max(1, Math.round(H * whaleDPR));
				wctx.setTransform(whaleDPR, 0, 0, whaleDPR, 0, 0);
				gridRebuild();
				/* 官方只提取一次像素数据;这里仅首次构建,避免缩放窗口时粒子随机尺寸跳变 */
				if (!whaleCount) buildWhaleData();
				measureContentCX();
				if (gl) fluidResize();
				updateScrollState();
			}

			function whaleW() {
				/* 官网:固定 800px 容器,鲸鱼宽 10.8 单位 = 视口 16.786 的 64.3% → 固定约 514px,不随屏幕缩放 */
				return WHALE.containerPx * WHALE.whaleRatio;
			}

			function whaleMouseNorm() {
				/* 官网:在固定 800×800 容器内归一化,超出容器不钳制 */
				const cSize = WHALE.containerPx;
				const left = contentCX - cSize / 2;
				const top = H * WHALE.baseY - cSize / 2;
				const nx = (mx - left) / cSize * 2 - 1;
				const ny = -((my - top) / cSize * 2 - 1);
				return { x: nx, y: ny };
			}

			function gridStep() {
				if (!GRID.enabled) return;
				let maxVel = 0;
				for (let i2 = 0; i2 < gridPts.length; i2++) {
					const p = gridPts[i2];
					const gdx = p.x - mx, gdy = p.y - my;
					const dist = Math.sqrt(gdx * gdx + gdy * gdy);
					if (dist < GRID.mouseRadius && dist > 0.1) {
						const e = (1 - dist / GRID.mouseRadius) * GRID.mouseForce;
						p.vx += (gdx / dist) * e * 0.1;
						p.vy += (gdy / dist) * e * 0.1;
					}
					p.vx += GRID.spring * (p.restX - p.x);
					p.vy += GRID.spring * (p.restY - p.y);
					p.vx *= GRID.damping; p.vy *= GRID.damping;
					p.x += p.vx; p.y += p.vy;
					const l = Math.abs(p.vx) + Math.abs(p.vy);
					if (l > maxVel) maxVel = l;
				}
				if (maxVel < GRID.idleStop && Date.now() - lastMove > 500) { gridIdle = true; return; }

				const P = theme();
				gctx.clearRect(0, 0, W, H);
				gctx.strokeStyle = P.gridLine + " " + P.lineOpacity + ")";
				gctx.lineWidth = GRID.lineWidth;
				for (let n = 0; n < gridRows; n++) {
					for (let r = 0; r < gridCols - 1; r++) {
						const a = gridPts[n * gridCols + r], b2 = gridPts[n * gridCols + r + 1];
						const o = b2.x - a.x, s2 = b2.y - a.y;
						const d = Math.sqrt(o * o + s2 * s2);
						if (d < GRID.minGap) continue;
						const l2 = o / d, m2 = s2 / d;
						gctx.beginPath();
						gctx.moveTo(a.x + GRID.lineInset * l2, a.y + GRID.lineInset * m2);
						gctx.lineTo(b2.x - GRID.lineInset * l2, b2.y - GRID.lineInset * m2);
						gctx.stroke();
					}
				}
				for (let r = 0; r < gridCols; r++) {
					for (let n = 0; n < gridRows - 1; n++) {
						const a2 = gridPts[n * gridCols + r], b3 = gridPts[(n + 1) * gridCols + r];
						const o2 = b3.x - a2.x, s3 = b3.y - a2.y;
						const d2b = Math.sqrt(o2 * o2 + s3 * s3);
						if (d2b < GRID.minGap) continue;
						const l3 = o2 / d2b, m3 = s3 / d2b;
						gctx.beginPath();
						gctx.moveTo(a2.x + GRID.lineInset * l3, a2.y + GRID.lineInset * m3);
						gctx.lineTo(b3.x - GRID.lineInset * l3, b3.y - GRID.lineInset * m3);
						gctx.stroke();
					}
				}
				gctx.fillStyle = P.gridLine + " " + P.dotOpacity + ")";
				for (let i3 = 0; i3 < gridPts.length; i3++) {
					const p2 = gridPts[i3];
					let dn = GRID.dotSize, an = P.dotOpacity;
					if (!isNaN(mx) && !isNaN(my)) {
						const ddx = p2.x - mx, ddy = p2.y - my;
						const dd = Math.sqrt(ddx * ddx + ddy * ddy);
						const l4 = Math.max(0, 1 - dd / GRID.mouseRadius);
						dn = GRID.dotSize + 2 * l4;
						an = P.dotOpacity + 0.4 * l4;
					}
					gctx.globalAlpha = an;
					const sz = 2 * dn;
					gctx.fillRect(p2.x - dn, p2.y - dn, sz, sz);
				}
				gctx.globalAlpha = 1;
			}

			function whaleStep(t, dt) {
				/* 侧栏折叠/展开不触发窗口 resize,每步轻量重测内容区中心 */
				measureContentCX();
				const I = t - mountT - WHALE.assemblyDelay;
				if (I < 0) return;
				const L = clamp01(I / WHALE.assemblyDuration);
				const D = 1 - Math.pow(1 - L, 3);
				const assembly = smoothstep(0, 1, D);
				const E = scrollE;
				const P = D * Math.max(0, 1 - 1.5 * E);
				const T = theme();
				const uR = T.whaleColor[0] * P, uG = T.whaleColor[1] * P, uB = T.whaleColor[2] * P;

				const rotZ = 0.04 * Math.sin(0.25 * t);
				const rotX = 0.05 * Math.sin(0.056 * t);
				const rotY = 0.1 * Math.sin(0.08 * t);
				const floatY = 0.15 * Math.sin(0.4 * t) + 2.5 * E;
				const objScale = (0.75 + 0.25 * D) * (1 - 0.5 * E);

				const unit = whaleW() / 10.8;
				const cx = contentCX;
				const cy = H * WHALE.baseY;

				const nm = mouseHasMoved ? whaleMouseNorm() : { x: 0, y: 0 };
				const mwx = nm.x * WHALE.viewport * 0.5;
				const mwy = nm.y * WHALE.viewport * 0.5;
				/* 官网系数按 30fps 步进换算为帧率无关形式:
				   decay .2/步 → 1-(1-.2)^(dt*30);strength 1-0.05^dt(官方直接按秒) */
				const lf = Math.min(1, 1 - Math.pow(1 - WHALE.mouse.decay, dt * WHALE.fps));
				if (!mouseHasMoved) { smoothMouseX = 0; smoothMouseY = 0; }
				else {
					if (mouseStrength < 0.01) { smoothMouseX = mwx; smoothMouseY = mwy; }
					else {
						smoothMouseX += (mwx - smoothMouseX) * lf;
						smoothMouseY += (mwy - smoothMouseY) * lf;
					}
				}
				const targetStr = mouseActive ? WHALE.mouse.strength : 0;
				mouseStrength += (targetStr - mouseStrength) * (1 - Math.pow(0.05, dt));
				const lightX = WHALE.light.x + smoothMouseX * WHALE.light.followX;
				const lightY = WHALE.light.y, lightZ = WHALE.light.z;
				const shadeMin = T.whaleShadeMin, shadeMax = T.whaleShadeMax;

				/* 官方:uMouse = 组逆矩阵 × 平滑后的鼠标世界坐标,再转换到
				   粒子所在的 Canvas 局部空间(y 向下 = 世界 y 取负) */
				const lx = smoothMouseX;
				const ly = smoothMouseY - floatY;
				const mRotX = (lx * Math.cos(rotZ) + ly * Math.sin(rotZ)) / objScale;
				const mRotY = (lx * Math.sin(rotZ) - ly * Math.cos(rotZ)) / objScale;

				const cz = Math.cos(rotZ), sz = Math.sin(rotZ);
				const cX = Math.cos(rotX), sX = Math.sin(rotX);
				const cY = Math.cos(rotY), sY = Math.sin(rotY);
				const MOUSE_R = WHALE.mouse.radius;

				wctx.clearRect(0, 0, W, H);
				wctx.save();
				/* 绘制统一用 Canvas 坐标:位移/旋转方向 = 世界变换的屏幕投影 */
				wctx.translate(cx, cy - floatY * unit);
				wctx.rotate(-rotZ);
				wctx.scale(objScale, objScale);
				wctx.globalCompositeOperation = T.whaleComp;

				for (let i = 0; i < whaleCount; i++) {
					const pt = whalePts[i];
					const idx = pt.idx;

					const ax = pt.scx + (pt.sx - pt.scx) * assembly;
					const ay = pt.scy + (pt.sy - pt.scy) * assembly;
					let px2 = ax, py2 = ay;

					const loose = WHALE.loose * (0.25 + 0.75 * pt.edge) * assembly;
					if (loose > 0.001) {
						const h1 = Math.sin(idx * 12.9898) * 43758.5453;
						const h2 = Math.sin(idx * 78.2330) * 12543.1230;
						const jx = (h1 - Math.floor(h1)) - 0.5;
						const jy = (h2 - Math.floor(h2)) - 0.5;
						px2 += jx * 0.05 * loose;
						py2 += jy * 0.05 * loose;
						px2 += Math.sin(t * 0.50 + idx * 0.53) * 0.06 * loose;
						py2 -= Math.cos(t * 0.42 + idx * 0.71) * 0.06 * loose;
						const tailF = smoothstep(0.5, 4.5, pt.sx) * WHALE.loose * assembly;
						py2 -= Math.sin(t * 1.1 - pt.sx * 0.7) * 0.1 * tailF;
					}

					const scatter = WHALE.scatterAmount * Math.min(1, 1.5 * E);
					if (scatter > 0.001) {
						const disperse = scatter * (0.5 + 0.5 * pt.edge);
						px2 += (pt.scx - px2) * disperse;
						py2 += (pt.scy - py2) * disperse;
						py2 += Math.sin(t * 0.6 + idx * 0.3) * disperse * 0.6;
					}

					if (assembly < 0.9) {
						const scat = smoothstep(0.9, 0, assembly);
						px2 += Math.sin(t * 0.5 + idx * 0.1) * 0.2 * scat;
						py2 -= Math.cos(t * 0.4 + idx * 0.07) * 0.2 * scat;
					}

					if (assembly > 0.8) {
						const mouseEffect = (assembly - 0.8) * 5;
						const mdx2 = px2 - mRotX, mdy2 = py2 - mRotY;
						const mouseDist = Math.sqrt(mdx2 * mdx2 + mdy2 * mdy2);
						if (mouseDist < MOUSE_R && mouseDist > 0.001) {
							const mt = 1 - mouseDist / MOUSE_R;
							const force = mt * mt * mt * mouseEffect * mouseStrength;
							const noiseAng = Math.sin(idx * 0.37 + t * 0.5) * WHALE.mouse.distort;
							const ca = Math.cos(noiseAng), sa = Math.sin(noiseAng);
							const radX = mdx2 / mouseDist, radY = mdy2 / mouseDist;
							const pushX = radX * ca - radY * sa;
							const pushY = radX * sa + radY * ca;
							px2 += pushX * force * 2.0;
							py2 += pushY * force * 2.0;
						}
					}

					/* 光照用世界坐标(y 向上):粒子 Canvas 局部 y 取负后进旋转链 */
					const pyw = -py2;
					const x1 = px2, y1 = pyw * cX, z1 = pyw * sX;
					const x2 = x1 * cY + z1 * sY, y2 = y1, z2 = -x1 * sY + z1 * cY;
					const x3 = x2 * cz - y2 * sz, y3 = x2 * sz + y2 * cz, z3 = z2;
					const wx = x3 * objScale;
					const wy = y3 * objScale + floatY;
					const wz = z3 * objScale;

					const ldx = wx - lightX, ldy = wy - lightY, ldz = wz - lightZ;
					const lightDist = Math.sqrt(ldx * ldx + ldy * ldy + ldz * ldz);
					let lit = Math.max(0, Math.min(1, 1 - lightDist / WHALE.light.range));
					lit *= lit;
					const vLight = shadeMin + (shadeMax - shadeMin) * lit;

					const gd = Math.sqrt(ax * ax + ay * ay);
					const glow = smoothstep(WHALE.glowRadius, 0, gd) * WHALE.glowAmp * D;

					const baseAlpha = WHALE.baseAlpha0 + (WHALE.baseAlpha1 - WHALE.baseAlpha0) * D;
					let alpha = pt.opacity * (baseAlpha + glow);
					const shimmer = Math.sin(t * 1.5 + ax * 5 + ay * 3) * 0.1 + 0.9;
					alpha *= shimmer * Math.min(vLight, 1);
					if (alpha <= 0.004) continue;

					let crr = (uR + glow * T.whaleGlowRGB[0]) * vLight;
					let cgg = (uG + glow * T.whaleGlowRGB[1]) * vLight;
					let cbb = (uB + glow * T.whaleGlowRGB[2]) * vLight;
					const warmT = Math.max(0, Math.min(1, vLight - 1));
					crr = crr * (1 - warmT) + crr * T.whaleWarm[0] * warmT;
					cgg = cgg * (1 - warmT) + cgg * T.whaleWarm[1] * warmT;
					cbb = cbb * (1 - warmT) + cbb * T.whaleWarm[2] * warmT;

					const size = WHALE.boxSize * unit * pt.randScale;

					const pxPx = px2 * unit;
					const pyPx = py2 * unit;
					wctx.fillStyle = "rgba(" +
						Math.round(Math.min(255, Math.max(0, crr * 255))) + "," +
						Math.round(Math.min(255, Math.max(0, cgg * 255))) + "," +
						Math.round(Math.min(255, Math.max(0, cbb * 255))) + "," +
						Math.min(1, alpha).toFixed(3) + ")";
					wctx.fillRect(pxPx - size / 2, pyPx - size / 2, size, size);
				}
				wctx.restore();
			}

			function frame(now) {
				if (stopped) return;
				/* 先排队下一帧,再执行本帧:任何异常都不会中断渲染循环 */
				rafId = requestAnimationFrame(frame);
				try {
					const t = now / 1000;
					const dt = Math.min(0.05, Math.max(0.001, t - lastT));
					lastT = t;
					if (mountT < 0) mountT = t;
					const showWide = W >= WHALE.minWidth;

					if (now - lastGrid >= 1000 / GRID.fps) {
						lastGrid = now;
						fluidFrame();
						if (showWide) gridStep();
					}

					if (showWide && now - lastWhale >= 1000 / WHALE.fps) {
						lastWhale = now;
						/* 真实步长时间:官网 30fps 步进的系数以秒为单位换算,帧率无关 */
						const wt = now / 1000;
						const wdt = lastWhaleT < 0 ? 1 / WHALE.fps : Math.min(0.1, Math.max(0.001, wt - lastWhaleT));
						lastWhaleT = wt;
						whaleStep(wt, wdt);
					}
				} catch (err) {
					if (!frameErrorLogged) {
						frameErrorLogged = true;
						if (window.__dshHomepageSkin) window.__dshHomepageSkin.state = "error:" + err.message;
					}
				}
			}

			function start() {
				if (canvasMounted) return; /* boot 重试防重复挂载 */
				canvasMounted = true;
				window.__dshHomepageSkin = window.__dshHomepageSkin || { state: "pending" };
				WHALE_PATH = makeWhalePath();

				const insertBefore = (el) => {
					const host = document.getElementById("root") || document.body;
					if (host.parentNode && typeof host.parentNode.insertBefore === "function") {
						host.parentNode.insertBefore(el, host);
					} else {
						document.body.appendChild(el);
					}
				};

				fluidCanvas = document.createElement("canvas");
				fluidCanvas.setAttribute("aria-hidden", "true");
				fluidCanvas.style.cssText =
					"position:fixed;inset:0;z-index:0;pointer-events:none;width:100%;height:100%;display:block;" +
					"mask-image:" + MASK + ";-webkit-mask-image:" + MASK + ";" +
					"filter:blur(" + HERO.fluidBlur + "px);opacity:0;";
				insertBefore(fluidCanvas);

				/* WebGL 上下文丢失防护:丢失时停用流体(网格/鲸鱼照常),恢复后自动重建 */
				on("webglcontextlost", (e) => { e.preventDefault(); gl = null; }, fluidCanvas);
				on("webglcontextrestored", () => { initFluid(); }, fluidCanvas);

				whaleCanvas = document.createElement("canvas");
				whaleCanvas.setAttribute("aria-hidden", "true");
				whaleCanvas.style.cssText =
					"position:fixed;inset:0;z-index:0;pointer-events:none;width:100%;height:100%;display:block;" +
					"mix-blend-mode:screen;";
				insertBefore(whaleCanvas);
				wctx = whaleCanvas.getContext("2d");

				gridCanvas = document.createElement("canvas");
				gridCanvas.setAttribute("aria-hidden", "true");
				gridCanvas.style.cssText =
					"position:fixed;inset:0;z-index:0;pointer-events:none;width:100%;height:100%;display:block;" +
					"mask-image:" + MASK + ";-webkit-mask-image:" + MASK + ";";
				insertBefore(gridCanvas);
				gctx = gridCanvas.getContext("2d");

				applyThemeToCanvases();

				/* Canvas 挂载成功后才点亮门控属性 → 皮肤 CSS 才开始生效 */
				document.body.setAttribute("data-dsh-homepage-skin", "");

				on("pointermove", (e) => {
					mx = e.clientX; my = e.clientY;
					mouseHasMoved = true; mouseActive = true; lastMove = Date.now();
					fluidMouse.x = mx / Math.max(1, W);
					fluidMouse.y = 1 - my / Math.max(1, H);
					gridIdle = false;
				}, window, { passive: true });
				on("pointerdown", (e) => {
					if (e.pointerType === "mouse") return;
					mx = e.clientX; my = e.clientY;
					mouseHasMoved = true; mouseActive = true; lastMove = Date.now();
					fluidMouse.x = mx / Math.max(1, W);
					fluidMouse.y = 1 - my / Math.max(1, H);
					gridIdle = false;
				}, window, { passive: true });
				on("mouseleave", () => { mouseActive = false; }, window, { passive: true });
				on("visibilitychange", () => { if (document.hidden) { mouseActive = false; } }, document);
				on("scroll", updateScrollState, window, { passive: true });
				on("scroll", updateScrollState, document, { passive: true, capture: true });

				themeObserver = new MutationObserver(() => {
					const dark = document.body && document.body.hasAttribute("data-ds-dark-theme");
					const next = dark ? "dark" : "light";
					if (next !== currentTheme) {
						currentTheme = next;
						applyThemeToCanvases();
					}
				});
				themeObserver.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
				disposed.push(() => themeObserver.disconnect());

				resizeObserver = new ResizeObserver(resize);
				resizeObserver.observe(document.body);
				disposed.push(() => resizeObserver.disconnect());

				/* fluid fade-in: opacity 0 → 1, 1.8s ease-out */
				(function fadeInFluid() {
					const t0f = performance.now();
					const step = (now) => {
						if (stopped || !fluidCanvas) return;
						const p = Math.min(1, (now - t0f) / (HERO.fadeInDuration * 1000));
						const eased = 1 - Math.pow(1 - p, 3);
						fluidCanvas.style.opacity = eased.toFixed(4);
						if (p < 1) requestAnimationFrame(step);
					};
					requestAnimationFrame(step);
				})();

				resize();
				initFluid();
				requestAnimationFrame((now) => { lastT = now / 1000; frame(now); });
			}

			function stop() {
				stopped = true;
				cancelAnimationFrame(rafId);
				if (iv) { clearInterval(iv); iv = null; }
				disposed.forEach((d) => { try { d(); } catch (e) { /* noop */ } });
				disposed = [];
				if (gl) {
					try {
						if (glFbo) glFbo.forEach((f) => { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); });
						const lose = gl.getExtension("WEBGL_lose_context");
						if (lose) lose.loseContext();
					} catch (e) { /* noop */ }
					gl = null;
				}
				if (fluidCanvas) fluidCanvas.remove();
				if (gridCanvas) gridCanvas.remove();
				if (whaleCanvas) whaleCanvas.remove();
				fluidCanvas = gridCanvas = whaleCanvas = null;
				/* 摘掉门控属性 → 皮肤 CSS 立即全部失效 */
				if (document.body) document.body.removeAttribute("data-dsh-homepage-skin");
				if (window.__dshHomepageSkin) window.__dshHomepageSkin.state = "stopped";
			}

			return {
				boot() {
					const t0 = Date.now();
					if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
						if (window.__dshHomepageSkin) window.__dshHomepageSkin.state = "reduced-motion";
						return;
					}
					/* 粗指针设备:官网关闭流体笔刷且整个网格组件不渲染 */
					if (window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches) {
						FLUID.brushEnabled = false;
						GRID.enabled = false;
					}
					iv = setInterval(() => {
						if (boot()) { clearInterval(iv); iv = null; }
						else if (Date.now() - t0 > HERO.waitMs) {
							/* 超时未挂载:回滚门控属性,保证皮肤 CSS 永不生效 */
							clearInterval(iv); iv = null;
							if (document.body) document.body.removeAttribute("data-dsh-homepage-skin");
							if (window.__dshHomepageSkin) window.__dshHomepageSkin.state = "timeout";
						}
					}, 400);
					if (window.MutationObserver && !started) {
						const mo = new MutationObserver(() => {
							if (started || stopped) { mo.disconnect(); return; }
							boot();
						});
						mo.observe(document.documentElement, { childList: true, subtree: true });
						disposed.push(() => mo.disconnect());
					}
				},
				stop
			};
		}

		function createEnabledStore() {
			return (0, _runtime_client.defineStore)({
				init: () => ({
					enabled: true,
					revision: -1
				}),
				actions: {
					sync: (d, enabled, revision) => {
						if (revision <= d.revision) return;
						d.enabled = enabled;
						d.revision = revision;
					}
				}
			});
		}

		const styles = {
			row: {
				borderBottom: "1px solid var(--dsw-alias-border-l2)",
				display: "flex",
				flexDirection: "column",
				gap: "8px",
				padding: "16px 0"
			},
			head: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "12px"
			},
			title: {
				color: "var(--dsw-alias-label-primary)",
				fontSize: "14px",
				lineHeight: "22px"
			},
			hint: {
				color: "var(--dsw-alias-label-tertiary)",
				fontSize: "12px",
				lineHeight: "18px"
			},
			swatch: {
				width: "18px",
				height: "18px",
				borderRadius: "999px",
				background: "linear-gradient(135deg, #4D6BFE 0%, #204a7e 100%)",
				flexShrink: 0
			},
			titleGroup: {
				display: "flex",
				alignItems: "center",
				gap: "8px"
			},
			statusDot: {
				width: "7px",
				height: "7px",
				borderRadius: "999px",
				background: "var(--dsw-alias-state-success-primary)",
				flexShrink: 0,
				display: "inline-block"
			}
		};

		function EnabledRow({ t, setEnabled, useStore }) {
			const enabled = useStore((s) => s.enabled);
			return (0, react_jsx_runtime.jsxs)("div", {
				style: styles.row,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.head,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								style: styles.titleGroup,
								children: [
									(0, react_jsx_runtime.jsx)("span", { style: styles.swatch, "aria-hidden": true }),
									(0, react_jsx_runtime.jsx)("div", { style: styles.title, children: t("title") }),
									enabled ? (0, react_jsx_runtime.jsx)("span", {
										style: styles.statusDot,
										title: t("statusOn"),
										"aria-label": t("statusOn")
									}) : null
								]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: enabled ? "dsh-homepage-skin-btn dsh-homepage-skin-btn-close" : "dsh-homepage-skin-btn dsh-homepage-skin-btn-open",
								"aria-pressed": enabled,
								onClick: () => setEnabled(!enabled),
								children: enabled ? t("close") : t("open")
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("div", { style: styles.hint, children: t("hint") })
				]
			});
		}

		const inject = ["slots", "locale"];

		function apply(ctx) {
			let engine = null;
			let revision = 0;
			let bound = null;
			let active = false;
			const store = createEnabledStore();

			/* 同模块实例防重入;teardown 时复位,允许再次挂载 */
			if (active) return;
			active = true;

			const startSkin = () => {
				if (engine) return;
				engine = createEngine();
				engine.boot();
			};

			const stopSkin = () => {
				if (engine) {
					engine.stop();
					engine = null;
				}
			};

			const sync = (enabled) => {
				revision += 1;
				bound?.sync(enabled, revision);
			};

			/* 样式元素常驻(包含设置行按钮样式);
			   皮肤规则全部由 body[data-dsh-homepage-skin] 门控,引擎挂载后才点亮 */
			injectStyle();

			if (readEnabled()) startSkin();
			sync(readEnabled());

			ctx.effect(() => () => {
				stopSkin();
				removeStyle();
				active = false;
			}, "dsh-homepage-skin: teardown");

			ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh, en }), "dsh-homepage-skin: locale");

			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "homepage-skin",
				order: 22,
				store,
				locale: SETTINGS_NS,
				inject: (actions) => {
					bound = actions;
					sync(readEnabled());
					return {
						setEnabled: (enabled) => {
							writeEnabled(enabled);
							if (enabled) startSkin();
							else stopSkin();
							sync(enabled);
						}
					};
				}
			}, EnabledRow));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
