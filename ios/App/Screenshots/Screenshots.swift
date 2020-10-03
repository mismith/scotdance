//
//  Screenshots.swift
//  Screenshots
//
//  Created by Murray Smith on 2020-10-01.
//

import XCTest

class Screenshots: XCTestCase {
    
    static var app: XCUIApplication!

    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.
        Screenshots.app = XCUIApplication()
        Screenshots.app.launchArguments.append("Screenshots")

        // In UI tests it is usually best to stop immediately when a failure occurs.
        continueAfterFailure = false

        // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }
    func testTakeScreenshots() throws {
        // UI tests must launch the application that they test.
        Screenshots.app.launch()
        
        // Use recording to get started writing UI tests.
        // Use XCTAssert and related functions to verify your tests produce the correct results.
        
        let webViewsQuery = Screenshots.app.webViews
        webViewsQuery/*@START_MENU_TOKEN@*/.staticTexts["home"]/*[[".otherElements.matching(identifier: \"ScotDance.app\")",".otherElements[\"banner\"]",".links[\"home\"]",".staticTexts[\"ScotDance.app\"]",".staticTexts[\"home\"]"],[[[-1,4],[-1,2,3],[-1,1,2],[-1,0,1]],[[-1,4],[-1,2,3],[-1,1,2]],[[-1,4],[-1,3],[-1,2,3]],[[-1,4],[-1,3]]],[0]]@END_MENU_TOKEN@*/.tap()
        takeScreenshot("1")
        let menuButton = webViewsQuery/*@START_MENU_TOKEN@*/.buttons["menu"]/*[[".otherElements[\"Browse Competitions • ScotDance.app\"]",".otherElements.matching(identifier: \"banner\").buttons[\"menu\"]",".buttons[\"menu\"]"],[[[-1,2],[-1,1],[-1,0,1]],[[-1,2],[-1,1]]],[0]]@END_MENU_TOKEN@*/
        let submenuButton = webViewsQuery/*@START_MENU_TOKEN@*/.buttons["submenu"]/*[[".otherElements.matching(identifier: \"ScotDance.app\")",".otherElements[\"banner\"].buttons[\"submenu\"]",".buttons[\"submenu\"]"],[[[-1,2],[-1,1],[-1,0,1]],[[-1,2],[-1,1]]],[0]]@END_MENU_TOKEN@*/
        submenuButton.tap()
        takeScreenshot("2")
        submenuButton.tap()
        menuButton.tap()
        takeScreenshot("3")
        webViewsQuery/*@START_MENU_TOKEN@*/.staticTexts["competitions"]/*[[".otherElements.matching(identifier: \"ScotDance.app\")",".otherElements[\"navigation\"]",".links.matching(identifier: \"competitions\").staticTexts[\"competitions\"]",".staticTexts[\"competitions\"]"],[[[-1,3],[-1,2],[-1,1,2],[-1,0,1]],[[-1,3],[-1,2],[-1,1,2]],[[-1,3],[-1,2]]],[0]]@END_MENU_TOKEN@*/.tap()
        takeScreenshot("4")
        menuButton.tap()
        webViewsQuery/*@START_MENU_TOKEN@*/.staticTexts["competitions.submit"]/*[[".otherElements[\"Browse Competitions • ScotDance.app\"]",".otherElements[\"navigation\"]",".links.matching(identifier: \"competitions.submit\").staticTexts[\"competitions.submit\"]",".staticTexts[\"competitions.submit\"]"],[[[-1,3],[-1,2],[-1,1,2],[-1,0,1]],[[-1,3],[-1,2],[-1,1,2]],[[-1,3],[-1,2]]],[0]]@END_MENU_TOKEN@*/.tap()
        takeScreenshot("5")
    }
    
    // Adapted from: https://github.com/fastlane/fastlane/blob/master/snapshot/lib/assets/SnapshotHelper.swift
    func waitForLoadingIndicatorToDisappear(within timeout: TimeInterval) {
        let networkLoadingIndicator = Screenshots.app.otherElements.deviceStatusBars.networkLoadingIndicators.element
        let networkLoadingIndicatorDisappeared = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: networkLoadingIndicator)
        _ = XCTWaiter.wait(for: [networkLoadingIndicatorDisappeared], timeout: timeout)
    }
    
    func takeScreenshot(_ name: String, timeWaitingForIdle timeout: TimeInterval = 60) {
        if timeout > 0 {
            waitForLoadingIndicatorToDisappear(within: timeout)
        }

    
        // wait 'for animations to complete'
        sleep(1)
        
        // Take the screenshot
        let fullScreenshot = XCUIScreen.main.screenshot()

        // Create a new attachment to save our screenshot
        // and give it a name consisting of the "named"
        // parameter and the device name, so we can find
        // it later.
        let screenshotAttachment = XCTAttachment(
            uniformTypeIdentifier: "public.png",
            name: "Screenshot-\(UIDevice.current.name)-\(name).png",
            payload: fullScreenshot.pngRepresentation,
            userInfo: nil)

        // Usually Xcode will delete attachments after
        // the test has run; we don't want that!
        screenshotAttachment.lifetime = .keepAlways

        // Add the attachment to the test log,
        // so we can retrieve it later
        add(screenshotAttachment)
    }
}


// Adapted from: https://github.com/fastlane/fastlane/blob/master/snapshot/lib/assets/SnapshotHelper.swift
private extension XCUIElementAttributes {
    var isNetworkLoadingIndicator: Bool {
        if hasAllowListedIdentifier { return false }

        let hasOldLoadingIndicatorSize = frame.size == CGSize(width: 10, height: 20)
        let hasNewLoadingIndicatorSize = frame.size.width.isBetween(46, and: 47) && frame.size.height.isBetween(2, and: 3)

        return hasOldLoadingIndicatorSize || hasNewLoadingIndicatorSize
    }

    var hasAllowListedIdentifier: Bool {
        let allowListedIdentifiers = ["GeofenceLocationTrackingOn", "StandardLocationTrackingOn"]

        return allowListedIdentifiers.contains(identifier)
    }

    func isStatusBar(_ deviceWidth: CGFloat) -> Bool {
        if elementType == .statusBar { return true }
        guard frame.origin == .zero else { return false }

        let oldStatusBarSize = CGSize(width: deviceWidth, height: 20)
        let newStatusBarSize = CGSize(width: deviceWidth, height: 44)

        return [oldStatusBarSize, newStatusBarSize].contains(frame.size)
    }
}

private extension XCUIElementQuery {
    var networkLoadingIndicators: XCUIElementQuery {
        let isNetworkLoadingIndicator = NSPredicate { (evaluatedObject, _) in
            guard let element = evaluatedObject as? XCUIElementAttributes else { return false }

            return element.isNetworkLoadingIndicator
        }

        return self.containing(isNetworkLoadingIndicator)
    }

    var deviceStatusBars: XCUIElementQuery {
        guard let app = Screenshots.app else {
            fatalError("XCUIApplication is not set. Please call setupSnapshot(app) before snapshot().")
        }

        let deviceWidth = app.windows.firstMatch.frame.width

        let isStatusBar = NSPredicate { (evaluatedObject, _) in
            guard let element = evaluatedObject as? XCUIElementAttributes else { return false }

            return element.isStatusBar(deviceWidth)
        }

        return self.containing(isStatusBar)
    }
}

private extension CGFloat {
    func isBetween(_ numberA: CGFloat, and numberB: CGFloat) -> Bool {
        return numberA...numberB ~= self
    }
}
