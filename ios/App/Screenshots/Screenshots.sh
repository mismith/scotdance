#!/bin/bash

# Adapted from: http://blog.winsmith.de/english/ios/2020/04/14/xcuitest-screenshots.html

# The Xcode project to create screenshots for
workspaceName="./ios/App/App.xcworkspace"

# The scheme to run tests for
schemeName="App"


# All the simulators we want to screenshot
# Copy/Paste new names from Xcode's
# "Devices and Simulators" window
# or from `xcrun simctl list`.
simulators=(
    "iPhone 11"
    "iPad Pro (12.9-inch) (4th generation)"
)

# All the languages we want to screenshot (ISO 3166-1 codes)
languages=(
    "en"
)

# All the appearances we want to screenshot
# (options are "light" and "dark")
appearances=(
    "light"
    "dark"
)

# Save final screenshots into this folder (it will be created)
targetFolder="./resources/screenshots"

derivedDataFolder="./resources/DerivedData"


## No need to edit anything beyond this point
for simulator in "${simulators[@]}"
do
    for language in "${languages[@]}"
    do
        for appearance in "${appearances[@]}"
        do
            rm -rf "$derivedDataFolder"
            echo "📲  Building and Running for $simulator in $language"

            # Boot up the new simulator and set it to the correct appearance
            xcrun simctl bootstatus "$simulator" -b
            xcrun simctl ui "$simulator" appearance $appearance

            # Build and Test
            xcodebuild -testLanguage $language -scheme $schemeName -workspace $workspaceName -derivedDataPath $derivedDataFolder -destination "platform=iOS Simulator,name=$simulator" build test
            echo "🖼  Collecting Results..."
            mkdir -p "$targetFolder/$simulator/$language/$appearance"
            find "$derivedDataFolder/Logs/Test" -maxdepth 1 -type d -exec xcparse screenshots {} "$targetFolder/$simulator/$language/$appearance" \;
            for f in "$targetFolder/$simulator/$language/$appearance/"*.png; do mv "$f" "${f/_*./.}"; done
        done
    done
done

rm -rf "$derivedDataFolder"
echo "✅  All Done"
