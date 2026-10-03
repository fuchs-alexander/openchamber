// Renders branded app icons and host-switcher logos from unmodified source
// logos. Source artwork is never redrawn: it is only scaled and placed.
//
// Usage:
//   render-brand-assets.swift icon <wordmark> <hex-bg> <icon-1024.png> [<label> <font.ttf> <hex-label-colour>]
//       Wordmark centred on a tile in the background colour; the optional label
//       is a second line, so apps sharing a wordmark stay distinguishable.
//   render-brand-assets.swift icon-logo <logo> <icon-1024.png>
//       A square logo that already is a tile, placed on the macOS icon grid.
//   render-brand-assets.swift icon-initial <wordmark> <hex-top> <hex-bottom> <icon-1024.png>
//       The wordmark's first letter in white, centred on a vertical gradient,
//       for brands whose favicon is that letter (crisp, unlike an upscaled favicon).
//   render-brand-assets.swift logo <wordmark> <hex-bg> <logo.png> [<height>]
//       Host-switcher logo: the wordmark on a rounded pill, optionally scaled to
//       <height> pixels, so it stays legible on light and dark themes.
//
// Sources may be PNG/WebP or SVG (rasterised at 2400 px width).

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
func usage() -> Never {
  fail("usage: render-brand-assets.swift icon <wordmark> <hex-bg> <out.png> [<label> <font.ttf> <hex-colour>] | icon-logo <logo> <out.png> | icon-initial <wordmark> <hex-top> <hex-bottom> <out.png> | logo <wordmark> <hex-bg> <out.png> [<height>]")
}
guard args.count >= 2 else { usage() }

func loadImage(_ path: String) -> CGImage {
  if path.lowercased().hasSuffix(".svg") {
    guard let svg = NSImage(contentsOfFile: path), svg.size.width > 0 else { fail("cannot read SVG at \(path)") }
    let width = 2400, height = Int((2400 * svg.size.height / svg.size.width).rounded())
    var rect = CGRect(x: 0, y: 0, width: width, height: height)
    guard let image = svg.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { fail("cannot rasterise \(path)") }
    return image
  }
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

// macOS app icon grid: 824pt rounded square centred on a 1024pt canvas.
let tile = CGRect(x: 100, y: 100, width: 824, height: 824)

func renderIcon(wordmark: CGImage, background: CGColor, label: (text: String, fontPath: String, colour: CGColor)?) -> CGImage {
  render(width: 1024, height: 1024) { context in
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
    var line = makeLabelLine(label.text, fontPath: label.fontPath, size: 170, colour: label.colour, tracking: 14)
    var bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
    if bounds.width > wordmarkWidth {
      let fitted = 170 * wordmarkWidth / bounds.width
      line = makeLabelLine(label.text, fontPath: label.fontPath, size: fitted, colour: label.colour, tracking: 14 * fitted / 170)
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
}

func renderLogoPill(wordmark: CGImage, background: CGColor, height: Int?) -> CGImage {
  let scale = height.map { CGFloat($0) / CGFloat(wordmark.height) } ?? 1
  let markWidth = Int((CGFloat(wordmark.width) * scale).rounded())
  let markHeight = Int((CGFloat(wordmark.height) * scale).rounded())
  let padX = 28, padY = 22
  let logoWidth = markWidth + padX * 2
  let logoHeight = markHeight + padY * 2
  return render(width: logoWidth, height: logoHeight) { context in
    let rect = CGRect(x: 0, y: 0, width: logoWidth, height: logoHeight)
    context.addPath(CGPath(roundedRect: rect, cornerWidth: 24, cornerHeight: 24, transform: nil))
    context.setFillColor(background)
    context.fillPath()
    context.draw(wordmark, in: CGRect(x: padX, y: padY, width: markWidth, height: markHeight))
  }
}

// The first glyph of a wordmark (columns up to the first gap), as a white mask.
func firstGlyphInWhite(_ image: CGImage) -> CGImage {
  let width = image.width, height = image.height
  var pixels = [UInt8](repeating: 0, count: width * height * 4)
  let space = CGColorSpace(name: CGColorSpace.sRGB)!
  let info = CGImageAlphaInfo.premultipliedLast.rawValue
  guard let reader = CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8,
                               bytesPerRow: width * 4, space: space, bitmapInfo: info) else { fail("glyph context") }
  reader.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  let inked = (0..<width).map { x in (0..<height).contains { y in pixels[(y * width + x) * 4 + 3] > 20 } }
  guard let start = inked.firstIndex(of: true) else { fail("wordmark is empty") }
  let end = inked[start...].firstIndex(of: false) ?? width
  let rows = (0..<height).filter { y in (start..<end).contains { x in pixels[(y * width + x) * 4 + 3] > 20 } }
  guard let top = rows.first, let bottom = rows.last else { fail("wordmark is empty") }
  let glyphWidth = end - start, glyphHeight = bottom - top + 1
  var out = [UInt8](repeating: 0, count: glyphWidth * glyphHeight * 4)
  for y in 0..<glyphHeight {
    for x in 0..<glyphWidth {
      let alpha = pixels[((y + top) * width + x + start) * 4 + 3]
      let index = (y * glyphWidth + x) * 4
      out[index] = alpha; out[index + 1] = alpha; out[index + 2] = alpha; out[index + 3] = alpha
    }
  }
  guard let writer = CGContext(data: &out, width: glyphWidth, height: glyphHeight, bitsPerComponent: 8,
                               bytesPerRow: glyphWidth * 4, space: space, bitmapInfo: info),
        let glyph = writer.makeImage() else { fail("glyph image") }
  return glyph
}

func renderInitialIcon(wordmark: CGImage, top: CGColor, bottom: CGColor) -> CGImage {
  let glyph = firstGlyphInWhite(wordmark)
  return render(width: 1024, height: 1024) { context in
    context.saveGState()
    context.addPath(CGPath(roundedRect: tile, cornerWidth: 185, cornerHeight: 185, transform: nil))
    context.clip()
    let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB)!, colors: [top, bottom] as CFArray, locations: [0, 1])!
    context.drawLinearGradient(gradient, start: CGPoint(x: tile.midX, y: tile.maxY), end: CGPoint(x: tile.midX, y: tile.minY), options: [])
    context.restoreGState()
    // Letter height as in the posylka.de favicon: 118 of 192 px.
    let height = tile.height * 118 / 192
    let width = height * CGFloat(glyph.width) / CGFloat(glyph.height)
    context.draw(glyph, in: CGRect(x: tile.midX - width / 2, y: tile.midY - height / 2, width: width, height: height))
  }
}

switch args[1] {
case "icon" where args.count == 5 || args.count == 8:
  let label = args.count == 8 ? (text: args[5], fontPath: args[6], colour: parseHex(args[7])) : nil
  writePNG(renderIcon(wordmark: loadImage(args[2]), background: parseHex(args[3]), label: label), to: args[4])
case "icon-logo" where args.count == 4:
  let logo = loadImage(args[2])
  writePNG(render(width: 1024, height: 1024) { $0.draw(logo, in: tile) }, to: args[3])
case "icon-initial" where args.count == 6:
  writePNG(renderInitialIcon(wordmark: loadImage(args[2]), top: parseHex(args[3]), bottom: parseHex(args[4])), to: args[5])
case "logo" where args.count == 5 || args.count == 6:
  let height = args.count == 6 ? Int(args[5]) : nil
  writePNG(renderLogoPill(wordmark: loadImage(args[2]), background: parseHex(args[3]), height: height), to: args[4])
default:
  usage()
}
