import UIKit

// Apps built with the iOS 27 SDK must use the scene life cycle. The window
// and its PluginViewController still come from Main.storyboard (set as the
// scene's storyboard in Info.plist).
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?
}
