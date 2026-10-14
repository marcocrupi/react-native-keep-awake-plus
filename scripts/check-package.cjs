const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = require('../package.json');

// Include every public entry, its supporting modules, and both native architectures.
// npm pack succeeds even when a file in package.json's files list is missing.
const requiredFiles = [
  'package.json',
  'index.js',
  'index.native.js',
  'index.d.ts',
  'Class.js',
  'Class.d.ts',
  'Class.js.d.ts',
  'KeepAwakeOwners.js',
  'NativeKCKeepAwakeModule.js',
  'NativeKCKeepAwake.ts',
  'react-native-keep-awake.podspec',
  'ios/ReactNativeKCKeepAwake.h',
  'ios/ReactNativeKCKeepAwake.mm',
  'android/build.gradle',
  'android/gradle.properties',
  'android/src/main/AndroidManifest.xml',
  'android/src/main/java/com/sayem/keepawake/KCKeepAwakeCoordinator.java',
  'android/src/main/java/com/sayem/keepawake/KCKeepAwakeImpl.java',
  'android/src/main/java/com/sayem/keepawake/KCKeepAwakePackage.java',
  'android/src/newarch/com/sayem/keepawake/KCKeepAwake.java',
  'android/src/oldarch/com/sayem/keepawake/KCKeepAwake.java',
  'README.md',
  'CHANGELOG.md',
  'LICENCE',
];

assert.ok(process.env.npm_execpath, 'Run this check with npm run check:package');
const output = execFileSync(
  process.execPath,
  [process.env.npm_execpath, 'pack', '--dry-run', '--json'],
  {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']},
);
const packages = JSON.parse(output);
assert.ok(Array.isArray(packages), 'Expected an npm package array');
assert.equal(packages.length, 1, 'Expected exactly one npm package');
const packed = packages[0];
assert.ok(
  packed !== null && typeof packed === 'object' && !Array.isArray(packed),
  'Expected an npm package object',
);
assert.equal(typeof packed.name, 'string', 'Expected a package name string');
assert.equal(typeof packed.version, 'string', 'Expected a package version string');
assert.equal(packed.name, manifest.name);
assert.equal(packed.version, manifest.version);
assert.ok(Array.isArray(packed.files), 'Expected an npm files array');
const files = new Map();
for (const file of packed.files) {
  assert.ok(
    file !== null && typeof file === 'object' && !Array.isArray(file),
    'Expected an npm file object',
  );
  assert.ok(
    typeof file.path === 'string' && file.path.length > 0,
    'Expected a non-empty npm file path string',
  );
  // npm supports empty optional files; required files must be positive below.
  assert.ok(
    typeof file.size === 'number' &&
      Number.isFinite(file.size) &&
      Number.isInteger(file.size) &&
      file.size >= 0,
    `Invalid npm file size: ${file.path}`,
  );
  assert.ok(!files.has(file.path), `Duplicate npm file path: ${file.path}`);
  files.set(file.path, file);
}

for (const filename of requiredFiles) {
  assert.ok(files.has(filename), `Missing npm package file: ${filename}`);
  assert.ok(files.get(filename).size > 0, `Empty npm package file: ${filename}`);
}
for (const filename of files.keys()) {
  assert.ok(
    !filename.startsWith('example/') && !filename.startsWith('node_modules/'),
    `Unexpected npm package file: ${filename}`,
  );
}

process.stdout.write(output);
console.log(`Validated ${requiredFiles.length} required npm package files.`);
