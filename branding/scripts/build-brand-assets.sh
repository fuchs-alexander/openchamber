#!/bin/sh
# Regenerates all nomobo branding assets from the unmodified nomobo.de sources.
# macOS only (swift, sips, iconutil).
#
# - App icons per profile: wordmark plus a second line on the profile's
#   background colour (branding/assets/<profile>/icon.icns + icon-1024.png).
# - Host-switcher logo "nomobo": the plain wordmark.
# - Menu bar icons per profile: one letter in a tile (branding/assets/<profile>/tray).
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)
wordmark="$root/branding/assets/nomobo-wordmark.png"
font="$root/branding/assets/fonts/Poppins-SemiBold.ttf"
label_colour='#F5F2EF'
logo="$root/packages/ui/src/assets/brand-logos/nomobo.png"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# profile id, icon background, second line, menu bar letter, where the switcher
# logo goes. The logo is drawn on the icon background, so only the #07090E run
# keeps it.
build_icon() {
  profile=$1 background=$2 label=$3 tray_letter=$4 logo_out=$5
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
  swift "$root/branding/scripts/render-tray-icons.swift" "$tray_letter" "$font" "$out/tray"
  echo "wrote $out/icon.icns and $out/tray"
}

build_icon claudi '#07090E' 'DEV' 'D' "$logo"
build_icon nomobogaming '#1F1147' 'GAMING' 'G' "$tmp/unused-logo.png"
# Navy of the nomobo-hosting folder icon (nomobo-hosting/assets/folder-icon.svg).
build_icon nomobohosting '#142B49' 'HOSTING' 'H' "$tmp/unused-logo.png"
echo "wrote $logo"
