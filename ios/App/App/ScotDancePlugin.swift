import Foundation
import Capacitor

@objc(ScotDancePlugin)
public class ScotDancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScotDancePlugin"
    public let jsName = "ScotDance"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setAppearance", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPaperAbove", returnType: CAPPluginReturnPromise),
    ]
    private var paperAbove: UIImageView?

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

    // A screen of the page's paper (lib/paperAbove paints it), shown just
    // above the page inside its scroll view: pulled down past the top, the
    // page bounces to reveal more paper rather than the web view's flat colour.
    @objc func setPaperAbove(_ call: CAPPluginCall) {
        guard let url = call.getString("image"),
              let comma = url.firstIndex(of: ","),
              let data = Data(base64Encoded: String(url[url.index(after: comma)...])),
              let image = UIImage(data: data, scale: UIScreen.main.scale)
        else { return call.reject("No image") }
        DispatchQueue.main.async {
            guard let scrollView = self.bridge?.webView?.scrollView else { return call.resolve() }
            let view = self.paperAbove ?? UIImageView()
            view.image = image
            view.frame = CGRect(x: 0, y: -image.size.height, width: image.size.width, height: image.size.height)
            if view.superview == nil { scrollView.insertSubview(view, at: 0) }
            self.paperAbove = view
            call.resolve()
        }
    }
}
