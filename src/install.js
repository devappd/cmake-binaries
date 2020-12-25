// cmake-binaries - install.js
// Copyright (c) 2020-2021 David Apollo (77db70f775fa0b590889c45371a70a1d23e99869d4565976a5207c11606fb6aa)
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.
//
////////////////////////////////////////////////////////////////////////
//
// Based on work by "Brave Developers <support@brave.com>" (MPL License)
//
// https://github.com/brave/install-cmake/blob/2bbba2b3f4293f1ce9590f444477fe86069f997a/install.js

const execSync = require('child_process').execSync;
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');

const fse = require('fs-extra');
const which = require('which');
const { moduleBase, MAJOR_VERSION, VERSION } = require('./common.js');
const DownloadCMakeArchive = require('./download.js');

////////////////////////////////////////////////////////////////////////
// Version and URL utilities
////////////////////////////////////////////////////////////////////////

const URL_ROOT = 'https://cmake.org/files/v' + MAJOR_VERSION + '/cmake-' + VERSION;

function GetCMakeBinaryUrl() {
  if (process.platform === 'win32') {
    if (process.arch === 'x64')
      return URL_ROOT + '-win64-x64.zip';
    else if (process.arch === 'x86')
      return URL_ROOT + '-win32-x86.zip';
  } else if (process.platform === 'darwin') {
    if (process.arch === 'x64')
      return URL_ROOT + '-Darwin-x86_64.tar.gz';
  } else if (process.platform === 'linux') {
    if (process.arch === 'x64')
      return URL_ROOT + '-Linux-x86_64.tar.gz';
  }

  // Binary download not supported
  return false;
}

////////////////////////////////////////////////////////////////////////
// Check if CMake is already in node_modules or in PATH.
////////////////////////////////////////////////////////////////////////

function GetCMakePathInPath() {
  // throws if not found
  return which.sync('cmake');
}

function GetCMakePathInModule() {
  const cmakeModuleBin = path.join(moduleBase(), 'bin',
    'cmake' + (process.platform === 'win32' ? '.exe' : '')
  );
  if (fs.existsSync(cmakeModuleBin))
    return cmakeModuleBin;
}

function GetCommand() {
  let testPath = GetCMakePathInModule();
  if (!testPath) {
    try {
      testPath = GetCMakePathInPath();
    } catch(e) {
      // not found
      testPath = 'cmake';
    }
  }
  return testPath;
}

function ExistsInPath() {
  try {
    return GetCMakePathInPath();
  } catch(e) {
    return false;
  }
}

function ExistsInModule() {
  if (GetCMakePathInModule())
    return true;
}

function Exists() {
  return (ExistsInPath() || ExistsInModule());
}

// main() subroutine to check CMake existence and print status messages.
function CheckCMakeExists(forceInstall) {
  let existsWhere = 'PATH';

  if (ExistsInPath() ||
    // Assign existsWhere on purpose.
    (ExistsInModule() && (existsWhere = 'module'))
  ) {
    console.log('Command "cmake" already exists in ' + existsWhere);

    if (!forceInstall) {
      if (require.main === module)
        console.log('To force-install via NPM, enter "npm run install -- --force"');
      else
        console.log('To force-install via NPM, enter ' +
          '"npm explore cmake-binaries -- npm run install -- --force"');
      return true;
    } else
      console.log('Forcing install via NPM...');
  }
  return false;
}

////////////////////////////////////////////////////////////////////////
// Build and install CMake
////////////////////////////////////////////////////////////////////////

function BuildCMake(srcPath) {
  console.log('Now building CMake...');

  fs.chmodSync(path.join(srcPath, 'configure'), 0o755);

  execSync('./configure --prefix=pwd', {
    'cwd': srcPath,
    'stdio': 'inherit'
  });

  execSync('make', {
    'cwd': srcPath,
    'stdio': 'inherit'
  });

  InstallCMakeBuild(srcPath);
}

function InstallCMakeBuild(rootPath) {
  console.log('Installing CMake to NPM module...');

  const binPath = path.join(rootPath, 'bin');
  const destPath = path.join(moduleBase(), 'bin');

  if (!fs.existsSync(destPath))
    fs.mkdirSync(destPath);

  const ext = (process.platform === 'win32' ? '.exe' : '');
  
  for (const fileFragment of [
    'cmake' + ext,
    'cpack' + ext
  ]) {
    const filePath = path.join(binPath, fileFragment);
    const fileDestPath = path.join(destPath, fileFragment);
    fs.copyFileSync(filePath, fileDestPath);
    fs.chmodSync(fileDestPath, 0o755);
  }

  // Also copy the "Modules" and "Templates" folders in "share"
  for (const dirFragment of [
    'share', 'cmake-' + MAJOR_VERSION, 'Modules',
    'share', 'cmake-' + MAJOR_VERSION, 'Templates'
  ]) {
    let dirPath = path.join(rootPath, dirFragment);
    let dirDestPath = path.join(moduleBase(), dirFragment);

    if (!fs.existsSync(dirPath))
      // Assume this is a source archive
      dirPath = path.join(rootPath, path.basename(dirFragment));

    fse.copySync(dirPath, dirDestPath);
  }
}

////////////////////////////////////////////////////////////////////////
// Main routine and exports
////////////////////////////////////////////////////////////////////////

async function main(forceInstall, forceCompile) {
  // If cmake already exists, then decline to install (unless --force).
  // Don't raise an error here. CheckCMakeExists() also prints status msgs.
  if (CheckCMakeExists(forceInstall))
    return 0;

  // Get download URL (determined from OS and arch)
  let cmakeUrl;
  let cmakeBuild;

  if (!forceCompile)
    cmakeUrl = GetCMakeBinaryUrl();

  // Nothing returned? That means we need to build from source.
  if (!cmakeUrl) {
    if (process.platform === 'win32') {
      throw new Error('CPU architecture ' + process.arch
        + ' is not supported for compiling on Windows!');
    }

    cmakeBuild = true;
    cmakeUrl = URL_ROOT + '.tar.gz';
  }

  // Set up temporary staging folder
  const tmpObj = tmp.dirSync({
    'unsafeCleanup': true
  });

  // Download archive and extract.
  // Binary downloads are located in ${zip_root}/${filename_without_ext}/bin
  // Source download, after building, will also build to ${zip_root}/${filename_without_ext}/bin
  try {
    let destPath = cmakeBuild ? tmpObj.name : moduleBase();
    // If downloading a binary, this also extracts the files.
    let cmakeTempPath = await DownloadCMakeArchive(cmakeUrl, destPath, cmakeBuild);

    // If we need to build, do so now.
    if (cmakeBuild)
      BuildCMake(cmakeTempPath);

    console.log('Success!');
    return 0;
  } catch (e) {
    throw e;
  } finally {
    tmpObj.removeCallback();
  }
}

// If running as a script, run main and return its error code.
if (require.main === module) {
  main(
    process.argv.includes('--force'),
    process.argv.includes('--compile')
  )
  .then(function(exitCode) {
    process.exit(exitCode);
  })
  .catch(function(error) {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  install: main,
  exists: Exists,
  getCommand: GetCommand
};
