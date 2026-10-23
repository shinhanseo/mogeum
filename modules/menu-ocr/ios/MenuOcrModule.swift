import ExpoModulesCore
import Vision
import UIKit

public class MenuOcrModule: Module {
 public func definition() -> ModuleDefinition {
  Name("MenuOcr")
  AsyncFunction("recognize") { (uri: String, promise: Promise) in
   DispatchQueue.global(qos: .userInitiated).async {
    do {
     guard let url=URL(string:uri), url.isFileURL,
      let image=UIImage(contentsOfFile:url.path), let cg=image.cgImage else {
      promise.reject("OCR_IMAGE", "Local upright image required"); return
     }
     let request=VNRecognizeTextRequest()
     request.recognitionLevel = .accurate
     let supported=try request.supportedRecognitionLanguages()
     request.recognitionLanguages=["ko-KR","en-US"].filter { supported.contains($0) }
     request.usesLanguageCorrection=false
     try VNImageRequestHandler(cgImage:cg,orientation:.up,options:[:]).perform([request])
     let lines=(request.results ?? []).compactMap { observation -> [String:Any]? in
      guard let candidate=observation.topCandidates(1).first else { return nil }
      let points=[observation.topLeft,observation.topRight,observation.bottomRight,observation.bottomLeft]
      return ["text":candidate.string,"confidence":Double(candidate.confidence),"polygon":points.map { ["x":Double($0.x),"y":Double(1-$0.y)] }]
     }
     promise.resolve(["width":cg.width,"height":cg.height,"engine":"apple-vision-v1","lines":lines])
    } catch { promise.reject("OCR_FAILED", "Text recognition failed") }
   }
  }
 }
}
