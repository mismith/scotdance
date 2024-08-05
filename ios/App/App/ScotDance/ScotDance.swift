import Foundation
import Capacitor

@objc(ScotDancePlugin)
public class ScotDancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScotDancePlugin"
    public let jsName = "ScotDance"
    public let pluginMethods: [CAPPluginMethod] = []

    override public func load() {
        if let webView = bridge?.webView as? WKWebView {
            webView.allowsBackForwardNavigationGestures = true

            if ProcessInfo.processInfo.arguments.contains("Screenshots") {
                // clear localStorage to ensure theme matches device appearance
                webView.evaluateJavaScript("window.localStorage.clear()")
            }
        }
    }
}
