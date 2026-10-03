#!/bin/sh
# Regenerates the Claudi icon (.icns + 1024 PNG) and the "nomobo" host-switcher
# logo from the unmodified nomobo.de wordmark. macOS only (swift, sips, iconutil).
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)
wordmark="$root/branding/assets/nomobo-wordmark.png"
background='#07090E'
out="$root/branding/assets/claudi"
logo="$root/packages/ui/src/assets/brand-logos/nomobo.png"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$out"
swift "$root/branding/scripts/render-brand-assets.swift" "$wordmark" "$background" "$out/icon-1024.png" "$logo"

iconset="$tmp/icon.iconset"
mkdir "$iconset"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$out/icon-1024.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$out/icon-1024.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$out/icon.icns"
echo "wrote $out/icon.icns, $out/icon-1024.png and $logo"
