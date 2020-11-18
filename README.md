# cmake-binaries

Install and run [CMake](https://cmake.org/) v3.18.4 as an NPM module.

## Installation

```sh
npm install git+https://github.com/devappd/cmake-binaries.git
```

If you already have CMake installed and it is in your PATH, this package will use
your pre-existing installation. You may force-install as an NPM module by passing
`npm run install -- --force`.

If you are running on Windows x86 or x64, or Linux/macOS x86_64, this package will
download those binary releases unless you pass `npm run install -- --compile`
to build from source. **Note that compiling is disabled on Windows!**

Note that because `cmake` takes such a long time to download and compile, you
should install this package in global mode.

## Usage

```js
const cmake = require('cmake-binaries');

// Check if CMake is installed.
const exists = cmake.exists();

// Run cmake.install if you want to ensure that it is installed at every
// run. To skip this step, you can just run cmake.run directly.
//
// forceInstall (bool) -- Install even if you already have CMake.
// forceCompile (bool) -- Compile even when a binary distribution exists.
cmake.install(forceInstall, forceCompile)
.then(function() {
  return cmake.run([
      // arguments
      'path/to/src',
      '-G', '"MSYS Makefiles"',
      '-DCMAKE_BUILD_TYPE=Release',
      '-DCMAKE_INSTALL_PREFIX=./install',
      // etc...
    ],
    { /* child_process.spawn options, e.g., cwd */ }
  );
})
.except(function (err) {
  // Handle err...
});
```

## Acknowledgements

Based on [install-cmake](https://github.com/brave/install-cmake) for npm
and [emsdk-npm](https://github.com/brion/emsdk-npm).
