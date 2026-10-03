import { describe, expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { HostBrandLogo } from './HostBrandLogo';

const resolveSrc = (id: string) => (id === 'nomobo' ? '/assets/nomobo.png' : null);

describe('HostBrandLogo', () => {
  test('renders nothing for a host without a logo', () => {
    expect(renderToStaticMarkup(<HostBrandLogo resolveSrc={resolveSrc} />)).toBe('');
  });

  test('shows the bundled image for a known logo, decorative next to the host name', () => {
    const html = renderToStaticMarkup(<HostBrandLogo brandLogoId="nomobo" resolveSrc={resolveSrc} />);
    expect(html).toContain('<img');
    expect(html).toContain('src="/assets/nomobo.png"');
    expect(html).toContain('alt=""');
    expect(html).toContain('object-contain');
  });

  test('shows a placeholder symbol for an unknown logo instead of a broken image', () => {
    const html = renderToStaticMarkup(<HostBrandLogo brandLogoId="missing" resolveSrc={resolveSrc} />);
    expect(html).not.toContain('<img');
    expect(html).toContain('<svg');
  });
});
