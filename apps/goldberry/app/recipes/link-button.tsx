import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * A link that looks like the @grove/ui-kit <Button> (same `grove-btn` class,
 * same --grove-* variant and size styles). ui-kit's Button renders a <button>,
 * and every CTA on /recipes navigates, so it has to be an <a>.
 *
 * `onDark` swaps the ghost variant's ink to primary-foreground for the plum
 * band. `offsite` renders a plain <a> for hrefs that leave the app, including
 * the /recipes/trees/* redirects (a client-side <Link> fetch can't follow an
 * off-site redirect). Candidate for ui-kit as `<ButtonLink>` if a second
 * surface needs it.
 */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  onDark = false,
  offsite = false,
  children,
}: {
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  onDark?: boolean;
  offsite?: boolean;
  children: ReactNode;
}) {
  const sizes: Record<"md" | "lg", CSSProperties> = {
    md: { padding: "0.5rem 1rem", fontSize: "1rem" },
    lg: { padding: "0.75rem 1.5rem", fontSize: "1.05rem" },
  };
  const variants: Record<"primary" | "secondary" | "ghost", CSSProperties> = {
    primary: { backgroundColor: "var(--grove-color-primary)", color: "var(--grove-color-primary-foreground)", border: "none" },
    secondary: { backgroundColor: "var(--grove-color-secondary)", color: "var(--grove-color-secondary-foreground)", border: "none" },
    ghost: {
      backgroundColor: "transparent",
      color: onDark ? "var(--grove-color-primary-foreground)" : "var(--grove-color-primary)",
      border: "1px solid currentColor",
    },
  };
  const style: CSSProperties = {
    fontFamily: "var(--grove-font-sans)",
    borderRadius: "var(--grove-radius-md)",
    fontWeight: 500,
    ...sizes[size],
    ...variants[variant],
  };
  if (offsite) {
    return (
      <a href={href} className="grove-btn" style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className="grove-btn" style={style}>
      {children}
    </Link>
  );
}
