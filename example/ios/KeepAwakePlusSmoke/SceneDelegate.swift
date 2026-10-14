import UIKit
import React_RCTAppDelegate

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard session.role == .windowApplication,
          let windowScene = scene as? UIWindowScene else { return }

    // A repeated connection must not mount a second React surface.
    if let window {
      precondition(window.windowScene === windowScene)
      return
    }

    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      preconditionFailure("React Native must be initialized before connecting the scene")
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    factory.startReactNative(
      withModuleName: "KeepAwakePlusSmoke",
      in: window,
      launchOptions: appDelegate.reactNativeLaunchOptions
    )
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    guard let window, window.windowScene === scene else { return }

    window.isHidden = true
    window.rootViewController = nil
    window.windowScene = nil
    self.window = nil
  }
}
