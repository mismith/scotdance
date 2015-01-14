# Setup

1. Replace all instances of `XXXXXX` with relevant info in `/index.html` and `/assets/js/app.js`
2. Configure your local/dev proxy/domain in `/gulpfile.js`, if needed
3. Run `sudo npm update` after `cd`ing into the directory this file lives in
4. Run `gulp` to launch watchers, pre-compilers, live browser-syncing, etc.
  1. Run `gulp --open` to launch a live-updating browser window
  2. Run `sudo ulimit -n 8192` if you get a 'memory limit exceeded' error running the previous command
5. Update `/robots.txt` and `/sitemap.xml` accordingly



# Structure

`/templates/` is for general-purpose partials (i.e. angular directive templates, re-used UI elements, or repeated content sections)
`/views/` is for partials to be rendered as full view templates (e.g. public vs. authenticated, header1 vs. header2)
`/views/pages/` is for partials that will be included in other views (e.g. subviews)
`/assets/img/` is for all site-specific static images; any user-uploaded content should be kept elsewhere
`/assets/js/` should contain only dynamically generated code; any code you will edit directly should be in `/assets/js/src/`