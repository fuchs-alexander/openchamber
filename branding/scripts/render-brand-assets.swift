// Renders the branded app icon and the host-switcher logo from an unmodified
// source wordmark. The wordmark itself is never redrawn: it is only scaled and
// placed on the brand's background colour.
//
// Usage:
//   swift branding/scripts/render-brand-assets.swift <wordmark.png> <hex-bg> <icon-1024.png> <logo.png> \
//     [<icon-label> <font.ttf> <hex-label-colour>]
//
// The optional label is set as a second line under the wordmark on the app
// icon only, so apps built from the same wordmark stay distinguishable.

import AppKit
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count == 5 || args.count == 8 else {
  fail("usage: render-brand-assets.swift <wordmark.png> <hex-bg> <icon-1024.png> <logo.png> [<icon-label> <font.ttf> <hex-label-colour>]")
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

func makeLabelLine(_ text: String, fontPath: String, size: CGFloat, colour: CGColor, tracking: CGFloat) -> CTLine {
  guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: fontPath) as CFURL) as? [CTFontDescriptor],
        let descriptor = descriptors.first else { fail("cannot load font at \(fontPath)") }
  let font = CTFontCreateWithFontDescriptor(descriptor, size, nil)
  let attributes: [NSAttributedString.Key: Any] = [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): colour,
    NSAttributedString.Key(kCTKernAttributeName as String): tracking,
  ]
  return CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attributes))
}

let wordmark = loadImage(args[1])
let background = parseHex(args[2])
let label = args.count == 8 ? args[5] : nil

// macOS app icon grid: 824pt rounded square centred on a 1024pt canvas.
let icon = render(width: 1024, height: 1024) { context in
  let tile = CGRect(x: 100, y: 100, width: 824, height: 824)
  context.addPath(CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil))
  context.setFillColor(background)
  context.fillPath()
  guard let label else {
    drawWordmark(wordmark, in: context, centeredIn: tile, width: 640)
    return
  }
  // Two lines: wordmark, then the label, centred as one block.
  let wordmarkWidth: CGFloat = 600
  let wordmarkHeight = CGFloat(wordmark.height) * wordmarkWidth / CGFloat(wordmark.width)
  // A long label shrinks to the wordmark's width instead of reaching the edge.
  var line = makeLabelLine(label, fontPath: args[6], size: 170, colour: parseHex(args[7]), tracking: 14)
  var bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
  if bounds.width > wordmarkWidth {
    let fitted = 170 * wordmarkWidth / bounds.width
    line = makeLabelLine(label, fontPath: args[6], size: fitted, colour: parseHex(args[7]), tracking: 14 * fitted / 170)
    bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
  }
  let gap: CGFloat = 70
  let blockHeight = wordmarkHeight + gap + bounds.height
  let blockBottom = tile.midY - blockHeight / 2
  let labelX = tile.midX - bounds.width / 2 - bounds.minX
  context.textPosition = CGPoint(x: labelX, y: blockBottom - bounds.minY)
  CTLineDraw(line, context)
  let wordmarkRect = CGRect(x: tile.midX - wordmarkWidth / 2, y: blockBottom + bounds.height + gap, width: wordmarkWidth, height: wordmarkHeight)
  context.draw(wordmark, in: wordmarkRect)
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
