package expo.modules.menuocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MenuOcrModule : Module() {
 override fun definition() = ModuleDefinition {
  Name("MenuOcr")
  AsyncFunction("recognize") { uri: String, promise: Promise ->
   val context = appContext.reactContext
   if (context == null || Uri.parse(uri).scheme != "file") {
    promise.reject("OCR_IMAGE", "Local upright image required", null)
   } else {
    try {
     val image = InputImage.fromFilePath(context, Uri.parse(uri))
     val client = TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
     client.process(image).addOnSuccessListener { result ->
      val lines = result.textBlocks.flatMap { it.lines }.mapNotNull { line ->
       val points = line.cornerPoints ?: return@mapNotNull null
       mapOf("text" to line.text, "confidence" to null,
        "polygon" to points.map { mapOf("x" to (it.x.toDouble()/image.width).coerceIn(0.0,1.0),"y" to (it.y.toDouble()/image.height).coerceIn(0.0,1.0)) })
      }
      promise.resolve(mapOf("width" to image.width,"height" to image.height,"engine" to "mlkit-korean-16.0.1","lines" to lines))
      client.close()
     }.addOnFailureListener { error ->
      promise.reject("OCR_FAILED", "Text recognition failed", error)
      client.close()
     }
    } catch (error: Exception) { promise.reject("OCR_FAILED", "Text recognition failed", error) }
   }
  }
 }
}
