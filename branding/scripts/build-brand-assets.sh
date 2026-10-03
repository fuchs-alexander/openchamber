#!/bin/sh
# Regenerates all branding assets from the unmodified source logos in
# branding/assets. macOS only (swift, sips, iconutil).
#
# Per profile: app icon (branding/assets/<profile>/icon.icns + icon-1024.png)
# and menu bar icons (branding/assets/<profile>/tray, one letter per app).
# Shared: host-switcher logos in packages/ui/src/assets/brand-logos.
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)
assets="$root/branding/assets"
render="$root/branding/scripts/render-brand-assets.swift"
font="$assets/fonts/Poppins-SemiBold.ttf"
label_colour='#F5F2EF'
logos="$root/packages/ui/src/assets/brand-logos"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# profile id, menu bar letter; expects $assets/<profile>/icon-1024.png
finish_profile() {
  profile=$1 tray_letter=$2
  out="$assets/$profile"
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

# nomobo apps: wordmark plus a second line on the profile's background
# ("#top:#bottom" for a gradient). An optional accent replaces the orange "bo"
# where the background itself is orange or red.
nomobo_icon() {
  profile=$1 background=$2 label=$3 tray_letter=$4 accent=${5:-}
  mkdir -p "$assets/$profile"
  if [ -n "$accent" ]; then
    swift "$render" icon "$assets/nomobo-wordmark.png" "$background" "$assets/$profile/icon-1024.png" \
      "$label" "$font" "$label_colour" "$accent"
  else
    swift "$render" icon "$assets/nomobo-wordmark.png" "$background" "$assets/$profile/icon-1024.png" \
      "$label" "$font" "$label_colour"
  fi
  finish_profile "$profile" "$tray_letter"
}

nomobo_icon claudi '#07090E' 'DEV' 'D'
nomobo_icon nomobogaming '#1F1147' 'GAMING' 'G'
# Navy of the nomobo-hosting folder icon (nomobo-hosting/assets/folder-icon.svg).
nomobo_icon nomobohosting '#142B49' 'HOSTING' 'H'

# Posylka: the orange of the posylka.de favicon (measured from
# favicon-192x192.png), "bo" in nomobo dark for contrast.
nomobo_icon posylka '#ED8420:#E56226' 'POSYLKA' 'P' '#07090E'
# Sofasx: the red of the mebleokes.com OKES logo, "bo" in nomobo dark.
nomobo_icon sofasx '#FD0136' 'OKES' 'S' '#07090E'
# Local OpenChamber replacement (shares OpenChamber's data).
nomobo_icon nomobolocal '#0E3B36' 'LOCAL' 'L'

# Host-switcher logos, about 61 px high to match the nomobo wordmark.
swift "$render" logo "$assets/nomobo-wordmark.png" '#07090E' "$logos/nomobo.png"
swift "$render" logo "$assets/posylka-logo.svg" '#FFFFFF' "$logos/posylka.png" 61
sips -s format png -z 105 105 "$assets/okes-logo.webp" --out "$logos/okes.png" >/dev/null
echo "wrote host-switcher logos to $logos"
