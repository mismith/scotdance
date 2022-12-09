# Release Notes

## 3.4.0 - Dec 8, 2022
- you can now track dancers across competitions using the "Search Dancers" page!
- add pagination to Competitions page (to reduce the amount of scrolling needed)
- some big admin table improvements and fixes:
  - copy/pasting (e.g. from Google Sheets) into a fresh table is fixed
  - exported tables now include all data, not just visible data
  - invalid dropdown cells are now clearly marked as such

## 3.3.1 - Nov 27, 2022
- add "Favourite All" button to suggested favourite dancers section
- various competition admin panel improvements, bug fixes, and help tips added
- misc little touch ups, renames, clean ups, etc

## 3.3.0 - Apr 3, 2022
- allow filtering competitions by location on Browse page
- minor improvements like: make it easier to tell which competition are currently ongoing
- various bug fixes like: allow awarding Championship Points to dancers who were not in callbacks; better dancer search matching

## 3.2.1 - Mar 20, 2022
- add support for Championship Points in results tab
- various minor improvements like: help tips, in progress / dancer missing styles, draw dialog tweaks
- various admin panel bug fixes: draw table saving, empty platforms crashing app, import wizard columns missing, etc.

## 3.2.0 - Feb 21, 2022
- major upgrades to the admin panel:
  - table view overhaul: fix column sorting, add undo/redo, polish UI
  - improve usability by adding more guidance for new admin users
  - rework UI to allow searching/filtering within tables, along with a streamlined toolbar

## 3.1.1 - Jan 17, 2022
- fixes a major bug that caused the app to show a loading spinner indefinitely

## 3.1.0 - Jan 16, 2022
- fixes an error message being shown (erroneously) on all new user registrations
- this is a MAJOR behind-the-scenes release - it updates and improves many of the app's core building blocks
- the outcome is a notably more stable app; this includes a number of minor bug fixes discovered through the addition of automated code testing software

## 3.0.1 - Nov 13, 2021
- fix section expander bug where toggling wouldn't always behave or persist as expected
- add number of dancers to schedule dance groups
- various minor improvements like: dividing dot formatting; favourite dancer suggestions transitions

## 3.0.0 - Nov 1, 2021
- the app can now auto-suggest favourite dancers to you based on your previous selections
- major framework upgrades to streamline things behind-the-scenes
- various minor bug fixes and improvements

## 2.0.1 - Feb 8, 2021
- allow admins to hide Schedule and Results tabs
- minor bug fixes

## 2.0.0 - Oct 5, 2020
- rework entire app layout to make navigating between competitions easier
- allow changing your email address
- loads of minor improvements, bug fixes, and performance enhancements under-the-hood

## 1.8.3 - Mar 1, 2020
- admin panel updates including file uploading for images and links
- add list of "All Dancers" to each results page
- loads of minor bug fixes, styling and layout enhancements, and feature improvements

## 1.8.2 - Jan 20, 2020
- add scrolling markers to competitons lists to make it easier to find "Now"
- various minor UI fixes and improvements like: schedule platforms, admin presets, judge listings
- reworked "Change Password" button to be more user-friendly (thanks to user feedback)

## 1.8.1 - Jan 13, 2020
- fix some minor bugs introduced in the previous release

## 1.8.0 - Jan 12, 2020
- add dark mode/theme (toggleable via Menu > App Settings), and upgrade entire UI framework
- add various features and refinements to admin panel now that more competition submissions are coming in
- fix and improve various bugs, styles, and layout issues like overflowing content being cut off on some devices

## 1.7.1 - Apr 14, 2019
- results screen now auto-scrolls to live results as they appear
- competitions listing now shows as a timeline instead of a boring list
- competitions now show judge/piper/volunteer/sponsor info before competition day
- minor UI improvements: list item animations, non-stretching images, nav-drawer close button

## 1.7.0 - Mar 29, 2019
- improve competition info page, thereby allowing custom link buttons
- fix fonts and certain icon glyphs displaying improperly and/or loading slowly
- fix bug where blank/empty sections could appeared
- add website links for sponsors

## 1.6.2 - Jan 22, 2019
- fix missing icon and splashscreen on some devices
- fix various admin panel bugs

## 1.6.1 - Jan 15, 2019
- add images to competition pages/listings
- add ability to link to a registration form, making signing up easier
- re-implement entire user interface using a new framework, avoiding many bugs and boosting performance
- you can now submit competitions to be listed in the app! (BETA)

## 1.5.0 - Nov 4, 2018
- see more at once with dual pane support when using your tablet in landscape mode
- tons of minor tweaks, bug fixes, and performance enhancements

## 1.4.4 - Jul 3, 2018
- fix bug where searching (e.g. typing very quickly) could crash the app
- fix/flip non-championship dancer order
- add judge and piper bios dialog; simply tap their name/avatar to read more!

## 1.4.3 - Jul 1, 2018
- fix bug where favouriting a dancer opened their dancer page (instead of just staying on the current screen)

## 1.4.2 - Jun 30, 2018
- fix admin permissions bug

## 1.4.1 - Jun 29, 2018
- make it more obvious that you can see draws/dancer order by tapping groups within platform listings on the schedule page
- fix bug where favouriting a dancer from the draw/order dialog, when logged out, didn't open the favouriting info dialog properly

## 1.4.0 - Jun 28, 2018
- add championship draws / dancer order list; to view, simply tap a dance group on the schedule page
- allow showing competition listings before their data is made public, so now you can see upcoming competition info before the day of
- add trophy details dialog—and re-design dancer detail page header—so you can read long names
- tons of minor visual tweaks, interface improvements, bug fixes, and performance enhancements

## 1.3.2 - Jun 26, 2018
- fix bug where registering after favouriting a dancer would ask you to authenticate again
- fix dancer searching being too broad/loose (so you can now dependably search for a dancer's number again)
- redesign results page
- tapping the top header title now links you to the competitions list page
- add FAQs section, including explanation of why favourite dancers don't carry over between competitions

## 1.2.3 - Jun 22, 2018
- pages now remember scroll position and subpage location—in other words, no more re-scrolling down every time you change pages!
- fix bug where searching for two words (e.g. using a space) returns no results
- fix bug where loading spinner shows on profile page all the time
- various performances enhancements and tweaks

## 1.2.1 - Jun 14, 2018
- layout, compatibility, and stability improvements/fixes for iOS 10.2 / iPhone 5 devices
- adds an "About" link to the help dropdown

## 1.2.0 - Jun 7, 2018
- major start up time speed boost
- app now resumes where you left off when you re-open it
- switching between tabs in a competition will now remember where you left off too
- trophy names and sponsors added to overall results
- added app version to bottom of home page to aid in support via live chat
- lots of bug fixes, performance improvements, and visual tweaks to improve UX throughout

## 1.1.2 - Jun 1, 2018
- major performance enhancements: tab changes are virtually instant now
- fixes bug where bottom bar tabs active state could become out of sync
- fixes bug where tapping the status bar to scroll to top could be janky if scrolling was still in progress
- instantly restore expanded group states, so the app feels snappier

## 1.1.1 - May 31, 2018
- can now handle ties in results
- can now handle unknown/missing dancers in results (e.g. if the wrong number is announced)
- swipe right from left-edge of screen to go back
- swipe left to close men drawer
- scroll to top on status bar tap
- tons of bug fixes and UI improvements

## 1.1.0 - May 27, 2018