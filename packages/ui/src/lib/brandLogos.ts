/**
 * Logos that branded desktop builds attach to a host through `brandLogoId`.
 * Only images bundled under `assets/brand-logos/` can be shown; a host never
 * supplies its own image URL or markup.
 */

// Vite rewrites `import.meta.glob` at build time. The bun test runner has no
// such transform and throws, so an empty registry stands in there.
const loadBrandLogoModules = (): Record<string, string> => {
  try {
    return import.meta.glob<string>('../assets/brand-logos/*.png', {
      eager: true,
      import: 'default',
    });
  } catch {
    return {};
  }
};

export const brandLogoMapFromModules = (modules: Record<string, string>): Map<string, string> => {
  const logos = new Map<string, string>();
  for (const [path, url] of Object.entries(modules)) {
    const match = path.match(/brand-logos\/([^/]+)\.png$/i);
    if (match?.[1] && url) {
      logos.set(match[1].toLowerCase(), url);
    }
  }
  return logos;
};

const BRAND_LOGOS = brandLogoMapFromModules(loadBrandLogoModules());

export const resolveBrandLogoSrc = (brandLogoId: string): string | null => BRAND_LOGOS.get(brandLogoId) ?? null;
