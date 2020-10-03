import Foundation
import Capacitor

// Setup from: https://www.joshmorony.com/creating-a-local-capacitor-plugin-to-access-native-functionality-ios-swift/

@objc(ScotDance)
public class ScotDance: CAPPlugin {
    @objc func setup(_ call: CAPPluginCall) {
        DispatchQueue.main.async(execute: {
            let webView = self.bridge.getWebView()

            if ProcessInfo.processInfo.arguments.contains("Screenshots") {
                // clear localStorage to ensure theme matches device appearance
                webView?.evaluateJavaScript("window.localStorage.clear()")
            }
            
            call.resolve()
        })
    }
}
