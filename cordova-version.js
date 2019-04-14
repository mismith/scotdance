#!/usr/bin/env node

const fs = require('fs');

function setVersion(v = undefined, {
  configFile = './config.xml',
  pkgFile = './package.json',
  pkgLockFile = './package-lock.json',
} = {}) {
  const config = fs.readFileSync(configFile, 'utf8');
  const pkg = fs.readFileSync(pkgFile, 'utf8');
  const pkgLock = fs.readFileSync(pkgLockFile, 'utf8');

  // auto-increment patch if no version explicitly specified
  const { version } = JSON.parse(pkg);
  const incrementPatch = (_, m, n, p) => `${m}.${n}.${Number.parseInt(p, 10) + 1}`;
  const V = v || version.replace(/^(\d+)\.(\d+)\.(\d+)$/, incrementPatch);

  // do some very naive/brittle find-and-replaces
  fs.writeFileSync(configFile, config.replace(/version="[^"]+"/, `version="${V}"`));
  fs.writeFileSync(pkgFile, pkg.replace(/"version": "[^"]+"/, `"version": "${V}"`));
  fs.writeFileSync(pkgLockFile, pkg.replace(/"version": "[^"]+"/, `"version": "${V}"`));

  console.log(`${version} -> ${V}`);
}

if (require.main === module) {
  setVersion(process.argv[2]);
} else {
  module.exports = setVersion;
}
