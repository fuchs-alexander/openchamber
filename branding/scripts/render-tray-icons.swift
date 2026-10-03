// Renders macOS menu bar template icons from the nomobo.de "nb" mark.
// The letter shapes are taken from the source image as a mask (not redrawn);
// they sit in an outlined tile whose fill follows the upstream OpenChamber
// tray states: idle (empty), unseen (filled) and a 16-frame busy animation.
//
// Usage: swift branding/scripts/render-tray-icons.swift <mark.png> <out-dir>

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
guard args.count == 3 else { fail("usage: render-tray-icons.swift <mark.png> <out-dir>") }

guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
      let mark = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fail("cannot read \(args[1])") }

// Letter mask: the bright (white "n", orange "b") pixels of the mark become
// opaque black, the dark tile and transparent corners become transparent.
func letterMask(_ image: CGImage) -> CGImage {
  let width = image.width, height = image.height
  var pixels = [UInt8](repeating: 0, count: width * height * 4)
  let space = CGColorSpace(name: CGColorSpace.sRGB)!
  let info = CGImageAlphaInfo.premultipliedLast.rawValue
  guard let reader = CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8,
                               bytesPerRow: width * 4, space: space, bitmapInfo: info) else { fail("mask context") }
  reader.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
  var out = [UInt8](repeating: 0, count: width * height * 4)
  for index in 0..<(width * height) {
    let r = Double(pixels[index * 4]), g = Double(pixels[index * 4 + 1]), b = Double(pixels[index * 4 + 2])
    let alpha = Double(pixels[index * 4 + 3]) / 255
    let brightness = max(r, g, b) / 255
    let coverage = min(1, max(0, (brightness - 0.12) / 0.6)) * alpha
    out[index * 4 + 3] = UInt8((coverage * 255).rounded())
  }
  guard let writer = CGContext(data: &out, width: width, height: height, bitsPerComponent: 8,
                               bytesPerRow: width * 4, space: space, bitmapInfo: info),
        let result = writer.makeImage() else { fail("mask image") }
  return result
}

func writePNG(_ image: CGImage, to path: String) {
  guard let destination = CGImageDestinationCreateWithURL(
    URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil
  ) else { fail("cannot write \(path)") }
  CGImageDestinationAddImage(destination, image, nil)
  guard CGImageDestinationFinalize(destination) else { fail("cannot finalize \(path)") }
}

let letters = letterMask(mark)

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
  // The mark's own proportions: letters keep their place within the tile.
  context.draw(letters, in: tile.insetBy(dx: -0.5 * scale, dy: -0.5 * scale))
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

let outDir = args[2]
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
for (name, alpha) in frames {
  writePNG(renderTray(size: 18, fillAlpha: alpha), to: "\(outDir)/\(name).png")
  writePNG(renderTray(size: 36, fillAlpha: alpha), to: "\(outDir)/\(name)@2x.png")
}
print("wrote \(frames.count * 2) tray icons to \(outDir)")
