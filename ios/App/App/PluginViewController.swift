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
    }
}
