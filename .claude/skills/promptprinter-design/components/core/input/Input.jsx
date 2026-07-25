import React from "react";

function InputStyle() {
  return (
    <style>{`
.pp-input{height:44px;width:100%;border-radius:var(--radius-lg);border:1px solid hsl(var(--border));background:hsl(var(--surface));padding:0 14px;font-size:14px;font-family:var(--font-sans);color:hsl(var(--foreground));transition:border-color .2s,box-shadow .2s;outline:none;box-sizing:border-box;}
.pp-input::placeholder{color:hsl(var(--muted-foreground));}
.pp-input:focus{border-color:hsl(var(--ring));box-shadow:0 0 0 3px hsl(var(--ring)/.18),0 0 10px hsl(var(--ring)/.16);}
.pp-input:disabled{cursor:not-allowed;opacity:.5;}
.pp-input.pp-input-error{border-color:hsl(var(--destructive)/.55)!important;}
.pp-input.pp-input-error:focus{box-shadow:0 0 0 3px hsl(var(--destructive)/.15)!important;}
.pp-textarea{height:auto;min-height:120px;padding:10px 14px;line-height:1.5;resize:vertical;font-family:var(--font-sans);}
`}</style>
  );
}

/** Text input — the product's one field shape, used directly or via PasswordInput. */
export const Input = React.forwardRef(function Input({ className = "", style, error = false, ...props }, ref) {
  return (
    <>
      <InputStyle />
      <input
        ref={ref}
        className={`pp-input ${error ? "pp-input-error" : ""} ${className}`.trim()}
        style={style}
        {...props}
      />
    </>
  );
});

export const Textarea = React.forwardRef(function Textarea({ className = "", style, error = false, ...props }, ref) {
  return (
    <>
      <InputStyle />
      <textarea
        ref={ref}
        className={`pp-input pp-textarea ${error ? "pp-input-error" : ""} ${className}`.trim()}
        style={style}
        {...props}
      />
    </>
  );
});
