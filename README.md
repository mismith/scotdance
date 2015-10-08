# Setup

1. Ensure everything is up to date by running `sudo npm update` after `cd`ing into the directory this file lives in
2. Configure your `/gulpfile.config.js`, if needed
3. Run `gulp` to launch watchers, pre-compilers, live browser-syncing, etc.
  1. Run `sudo ulimit -n 8192` if you get a 'memory limit exceeded' error running the previous command
  2. Run `gulp -s` or `gulp --silent` to prevent launching a new live-updating browser window
  3. Run `gulp -g` or `gulp --ghost` to sync all browser page changes, scrolling, and clicks
  4. Run `gulp rev` to auto-append file hashes to any `href` or `src` attributes in your html ending in `?rev=`



# Structure

* `/html/views/` is for partials to be rendered as full view templates (e.g. public vs. authenticated, header1 vs. header2)
* `/html/views/page/` is for partials that will be included in other views (e.g. subviews)
* `/html/views/template/` is for general-purpose partials (i.e. angular directive templates, re-used UI elements, or repeated content sections)
* `/html/assets/img/` is for all site-specific static images; any user-uploaded content should be kept elsewhere
* `/html/assets/scripts/` should contain your source code, whereas `/html/assets/js/` should contain only dynamically generated javascript
* `/html/assets/styles/`, likewise, should contain your source code, whereas `/html/assets/css/` should contain only dynamically generated css
