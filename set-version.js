#!/usr/bin/env node

import fs from 'fs';

const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

function setVersion(v = undefined, {
  pkgFile = './package.json',
  pkgLockFile = './package-lock.json',
  iosFile = './ios/App/App.xcodeproj/project.pbxproj',
  androidFile = './android/app/build.gradle',
} = {}) {
  const pkg = fs.readFileSync(pkgFile, 'utf8');
  const pkgLock = fs.readFileSync(pkgLockFile, 'utf8');
  const ios = fs.readFileSync(iosFile, 'utf8');
  const android = fs.readFileSync(androidFile, 'utf8');

  // auto-increment patch if no version explicitly specified
  const { version } = JSON.parse(pkg);
  const incrementPatch = (_, m, n, p) => `${m}.${n}.${Number.parseInt(p, 10) + 1}`;
  const V = v || version.replace(VERSION_REGEX, incrementPatch);
  const code = V.split('.').map((n, i) => (i ? n.padStart(3, '0') : n)).join('');

  // do some very naive/brittle find-and-replaces
  const replacement = `$1"${V}"`;
  fs.writeFileSync(pkgFile, pkg.replace(/("version": )"[^"]+"/, replacement));
  fs.writeFileSync(pkgLockFile, pkgLock.replace(/("version": )"[^"]+"/, replacement));
  fs.writeFileSync(androidFile, android
    .replace(/(versionName )"[^"]+"/, replacement)
    .replace(/(versionCode )\d+/, `$1${code}`));
  fs.writeFileSync(iosFile, ios.replace(/(MARKETING_VERSION = )[^;]+;/g, `$1${V};`));

  console.info(`${version} -> ${V}`); // eslint-disable-line no-console
}

setVersion(process.argv.find((a) => VERSION_REGEX.test(a)));
