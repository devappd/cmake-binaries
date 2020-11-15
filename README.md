# cmake-npm

Download [CMake](https://cmake.org/) for subsequent use by `npm --global install`.

If you already have CMake installed and it is in your PATH, you may force installation
as an NPM module by passing `npm run install -- --force`.

If CMake distributes binaries for your platform (Linux/macOS x86_64; Windows x64 and x86),
this will download those binaries unless you pass `npm run install -- --compile`.

This package installs CMake 3.18.4.

Note that because `cmake` takes such a long time to download and compile,
it is recommended that you install this package in global mode.

Based on [install-cmake](https://github.com/brave/install-cmake) for npm.
