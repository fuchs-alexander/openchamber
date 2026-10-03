#!/bin/sh
# Regenerates all nomobo branding assets from the unmodified nomobo.de sources.
# macOS only (swift, sips, iconutil).
#
# - App icons per profile: wordmark plus a second line on the profile's
#   background colour (branding/assets/<profile>/icon.icns + icon-1024.png).
# - Host-switcher logo "nomobo": the plain wordmark.
# - Menu bar icons: the "nb" mark as template images (branding/assets/tray-nomobo).
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)
wordmark="$root/branding/assets/nomobo-wordmark.png"
mark="$root/branding/assets/nomobo-mark.png"
font="$root/branding/assets/fonts/Poppins-SemiBold.ttf"
label_colour='#F5F2EF'
logo="$root/packages/ui/src/assets/brand-logos/nomobo.png"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# profile id, icon background, second line, where the switcher logo goes.
# The logo is drawn on the icon background, so only the #07090E run keeps it.
build_icon() {
  profile=$1 background=$2 label=$3 logo_out=$4
  out="$root/branding/assets/$profile"
  mkdir -p "$out"
  swift "$root/branding/scripts/render-brand-assets.swift" "$wordmark" "$background" "$out/icon-1024.png" "$logo_out" \
    "$label" "$font" "$label_colour"
  iconset="$tmp/$profile.iconset"
  mkdir "$iconset"
  for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$out/icon-1024.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
    double=$((size * 2))
    sips -z "$double" "$double" "$out/icon-1024.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$iconset" -o "$out/icon.icns"
  echo "wrote $out/icon.icns"
}

build_icon claudi '#07090E' 'DEV' "$logo"
build_icon nomobogaming '#1F1147' 'GAMING' "$tmp/unused-logo.png"
swift "$root/branding/scripts/render-tray-icons.swift" "$mark" "$root/branding/assets/tray-nomobo"
echo "wrote $logo"
