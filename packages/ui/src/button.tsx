import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  style,
  ...props
}: ButtonProps) {
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: "0.375rem 0.75rem", fontSize: "0.875rem" },
    md: { padding: "0.5rem 1rem", fontSize: "1rem" },
    lg: { padding: "0.75rem 1.5rem", fontSize: "1.125rem" },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "var(--grove-color-primary, #2d6a4f)",
      color: "var(--grove-color-primary-foreground, #ffffff)",
      border: "none",
    },
    secondary: {
      backgroundColor: "var(--grove-color-secondary, #b7e4c7)",
      color: "var(--grove-color-secondary-foreground, #1b4332)",
      border: "none",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "var(--grove-color-primary, #2d6a4f)",
      border: "1px solid currentColor",
    },
  };

  return (
    <button
      className={className}
      style={{
        borderRadius: "0.375rem",
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
