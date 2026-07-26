export function localePath(locale: string | undefined, path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale || "en"}${normalizedPath}`;
}
