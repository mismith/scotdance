# Setup

2. Configure your local/dev proxy/domain in `/gulpfile.js`, if needed
3. Run `sudo npm update` after `cd`ing into the directory this file lives in
4. Run `gulp` to launch watchers, pre-compilers, live browser-syncing, etc.
  1. Run `gulp --open` to launch a live-updating browser window
  2. Run `sudo ulimit -n 8192` if you get a 'memory limit exceeded' error running the previous command



# Config

* If you are making a site with a pre-existing design, disable Twitter Bootstrap and FontAwesome by:
	* Removing the 2 `<link>`s in `/index.html`
	* Removing the 1 `<script>` in `/index.html`
	* Removing the `ui.bootstrap` module from your `/assets/js/app.js` dependencies
* If you are not going to be using Firebase as your backend, disabled it by:
	* Removing the 3 `<script>`s in `/index.html`
	* Removing the `firebaseHelper` module from your `/assets/js/app.js` dependencies
* Replace all instances of `XXXXXX` with relevant info in `/index.html` and `/assets/js/app.js`; consider:
	* <meta> tags and OpenGraph info
	* Google Analytics
* Update `/robots.txt` and `/sitemap.xml` accordingly
* Create an app icon in PNG format at `/assets/img/touchicon.png`



# Structure

* `/views/` is for partials to be rendered as full view templates (e.g. public vs. authenticated, header1 vs. header2)
* `/views/page/` is for partials that will be included in other views (e.g. subviews)
* `/views/template/` is for general-purpose partials (i.e. angular directive templates, re-used UI elements, or repeated content sections)
* `/assets/img/` is for all site-specific static images; any user-uploaded content should be kept elsewhere
* `/assets/scripts/` should contain your source code, whereas `/assets/js/` should contain only dynamically generated javascript
* `/assets/styles/`, likewise, should contain your source code, whereas `/assets/css/` should contain only dynamically generated css
