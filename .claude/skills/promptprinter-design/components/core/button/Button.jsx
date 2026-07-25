import React from "react";

const SIZES = {
  sm: { height: 36, paddingInline: 14, fontSize: 13 },
  md: { height: 44, paddingInline: 20, fontSize: 14 },
  lg: { height: 48, paddingInline: 24, fontSize: 15 },
  icon: { height: 40, width: 40, paddingInline: 0, fontSize: 14 },
};

const VARIANT_CLASS = {
  primary: "pp-btn-primary",
  accent: "pp-btn-accent",
  ghost: "pp-btn-ghost",
  outline: "pp-btn-outline",
  subtle: "pp-btn-subtle",
  destructive: "pp-btn-destructive",
  link: "pp-btn-link",
};

function ButtonStyle() {
  return (
    <style>{`
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
`}</style>
  );
}

/**
 * Primary UI button. `variant="primary"` (monochrome) is the default action;
 * `variant="accent"` carries the one brand accent, reserve it for the single
 * action that should read as "the" brand moment. `asChild` renders the style
 * onto a single child element (e.g. an anchor) instead of a <button>.
 */
export const Button = React.forwardRef(function Button(
  { variant = "primary", size = "md", asChild = false, className = "", style, children, ...props },
  ref
) {
  const dims = SIZES[size] || SIZES.md;
  const cls = `pp-btn ${VARIANT_CLASS[variant] || VARIANT_CLASS.primary} ${className}`.trim();
  const mergedStyle = {
    height: dims.height,
    width: dims.width,
    paddingInline: dims.paddingInline,
    fontSize: dims.fontSize,
    ...style,
  };

  if (asChild && React.isValidElement(children)) {
    return (
      <>
        <ButtonStyle />
        {React.cloneElement(children, {
          ref,
          className: `${cls} ${children.props.className || ""}`.trim(),
          style: { ...mergedStyle, ...(children.props.style || {}) },
          ...props,
        })}
      </>
    );
  }

  return (
    <>
      <ButtonStyle />
      <button ref={ref} className={cls} style={mergedStyle} {...props}>
        {children}
      </button>
    </>
  );
});
