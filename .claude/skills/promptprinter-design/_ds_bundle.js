/* @ds-bundle: {"format":4,"namespace":"PromptPrinterDesignSystem_dfd779","components":[{"name":"Floaters","sourcePath":"components/brand/floaters/Floaters.jsx"},{"name":"FLOATER_PRESETS","sourcePath":"components/brand/floaters/Floaters.jsx"},{"name":"Logo","sourcePath":"components/brand/logo/Logo.jsx"},{"name":"LogoMark","sourcePath":"components/brand/logo/Logo.jsx"},{"name":"DolphinLoader","sourcePath":"components/brand/mascot/DolphinLoader.jsx"},{"name":"MASCOT_STATES","sourcePath":"components/brand/mascot/Mascot.jsx"},{"name":"Mascot","sourcePath":"components/brand/mascot/Mascot.jsx"},{"name":"AnimatedMascot","sourcePath":"components/brand/mascot/Mascot.jsx"},{"name":"SuccessCelebration","sourcePath":"components/brand/mascot/SuccessCelebration.jsx"},{"name":"TOOL_VISUAL","sourcePath":"components/brand/tool-logos/ToolLogo.jsx"},{"name":"ToolLogo","sourcePath":"components/brand/tool-logos/ToolLogo.jsx"},{"name":"Badge","sourcePath":"components/core/badge/Badge.jsx"},{"name":"PlanBadge","sourcePath":"components/core/badge/Badge.jsx"},{"name":"Button","sourcePath":"components/core/button/Button.jsx"},{"name":"Card","sourcePath":"components/core/card/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/card/Card.jsx"},{"name":"CardTitle","sourcePath":"components/core/card/Card.jsx"},{"name":"CardDescription","sourcePath":"components/core/card/Card.jsx"},{"name":"CardContent","sourcePath":"components/core/card/Card.jsx"},{"name":"CardFooter","sourcePath":"components/core/card/Card.jsx"},{"name":"Icon","sourcePath":"components/core/icon/Icon.jsx"},{"name":"IconSpinKeyframes","sourcePath":"components/core/icon/Icon.jsx"},{"name":"ICON_NAMES","sourcePath":"components/core/icon/Icon.jsx"},{"name":"Input","sourcePath":"components/core/input/Input.jsx"},{"name":"Textarea","sourcePath":"components/core/input/Input.jsx"},{"name":"Label","sourcePath":"components/core/input/Label.jsx"},{"name":"PasswordInput","sourcePath":"components/core/input/PasswordInput.jsx"},{"name":"Skeleton","sourcePath":"components/core/skeleton/Skeleton.jsx"},{"name":"StatCardSkeleton","sourcePath":"components/core/skeleton/Skeleton.jsx"},{"name":"ProjectCardSkeleton","sourcePath":"components/core/skeleton/Skeleton.jsx"},{"name":"ToastProvider","sourcePath":"components/feedback/toast/ToastProvider.jsx"},{"name":"UsageMeter","sourcePath":"components/feedback/usage-meter/UsageMeter.jsx"},{"name":"MenuToggleIcon","sourcePath":"components/navigation/menu-toggle-icon/MenuToggleIcon.jsx"}],"sourceHashes":{"components/brand/floaters/Floaters.jsx":"3b6c998985d5","components/brand/logo/Logo.jsx":"101879707e42","components/brand/mascot/DolphinLoader.jsx":"2e825cb76cb9","components/brand/mascot/Mascot.jsx":"03279fe4515c","components/brand/mascot/SuccessCelebration.jsx":"a10c0622bea1","components/brand/tool-logos/ToolLogo.jsx":"e05092beb010","components/core/badge/Badge.jsx":"ee80e3649505","components/core/button/Button.jsx":"e3c1ffe8c884","components/core/card/Card.jsx":"12c31234ce21","components/core/icon/Icon.jsx":"522f24751695","components/core/input/Input.jsx":"b35624c1abff","components/core/input/Label.jsx":"b97afe7a924b","components/core/input/PasswordInput.jsx":"ab1e4f39b56e","components/core/skeleton/Skeleton.jsx":"d385471579e0","components/feedback/toast/ToastProvider.jsx":"466cec71aced","components/feedback/usage-meter/UsageMeter.jsx":"86a343b67ec1","components/navigation/menu-toggle-icon/MenuToggleIcon.jsx":"3528452fb28a","doc-page.js":"371bab66f42d"},"inlinedExternals":[],"unexposedExports":[{"name":"toolVisual","sourcePath":"components/brand/tool-logos/ToolLogo.jsx"},{"name":"useToast","sourcePath":"components/feedback/toast/ToastProvider.jsx"}]} */

(() => {

const __ds_ns = (window.PromptPrinterDesignSystem_dfd779 = window.PromptPrinterDesignSystem_dfd779 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/floaters/Floaters.jsx
try { (() => {
/**
 * Ambient decoration adrift around a section — rising bubbles + a few
 * sparks (Finn's ocean). Pass a fixed, deterministic `items` array (not
 * randomized per render) so density/spread match that section's own size.
 * Renders nothing under prefers-reduced-motion (handled by the animation
 * itself pausing via tokens/motion.css's global reduced-motion rule).
 * Needs a `position:relative` (usually `overflow:hidden`) ancestor.
 */
function Floaters({
  items = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement("style", null, `@keyframes pp-floater{0%,100%{transform:translateY(0);opacity:.3}50%{transform:translateY(-16px);opacity:.85}}`), items.map((f, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      position: "absolute",
      top: f.top,
      left: f.left,
      animation: `pp-floater ${f.duration}s ease-in-out ${f.delay}s infinite`
    }
  }, f.kind === "star" ? /*#__PURE__*/React.createElement("svg", {
    width: f.size,
    height: f.size,
    viewBox: "0 0 24 24",
    fill: "hsl(var(--accent-warm))",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.7 6.6-.9z"
  })) : /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      width: f.size,
      height: f.size,
      borderRadius: "50%",
      border: "1px solid hsl(var(--accent) / 0.4)",
      background: "hsl(var(--accent) / 0.1)"
    }
  }))));
}

/** A few ready-made deterministic layouts for common section sizes. */
const FLOATER_PRESETS = {
  hero: [{
    kind: "star",
    top: "4%",
    left: "10%",
    size: 15,
    delay: 0,
    duration: 3.5
  }, {
    kind: "bubble",
    top: "8%",
    left: "88%",
    size: 20,
    delay: 0.6,
    duration: 4.8
  }, {
    kind: "star",
    top: "22%",
    left: "94%",
    size: 10,
    delay: 1.3,
    duration: 3.1
  }, {
    kind: "bubble",
    top: "38%",
    left: "4%",
    size: 16,
    delay: 0.3,
    duration: 4.4
  }, {
    kind: "star",
    top: "55%",
    left: "3%",
    size: 11,
    delay: 1.7,
    duration: 3.7
  }, {
    kind: "bubble",
    top: "68%",
    left: "95%",
    size: 24,
    delay: 0.9,
    duration: 5.2
  }],
  section: [{
    kind: "star",
    top: "5%",
    left: "9%",
    size: 13,
    delay: 0.2,
    duration: 3.4
  }, {
    kind: "bubble",
    top: "14%",
    left: "90%",
    size: 18,
    delay: 0.8,
    duration: 4.6
  }, {
    kind: "star",
    top: "40%",
    left: "95%",
    size: 10,
    delay: 1.4,
    duration: 3.2
  }, {
    kind: "bubble",
    top: "60%",
    left: "3%",
    size: 16,
    delay: 0.5,
    duration: 4.3
  }, {
    kind: "star",
    top: "90%",
    left: "85%",
    size: 9,
    delay: 1.0,
    duration: 3.5
  }]
};
Object.assign(__ds_scope, { Floaters, FLOATER_PRESETS });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/floaters/Floaters.jsx", error: String((e && e.message) || e) }); }

// components/brand/logo/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Brand lockup: the dolphin mark + "PromptPrinter" wordmark. The mark is the
 * single source PNG (assets/mascot/dolphin.png), so swapping that file
 * reskins the logo everywhere. The wordmark is real text — crisp at any
 * size, theme-aware.
 */
function Logo({
  className = "",
  size = 28,
  iconOnly = false,
  accentWordmark = false,
  collapsed,
  assetsBase = "../../../assets/mascot",
  style,
  ...props
}) {
  const isCollapsible = collapsed !== undefined;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: className,
    "aria-label": "PromptPrinter",
    role: "img",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("style", null, `.pp-logo-word{transition:max-width .3s ease-out,opacity .3s ease-out;overflow:hidden;white-space:nowrap;display:inline-block;}`), /*#__PURE__*/React.createElement("img", {
    src: `${assetsBase}/dolphin.png`,
    width: size,
    height: size,
    alt: "",
    style: {
      display: "block",
      userSelect: "none",
      flexShrink: 0
    }
  }), !iconOnly && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: isCollapsible ? "pp-logo-word" : "",
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: 600,
      lineHeight: 1,
      letterSpacing: "-0.02em",
      fontSize: Math.round(size * 0.66),
      ...(isCollapsible ? {
        maxWidth: collapsed ? 0 : size * 6,
        opacity: collapsed ? 0 : 1
      } : {})
    }
  }, accentWordmark ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "hsl(var(--accent-text))"
    }
  }, "Prompt"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "hsl(var(--foreground))"
    }
  }, "Printer")) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: "hsl(var(--foreground))"
    }
  }, "PromptPrinter")));
}

/** Compact mark for tight spots (favicons, avatars, collapsed rails) — just the dolphin. */
function LogoMark({
  size = 28,
  assetsBase,
  className
}) {
  return /*#__PURE__*/React.createElement(Logo, {
    size: size,
    iconOnly: true,
    assetsBase: assetsBase,
    className: className
  });
}
Object.assign(__ds_scope, { Logo, LogoMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/logo/Logo.jsx", error: String((e && e.message) || e) }); }

// components/brand/mascot/DolphinLoader.jsx
try { (() => {
/**
 * Looping loading indicator built from the transparent mascot PNG: Finn bobs
 * and sways (swimming) while small bubbles drift upward. Fully transparent,
 * works on any surface. Respects prefers-reduced-motion (tokens/motion.css).
 */
function DolphinLoader({
  size = 36,
  label,
  assetsBase = "../../../assets/mascot",
  className = ""
}) {
  const bubble = Math.max(2, Math.round(size * 0.12));
  return /*#__PURE__*/React.createElement("span", {
    role: "status",
    "aria-label": label ?? "Lädt…",
    className: className,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("style", null, `@keyframes pp-loader-bubble{0%{opacity:0;transform:translateY(0) scale(.5)}15%{opacity:.85}100%{opacity:0;transform:translateY(-${size * 0.85}px) scale(.7)}}`), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-block",
      width: size,
      height: size,
      flexShrink: 0
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    "aria-hidden": "true",
    style: {
      position: "absolute",
      borderRadius: "50%",
      background: "hsl(var(--accent-text) / 0.4)",
      width: bubble,
      height: bubble,
      left: `${28 + i * 20}%`,
      bottom: 2,
      animation: "pp-loader-bubble 1.9s ease-out infinite",
      animationDelay: `${i * 0.55}s`
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      animation: "pp-bob 2.6s ease-in-out infinite"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: `${assetsBase}/dolphin-waiting.png`,
    width: size,
    height: size,
    alt: "",
    style: {
      userSelect: "none",
      display: "block"
    }
  }))), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "hsl(var(--foreground) / 0.55)"
    }
  }, label));
}
Object.assign(__ds_scope, { DolphinLoader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/mascot/DolphinLoader.jsx", error: String((e && e.message) || e) }); }

// components/brand/mascot/Mascot.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Finn's 14-state registry — filenames under assets/mascot (see readme →
 * Iconography). `assetsBase` should be the relative path from the consuming
 * page to that folder (defaults match this component's own card depth).
 */
const MASCOT_STATES = {
  idle: {
    file: "dolphin.png",
    alt: "Finn, der PromptPrinter-Delfin",
    motion: "float"
  },
  welcoming: {
    file: "dolphin-welcoming.png",
    alt: "Finn winkt dir zur Begrüßung zu",
    motion: "float"
  },
  curious: {
    file: "dolphin-curious.png",
    alt: "Finn ist neugierig auf deine Idee",
    motion: "lean"
  },
  listening: {
    file: "dolphin-listening.png",
    alt: "Finn hört dir aufmerksam zu",
    motion: "nod"
  },
  thinking: {
    file: "dolphin-thinking.png",
    alt: "Finn denkt über deine Idee nach",
    motion: "think"
  },
  researching: {
    file: "dolphin-researching.png",
    alt: "Finn recherchiert die passenden Tools",
    motion: "lean"
  },
  building: {
    file: "dolphin-building.png",
    alt: "Finn baut dein Projekt",
    motion: "float"
  },
  organizing: {
    file: "dolphin-organizing.png",
    alt: "Finn sortiert alles zu einem Paket",
    motion: "float"
  },
  explaining: {
    file: "dolphin-explaining.png",
    alt: "Finn erklärt dir das Ergebnis",
    motion: "lean"
  },
  delivering: {
    file: "dolphin-delivering.png",
    alt: "Finn übergibt dir dein fertiges Bau-Paket",
    motion: "float"
  },
  celebrating: {
    file: "dolphin-celebrating.png",
    alt: "Finn feiert mit dir",
    motion: "cheer"
  },
  helping: {
    file: "dolphin-helping.png",
    alt: "Finn streckt dir helfend die Flosse hin",
    motion: "peek"
  },
  waiting: {
    file: "dolphin-waiting.png",
    alt: "Finn wartet geduldig",
    motion: "bob"
  },
  sad: {
    file: "dolphin-sad.png",
    alt: "Finn ist betrübt",
    motion: "sigh"
  }
};
const MOTION_DURATION = {
  float: 4,
  lean: 5,
  nod: 1.8,
  think: 3.2,
  bob: 2.6,
  cheer: 1.4,
  peek: 3.4,
  sigh: 4.4
};

/**
 * Finn, the PromptPrinter dolphin — static artwork. Prefer `state` (resolved
 * through MASCOT_STATES) so artwork stays centralized; `src` is a manual
 * override. For idle animation use <AnimatedMascot> instead.
 */
function Mascot({
  size = 96,
  className = "",
  alt = "",
  priority = false,
  state,
  src,
  assetsBase = "../../../assets/mascot",
  style,
  ...props
}) {
  const resolved = src ?? `${assetsBase}/${state ? MASCOT_STATES[state].file : "dolphin.png"}`;
  const resolvedAlt = alt || (state ? MASCOT_STATES[state].alt : "");
  return /*#__PURE__*/React.createElement("img", _extends({
    src: resolved,
    width: size,
    height: size,
    alt: alt === undefined ? resolvedAlt : alt,
    loading: priority ? "eager" : "lazy",
    className: className,
    style: {
      userSelect: "none",
      display: "inline-block",
      ...style
    }
  }, props));
}

/**
 * Finn with his state's idle animation (gentle, spring-like, never hectic —
 * see DESIGN.md → Finn's World, "Finn-Physik"). Respects
 * prefers-reduced-motion globally via tokens/motion.css. Requires styles.css
 * linked (uses the pp-float/pp-lean/… keyframes it defines).
 */
function AnimatedMascot({
  state,
  size = 96,
  className = "",
  alt = "",
  priority = false,
  motion,
  assetsBase,
  style,
  ...props
}) {
  const preset = motion || MASCOT_STATES[state]?.motion || "float";
  const duration = MOTION_DURATION[preset] || 4;
  return /*#__PURE__*/React.createElement(Mascot, _extends({
    state: state,
    size: size,
    alt: alt,
    priority: priority,
    assetsBase: assetsBase,
    className: className,
    style: {
      animation: `pp-${preset} ${duration}s ease-in-out infinite`,
      ...style
    }
  }, props));
}
Object.assign(__ds_scope, { MASCOT_STATES, Mascot, AnimatedMascot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/mascot/Mascot.jsx", error: String((e && e.message) || e) }); }

// components/brand/mascot/SuccessCelebration.jsx
try { (() => {
const {
  useEffect,
  useRef
} = React;
const CONFETTI = [{
  x: -130,
  y: -70,
  r: -50,
  d: 0.0,
  c: "var(--accent)",
  w: 8,
  h: 8
}, {
  x: 125,
  y: -90,
  r: 40,
  d: 0.06,
  c: "var(--warning)",
  w: 7,
  h: 11
}, {
  x: -90,
  y: -120,
  r: 20,
  d: 0.12,
  c: "var(--success)",
  w: 9,
  h: 9
}, {
  x: 95,
  y: -120,
  r: -30,
  d: 0.04,
  c: "var(--destructive)",
  w: 7,
  h: 7
}, {
  x: -150,
  y: 10,
  r: 60,
  d: 0.1,
  c: "var(--accent-text)",
  w: 8,
  h: 10
}, {
  x: 150,
  y: 0,
  r: -45,
  d: 0.14,
  c: "var(--success)",
  w: 8,
  h: 8
}, {
  x: -60,
  y: 130,
  r: 35,
  d: 0.18,
  c: "var(--warning)",
  w: 9,
  h: 9
}, {
  x: 70,
  y: 125,
  r: -25,
  d: 0.08,
  c: "var(--accent)",
  w: 7,
  h: 11
}, {
  x: 20,
  y: -140,
  r: 50,
  d: 0.16,
  c: "var(--accent)",
  w: 7,
  h: 7
}, {
  x: -20,
  y: 150,
  r: -55,
  d: 0.22,
  c: "var(--destructive)",
  w: 8,
  h: 8
}, {
  x: 135,
  y: 70,
  r: 30,
  d: 0.2,
  c: "var(--warning)",
  w: 8,
  h: 10
}, {
  x: -135,
  y: 75,
  r: -35,
  d: 0.12,
  c: "var(--success)",
  w: 7,
  h: 9
}];

/**
 * Full-screen celebratory overlay: the dolphin pops in amid a confetti burst
 * over a blurred backdrop, then `onDone` fires after `durationMs`. Use for
 * every "it worked" moment (login, signup, export, first package built…).
 */
function SuccessCelebration({
  message,
  description,
  onDone,
  durationMs = 2200,
  assetsBase = "../../../assets/mascot",
  className = ""
}) {
  const doneRef = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs, onDone]);
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    "aria-live": "polite",
    className: className,
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 200,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 0,
      padding: "0 24px",
      textAlign: "center",
      background: "hsl(var(--background) / 0.85)",
      backdropFilter: "blur(12px)",
      animation: "pp-fade-in 0.2s",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("style", null, `
@keyframes pp-confetti{0%{opacity:0;transform:translate(0,0) scale(0) rotate(0deg)}15%{opacity:1}70%{opacity:1}100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(.7) rotate(var(--rot))}}
@keyframes pp-celebrate-pop{0%{opacity:0;transform:scale(.5) translateY(16px)}60%{opacity:1;transform:scale(1.05) translateY(-8px)}100%{opacity:1;transform:scale(1) translateY(0)}}
`), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, CONFETTI.map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    "aria-hidden": "true",
    style: {
      position: "absolute",
      left: "50%",
      top: "50%",
      borderRadius: 1,
      width: p.w,
      height: p.h,
      background: `hsl(${p.c})`,
      "--tx": `${p.x}px`,
      "--ty": `${p.y}px`,
      "--rot": `${p.r}deg`,
      animation: `pp-confetti 1.6s ease-out ${p.d}s both`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      animation: "pp-celebrate-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: `${assetsBase}/dolphin-celebrating.png`,
    width: 184,
    height: 184,
    alt: "",
    style: {
      userSelect: "none",
      display: "block"
    }
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 20,
      fontSize: 19,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: "hsl(var(--foreground))",
      animation: "pp-fade-up 0.3s 0.18s both"
    }
  }, message), description && /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 6,
      fontSize: 13.5,
      color: "hsl(var(--foreground) / 0.6)",
      animation: "pp-fade-in 0.3s 0.28s both"
    }
  }, description));
}
Object.assign(__ds_scope, { SuccessCelebration });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/mascot/SuccessCelebration.jsx", error: String((e && e.message) || e) }); }

// components/brand/tool-logos/ToolLogo.jsx
try { (() => {
/**
 * Inline brand marks for every build-target tool the product offers, no
 * network assets. `TOOL_VISUAL` carries each tool's accent color + a
 * one-line blurb for pickers. Real brand colors are the allowed exception to
 * "no raw hex in components" (provider marks must keep their real colors).
 */
const TOOL_VISUAL = {
  Claude: {
    color: "#D97757",
    blurb: "Stark für Prompts"
  },
  ChatGPT: {
    color: "#10A37F",
    blurb: "Strukturierte Outputs"
  },
  Gemini: {
    color: "#4285F4",
    blurb: "Recherche & Kontext"
  },
  Lovable: {
    color: "#FF7AA2",
    blurb: "Full-Stack aus Prompt"
  },
  Stitch: {
    color: "#00BFA6",
    blurb: "UI aus Text"
  },
  Figma: {
    color: "#A259FF",
    blurb: "Design-Handoff"
  },
  "Claude Code": {
    color: "#D97757",
    blurb: "Agentisches Coding"
  },
  Cursor: {
    color: "#A1A1AA",
    blurb: "KI-Code-Editor"
  },
  Windsurf: {
    color: "#22D3EE",
    blurb: "Agentische IDE"
  },
  PostgreSQL: {
    color: "#5A9BD4",
    blurb: "Robustes SQL"
  },
  MySQL: {
    color: "#00A6C9",
    blurb: "Bewährtes SQL"
  },
  Supabase: {
    color: "#3ECF8E",
    blurb: "Postgres + Auth"
  }
};
function toolVisual(name) {
  return TOOL_VISUAL[name] ?? {
    color: "#8FCDF2",
    blurb: "Build-Tool"
  };
}
function uidOf(name) {
  return name.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
const TOOL_SVG = {
  Claude: '<g stroke="#D97757" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="2.5" x2="12" y2="21.5"/><line x1="2.5" y1="12" x2="21.5" y2="12"/><line x1="5.3" y1="5.3" x2="18.7" y2="18.7"/><line x1="18.7" y1="5.3" x2="5.3" y2="18.7"/><line x1="8.2" y1="3.6" x2="15.8" y2="20.4" stroke-width="1.1"/><line x1="20.4" y1="8.2" x2="3.6" y2="15.8" stroke-width="1.1"/><line x1="15.8" y1="3.6" x2="8.2" y2="20.4" stroke-width="1.1"/><line x1="20.4" y1="15.8" x2="3.6" y2="8.2" stroke-width="1.1"/></g>',
  ChatGPT: '<path fill="#10A37F" d="M21.55 10.04a5.42 5.42 0 0 0-.47-4.46 5.5 5.5 0 0 0-5.92-2.64 5.43 5.43 0 0 0-4.1-1.84 5.5 5.5 0 0 0-5.24 3.8 5.43 5.43 0 0 0-3.63 2.63 5.5 5.5 0 0 0 .68 6.45 5.42 5.42 0 0 0 .47 4.46 5.5 5.5 0 0 0 5.92 2.64 5.42 5.42 0 0 0 4.1 1.84 5.5 5.5 0 0 0 5.24-3.81 5.43 5.43 0 0 0 3.63-2.63 5.5 5.5 0 0 0-.68-6.44zm-8.2 11.45a4.07 4.07 0 0 1-2.62-.95l.13-.07 4.35-2.51a.71.71 0 0 0 .36-.62v-6.13l1.84 1.07a.07.07 0 0 1 .03.05v5.08a4.1 4.1 0 0 1-4.09 4.08zm-8.79-3.75a4.07 4.07 0 0 1-.49-2.74l.13.08 4.35 2.51a.71.71 0 0 0 .71 0l5.31-3.06v2.12a.07.07 0 0 1-.02.06l-4.4 2.54a4.1 4.1 0 0 1-5.6-1.5zM3.62 8.1a4.07 4.07 0 0 1 2.13-1.79v5.17a.71.71 0 0 0 .35.62l5.31 3.06-1.84 1.07a.07.07 0 0 1-.06 0l-4.4-2.54a4.1 4.1 0 0 1-1.5-5.6zm15.1 3.51-5.31-3.07 1.84-1.06a.07.07 0 0 1 .06 0l4.4 2.54a4.09 4.09 0 0 1-.62 7.38v-5.17a.71.71 0 0 0-.36-.62zm1.83-2.76-.13-.08-4.34-2.53a.71.71 0 0 0-.72 0L11.38 9.3V7.18a.07.07 0 0 1 .02-.06l4.4-2.54a4.09 4.09 0 0 1 6.07 4.24zm-11.5 3.79-1.84-1.06a.07.07 0 0 1-.03-.06V6.43a4.09 4.09 0 0 1 6.7-3.14l-.13.07-4.35 2.51a.71.71 0 0 0-.36.62v6.18zm1-2.15 2.36-1.36 2.37 1.36v2.73l-2.36 1.36-2.37-1.36z"/>',
  Gemini: '<defs><linearGradient id="tl-gemini" x1="2" y1="3" x2="22" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#4285F4"/><stop offset="0.5" stop-color="#9B72CB"/><stop offset="1" stop-color="#D96570"/></linearGradient></defs><path fill="url(#tl-gemini)" d="M12 2c.5 5.3 4.4 9.2 9.7 9.7v.6c-5.3.5-9.2 4.4-9.7 9.7h-.6c-.5-5.3-4.4-9.2-9.7-9.7v-.6C7 11.2 10.9 7.3 11.4 2h.6z"/>',
  Lovable: '<defs><linearGradient id="tl-lovable" x1="3" y1="4" x2="20" y2="21" gradientUnits="userSpaceOnUse"><stop stop-color="#FF7AA2"/><stop offset="1" stop-color="#FF8E53"/></linearGradient></defs><path fill="url(#tl-lovable)" d="M12 20.6l-1.3-1.2C6.1 15.2 3.3 12.6 3.3 9.3 3.3 6.7 5.3 4.7 7.9 4.7c1.5 0 2.9.7 3.8 1.9.9-1.2 2.3-1.9 3.8-1.9 2.6 0 4.6 2 4.6 4.6 0 3.3-2.8 5.9-7.4 10.1L12 20.6z"/>',
  Stitch: '<g stroke="#00BFA6" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M4.5 19.5 14 10"/><path d="M14 10l5-5"/><path d="M4.5 19.5c-1.6-1.6.1-3.7 2-2.9"/><ellipse cx="15.6" cy="8.4" rx="1.7" ry="0.9" transform="rotate(-45 15.6 8.4)"/></g>',
  Figma: '<path d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 1 0 0 8z" fill="#0ACF83"/><path d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" fill="#A259FF"/><path d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" fill="#F24E1E"/><path d="M12 0h4a4 4 0 0 1 0 8h-4V0z" fill="#FF7262"/><path d="M20 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" fill="#1ABCFE"/>',
  "Claude Code": '<rect x="2.5" y="4.5" width="19" height="15" rx="3" stroke="#D97757" stroke-width="1.6"/><path d="M7 10l3 2-3 2" stroke="#D97757" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 15h4.5" stroke="#D97757" stroke-width="1.6" stroke-linecap="round"/>',
  Cursor: '<defs><linearGradient id="tl-cursor" x1="5" y1="3" x2="18" y2="20" gradientUnits="userSpaceOnUse"><stop stop-color="#fff"/><stop offset="1" stop-color="#9CA3AF"/></linearGradient></defs><path fill="url(#tl-cursor)" d="M5 3.2 19.4 10c.7.3.6 1.3-.1 1.5l-5.5 1.6-2.6 5.2c-.3.7-1.4.6-1.6-.2L4.9 3.9c-.1-.5.4-.9.1-.7z"/>',
  Windsurf: '<defs><linearGradient id="tl-windsurf" x1="6" y1="3" x2="18" y2="18" gradientUnits="userSpaceOnUse"><stop stop-color="#5EEAD4"/><stop offset="1" stop-color="#0EA5E9"/></linearGradient></defs><path fill="url(#tl-windsurf)" d="M12 2.5c3.7 2.2 5.7 6 5.9 11.5H6.1C6.3 8.5 8.3 4.7 12 2.5z"/><path d="M12 2.5V18" stroke="#0EA5E9" stroke-width="1.4" stroke-linecap="round"/><path d="M4.5 18.5c2 1.3 3.5 1.3 5.5 0s3.5-1.3 5.5 0 3.5 1.3 5.5 0" stroke="url(#tl-windsurf)" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  PostgreSQL: '<path fill="#5A9BD4" d="M8 3.5C5.2 3.5 3 5.7 3 8.5c0 1.7.8 3.2 2.1 4.1V18a1.5 1.5 0 0 0 3 0v-2.2h1.3V18a1.5 1.5 0 0 0 3 0v-2.6c.5-.2.9-.4 1.3-.7.5.9 1.4 1.3 2.3 1.3v-2c-.5 0-.9-.4-.9-.9v-2.7c0-3.3-2.6-5.9-5.8-5.9H8z"/><path fill="#5A9BD4" d="M5.2 12.2c-1 .6-1.6 1.7-1.6 2.9V18a1.4 1.4 0 0 0 2.8 0v-3.1"/><circle cx="8.2" cy="8" r="0.95" fill="#0A0A0A"/><path d="M11.5 6c1.5 0 2.6 1.1 2.6 2.6" stroke="#3D7AB3" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
  MySQL: '<path fill="#00A6C9" d="M3 13.6c3 1 5.3.2 7.3-1.8 1.4-1.4 3-2.8 5.6-2.9-.8 1.2-.8 2.2-.3 3.1 1.4-1 2.4-2.1 2.9-3.2.4 3.4-1.8 7.2-6.1 7.2-2.5 0-4.2-.7-5.5-1.6-1.2.2-2.4.7-3.3 1.4L3 13.6z"/><path fill="#00A6C9" d="M13 9.6c.4-1.9 1.8-3.1 3.9-3.3-.9.9-1 2-.8 3.2"/><circle cx="8.6" cy="11.3" r="0.7" fill="#fff"/><path d="M4 16.4c2.1.9 4.2.9 6.3 0" stroke="#F29111" stroke-width="1.3" stroke-linecap="round" fill="none"/>',
  Supabase: '<defs><linearGradient id="tl-supabase" x1="6" y1="2" x2="16" y2="22" gradientUnits="userSpaceOnUse"><stop stop-color="#3ECF8E"/><stop offset="1" stop-color="#1B8F5E"/></linearGradient></defs><path fill="url(#tl-supabase)" d="M12.6 2.3 4.3 12.9c-.5.6-.1 1.6.7 1.6h6.1l-.9 7.1c-.1.8 1 1.2 1.5.6l8.3-10.6c.5-.6.1-1.6-.7-1.6h-6.1l.9-7.1c.1-.8-1-1.2-1.5-.6z"/>'
};
const FALLBACK_SVG = '<path fill="#8FCDF2" d="M12 2.5c.4 4.7 3.8 8.1 8.5 8.5-4.7.4-8.1 3.8-8.5 8.5-.4-4.7-3.8-8.1-8.5-8.5 4.7-.4 8.1-3.8 8.5-8.5z"/>';

/** One tool's brand mark, inline SVG (no network fetch), 24×24 viewBox. */
function ToolLogo({
  name,
  size = 18,
  className
}) {
  const markup = (TOOL_SVG[name] || FALLBACK_SVG).replace(/tl-(\w+)/g, `tl-${uidOf(name)}-$1`);
  return React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
    className,
    dangerouslySetInnerHTML: {
      __html: markup
    }
  });
}
Object.assign(__ds_scope, { TOOL_VISUAL, toolVisual, ToolLogo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/tool-logos/ToolLogo.jsx", error: String((e && e.message) || e) }); }

// components/core/badge/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ChipStyle() {
  return /*#__PURE__*/React.createElement("style", null, `
.pp-chip{display:inline-flex;align-items:center;gap:6px;border-radius:var(--radius-full);border:1px solid hsl(var(--border));background:hsl(var(--surface));padding:4px 10px;font-family:var(--font-mono);font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:hsl(var(--muted-foreground));}
.pp-chip-accent{border-color:hsl(var(--accent)/.4);background:hsl(var(--accent-subtle));color:hsl(var(--accent-text));}
.pp-plan-badge{display:inline-flex;flex-shrink:0;align-items:center;border-radius:var(--radius-full);border:1px solid;padding:4px 10px;font-family:var(--font-sans);font-size:11px;font-weight:500;text-transform:capitalize;}
`);
}
const PLAN_STYLE = {
  free: {
    borderColor: "hsl(var(--border))",
    background: "hsl(var(--surface))",
    color: "hsl(var(--foreground) / 0.7)"
  },
  pro: {
    borderColor: "hsl(var(--accent) / 0.4)",
    background: "hsl(var(--accent-subtle))",
    color: "hsl(var(--accent-text))"
  },
  team: {
    borderColor: "hsl(var(--tier-team) / 0.4)",
    background: "hsl(var(--tier-team) / 0.15)",
    color: "hsl(var(--tier-team))"
  }
};

/** Small uppercase mono pill for tags/status words ("Neu", "Beta", "Pro"). */
function Badge({
  accent = false,
  className = "",
  style,
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ChipStyle, null), /*#__PURE__*/React.createElement("span", _extends({
    className: `pp-chip ${accent ? "pp-chip-accent" : ""} ${className}`.trim(),
    style: style
  }, props), children));
}

/** One pill style per plan tier, reused everywhere a plan is surfaced (sidebar, settings, billing). */
function PlanBadge({
  plan = "free",
  isAdmin = false,
  className = "",
  style,
  ...props
}) {
  if (isAdmin) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ChipStyle, null), /*#__PURE__*/React.createElement("span", _extends({
      className: `pp-plan-badge ${className}`.trim(),
      style: {
        borderColor: "hsl(var(--warning) / 0.4)",
        background: "hsl(var(--warning) / 0.15)",
        color: "hsl(var(--warning))",
        ...style
      }
    }, props), "Admin"));
  }
  const tone = PLAN_STYLE[plan] || PLAN_STYLE.free;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ChipStyle, null), /*#__PURE__*/React.createElement("span", _extends({
    className: `pp-plan-badge ${className}`.trim(),
    style: {
      ...tone,
      ...style
    }
  }, props), plan));
}
Object.assign(__ds_scope, { Badge, PlanBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/badge/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/button/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    height: 36,
    paddingInline: 14,
    fontSize: 13
  },
  md: {
    height: 44,
    paddingInline: 20,
    fontSize: 14
  },
  lg: {
    height: 48,
    paddingInline: 24,
    fontSize: 15
  },
  icon: {
    height: 40,
    width: 40,
    paddingInline: 0,
    fontSize: 14
  }
};
const VARIANT_CLASS = {
  primary: "pp-btn-primary",
  accent: "pp-btn-accent",
  ghost: "pp-btn-ghost",
  outline: "pp-btn-outline",
  subtle: "pp-btn-subtle",
  destructive: "pp-btn-destructive",
  link: "pp-btn-link"
};
function ButtonStyle() {
  return /*#__PURE__*/React.createElement("style", null, `
.pp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;border-radius:var(--radius-lg);font-family:var(--font-sans);font-weight:500;border:1px solid transparent;cursor:pointer;transition:all .2s var(--ease-out-expo);box-sizing:border-box;text-decoration:none;}
.pp-btn:disabled{pointer-events:none;opacity:.5;}
.pp-btn:focus-visible{outline:none;box-shadow:0 0 0 2px hsl(var(--ring)/.55),0 0 11px hsl(var(--ring)/.22);}
.pp-btn-primary{background:hsl(var(--primary));color:hsl(var(--primary-foreground));}
.pp-btn-primary:hover{background:hsl(var(--primary)/.9);}
.pp-btn-primary:active{transform:scale(.98);}
.pp-btn-accent{background:hsl(var(--accent));color:hsl(var(--accent-foreground));}
.pp-btn-accent:hover{background:hsl(var(--accent)/.9);}
.pp-btn-accent:active{transform:scale(.98);}
.pp-btn-ghost{background:transparent;border-color:hsl(var(--border));color:hsl(var(--foreground)/.9);}
.pp-btn-ghost:hover{background:hsl(var(--surface-hover));border-color:hsl(var(--border-strong));}
.pp-btn-outline{background:transparent;border-color:hsl(var(--border-strong));color:hsl(var(--foreground));}
.pp-btn-outline:hover{background:hsl(var(--surface));}
.pp-btn-subtle{background:hsl(var(--surface));color:hsl(var(--foreground)/.9);}
.pp-btn-subtle:hover{background:hsl(var(--surface-hover));}
.pp-btn-destructive{background:hsl(var(--destructive));color:hsl(var(--destructive-foreground));}
.pp-btn-destructive:hover{background:hsl(var(--destructive)/.9);}
.pp-btn-destructive:active{transform:scale(.98);}
.pp-btn-link{background:transparent;color:hsl(var(--accent-text));padding:0!important;height:auto!important;}
.pp-btn-link:hover{text-decoration:underline;}
`);
}

/**
 * Primary UI button. `variant="primary"` (monochrome) is the default action;
 * `variant="accent"` carries the one brand accent, reserve it for the single
 * action that should read as "the" brand moment. `asChild` renders the style
 * onto a single child element (e.g. an anchor) instead of a <button>.
 */
const Button = React.forwardRef(function Button({
  variant = "primary",
  size = "md",
  asChild = false,
  className = "",
  style,
  children,
  ...props
}, ref) {
  const dims = SIZES[size] || SIZES.md;
  const cls = `pp-btn ${VARIANT_CLASS[variant] || VARIANT_CLASS.primary} ${className}`.trim();
  const mergedStyle = {
    height: dims.height,
    width: dims.width,
    paddingInline: dims.paddingInline,
    fontSize: dims.fontSize,
    ...style
  };
  if (asChild && React.isValidElement(children)) {
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ButtonStyle, null), React.cloneElement(children, {
      ref,
      className: `${cls} ${children.props.className || ""}`.trim(),
      style: {
        ...mergedStyle,
        ...(children.props.style || {})
      },
      ...props
    }));
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ButtonStyle, null), /*#__PURE__*/React.createElement("button", _extends({
    ref: ref,
    className: cls,
    style: mergedStyle
  }, props), children));
});
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/button/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/card/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function CardStyle() {
  return /*#__PURE__*/React.createElement("style", null, `
.pp-card{background:hsl(var(--surface-raised));border:1px solid hsl(var(--border));border-radius:var(--radius-xl);box-shadow:var(--shadow-card);padding:24px;transition:border-color .2s;font-family:var(--font-sans);color:hsl(var(--foreground));box-sizing:border-box;}
.pp-card:hover{border-color:hsl(var(--border-strong));}
.pp-card-header{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
.pp-card-title{font-size:17px;font-weight:600;letter-spacing:-0.01em;margin:0;color:hsl(var(--foreground));}
.pp-card-desc{font-size:14px;line-height:1.5;margin:0;color:hsl(var(--muted-foreground));}
.pp-card-footer{display:flex;align-items:center;justify-content:space-between;padding-top:16px;margin-top:16px;border-top:1px solid hsl(var(--border));}
`);
}

/** Flat surface, hairline border, very subtle elevation — the product's one card shape. */
const Card = React.forwardRef(function Card({
  className = "",
  style,
  children,
  ...props
}, ref) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(CardStyle, null), /*#__PURE__*/React.createElement("div", _extends({
    ref: ref,
    className: `pp-card ${className}`.trim(),
    style: style
  }, props), children));
});
function CardHeader({
  className = "",
  style,
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `pp-card-header ${className}`.trim(),
    style: style
  }, props), children);
}
function CardTitle({
  className = "",
  style,
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("h3", _extends({
    className: `pp-card-title ${className}`.trim(),
    style: style
  }, props), children);
}
function CardDescription({
  className = "",
  style,
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("p", _extends({
    className: `pp-card-desc ${className}`.trim(),
    style: style
  }, props), children);
}
function CardContent({
  className = "",
  style,
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: className,
    style: style
  }, props), children);
}
function CardFooter({
  className = "",
  style,
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `pp-card-footer ${className}`.trim(),
    style: style
  }, props), children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/card/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/icon/Icon.jsx
try { (() => {
/*
 * Small dependency-free line-icon set in the product's stroke style
 * (~1.8 stroke, round caps/joins, 24x24). The product itself uses Lucide
 * (see readme.md → Iconography); these are hand-authored equivalents so
 * every component here stays free of npm/CDN icon dependencies. Swap in
 * real Lucide (or another set) in production if you already depend on it.
 */
const PATHS = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "arrow-right": '<path d="M5 12h14M13 5l7 7-7 7"/>',
  "corner-down-left": '<path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  star: '<path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.1 6.6-5.8-3.1-5.8 3.1 1.1-6.6-4.8-4.7 6.6-.9z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off": '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-3.1 3.9M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1"/><path d="M9.5 9.5a3 3 0 0 0 4.24 4.24"/>',
  loader: '<path d="M12 2v4"/><path d="m16.9 7.1 2.8-2.8"/><path d="M18 12h4"/><path d="m16.9 16.9 2.8 2.8"/><path d="M12 18v4"/><path d="m4.3 19.7 2.8-2.8"/><path d="M2 12h4"/><path d="m4.3 4.3 2.8 2.8"/>',
  "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  "panel-left-close": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m14 10-2 2 2 2"/>',
  "panel-left-open": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m13 10 2 2-2 2"/>',
  "folder-kanban": '<path d="M4 5a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M8 12v3M12 10v5M16 12v3"/>',
  "folder-plus": '<path d="M4 5a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M12 10v5M9.5 12.5h5"/>',
  "message-square": '<path d="M4 4h16v12H8l-4 4Z"/>',
  "messages-square": '<path d="M14 4H4v10l3-2.2V4"/><path d="M8 8h12v9l-3-2H8Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.5 6.5 2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>',
  "key-round": '<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 19 4M16 8l2.5 2.5M19 4l2 2-3 3"/>',
  lock: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/>',
  building2: '<rect x="4" y="3" width="9" height="18"/><rect x="15" y="9" width="5" height="12"/><path d="M7 7h1M7 11h1M7 15h1M17 13h1M17 17h1"/>',
  gauge: '<circle cx="12" cy="13" r="8"/><path d="M12 13 15.5 9M8 13a4 4 0 0 1 8 0"/>',
  "shield-alert": '<path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6Z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 6-6 2 2-6z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  pencil: '<path d="m17 3 4 4L7 21H3v-4Z"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5V12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V5.5"/><path d="M4 12v6.5c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V12"/>',
  "layout-template": '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>',
  "terminal-square": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m8 10 2.5 2.5L8 15"/><path d="M13 15h3"/>',
  "arrow-up-right": '<path d="M7 17 17 7M9 7h8v8"/>',
  "sun-moon": '<path d="M12 8a2.8 2.8 0 1 0 2.8 2.8"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/>'
};

/**
 * Small line-icon renderer. Pass `name` (kebab-case) and optional `size` /
 * `strokeWidth` / `className` / `style`; unknown names render nothing.
 */
function Icon({
  name,
  size = 16,
  strokeWidth = 1.8,
  className,
  style,
  title
}) {
  const inner = PATHS[name];
  if (!inner) return null;
  const spin = name === "loader";
  return React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": title ? undefined : true,
    role: title ? "img" : undefined,
    style: spin ? {
      animation: "pp-icon-spin 0.9s linear infinite",
      ...style
    } : style,
    dangerouslySetInnerHTML: {
      __html: (title ? `<title>${title}</title>` : "") + inner
    }
  });
}

// Injected once per mount; harmless if duplicated across instances.
function IconSpinKeyframes() {
  return React.createElement("style", null, "@keyframes pp-icon-spin{to{transform:rotate(360deg)}}");
}
const ICON_NAMES = Object.keys(PATHS);
Object.assign(__ds_scope, { Icon, IconSpinKeyframes, ICON_NAMES });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/icon/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/input/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function InputStyle() {
  return /*#__PURE__*/React.createElement("style", null, `
.pp-input{height:44px;width:100%;border-radius:var(--radius-lg);border:1px solid hsl(var(--border));background:hsl(var(--surface));padding:0 14px;font-size:14px;font-family:var(--font-sans);color:hsl(var(--foreground));transition:border-color .2s,box-shadow .2s;outline:none;box-sizing:border-box;}
.pp-input::placeholder{color:hsl(var(--muted-foreground));}
.pp-input:focus{border-color:hsl(var(--ring));box-shadow:0 0 0 3px hsl(var(--ring)/.18),0 0 10px hsl(var(--ring)/.16);}
.pp-input:disabled{cursor:not-allowed;opacity:.5;}
.pp-input.pp-input-error{border-color:hsl(var(--destructive)/.55)!important;}
.pp-input.pp-input-error:focus{box-shadow:0 0 0 3px hsl(var(--destructive)/.15)!important;}
.pp-textarea{height:auto;min-height:120px;padding:10px 14px;line-height:1.5;resize:vertical;font-family:var(--font-sans);}
`);
}

/** Text input — the product's one field shape, used directly or via PasswordInput. */
const Input = React.forwardRef(function Input({
  className = "",
  style,
  error = false,
  ...props
}, ref) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(InputStyle, null), /*#__PURE__*/React.createElement("input", _extends({
    ref: ref,
    className: `pp-input ${error ? "pp-input-error" : ""} ${className}`.trim(),
    style: style
  }, props)));
});
const Textarea = React.forwardRef(function Textarea({
  className = "",
  style,
  error = false,
  ...props
}, ref) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(InputStyle, null), /*#__PURE__*/React.createElement("textarea", _extends({
    ref: ref,
    className: `pp-input pp-textarea ${error ? "pp-input-error" : ""} ${className}`.trim(),
    style: style
  }, props)));
});
Object.assign(__ds_scope, { Input, Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/input/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/input/Label.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Form field label — mono, uppercase, wide tracking (matches label-caps type token). */
function Label({
  className = "",
  style,
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, `.pp-label{font-size:11px;font-family:var(--font-mono);font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:hsl(var(--muted-foreground));display:block;margin-bottom:6px;}`), /*#__PURE__*/React.createElement("label", _extends({
    className: `pp-label ${className}`.trim(),
    style: style
  }, props), children));
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/input/Label.jsx", error: String((e && e.message) || e) }); }

// components/core/input/PasswordInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/** Password field with a built-in show/hide toggle. Drop-in for `<Input type="password">`. */
const PasswordInput = React.forwardRef(function PasswordInput({
  className = "",
  style,
  ...props
}, ref) {
  const [visible, setVisible] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("style", null, `
.pp-input{height:44px;width:100%;border-radius:var(--radius-lg);border:1px solid hsl(var(--border));background:hsl(var(--surface));padding:0 44px 0 14px;font-size:14px;font-family:var(--font-sans);color:hsl(var(--foreground));transition:border-color .2s,box-shadow .2s;outline:none;box-sizing:border-box;}
.pp-input::placeholder{color:hsl(var(--muted-foreground));}
.pp-input:focus{border-color:hsl(var(--ring));box-shadow:0 0 0 3px hsl(var(--ring)/.18),0 0 10px hsl(var(--ring)/.16);}
.pp-pw-toggle{position:absolute;right:0;top:0;height:44px;width:44px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;cursor:pointer;color:hsl(var(--muted-foreground));}
.pp-pw-toggle:hover{color:hsl(var(--foreground));}
`), /*#__PURE__*/React.createElement("input", _extends({
    ref: ref,
    type: visible ? "text" : "password",
    className: `pp-input ${className}`.trim(),
    style: style
  }, props)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setVisible(v => !v),
    "aria-label": visible ? "Passwort verbergen" : "Passwort anzeigen",
    "aria-pressed": visible,
    className: "pp-pw-toggle"
  }, visible ? /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 3l18 18"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.6 5.1A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-3.1 3.9M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9.5 9.5a3 3 0 0 0 4.24 4.24"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }))));
});
Object.assign(__ds_scope, { PasswordInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/input/PasswordInput.jsx", error: String((e && e.message) || e) }); }

// components/core/skeleton/Skeleton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SkeletonStyle() {
  return /*#__PURE__*/React.createElement("style", null, `
.pp-skeleton{border-radius:var(--radius-md);background:hsl(var(--surface-hover));animation:pp-skel-pulse 1.6s ease-in-out infinite;}
@keyframes pp-skel-pulse{0%,100%{opacity:1}50%{opacity:.5}}
`);
}

/** A pulsing placeholder block — compose it into the loading state of any layout. */
function Skeleton({
  className = "",
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SkeletonStyle, null), /*#__PURE__*/React.createElement("div", _extends({
    className: `pp-skeleton ${className}`.trim(),
    style: style
  }, props)));
}

/** Loading placeholder matching a stat card (label row + big number). */
function StatCardSkeleton() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "hsl(var(--surface-raised))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-card)",
      padding: 20,
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    style: {
      height: 12,
      width: 80
    }
  }), /*#__PURE__*/React.createElement(Skeleton, {
    style: {
      height: 16,
      width: 16
    }
  })), /*#__PURE__*/React.createElement(Skeleton, {
    style: {
      height: 32,
      width: 64
    }
  }));
}

/** Loading placeholder matching a project card (icon + badge, title, tags). */
function ProjectCardSkeleton() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "hsl(var(--surface-raised))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-card)",
      padding: 20,
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    style: {
      height: 36,
      width: 36,
      borderRadius: "var(--radius-lg)"
    }
  }), /*#__PURE__*/React.createElement(Skeleton, {
    style: {
      height: 20,
      width: 64,
      borderRadius: "var(--radius-full)"
    }
  })), /*#__PURE__*/React.createElement(Skeleton, {
    style: {
      marginBottom: 8,
      height: 16,
      width: "66%"
    }
  }), /*#__PURE__*/React.createElement(Skeleton, {
    style: {
      marginBottom: 20,
      height: 12,
      width: "33%"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Skeleton, {
    style: {
      height: 20,
      width: 56
    }
  }), /*#__PURE__*/React.createElement(Skeleton, {
    style: {
      height: 20,
      width: 56
    }
  })));
}
Object.assign(__ds_scope, { Skeleton, StatCardSkeleton, ProjectCardSkeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/skeleton/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/toast/ToastProvider.jsx
try { (() => {
const {
  createContext,
  useCallback,
  useContext,
  useState
} = React;
const ToastContext = createContext(null);
function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
const AUTO_DISMISS_MS = 4000;
function ToastStyle() {
  return /*#__PURE__*/React.createElement("style", null, `
@keyframes pp-toast-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
.pp-toast-viewport{position:fixed;bottom:16px;right:16px;z-index:100;display:flex;flex-direction:column;gap:8px;width:calc(100% - 32px);max-width:384px;pointer-events:none;}
.pp-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:12px;border-radius:var(--radius-xl);border:1px solid hsl(var(--border));background:hsl(var(--surface-raised) / 0.95);backdrop-filter:blur(16px);box-shadow:var(--shadow-elevated);padding:12px 16px;animation:pp-toast-in .22s var(--ease-out-expo);font-family:var(--font-sans);}
.pp-toast-title{font-size:13.5px;font-weight:500;color:hsl(var(--foreground));margin:0;}
.pp-toast-desc{font-size:12.5px;color:hsl(var(--muted-foreground));margin:2px 0 0;}
.pp-toast-close{flex-shrink:0;background:none;border:none;cursor:pointer;color:hsl(var(--muted-foreground));padding:0;}
.pp-toast-close:hover{color:hsl(var(--foreground));}
`);
}

/** Mascot artwork for success/error toasts; falls back to a plain dot for "default". `mascotBase` should point at assets/mascot relative to the consuming page. */
function ToastGlyph({
  variant,
  mascotBase
}) {
  if (variant === "default") {
    return /*#__PURE__*/React.createElement("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.8",
      style: {
        color: "hsl(var(--accent-text))",
        marginTop: 2,
        flexShrink: 0
      },
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 16v-5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 8h.01"
    }));
  }
  const src = `${mascotBase}/dolphin-${variant === "success" ? "celebrating" : "sad"}.png`;
  return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: "",
    width: 28,
    height: 28,
    style: {
      marginTop: -4,
      flexShrink: 0
    }
  });
}
function ToastProvider({
  children,
  mascotBase = "../../../assets/mascot"
}) {
  const [toasts, setToasts] = useState([]);
  const remove = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  const toast = useCallback(({
    title,
    description,
    variant = "default"
  }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, {
      id,
      title,
      description,
      variant
    }]);
    window.setTimeout(() => remove(id), AUTO_DISMISS_MS);
  }, [remove]);
  return /*#__PURE__*/React.createElement(ToastContext.Provider, {
    value: {
      toast
    }
  }, /*#__PURE__*/React.createElement(ToastStyle, null), children, /*#__PURE__*/React.createElement("div", {
    "aria-live": "polite",
    className: "pp-toast-viewport"
  }, toasts.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    role: "status",
    className: "pp-toast"
  }, /*#__PURE__*/React.createElement(ToastGlyph, {
    variant: t.variant,
    mascotBase: mascotBase
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "pp-toast-title"
  }, t.title), t.description && /*#__PURE__*/React.createElement("p", {
    className: "pp-toast-desc"
  }, t.description)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => remove(t.id),
    "aria-label": "Benachrichtigung schliessen",
    className: "pp-toast-close"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  })))))));
}
Object.assign(__ds_scope, { useToast, ToastProvider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/toast/ToastProvider.jsx", error: String((e && e.message) || e) }); }

// components/feedback/usage-meter/UsageMeter.jsx
try { (() => {
/** One metric's real relationship to its cap — a labeled progress bar, not just a number. */
function UsageMeter({
  label,
  used,
  limit
}) {
  const unlimited = !Number.isFinite(limit);
  const pct = unlimited ? 6 : Math.min(100, Math.round(used / Math.max(1, limit) * 100));
  const tone = !unlimited && pct >= 100 ? "linear-gradient(90deg, hsl(0 72% 51%), hsl(0 84% 63%))" : !unlimited && pct >= 80 ? "linear-gradient(90deg, hsl(var(--warning)), hsl(43 96% 62%))" : "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent-text)))";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("style", null, `@keyframes pp-meter-fill{from{width:0}}`), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8,
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 500,
      color: "hsl(var(--foreground) / 0.8)"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "hsl(var(--foreground) / 0.55)"
    }
  }, unlimited ? /*#__PURE__*/React.createElement(React.Fragment, null, used, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "hsl(var(--foreground) / 0.35)"
    }
  }, "\xB7 Unbegrenzt")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "hsl(var(--foreground) / 0.85)"
    }
  }, used), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "hsl(var(--foreground) / 0.35)"
    }
  }, " / ", limit)))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      overflow: "hidden",
      borderRadius: "var(--radius-full)",
      background: "hsl(var(--surface))"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      width: `${pct}%`,
      borderRadius: "var(--radius-full)",
      background: tone,
      animation: "pp-meter-fill .8s var(--ease-out-expo)"
    }
  })));
}
Object.assign(__ds_scope, { UsageMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/usage-meter/UsageMeter.jsx", error: String((e && e.message) || e) }); }

// components/navigation/menu-toggle-icon/MenuToggleIcon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Animated hamburger ⇆ close icon. Purely presentational — the toggling button owns aria-label/aria-expanded. */
function MenuToggleIcon({
  open,
  className = "",
  duration = 300,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: 24,
    height: 24,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    className: className,
    style: {
      transition: `transform ${duration}ms ease-in-out`,
      transform: open ? "rotate(-45deg)" : "none",
      ...style
    }
  }, props), /*#__PURE__*/React.createElement("path", {
    style: {
      transition: `stroke-dasharray ${duration}ms ease-in-out, stroke-dashoffset ${duration}ms ease-in-out`,
      strokeDasharray: open ? "20 300" : "12 63",
      strokeDashoffset: open ? "-32.42px" : "0"
    },
    d: "M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 16 27 16"
  }));
}
Object.assign(__ds_scope, { MenuToggleIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/menu-toggle-icon/MenuToggleIcon.jsx", error: String((e && e.message) || e) }); }

// doc-page.js
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
// Copied omelette starter. Re-running copy_starter_component with this kind overwrites this file with the latest version (page content is unaffected).
/* BEGIN USAGE */
/**
 * <doc-page> — paged-document shell for printable HTML.
 *
 * FIRST, decide how the document paginates — up front, before building:
 *
 * - FLOWING document (the default): write the whole document as one
 *   normal HTML flow inside <doc-page>; the browser's print engine
 *   splits it onto pages at export. Use for long-form documents with a
 *   single text flow: reports, memos, letters, essays.
 * - EXPLICIT pagination: a fixed set of pre-paginated pages, one
 *   <section class="page"> child per page. Use when the user asks for a
 *   specific page count, or the design implies one: a one-page resume, a
 *   two-sided flier, a poster, a certificate, a brochure — any richly
 *   laid-out document without a single text flow.
 * - If in doubt, ask the user as part of the build.
 *
 * PAGE SIZING — paper differs by country (letter vs A4), so the printed
 * sheet is not one fixed truth:
 * - FLOWING documents pin NO paper size: the print engine paginates
 *   onto the user's real paper, and the content reflows to it.
 * - EXPLICITLY PAGINATED documents print each page at a FIXED page box
 *   with overflow hidden — letter by default, size="a4" for a clearly
 *   metric user, the user's chosen paper when they export. Design each
 *   page to FILL that box, fitting letter and A4 alike without overlap.
 * - width/height pin an explicit fixed size, ONLY when the user gives
 *   one.
 * Never write your own @page rule or hard-code paper dimensions in the
 * content.
 *
 * Sizing modes (attributes):
 *   (none)                      — portrait: flowing docs use the user's
 *           paper; explicitly paginated pages use the named size box
 *           (letter unless size="a4")
 *   orientation="landscape"     — the same, landscape
 *   width / height              — explicit fixed size, ONLY when the user
 *           gives one (e.g. width="22in" height="30in" for a 22×30
 *           poster): the page IS the design's size, printed at true
 *           dimensions (or scaled onto the user's paper at print time).
 *           Any absolute CSS length: px/in/mm/cm/pt/pc.
 * The component announces the chosen mode to the host app at runtime (a
 * meta tag it injects), so the print path can inject the user's true
 * paper size.
 *
 * On screen the document renders on a desk background: a flowing
 * document as one tall scrolling sheet (Google Docs' pageless view);
 * explicitly paginated documents as one card per page.
 *
 * EXPLICIT pagination usage:
 *   <style>doc-page:not(:defined){visibility:hidden}</style>
 *   <doc-page>
 *     <section class="page" id="p1">…one page's design…</section>
 *     <section class="page" id="p2">…</section>
 *   </doc-page>
 *   <script src="doc-page.js"></script>
 * How the page box works, concretely: each .page prints as ONE full-bleed
 * sheet at a FIXED physical size — letter by default (set size="a4" for
 * a clearly metric user), the user's chosen paper when they export —
 * with overflow hidden. Nothing scrolls and nothing reflows onto a next
 * sheet: content that misses the box is CLIPPED. Design each page to
 * FILL that page box, and to fit it — letter and A4 alike — without
 * overlap. Each page is a size container; don't size anything in
 * viewport units (they track the window, not the page), and never set
 * width or height on the .page section itself (the component sizes the
 * page box; an authored height like 100% is meaningless at print and is
 * overridden). The component owns the page box, the screen card chrome,
 * and the page breaks (never add your own break-before/after). Don't mix
 * .page sections with flowing content or header/footer slots in the same
 * document.
 *
 * FLOWING usage:
 *   <style>doc-page:not(:defined){visibility:hidden}</style>
 *   <doc-page margin="0.75in">
 *     <h1>Title</h1>
 *     <p>…body…</p>
 *   </doc-page>
 *   <script src="doc-page.js"></script>
 * There is no manual page-splitting — the browser's print engine
 * paginates at export. Standard break-hygiene rules (`break-inside:
 * avoid` on figures, code blocks, images and table rows; `orphans/
 * widows: 3`) are applied so paragraphs and groups split cleanly. On
 * screen and at print, headings default to `text-wrap: balance` and
 * body text to `text-wrap: pretty`; the defaults have zero specificity,
 * so any text-wrap you declare wins.
 *
 * Other attributes:
 *   size    — letter | a4 | legal (default letter). Flowing documents:
 *           preview proportion only — it does NOT pin their printed
 *           paper (the print dialog's paper governs); leave it alone
 *           there. Explicitly paginated documents: it sets the page box
 *           the cards and the pinned @page share (the export dialog's
 *           choice overrides both at print) — set size="a4" for a
 *           clearly metric user. Scaled-fit: names the sheet the fit is
 *           computed against, same a4-for-metric-users advice.
 *   content-width / content-height — the design's own fixed dimensions
 *           (CSS lengths), for scaling a fixed-size design ONTO the
 *           named sheet: content lays out at exactly this size, and the
 *           component scales it to fit that sheet's printable area
 *           (centered horizontally, top-aligned; the export dialog
 *           re-fits to the user's actual paper choice where available).
 *           Both must be set; they do not change the page box. For pages
 *           WITHOUT running header/footer slots.
 *   margin  — printable inset on every page of a FLOWING document
 *           (default 0.75in); margin="0" makes pages full-bleed.
 *           Explicitly paginated pages are always full-bleed.
 *
 * Running header/footer (flowing documents only): give an element
 * `slot="header"` or `slot="footer"` and it repeats on every printed
 * page via `position: fixed`. To keep body text from sliding under it,
 * the component prints inside a single-cell table whose <thead>/<tfoot>
 * are spacers sized to the header/footer height — browsers repeat
 * thead/tfoot on every page, so each sheet's content starts below the
 * header and ends above the footer. On screen the header/footer render
 * once at the top/bottom of the sheet.
 *
 * At print the component injects `@page { margin: 0 }` (which leaves
 * Chrome no margin box to draw its date/URL/page-count header in) and
 * moves the visual margin onto the sheet's own padding. It also marks
 * the document as owning its print CSS (a
 * `meta[name="omelette-owns-print"]` it injects at runtime), so the
 * PDF export never injects page-geometry CSS of its own on top.
 *
 * Print best practices for the content you author:
 * - Multi-column text: use CSS columns (`column-count` +
 *   `column-gap`), never side-by-side flex/grid columns — only real
 *   CSS columns flow and break across pages. `column-span: all` lets
 *   a heading span the columns; `hyphens: auto` (needs `lang` on
 *   the html element) keeps narrow columns readable.
 * - Page breaks in flowing documents: `break-before: page` on an
 *   element that must start a new page (a chapter, an appendix). Add
 *   your own kept-together blocks (callouts, stat tiles, cards) to a
 *   `break-inside: avoid` rule, and keep each one shorter than a page.
 * - Extend `orphans: 3; widows: 3` to any custom text blocks you add
 *   (p and li are covered by default).
 * - Give long tables a <thead> — browsers repeat it on every printed
 *   page.
 * - No `position: fixed`/`sticky` and no viewport units in content:
 *   fixed elements stamp every printed page (running headers/footers go
 *   in the component's slots) and `100vh` mis-sizes at print.
 *
 * Author content as static HTML so the user can click-to-edit any text
 * directly. Do not set width/padding/background on the document body —
 * the component owns the sheet box.
 */
/* END USAGE */

(() => {
  const PAPER = {
    letter: ['8.5in', '11in'],
    a4: ['210mm', '297mm'],
    legal: ['8.5in', '14in']
  };
  const CSS_LENGTH = /^\d+(\.\d+)?(px|in|mm|cm|pt|pc)$/;
  // Unitless "0" is a valid CSS length and the natural way to write
  // margin="0"; normalise it to 0px so max()/calc() (which reject a bare
  // number) keep working.
  const safeLen = (v, fb) => {
    v = (v || '').trim();
    return v === '0' ? '0px' : CSS_LENGTH.test(v) ? v : fb;
  };
  // WebKit (Safari and every iOS browser shell) never repeats a table's
  // thead/tfoot on printed pages (WebKit bug 17205), so the spacer-borne
  // vertical margins of a FLOWING document reach only the first page
  // there. Engine check, not browser check: vendor is 'Apple Computer,
  // Inc.' exactly for WebKit and 'Google Inc.' for Blink.
  const WK_PRINT = /apple/i.test(navigator.vendor || '');
  // CSS length → px number (CSS absolute units are exact: 1in = 96px).
  // Returns NaN for anything safeLen would reject — callers gate on it.
  const PX_PER = {
    px: 1,
    in: 96,
    mm: 96 / 25.4,
    cm: 96 / 2.54,
    pt: 96 / 72,
    pc: 16
  };
  const toPx = v => {
    const m = /^(\d+(?:\.\d+)?)(px|in|mm|cm|pt|pc)$/.exec((v || '').trim());
    return m ? parseFloat(m[1]) * PX_PER[m[2]] : NaN;
  };
  const stylesheet = `
    :host {
      position: relative;
      display: block;
      /* When the viewport is narrower than the page, grow to wrap the
       * sheet (plus this padding) instead of staying viewport-width, so
       * the desk background and right margin reach the sheet's far edge
       * in the horizontal scroll. */
      min-width: max-content;
      min-height: 100vh;
      background: #f5f5f4;
      padding: 48px 24px;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      --doc-page-w: 8.5in;
      --doc-page-h: 11in;
      --doc-page-margin: 0.75in;
      --doc-hdr-h: 0px;
      --doc-ftr-h: 0px;
      --doc-hdr-pad: 0px;
      --doc-ftr-pad: 0px;
    }
    .sheet {
      width: var(--doc-page-w);
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 2px 10px rgba(20, 20, 19, 0.12);
      border-radius: 7px;
      box-sizing: border-box;
      padding: var(--doc-page-margin);
    }
    .frame { width: 100%; border-collapse: collapse; }
    /* Scaled-fit mode (content-width/content-height): the inner .fit box
     * lays the content out at its authored fixed size and scales it onto
     * the printable area; .fit-box reserves the scaled footprint in flow
     * (transforms don't affect layout) and centers it. Without the mode,
     * both divs are unstyled block pass-throughs. */
    /* Explicit pagination: direct .page children are the pages. The sheet
     * becomes a transparent stack and each page carries the card look on
     * screen; at print each page is exactly one full-bleed sheet. The
     * ::slotted defaults are deliberately weak (document CSS wins), so
     * authored page styling can override any of this. */
    .sheet.paginated {
      background: transparent;
      box-shadow: none;
      border-radius: 0;
      padding: 0;
    }
    .paginated ::slotted(.page) {
      position: relative;
      display: block;
      width: 100%;
      aspect-ratio: var(--doc-page-ar);
      container-type: size;
      overflow: hidden;
      box-sizing: border-box;
      background: #fff;
      border-radius: 7px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
      break-inside: avoid;
    }
    .paginated ::slotted(.page:not(:first-child)) { margin-top: 1rem; }
    @media print {
      .sheet.paginated { padding: 0; }
      /* The flowing-document vertical inset lives on the repeating
       * thead/tfoot spacers, not the sheet padding — they must go too,
       * or each full-sheet .page is pushed ~margin down and spills onto
       * a second sheet. Paginated pages are full-bleed by definition
       * (content owns its insets). */
      .sheet.paginated .hdr-space,
      .sheet.paginated .ftr-space { height: 0; }
      .paginated ::slotted(.page) {
        border-radius: 0 !important;
        box-shadow: none !important;
        margin: 0 !important;
        /* Physical page-box sizing, no viewport units: Safari resolves
         * 100vh against the window, not the page box, so a vh-sized card
         * paginates wrong there. --doc-page-w/h are the named size by
         * default and are overridden to the user's chosen paper by the
         * export path, so every card is exactly one sheet either way.
         * Width + height (same source values as @page size) rather than
         * width + aspect-ratio: the ratio is a 6-decimal rounding of the
         * same division, and a few millionths of overflow would spill a
         * blank sheet after every page. The screen-only aspect-ratio
         * (preview proportions) must not leak into print. cqh typography
         * tracks the same box.
         *
         * Every declaration is !important: per CSS Scoping, unimportant
         * shadow ::slotted rules LOSE to the document context, so a page
         * section's authored inline style would silently beat this print
         * geometry. A model-authored height:100% did exactly that — the
         * percentage resolves as auto in the all-auto print ancestry, the
         * base rule's size containment turns auto into ZERO, and
         * overflow:hidden then paints nothing: a blank PDF with perfect
         * page boxes. At print the component's geometry is the design's
         * whole contract, so it must win over any authored sizing. */
        aspect-ratio: auto !important;
        width: var(--doc-page-w) !important;
        height: var(--doc-page-h) !important;
        overflow: hidden !important;
      }
      .paginated ::slotted(.page:not(:first-child)) {
        break-before: page !important;
        margin-top: 0 !important;
      }
    }
    .fit-mode .fit-box {
      width: calc(var(--doc-fit-w) * var(--doc-fit-scale));
      height: calc(var(--doc-fit-h) * var(--doc-fit-scale));
      margin: 0 auto;
      break-inside: avoid;
    }
    .fit-mode .fit {
      width: var(--doc-fit-w);
      height: var(--doc-fit-h);
      transform: scale(var(--doc-fit-scale));
      transform-origin: top left;
    }
    .frame td, .frame th { padding: 0; text-align: left; font-weight: inherit; }
    .hdr-space { height: var(--doc-hdr-h); }
    .ftr-space { height: var(--doc-ftr-h); }
    ::slotted([slot="header"]),
    ::slotted([slot="footer"]) { display: block; box-sizing: border-box; }
    @media print {
      :host { background: none; padding: 0; min-width: 0; min-height: 0; }
      .sheet {
        width: auto; margin: 0; box-shadow: none; border-radius: 0;
        padding: 0 var(--doc-page-margin);
      }
      /* The thead/tfoot spacers repeat on every page, so they carry the
       * vertical page margin (which the sheet's own padding cannot, since
       * that padding is consumed once on the first/last page). The running
       * header/footer are fixed inside that band. */
      /* The 0.35in is breathing room between a running header/footer and
       * the body; without one the spacer is exactly the page margin, so a
       * margin="0" full-bleed document gets truly full-bleed pages. */
      .hdr-space { height: max(var(--doc-page-margin), calc(var(--doc-hdr-h) + var(--doc-hdr-pad))); }
      .ftr-space { height: max(var(--doc-page-margin), calc(var(--doc-ftr-h) + var(--doc-ftr-pad))); }
      /* WebKit flowing documents: @page carries the vertical margin (see
       * _syncPrintPageRule), so the spacers keep only whatever a running
       * header/footer needs BEYOND it — page 1 would otherwise double its
       * top inset. Paginated sheets already zero their spacers above. */
      .sheet.wk-print:not(.paginated) .hdr-space { height: max(0px, calc(max(var(--doc-page-margin), calc(var(--doc-hdr-h) + var(--doc-hdr-pad))) - var(--doc-page-margin))); }
      .sheet.wk-print:not(.paginated) .ftr-space { height: max(0px, calc(max(var(--doc-page-margin), calc(var(--doc-ftr-h) + var(--doc-ftr-pad))) - var(--doc-page-margin))); }
      ::slotted([slot="header"]) {
        position: fixed; top: 0; left: 0; right: 0; margin: 0;
        padding: calc(var(--doc-page-margin) * 0.45) var(--doc-page-margin) 0;
      }
      ::slotted([slot="footer"]) {
        position: fixed; bottom: 0; left: 0; right: 0; margin: 0;
        padding: 0 var(--doc-page-margin) calc(var(--doc-page-margin) * 0.45);
      }
    }
  `;
  class DocPage extends HTMLElement {
    static get observedAttributes() {
      return ['size', 'width', 'height', 'margin', 'orientation', 'content-width', 'content-height'];
    }
    constructor() {
      super();
      this._root = this.attachShadow({
        mode: 'open'
      });
      this._mo = typeof MutationObserver === 'function' ? new MutationObserver(() => this._scheduleMeasure()) : null;
    }

    /** The named paper's [w, h], swapped when orientation="landscape".
     *  Only the named size swaps — explicit width/height are exact values
     *  the author already oriented. */
    _paperSize() {
      const named = PAPER[(this.getAttribute('size') || '').toLowerCase()] || PAPER.letter;
      const landscape = (this.getAttribute('orientation') || '').trim().toLowerCase() === 'landscape';
      return landscape ? [named[1], named[0]] : named;
    }
    get pageWidth() {
      return safeLen(this.getAttribute('width'), this._paperSize()[0]);
    }
    get pageHeight() {
      return safeLen(this.getAttribute('height'), this._paperSize()[1]);
    }
    get pageMargin() {
      return safeLen(this.getAttribute('margin'), '0.75in');
    }

    /** Scaled-fit mode's content box [w, h] as CSS lengths, or null when
     *  the mode is off (either attribute missing/invalid/zero — a partial
     *  declaration falls back to normal flow rather than guessing). */
    _contentFit() {
      const w = safeLen(this.getAttribute('content-width'), null);
      const h = safeLen(this.getAttribute('content-height'), null);
      if (!w || !h) return null;
      const wPx = toPx(w),
        hPx = toPx(h);
      return wPx > 0 && hPx > 0 ? [w, h, wPx, hPx] : null;
    }
    connectedCallback() {
      if (!this._sheet) this._render();
      this._syncSize();
      this._syncPrintPageRule();
      this._ensureTextWrapDefaults();
      this._ensureOwnsPrintMeta();
      this._syncFixedSizeMeta();
      this._syncPrintSizingMeta();
      if (this._mo) this._mo.observe(this, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
      });
      this._onResize = () => this._scheduleMeasure();
      window.addEventListener('resize', this._onResize);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => this._scheduleMeasure());
      }
      this._scheduleMeasure();
    }
    disconnectedCallback() {
      window.removeEventListener('resize', this._onResize);
      if (this._mo) this._mo.disconnect();
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = null;
      }
      // Drop the head rules when the last doc-page leaves, so a deleted
      // document's @page geometry and text-wrap defaults can't apply to
      // whatever replaces it.
      const survivor = document.querySelector('doc-page');
      if (!survivor) {
        ['doc-page-print', 'doc-page-text-wrap', 'doc-page-owns-print', 'doc-page-fixed-size', 'doc-page-print-sizing'].forEach(id => {
          const tag = document.getElementById(id);
          if (tag) tag.remove();
        });
        // A live deck-stage deferred its own print-sizing meta to ours —
        // hand the page-global meta over so the deck isn't left unmarked.
        const deck = document.querySelector('deck-stage');
        if (deck && typeof deck._ensurePrintSizingMeta === 'function') {
          deck._ensurePrintSizingMeta();
        }
      } else {
        // A departed owner hands each page-global meta to whatever
        // doc-page remains (or it's removed).
        if (typeof survivor._syncFixedSizeMeta === 'function') {
          survivor._syncFixedSizeMeta();
        }
        if (typeof survivor._syncPrintSizingMeta === 'function') {
          survivor._syncPrintSizingMeta();
        }
      }
    }
    attributeChangedCallback() {
      if (!this._sheet) return;
      this._syncSize();
      this._syncPrintPageRule();
      this._syncFixedSizeMeta();
      this._syncPrintSizingMeta();
      this._scheduleMeasure();
    }
    _render() {
      this._root.innerHTML = `
        <style>${stylesheet}</style>
        <style id="vars"></style>
        <div class="sheet" data-screen-label="Document">
          <table class="frame" role="presentation">
            <thead><tr><th><div class="hdr-space"><slot name="header"></slot></div></th></tr></thead>
            <tbody><tr><td class="body"><div class="fit-box"><div class="fit"><slot></slot></div></div></td></tr></tbody>
            <tfoot><tr><td><div class="ftr-space"><slot name="footer"></slot></div></td></tr></tfoot>
          </table>
        </div>`;
      this._sheet = this._root.querySelector('.sheet');
      this._vars = this._root.getElementById('vars');
    }

    /** Runtime sizing lives in a shadow <style> :host rule, never on the
     *  light-DOM host element, so serialize-persist can't write it back. */
    _syncSize(hdrH, ftrH) {
      // Scaled-fit mode: content at its authored size, scaled onto the
      // printable area (page minus margins on both axes). The factor is a
      // plain number var so calc(length * number) stays valid; 4 decimals
      // keeps the shadow style stable across re-measures. Upscaling is
      // allowed — print transforms are vector, so text and CSS stay crisp
      // (raster images soften, which the catalog bullet warns about).
      const fit = this._contentFit();
      let fitVars = '';
      if (fit) {
        const marginPx = toPx(this.pageMargin) || 0;
        const availW = toPx(this.pageWidth) - 2 * marginPx;
        const availH = toPx(this.pageHeight) - 2 * marginPx;
        const scale = Math.min(availW / fit[2], availH / fit[3]);
        if (scale > 0 && Number.isFinite(scale)) {
          fitVars = '--doc-fit-w:' + fit[0] + ';' + '--doc-fit-h:' + fit[1] + ';' + '--doc-fit-scale:' + scale.toFixed(4) + ';';
        }
      }
      this._sheet.classList.toggle('fit-mode', !!fitVars);
      // Numeric w/h ratio for the paginated page cards' aspect-ratio —
      // aspect-ratio takes a number, not a length ratio, so compute it
      // here (CSS length division isn't portable). 6 decimals keeps the
      // shadow style stable across re-syncs.
      const arW = toPx(this.pageWidth);
      const arH = toPx(this.pageHeight);
      const ar = arW > 0 && arH > 0 ? (arW / arH).toFixed(6) : '0.772727';
      this._vars.textContent = ':host{' + fitVars + '--doc-page-ar:' + ar + ';' + '--doc-page-w:' + this.pageWidth + ';' + '--doc-page-h:' + this.pageHeight + ';' + '--doc-page-margin:' + this.pageMargin + ';' + '--doc-hdr-h:' + (hdrH || 0) + 'px;' + '--doc-ftr-h:' + (ftrH || 0) + 'px;' + '--doc-hdr-pad:' + (hdrH ? '0.35in' : '0px') + ';' + '--doc-ftr-pad:' + (ftrH ? '0.35in' : '0px') + '}';
    }

    /** @page is a no-op inside shadow DOM, so the rule lives in <head>.
     *  Re-appended on every sync so it stays last in source order — the
     *  @page cascade is source-order per descriptor, so this rule wins
     *  over any other @page rule in the document.
     *
     *  The @page SIZE is pinned where the page box IS part of the design:
     *  explicit-fixed-size mode (width + height authored), scaled-fit
     *  mode (the named sheet the fit targets), and explicit pagination
     *  (the named size the cards share — so card and sheet agree on
     *  every print path, and the export path's chosen paper overrides
     *  BOTH with one later rule). For FLOWING documents no paper size is
     *  emitted at all — the true size comes from the user's preference,
     *  injected by the export path or chosen in the print dialog — so a
     *  flowing document never fights the paper it lands on.
     *  margin: 0 is emitted in every mode: it leaves Chrome no margin box
     *  to draw its date/URL/page-count header in, and the visual margin
     *  lives on the sheet's own padding. */
    _syncPrintPageRule() {
      const id = 'doc-page-print';
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
      }
      document.head.appendChild(tag);
      // Three print-geometry regimes:
      // - true-size: the page IS the design — pin its exact size.
      // - scaled-fit (content-width/height): the fit factor is computed
      //   against the NAMED paper's printable area, so that paper must
      //   stay pinned or the scaled content overflows a smaller sheet
      //   (the export path re-fits and re-pins at print time on top).
      // - default modes: no paper size — but landscape still needs the
      //   paper-agnostic 'size: landscape' keyword, because the size
      //   descriptor is what carries orientation; without it a landscape
      //   document prints portrait whenever nothing injects a size.
      const landscape = (this.getAttribute('orientation') || '').trim().toLowerCase() === 'landscape';
      // Explicit pagination pins the page box to the SAME values that
      // size the cards (the named size by default, the export path's
      // chosen paper when its later rule overrides both) — card and
      // sheet agree on every print path, and a mismatched real paper
      // shrinks-to-fit in the dialog instead of clipping a Letter card
      // on A4. Declared before the paginated read below so both derive
      // from one check.
      const paginatedNow = this.querySelector(':scope > .page') !== null;
      const sizeDescriptor = this._trueSizePx() ? 'size: ' + this.pageWidth + ' ' + this.pageHeight + '; ' : this._contentFit() ? 'size: ' + this.pageWidth + ' ' + this.pageHeight + '; ' : paginatedNow ? 'size: ' + this.pageWidth + ' ' + this.pageHeight + '; ' : landscape ? 'size: landscape; ' : '';
      // WebKit never repeats the thead/tfoot spacers that carry a flowing
      // document's vertical page margins (see WK_PRINT above), so pages
      // after the first print edge-to-edge there. Carry the VERTICAL
      // margins on @page for WebKit instead, and the shadow print CSS
      // trims the first-page spacers by the same amount (.sheet.wk-print
      // rules). Horizontal inset stays on the sheet's own padding in
      // every engine. Blink keeps margin: 0 (a nonzero margin there
      // re-opens the box Chrome draws its header furniture in). One cost,
      // learned in testing: Safari's own date/URL headers are a USER
      // dialog setting ("Print headers and footers") that renders in the
      // margin area when room exists — margin: 0 only suppressed it by
      // leaving no room, and no CSS controls it. The export dialog's
      // Safari guide teaches turning the setting off for flowing
      // documents. Explicitly paginated and fixed-size documents keep
      // margin: 0 everywhere: their pages ARE the sheet.
      const wkFlowing = WK_PRINT && !paginatedNow && !this._trueSizePx() && !this._contentFit();
      const marginDescriptor = wkFlowing ? 'margin: ' + this.pageMargin + ' 0; ' : 'margin: 0; ';
      // Shadow-internal marker (never serialized), kept in lockstep with
      // the @page decision above: the print CSS trims the first-page
      // spacers ONLY while @page actually carries the margins — a
      // true-size or scaled-fit sheet keeps margin: 0 and must keep its
      // spacers too. Re-synced here so attribute changes and pagination
      // flips move both together.
      if (this._sheet) this._sheet.classList.toggle('wk-print', wkFlowing);
      tag.textContent = '@page { ' + sizeDescriptor + marginDescriptor + '} ' + '@media print { html, body { margin: 0 !important; padding: 0 !important; background: none !important; height: auto !important; overflow: visible !important; } ' + 'h1,h2,h3,h4,h5,h6 { break-after: avoid; } ' + 'figure,pre,blockquote,img,svg,tr { break-inside: avoid; } ' + 'p,li { orphans: 3; widows: 3; } ' + '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; ' + 'backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } ' + '*, *::before, *::after { animation-delay: -99s !important; animation-duration: .001s !important; ' + 'animation-iteration-count: 1 !important; animation-fill-mode: both !important; ' + 'animation-play-state: running !important; transition-duration: 0s !important; } }';
    }

    /** Typographic defaults for document text: balance headings, avoid
     *  widowed/orphaned words in body copy (browsers without text-wrap
     *  support drop the declarations). Zero-specificity via :where() so
     *  any text-wrap authored on those elements wins; document-level so the
     *  rules reach the slotted (light DOM) content — shadow styles can't.
     *  data-omelette-injected marks the tag for the host editor to strip
     *  at serialize, so it is never written back as authored source. */
    _ensureTextWrapDefaults() {
      if (document.getElementById('doc-page-text-wrap')) return;
      const tag = document.createElement('style');
      tag.id = 'doc-page-text-wrap';
      tag.setAttribute('data-omelette-injected', '');
      tag.textContent = ':where(h1,h2,h3,h4,h5,h6){text-wrap:balance}' + ':where(p,li,blockquote,figcaption){text-wrap:pretty}';
      document.head.appendChild(tag);
    }

    /** Declares that this document owns its print CSS. The instant-PDF
     *  export checks for the meta by NAME PRESENCE alone (content is
     *  ignored) and skips its automatic print-CSS injections, so the
     *  component's @page geometry is never overridden by a heuristic.
     *  data-omelette-injected keeps it out of serialized source. */
    _ensureOwnsPrintMeta() {
      if (document.getElementById('doc-page-owns-print')) return;
      const tag = document.createElement('meta');
      tag.id = 'doc-page-owns-print';
      tag.name = 'omelette-owns-print';
      tag.content = 'true';
      tag.setAttribute('data-omelette-injected', '');
      document.head.appendChild(tag);
    }

    /** This page's valid true-size page box (explicit width AND height)
     *  as [w, h] px ints, or null when the mode is off. */
    _trueSizePx() {
      if (!safeLen(this.getAttribute('width'), null) || !safeLen(this.getAttribute('height'), null)) return null;
      const w = Math.round(toPx(this.pageWidth));
      const h = Math.round(toPx(this.pageHeight));
      return w > 0 && h > 0 ? [w, h] : null;
    }

    /** True-size pages (explicit width AND height) also declare the page
     *  box as the preview size: the in-app preview reads
     *  meta[name="omelette-fixed-size"] (content "W,H" in px ints) and
     *  scales the sheet into view — without it an 18in poster previews at
     *  true size with scrollbars. Never overrides an author-set meta
     *  (only the component's own id is managed). The meta is page-global
     *  while doc-page instances are not, so every sync recomputes the
     *  page-wide owner — the first connected true-size doc-page — and a
     *  non-true-size sibling's sync can never delete the owner's meta.
     *  Removed when no true-size page remains (the owner's disconnect
     *  re-syncs via any survivor) or when an author-set meta exists. */
    _syncFixedSizeMeta() {
      const id = 'doc-page-fixed-size';
      const own = document.getElementById(id);
      const authored = document.querySelector('meta[name="omelette-fixed-size"]:not([data-omelette-injected])');
      // The page-wide owner, not this instance: an upgraded true-size page
      // anywhere in the document keeps the meta alive and sized.
      let box = null;
      for (const el of document.querySelectorAll('doc-page')) {
        box = typeof el._trueSizePx === 'function' ? el._trueSizePx() : null;
        if (box) break;
      }
      if (!box || authored) {
        if (own) own.remove();
        return;
      }
      const tag = own || document.createElement('meta');
      tag.id = id;
      tag.name = 'omelette-fixed-size';
      tag.content = box[0] + ',' + box[1];
      tag.setAttribute('data-omelette-injected', '');
      if (!own) document.head.appendChild(tag);
    }

    /** This page's print-sizing mode: 'fixed' when an explicit width AND
     *  height are authored (the page is the design's own size), else the
     *  default paper in the authored orientation. */
    _printSizingMode() {
      if (this._trueSizePx()) return 'fixed';
      const landscape = (this.getAttribute('orientation') || '').trim().toLowerCase() === 'landscape';
      return landscape ? 'default-landscape' : 'default-portrait';
    }

    /** Announces the print-sizing mode to the host app:
     *  meta[name="omelette-print-sizing"] with content 'default-portrait',
     *  'default-landscape', or 'fixed' (fixed pages also carry the
     *  omelette-fixed-size meta with the page box in px). The export path
     *  probes it to decide what true paper size to inject at print time —
     *  in the default modes the component emits no paper size of its own.
     *  Same page-global ownership rules as the fixed-size meta above:
     *  first connected doc-page owns it, an authored meta is never
     *  overridden, removed when no doc-page remains. */
    _syncPrintSizingMeta() {
      const id = 'doc-page-print-sizing';
      const own = document.getElementById(id);
      const authored = document.querySelector('meta[name="omelette-print-sizing"]:not([data-omelette-injected])');
      // A fixed page wins outright (mirroring the fixed-size loop above,
      // so the two metas can never contradict each other in a mixed
      // multi-page document); otherwise the first page's mode holds.
      let mode = null;
      for (const el of document.querySelectorAll('doc-page')) {
        if (typeof el._printSizingMode !== 'function') continue;
        const m = el._printSizingMode();
        if (m === 'fixed') {
          mode = m;
          break;
        }
        if (mode === null) mode = m;
      }
      if (!mode || authored) {
        if (own) own.remove();
        return;
      }
      // A deck-stage that connected first injected its own meta and
      // defers to any existing one — take it over, or the document ends
      // up with two conflicting injected metas (a doc-page page is the
      // document; the deck re-ensures its meta if every doc-page leaves).
      const deckMeta = document.getElementById('deck-stage-print-sizing');
      if (deckMeta) deckMeta.remove();
      const tag = own || document.createElement('meta');
      tag.id = id;
      tag.name = 'omelette-print-sizing';
      tag.content = mode;
      tag.setAttribute('data-omelette-injected', '');
      if (!own) document.head.appendChild(tag);
    }
    _scheduleMeasure() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = null;
        this._measure();
      });
    }

    /** Slot heights feed the print spacers (--doc-hdr-h / --doc-ftr-h), so
     *  they re-measure on content mutation, resize, and font load. The
     *  same pass detects explicit pagination (direct .page children) and
     *  toggles the sheet between the flowing-document card and the
     *  page-per-card stack — content edits can add or remove pages at any
     *  time, so this tracks the same mutations the measurement does. */
    _measure() {
      const hdr = this.querySelector(':scope > [slot="header"]');
      const ftr = this.querySelector(':scope > [slot="footer"]');
      const wasPaginated = this._sheet.classList.contains('paginated');
      this._sheet.classList.toggle('paginated', this.querySelector(':scope > .page') !== null);
      // The WebKit @page margin is flowing-only, so a pagination flip
      // must re-emit the rule (content edits can add or remove .page
      // sections at any time).
      if (this._sheet.classList.contains('paginated') !== wasPaginated) {
        this._syncPrintPageRule();
      }
      this._syncSize(hdr ? hdr.offsetHeight : 0, ftr ? ftr.offsetHeight : 0);
    }
  }
  if (!customElements.get('doc-page')) {
    customElements.define('doc-page', DocPage);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "doc-page.js", error: String((e && e.message) || e) }); }

__ds_ns.Floaters = __ds_scope.Floaters;

__ds_ns.FLOATER_PRESETS = __ds_scope.FLOATER_PRESETS;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.LogoMark = __ds_scope.LogoMark;

__ds_ns.DolphinLoader = __ds_scope.DolphinLoader;

__ds_ns.MASCOT_STATES = __ds_scope.MASCOT_STATES;

__ds_ns.Mascot = __ds_scope.Mascot;

__ds_ns.AnimatedMascot = __ds_scope.AnimatedMascot;

__ds_ns.SuccessCelebration = __ds_scope.SuccessCelebration;

__ds_ns.TOOL_VISUAL = __ds_scope.TOOL_VISUAL;

__ds_ns.ToolLogo = __ds_scope.ToolLogo;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.PlanBadge = __ds_scope.PlanBadge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardDescription = __ds_scope.CardDescription;

__ds_ns.CardContent = __ds_scope.CardContent;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconSpinKeyframes = __ds_scope.IconSpinKeyframes;

__ds_ns.ICON_NAMES = __ds_scope.ICON_NAMES;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.PasswordInput = __ds_scope.PasswordInput;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.StatCardSkeleton = __ds_scope.StatCardSkeleton;

__ds_ns.ProjectCardSkeleton = __ds_scope.ProjectCardSkeleton;

__ds_ns.ToastProvider = __ds_scope.ToastProvider;

__ds_ns.UsageMeter = __ds_scope.UsageMeter;

__ds_ns.MenuToggleIcon = __ds_scope.MenuToggleIcon;

})();
