import Foundation
import Capacitor

@objc(ScotDancePlugin)
public class ScotDancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScotDancePlugin"
    public let jsName = "ScotDance"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setAppearance", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPaper", returnType: CAPPluginReturnPromise),
    ]
    private let paperAbove = UIImageView()
    private let paperBelow = UIImageView()
    private var paperTile: CGFloat = 1
    private var pageHeight: NSKeyValueObservation?

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

    // The page's paper beyond its edges (lib/paperEdges paints it), shown
    // inside its scroll view: pulled past its top or its end, the page
    // bounces to reveal more paper rather than the web view's flat colour.
    // Above sits just over the top; below starts on the grain's last tile
    // edge before the page's end (the page covers the overlap), and follows
    // the end as the page grows or shrinks.
    @objc func setPaper(_ call: CAPPluginCall) {
        func image(_ key: String) -> UIImage? {
            guard let url = call.getString(key), let comma = url.firstIndex(of: ","),
                  let data = Data(base64Encoded: String(url[url.index(after: comma)...]))
            else { return nil }
            return UIImage(data: data, scale: UIScreen.main.scale)
        }
        guard let above = image("above"), let below = image("below") else { return call.reject("No paper") }
        let tile = CGFloat(call.getDouble("tile", 220))
        DispatchQueue.main.async {
            guard let scrollView = self.bridge?.webView?.scrollView else { return call.resolve() }
            self.paperAbove.image = above
            self.paperAbove.frame = CGRect(x: 0, y: -above.size.height, width: above.size.width, height: above.size.height)
            self.paperBelow.image = below
            self.paperTile = tile
            for view in [self.paperBelow, self.paperAbove] where view.superview == nil {
                scrollView.insertSubview(view, at: 0)
            }
            self.placePaperBelow(scrollView)
            if self.pageHeight == nil {
                self.pageHeight = scrollView.observe(\.contentSize) { [weak self] scrollView, _ in
                    DispatchQueue.main.async { self?.placePaperBelow(scrollView) }
                }
            }
            call.resolve()
        }
    }

    private func placePaperBelow(_ scrollView: UIScrollView) {
        guard let size = paperBelow.image?.size else { return }
        let top = (scrollView.contentSize.height / paperTile).rounded(.down) * paperTile
        paperBelow.frame = CGRect(x: 0, y: top, width: size.width, height: size.height)
    }
}
