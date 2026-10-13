/** True for an inline `data:` image URL. The shop pages consult this to decide
 *  whether to render with next/image (HTTPS) or a plain <img> (data:), since
 *  next/image cannot optimize an inline URI. */
export function isDataUri(url: string | null | undefined): boolean {
  return !!url && url.startsWith("data:");
}
