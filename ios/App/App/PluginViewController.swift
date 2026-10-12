//
//  PluginViewController.swift
//  App
//
//  Created by Murray Rowan on 2024-08-05.
//

import UIKit
import Capacitor

class PluginViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ScotDancePlugin())
        // Capacitor turns the web view's rubber banding off; scrolling should
        // feel like every other iOS app, short pages included.
        webView?.scrollView.bounces = true
        webView?.scrollView.alwaysBounceVertical = true
        // Until the page paints, the app's own background shows, light or
        // dark, not the web view's white. Capacitor does this for the first
        // load only; a reload (iOS restarts the page after a while in the
        // background) would flash white. Set before the first load, so
        // Capacitor keeps it.
        let background = UIColor(named: "SplashBackground") ?? .systemBackground
        webView?.isOpaque = false
        webView?.backgroundColor = background
        webView?.scrollView.backgroundColor = background
    }
}
