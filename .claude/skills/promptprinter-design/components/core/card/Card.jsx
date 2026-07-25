import React from "react";

function CardStyle() {
  return (
    <style>{`
.pp-card{background:hsl(var(--surface-raised));border:1px solid hsl(var(--border));border-radius:var(--radius-xl);box-shadow:var(--shadow-card);padding:24px;transition:border-color .2s;font-family:var(--font-sans);color:hsl(var(--foreground));box-sizing:border-box;}
.pp-card:hover{border-color:hsl(var(--border-strong));}
.pp-card-header{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
.pp-card-title{font-size:17px;font-weight:600;letter-spacing:-0.01em;margin:0;color:hsl(var(--foreground));}
.pp-card-desc{font-size:14px;line-height:1.5;margin:0;color:hsl(var(--muted-foreground));}
.pp-card-footer{display:flex;align-items:center;justify-content:space-between;padding-top:16px;margin-top:16px;border-top:1px solid hsl(var(--border));}
`}</style>
  );
}

/** Flat surface, hairline border, very subtle elevation — the product's one card shape. */
export const Card = React.forwardRef(function Card({ className = "", style, children, ...props }, ref) {
  return (
    <>
      <CardStyle />
      <div ref={ref} className={`pp-card ${className}`.trim()} style={style} {...props}>
        {children}
      </div>
    </>
  );
});

export function CardHeader({ className = "", style, children, ...props }) {
  return (
    <div className={`pp-card-header ${className}`.trim()} style={style} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", style, children, ...props }) {
  return (
    <h3 className={`pp-card-title ${className}`.trim()} style={style} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = "", style, children, ...props }) {
  return (
    <p className={`pp-card-desc ${className}`.trim()} style={style} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = "", style, children, ...props }) {
  return (
    <div className={className} style={style} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", style, children, ...props }) {
  return (
    <div className={`pp-card-footer ${className}`.trim()} style={style} {...props}>
      {children}
    </div>
  );
}
