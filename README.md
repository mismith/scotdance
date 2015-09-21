# Setup

1. Ensure everything is up to date by running `sudo npm update` after `cd`ing into the directory this file lives in
2. Configure your `/gulpfile.config.js`, if needed
3. Run `gulp` to launch watchers, pre-compilers, live browser-syncing, etc.
  1. Run `sudo ulimit -n 8192` if you get a 'memory limit exceeded' error running the previous command
  2. Run `gulp -s` or `gulp --silent` to prevent launching a new live-updating browser window
  3. Run `gulp -g` or `gulp --ghost` to sync all browser page changes, scrolling, and clicks
  4. Run `gulp rev` to auto-append file hashes to any `href` or `src` attributes in your html ending in `?rev=`



# Config

* Make sure the `<base href>` tag in `/index.html` is set to the proper path
* For local assets, enable cache-busting by appending `?rev=1` to the URL in `src` and `href` attributes
* Create an app icon in PNG format at `/assets/img/touchicon.png`
* If you are using custom glyphs or don't need FontAwesome's ones, disable them by:
	* Removing the `<link>` in `/index.html`
* If you don't need any of Google's webfonts, shorten loading times by:
	* Removing the `<link>` in `/index.html`
* If you are not going to be using smooth scrolling, disable it by:
	* Removing the `<script>` in `/index.html`
	* Removing the `bigScroll` module from your `/assets/scripts/app.js` dependencies
	* Removing the file at `/assets/scripts/modules/bigScroll.js`
* If you are not going to be using Firebase as your backend, disable it by:
	* Removing the 3 `<script>`s in `/index.html`
	* Removing the `firebaseHelper` module from your `/assets/scripts/app.js` dependencies
* If you are not going to be using Contentful as your backend (with Markdown support via Marked plugin), disable it by:
	* Removing the 3 `<script>`s in `/index.html` (one for `contentful` and two for `marked`)
	* Removing the `contentful` and `hc.marked` modules from your `/assets/scripts/app.js` dependencies
* Replace all instances of `XXXXXX` with relevant info in `/index.html` and `/assets/scripts/app.js`; consider:
	* `<meta>` tags
	* Open Graph & social media info
	* Google Analytics
* Update `/robots.txt` and `/sitemap.xml` accordingly



# Structure

* `/views/` is for partials to be rendered as full view templates (e.g. public vs. authenticated, header1 vs. header2)
* `/views/page/` is for partials that will be included in other views (e.g. subviews)
* `/views/template/` is for general-purpose partials (i.e. angular directive templates, re-used UI elements, or repeated content sections)
* `/assets/img/` is for all site-specific static images; any user-uploaded content should be kept elsewhere
* `/assets/scripts/` should contain your source code, whereas `/assets/js/` should contain only dynamically generated javascript
* `/assets/styles/`, likewise, should contain your source code, whereas `/assets/css/` should contain only dynamically generated css
