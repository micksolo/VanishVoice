package expo.modules.screenshotprevent

import android.app.Activity
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class ScreenshotPreventModule : Module() {
  override fun definition() = ModuleDefinition {
    name("ScreenshotPrevent")

    asyncFunction("enableSecure") { promise: Promise ->
      try {
        val activity = appContext.activityProvider?.currentActivity
        
        if (activity == null) {
          promise.reject("NO_ACTIVITY", "No activity available", null)
          return@asyncFunction
        }
        
        activity.runOnUiThread {
          try {
            activity.window.setFlags(
              WindowManager.LayoutParams.FLAG_SECURE,
              WindowManager.LayoutParams.FLAG_SECURE
            )
            promise.resolve(true)
          } catch (e: Exception) {
            promise.reject("ENABLE_ERROR", "Failed to enable secure mode", e)
          }
        }
      } catch (e: Exception) {
        promise.reject("ENABLE_ERROR", "Failed to enable secure mode", e)
      }
    }

    asyncFunction("disableSecure") { promise: Promise ->
      try {
        val activity = appContext.activityProvider?.currentActivity
        
        if (activity == null) {
          promise.reject("NO_ACTIVITY", "No activity available", null)
          return@asyncFunction
        }
        
        activity.runOnUiThread {
          try {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            promise.resolve(true)
          } catch (e: Exception) {
            promise.reject("DISABLE_ERROR", "Failed to disable secure mode", e)
          }
        }
      } catch (e: Exception) {
        promise.reject("DISABLE_ERROR", "Failed to disable secure mode", e)
      }
    }

    asyncFunction("isSecureEnabled") { promise: Promise ->
      try {
        val activity = appContext.activityProvider?.currentActivity
        
        if (activity == null) {
          promise.resolve(false)
          return@asyncFunction
        }
        
        activity.runOnUiThread {
          try {
            val flags = activity.window.attributes.flags
            val isSecure = (flags and WindowManager.LayoutParams.FLAG_SECURE) != 0
            promise.resolve(isSecure)
          } catch (e: Exception) {
            promise.resolve(false)
          }
        }
      } catch (e: Exception) {
        promise.resolve(false)
      }
    }

    asyncFunction("setSecureMode") { enabled: Boolean, promise: Promise ->
      try {
        val activity = appContext.activityProvider?.currentActivity
        
        if (activity == null) {
          promise.reject("NO_ACTIVITY", "No activity available", null)
          return@asyncFunction
        }
        
        activity.runOnUiThread {
          try {
            if (enabled) {
              activity.window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
              )
            } else {
              activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
            promise.resolve(true)
          } catch (e: Exception) {
            val errorCode = if (enabled) "ENABLE_ERROR" else "DISABLE_ERROR"
            val errorMessage = if (enabled) "Failed to enable secure mode" else "Failed to disable secure mode"
            promise.reject(errorCode, errorMessage, e)
          }
        }
      } catch (e: Exception) {
        val errorCode = if (enabled) "ENABLE_ERROR" else "DISABLE_ERROR"
        val errorMessage = if (enabled) "Failed to enable secure mode" else "Failed to disable secure mode"
        promise.reject(errorCode, errorMessage, e)
      }
    }

    constants {
      mapOf(
        "isAndroid" to true,
        "supportsFlagSecure" to true
      )
    }
  }
}