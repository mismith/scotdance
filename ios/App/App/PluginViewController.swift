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
    }
}
