import ExpoModulesCore
import UIKit

public class ScreenshotPreventModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScreenshotPrevent")

    AsyncFunction("enableSecure") { (promise: Promise) in
      // iOS doesn't support FLAG_SECURE equivalent
      // Return false to indicate this feature is not available
      promise.resolve(false)
    }

    AsyncFunction("disableSecure") { (promise: Promise) in
      // iOS doesn't support FLAG_SECURE equivalent
      promise.resolve(false)
    }

    AsyncFunction("isSecureEnabled") { (promise: Promise) in
      // Always return false on iOS
      promise.resolve(false)
    }

    AsyncFunction("setSecureMode") { (enabled: Bool, promise: Promise) in
      // iOS doesn't support FLAG_SECURE equivalent
      promise.resolve(false)
    }

    Constants([
      "isAndroid": false,
      "isIOS": true,
      "supportsFlagSecure": false
    ])
  }
}