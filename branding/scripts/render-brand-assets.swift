// Renders the branded app icon and the host-switcher logo from an unmodified
// source wordmark. The wordmark itself is never redrawn: it is only scaled and
// placed on the brand's background colour.
//
// Usage:
//   swift branding/scripts/render-brand-assets.swift <wordmark.png> <hex-bg> <icon-1024.png> <logo.png>

import AppKit
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count == 5 else {
  fail("usage: render-brand-assets.swift <wordmark.png> <hex-bg> <icon-1024.png> <logo.png>")
}

func loadImage(_ path: String) -> CGImage {
  guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fail("cannot read image at \(path)")
  }
  return image
}

func parseHex(_ hex: String) -> CGColor {
  let value = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
  guard value.count == 6, let rgb = UInt32(value, radix: 16) else { fail("invalid colour \(hex)") }
  return CGColor(
    srgbRed: CGFloat((rgb >> 16) & 0xff) / 255,
    green: CGFloat((rgb >> 8) & 0xff) / 255,
    blue: CGFloat(rgb & 0xff) / 255,
    alpha: 1
  )
}

func render(width: Int, height: Int, draw: (CGContext) -> Void) -> CGImage {
  guard let context = CGContext(
    data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpace(name: CGColorSpace.sRGB)!,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else { fail("cannot create bitmap context") }
  context.interpolationQuality = .high
  draw(context)
  guard let image = context.makeImage() else { fail("cannot render image") }
  return image
}

func writePNG(_ image: CGImage, to path: String) {
  guard let destination = CGImageDestinationCreateWithURL(
    URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil
  ) else { fail("cannot write \(path)") }
  CGImageDestinationAddImage(destination, image, nil)
  guard CGImageDestinationFinalize(destination) else { fail("cannot finalize \(path)") }
}

func drawWordmark(_ wordmark: CGImage, in context: CGContext, centeredIn rect: CGRect, width: CGFloat) {
  let scale = width / CGFloat(wordmark.width)
  let size = CGSize(width: width, height: CGFloat(wordmark.height) * scale)
  let origin = CGPoint(x: rect.midX - size.width / 2, y: rect.midY - size.height / 2)
  context.draw(wordmark, in: CGRect(origin: origin, size: size))
}

let wordmark = loadImage(args[1])
let background = parseHex(args[2])

// macOS app icon grid: 824pt rounded square centred on a 1024pt canvas.
let icon = render(width: 1024, height: 1024) { context in
  let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
  context.addPath(CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil))
  context.setFillColor(background)
  context.fillPath()
  drawWordmark(wordmark, in: context, centeredIn: tile, width: 640)
}
writePNG(icon, to: args[3])

// Host-switcher logo: the wordmark at its native size on a rounded pill, so it
// stays legible on light and dark themes.
let padX = 28, padY = 22
let logoWidth = wordmark.width + padX * 2
let logoHeight = wordmark.height + padY * 2
let logo = render(width: logoWidth, height: logoHeight) { context in
  let rect = CGRect(x: 0, y: 0, width: logoWidth, height: logoHeight)
  context.addPath(CGPath(roundedRect: rect, cornerWidth: 24, cornerHeight: 24, transform: nil))
  context.setFillColor(background)
  context.fillPath()
  context.draw(wordmark, in: CGRect(x: padX, y: padY, width: wordmark.width, height: wordmark.height))
}
writePNG(logo, to: args[4])
