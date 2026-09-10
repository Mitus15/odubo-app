// Lift the subject out of a product photo and write it as a transparent PNG.
//
// Uses Vision's foreground-instance mask — the same engine behind "lift
// subject" in Photos — because supplier renders sit on flat white and several
// garments (the cream hoodies) are within a few values of that white, which a
// luminance key would eat.
//
//   swiftc -O -o liftsubject liftsubject.swift
//   ./liftsubject in.png out.png
//
// Prints `ok <out> instances=<n> coverage=<0..1> pass=<plain|stretched>`.
// Coverage is the fraction of the frame the subject occupies: a value near 1
// means nothing was removed, near 0 means the garment itself was eaten. The
// caller uses it to refuse an implausible cut rather than publish one.
//
// A white garment on a white field (the B.A.A.D spray tee: body 240,240,250,
// background a flat 255) is not a "subject" to Vision at all. So when the
// plain pass finds nothing, the near-white range is stretched across the full
// scale and Vision is asked again. The stretch exists ONLY to find the mask —
// the mask is always applied to the untouched original, so no pixel of the
// garment is altered.
import Foundation
import Vision
import CoreImage

let args = CommandLine.arguments
guard args.count == 3 else { fputs("usage: liftsubject <in.png> <out.png>\n", stderr); exit(64) }
guard let image = CIImage(contentsOf: URL(fileURLWithPath: args[1])) else { fputs("cannot read \(args[1])\n", stderr); exit(1) }

/// Map [0.90, 1.0] onto [0, 1] so a near-white garment separates from a pure
/// white ground. Used for detection only.
func stretchWhites(_ input: CIImage) -> CIImage {
  let matrix = CIFilter(name: "CIColorMatrix")!
  matrix.setValue(input, forKey: kCIInputImageKey)
  matrix.setValue(CIVector(x: 10, y: 0, z: 0, w: 0), forKey: "inputRVector")
  matrix.setValue(CIVector(x: 0, y: 10, z: 0, w: 0), forKey: "inputGVector")
  matrix.setValue(CIVector(x: 0, y: 0, z: 10, w: 0), forKey: "inputBVector")
  matrix.setValue(CIVector(x: -9, y: -9, z: -9, w: 0), forKey: "inputBiasVector")
  return matrix.outputImage!.cropped(to: input.extent)
}

func lift(_ candidate: CIImage) throws -> (VNInstanceMaskObservation, VNImageRequestHandler)? {
  let handler = VNImageRequestHandler(ciImage: candidate, options: [:])
  let request = VNGenerateForegroundInstanceMaskRequest()
  try handler.perform([request])
  guard let result = request.results?.first else { return nil }
  return (result, handler)
}

var pass = "plain"
var lifted = try lift(image)
if lifted == nil {
  pass = "stretched"
  lifted = try lift(stretchWhites(image))
}
guard let (result, handler) = lifted else { fputs("no subject found in \(args[1])\n", stderr); exit(2) }

let maskBuffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
let mask = CIImage(cvPixelBuffer: maskBuffer)

let context = CIContext()

// Mean of the mask = the fraction of the frame the subject covers.
let average = CIFilter(name: "CIAreaAverage")!
average.setValue(mask, forKey: kCIInputImageKey)
average.setValue(CIVector(cgRect: mask.extent), forKey: kCIInputExtentKey)
var pixel = [UInt8](repeating: 0, count: 4)
context.render(average.outputImage!, toBitmap: &pixel, rowBytes: 4, bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
let coverage = Double(pixel[0]) / 255.0

let blend = CIFilter(name: "CIBlendWithMask")!
blend.setValue(image, forKey: kCIInputImageKey)
blend.setValue(CIImage(color: .clear).cropped(to: image.extent), forKey: kCIInputBackgroundImageKey)
blend.setValue(mask, forKey: kCIInputMaskImageKey)
guard let output = blend.outputImage else { exit(3) }

try context.writePNGRepresentation(of: output, to: URL(fileURLWithPath: args[2]), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("ok \(args[2]) instances=\(result.allInstances.count) coverage=\(String(format: "%.3f", coverage)) pass=\(pass)")
