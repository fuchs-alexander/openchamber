import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { brandLogoMapFromModules } from './brandLogos';

describe('brand logo registry', () => {
  test('maps bundled logo files to their ids', () => {
    const logos = brandLogoMapFromModules({
      '../assets/brand-logos/nomobo.png': '/assets/nomobo-abc.png',
      '../assets/brand-logos/Other.png': '/assets/other.png',
    });
    expect(logos.get('nomobo')).toBe('/assets/nomobo-abc.png');
    expect(logos.get('other')).toBe('/assets/other.png');
    expect(logos.get('unknown')).toBeUndefined();
  });

  test('ignores modules without a usable URL', () => {
    const logos = brandLogoMapFromModules({ '../assets/brand-logos/empty.png': '' });
    expect(logos.has('empty')).toBe(false);
  });

  test('the nomobo logo is bundled', () => {
    const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/brand-logos');
    expect(existsSync(resolve(directory, 'nomobo.png'))).toBe(true);
  });
});
