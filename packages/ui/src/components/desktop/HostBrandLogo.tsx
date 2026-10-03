import React from 'react';

import { Icon } from '@/components/icon/Icon';
import { resolveBrandLogoSrc } from '@/lib/brandLogos';
import { cn } from '@/lib/utils';

type HostBrandLogoProps = {
  brandLogoId?: string;
  className?: string;
  resolveSrc?: (brandLogoId: string) => string | null;
};

/**
 * Logo shown before a host's name. Decorative: the name next to it stays the
 * accessible label. A logo id the UI does not bundle, or an image that fails
 * to load, falls back to the generic server symbol.
 */
export function HostBrandLogo({ brandLogoId, className, resolveSrc = resolveBrandLogoSrc }: HostBrandLogoProps) {
  const [failed, setFailed] = React.useState(false);
  if (!brandLogoId) return null;

  const src = failed ? null : resolveSrc(brandLogoId);
  if (!src) {
    return <Icon name="server" aria-hidden="true" className={cn('h-4 w-4 flex-shrink-0 text-muted-foreground', className)} />;
  }
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('h-4 w-auto max-w-[4.5rem] flex-shrink-0 object-contain', className)}
    />
  );
}
