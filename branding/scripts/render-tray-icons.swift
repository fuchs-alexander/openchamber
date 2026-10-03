// Renders macOS menu bar template icons for one app: a single letter in an
// outlined tile whose fill follows the upstream OpenChamber tray states: idle
// (empty), unseen (filled) and a 16-frame busy animation. Each nomobo app gets
// its own letter so they can be told apart in the menu bar.
//
// Usage: swift branding/scripts/render-tray-icons.swift <letter> <font.ttf> <out-dir>

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
guard args.count == 4 else { fail("usage: render-tray-icons.swift <letter> <font.ttf> <out-dir>") }

guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(URL(fileURLWithPath: args[2]) as CFURL) as? [CTFontDescriptor],
      let fontDescriptor = descriptors.first else { fail("cannot load font at \(args[2])") }

func writePNG(_ image: CGImage, to path: String) {
  guard let destination = CGImageDestinationCreateWithURL(
    URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil
  ) else { fail("cannot write \(path)") }
  CGImageDestinationAddImage(destination, image, nil)
  guard CGImageDestinationFinalize(destination) else { fail("cannot finalize \(path)") }
}

func renderTray(size: Int, fillAlpha: CGFloat) -> CGImage {
  let scale = CGFloat(size) / 18
  guard let context = CGContext(
    data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else { fail("tray context") }
  context.interpolationQuality = .high
  let lineWidth = 1.3 * scale
  let tile = CGRect(x: 0, y: 0, width: size, height: size).insetBy(dx: 1 * scale + lineWidth / 2, dy: 1 * scale + lineWidth / 2)
  let path = CGPath(roundedRect: tile, cornerWidth: 4 * scale, cornerHeight: 4 * scale, transform: nil)
  context.addPath(path)
  context.setFillColor(CGColor(gray: 0, alpha: fillAlpha))
  context.fillPath()
  context.addPath(path)
  context.setStrokeColor(CGColor(gray: 0, alpha: 1))
  context.setLineWidth(lineWidth)
  context.strokePath()
  let font = CTFontCreateWithFontDescriptor(fontDescriptor, 11.5 * scale, nil)
  let attributes: [NSAttributedString.Key: Any] = [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(gray: 0, alpha: 1),
  ]
  let line = CTLineCreateWithAttributedString(NSAttributedString(string: args[1], attributes: attributes))
  let bounds = CTLineGetBoundsWithOptions(line, .useGlyphPathBounds)
  context.textPosition = CGPoint(x: tile.midX - bounds.width / 2 - bounds.minX, y: tile.midY - bounds.height / 2 - bounds.minY)
  CTLineDraw(line, context)
  guard let image = context.makeImage() else { fail("tray image") }
  return image
}

// Fill levels of the upstream OpenChamber tray frames, so animation and
// unseen state read the same as in the original app.
let breath: [CGFloat] = [0.05, 0.05, 0.07, 0.09, 0.12, 0.15, 0.19, 0.23, 0.27, 0.32, 0.36, 0.39, 0.42, 0.44, 0.45, 0.46]
var frames: [(String, CGFloat)] = [("trayTemplate-idle", 0), ("trayTemplate-unseen", 0.55)]
for (index, alpha) in breath.enumerated() {
  frames.append((String(format: "trayTemplate-breath-%02d", index), alpha))
}

let outDir = args[3]
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
for (name, alpha) in frames {
  writePNG(renderTray(size: 18, fillAlpha: alpha), to: "\(outDir)/\(name).png")
  writePNG(renderTray(size: 36, fillAlpha: alpha), to: "\(outDir)/\(name)@2x.png")
}
print("wrote \(frames.count * 2) tray icons to \(outDir)")
