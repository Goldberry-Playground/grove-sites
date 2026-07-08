import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. */
  variant?: "primary" | "secondary" | "ghost";
  /** Control height + type scale. */
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

/**
 * The Grove button. Styled entirely against `--grove-*` tokens, so it renders
 * on-brand under any theme (`@grove/tokens/themes/<brand>.css`) with no per-app
 * variants. Portable: no `next/*`, no data — a plain `<button>`.
 */
export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  style,
  ...props
}: ButtonProps) {
  const sizeStyles: Record<NonNullable<ButtonProps["size"]>, CSSProperties> = {
    sm: { padding: "0.375rem 0.75rem", fontSize: "0.875rem" },
    md: { padding: "0.5rem 1rem", fontSize: "1rem" },
    lg: { padding: "0.75rem 1.5rem", fontSize: "1.125rem" },
  };

  const variantStyles: Record<NonNullable<ButtonProps["variant"]>, CSSProperties> = {
    primary: {
      backgroundColor: "var(--grove-color-primary)",
      color: "var(--grove-color-primary-foreground)",
      border: "none",
    },
    secondary: {
      backgroundColor: "var(--grove-color-secondary)",
      color: "var(--grove-color-secondary-foreground)",
      border: "none",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--grove-color-primary)",
      border: "1px solid currentColor",
    },
  };

  return (
    <button
      className={["grove-btn", className].filter(Boolean).join(" ")}
      style={{
        fontFamily: "var(--grove-font-sans)",
        borderRadius: "var(--grove-radius-md)",
        fontWeight: 500,
        cursor: "pointer",
        transition: "opacity 0.15s ease",
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
