import Foundation
import Vision
import CoreImage

let args = CommandLine.arguments
guard args.count == 3 else { fputs("usage: liftsubject <in.png> <out.png>\n", stderr); exit(64) }
guard let image = CIImage(contentsOf: URL(fileURLWithPath: args[1])) else { fputs("cannot read \(args[1])\n", stderr); exit(1) }

let handler = VNImageRequestHandler(ciImage: image, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
guard let result = request.results?.first else { fputs("no subject found in \(args[1])\n", stderr); exit(2) }

let maskBuffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
let mask = CIImage(cvPixelBuffer: maskBuffer)

let blend = CIFilter(name: "CIBlendWithMask")!
blend.setValue(image, forKey: kCIInputImageKey)
blend.setValue(CIImage(color: .clear).cropped(to: image.extent), forKey: kCIInputBackgroundImageKey)
blend.setValue(mask, forKey: kCIInputMaskImageKey)
guard let output = blend.outputImage else { exit(3) }

let context = CIContext()
try context.writePNGRepresentation(of: output, to: URL(fileURLWithPath: args[2]), format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
print("ok \(args[2]) instances=\(result.allInstances.count)")
