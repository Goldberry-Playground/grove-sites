"use client";

/**
 * The Next-injection seam. grove-ui components NEVER import `next/link` or
 * `next/image`; they read a Link/Image from context here. Apps wrap their tree
 * in <GroveLinkProvider value={NextLinkAdapter}> / <GroveImageProvider …>;
 * Storybook and Claude Design get the plain `<a>` / `<img>` defaults, so every
 * component renders standalone.
 */
import {
  createContext,
  useContext,
  type ComponentType,
  type ReactNode,
} from "react";

export type GroveLinkProps = {
  href: string;
  className?: string;
  "aria-current"?: boolean | "page";
  /** Fired on activation — lets callers collapse overlays (e.g. the mini-cart) before navigating. */
  onClick?: () => void;
  children: ReactNode;
};

export type GroveImageProps = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
};

const DefaultLink: ComponentType<GroveLinkProps> = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

const DefaultImage: ComponentType<GroveImageProps> = ({ src, alt, ...rest }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} {...rest} />
);

const GroveLinkContext = createContext<ComponentType<GroveLinkProps>>(DefaultLink);
const GroveImageContext = createContext<ComponentType<GroveImageProps>>(DefaultImage);

export const GroveLinkProvider = GroveLinkContext.Provider;
export const GroveImageProvider = GroveImageContext.Provider;

/** Use inside a grove-ui component instead of importing `next/link`. */
export const useGroveLink = () => useContext(GroveLinkContext);
/** Use inside a grove-ui component instead of importing `next/image`. */
export const useGroveImage = () => useContext(GroveImageContext);
