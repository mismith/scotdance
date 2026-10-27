import Foundation
import Capacitor

@objc(ScotDancePlugin)
public class ScotDancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScotDancePlugin"
    public let jsName = "ScotDance"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setAppearance", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        if let webView = bridge?.webView as? WKWebView {
            webView.allowsBackForwardNavigationGestures = true

            if ProcessInfo.processInfo.arguments.contains("Screenshots") {
                // clear localStorage to ensure theme matches device appearance
                webView.evaluateJavaScript("window.localStorage.clear()")
            }
        }
    }

    // The app's own light/dark setting (Settings) can differ from the
    // phone's, so the page tells iOS which it is: the backdrop behind the
    // page when it's pulled down, and system UI (keyboard, menus), follow it.
    // "auto" hands it back to the phone (and the page's own
    // prefers-color-scheme with it, which an override would freeze).
    @objc func setAppearance(_ call: CAPPluginCall) {
        let style: UIUserInterfaceStyle
        switch call.getString("theme") {
        case "light": style = .light
        case "dark": style = .dark
        default: style = .unspecified
        }
        DispatchQueue.main.async {
            self.bridge?.viewController?.view.window?.overrideUserInterfaceStyle = style
            call.resolve()
        }
    }
}
