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
const http = require('https');
const fs = require('fs');
const url = require('url');
const path = require('path');
const commandExistsSync = require('command-exists').sync;
const tmp = require('tmp');
const decompress = require('decompress');
const fse = require('fs-extra');

const MAJOR_VERSION = '3.18';
const VERSION = '3.18.4';

const URL_ROOT = 'https://cmake.org/files/v' + MAJOR_VERSION + '/cmake-' + VERSION;

////////////////////////////////////////////////////////////////////////
// Utilities
////////////////////////////////////////////////////////////////////////

// courtesy of https://stackoverflow.com/questions/11944932/how-to-download-a-file-with-node-js-without-using-third-party-libraries
function Download(url, dest) {
  return new Promise(function(resolve, reject) {
    var file = fs.createWriteStream(dest);
    http.get(url, function(response) {
      response.pipe(file);
      file.on('finish', function() {
        file.close(function() { // close() is async, call cb after close completes.
          resolve();
        });
      });
    })
    .on('error', function(err) { // Handle errors
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
        reject(err.message);
    });
  });
}

function GetFilenameFromUrl(testUrl) {
  var parsed = url.parse(testUrl);
  return decodeURIComponent(path.basename(parsed.pathname));
}

function GetFilenameWithoutExt(testPath) {
  var ext = path.extname(testPath);
  var name = path.basename(testPath, ext);

  if (name.toLowerCase().endsWith('.tar'))
    name = name.substring(0, name.length - 4);

  return name;
}

function GetBaseDir() {
  var srcdir = path.dirname(module.filename);
  var basedir = path.dirname(srcdir);
  return basedir;
}

////////////////////////////////////////////////////////////////////////
// Check if CMake is already in node_modules or in PATH.
////////////////////////////////////////////////////////////////////////

function ExistsInPath() {
  return commandExistsSync('cmake');
}

function GetCMakePathInModule() {
  const cmakeModuleBin = path.join(GetBaseDir(), 'bin', 'cmake',
    (process.platform === 'win32' ? '.exe' : '')
  );
  if (fs.existsSync(cmakeModuleBin))
    return cmakeModuleBin;
}

function ExistsInModule() {
  if (GetCMakePathInModule())
    return true;
}

function Exists() {
  return (ExistsInPath() || ExistsInModule());
}

function GetCommand() {
  if (ExistsInPath())
    return 'cmake';
  else
    // returns null if this doesn't exist
    return GetCMakePathInModule();
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
// Download CMake distribution from cmake.org
////////////////////////////////////////////////////////////////////////

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

function DownloadArchive(url, destPath) {
  console.log('Downloading CMake archive...');

  const destFile = GetFilenameFromUrl(url);
  const folderName = GetFilenameWithoutExt(destFile);

  const tmpArchiveDest = path.join(destPath, destFile);

  return Download(url, tmpArchiveDest)
  .then(function() {
    console.log('Extracting CMake archive. This may take a while...');

    // Extract the archive. CMake archives have a folder in root,
    // so just extract to tmp folder.
    return decompress(tmpArchiveDest, destPath);
  })
  .then(function() {
    // Check if the expected archive root exists: ${tmp}/${filename_without_ext}
    let tmpExtractRoot = path.join(destPath, folderName);

    // If macOS, this will be in ${tmp}/${filename_without_ext}/CMake.app/Contents
    //
    // \todo Does this actually work to extract bin/ and share/ from
    // a .app folder? If not, then just copy the entire .app folder
    // and figure out how to execute it from NPX.
    if (folderName.includes('Darwin'))
      tmpExtractRoot = path.join(tmpExtractRoot, 'CMake.app/Contents');

    if (fs.existsSync(tmpExtractRoot)) {
      return tmpExtractRoot;
    } else {
      throw new Error('Expected archive folder does not exist: '
        + tmpExtractRoot);
    }
  });
}

////////////////////////////////////////////////////////////////////////
// Build and install CMake
////////////////////////////////////////////////////////////////////////

function BuildCMake(srcPath) {
  console.log('Now building CMake...');

  execSync('./configure --prefix=pwd', {
    'cwd': srcPath,
    'stdio': 'inherit'
  });

  execSync('make', {
    'cwd': srcPath,
    'stdio': 'inherit'
  });
}

function InstallCMake(rootPath) {
  console.log('Installing CMake to NPM module...');

  const binPath = path.join(rootPath, 'bin');
  const destPath = path.join(GetBaseDir(), 'bin');

  if (!fs.existsSync(destPath))
    fs.mkdirSync(destPath);

  const ext = (process.platform === 'win32' ? '.exe' : '');
  const cmakePath = path.join(binPath, 'cmake' + ext);
  const cpackPath = path.join(binPath, 'cpack' + ext);

  const cmakeDestPath = path.join(destPath, 'cmake' + ext);
  fs.copyFileSync(cmakePath, cmakeDestPath);
  fs.chmodSync(cmakeDestPath, 0o775);

  const cpackDestPath = path.join(destPath, 'cpack' + ext);
  fs.copyFileSync(cpackPath, cpackDestPath);
  fs.chmodSync(cpackDestPath, 0o775);

  // Also copy the "Modules" and "Templates" folders in "share"
  let modulesPath = path.join(rootPath, 'share', 'cmake-' + MAJOR_VERSION, 'Modules');
  let modulesDestPath = path.join(GetBaseDir(), 'share', 'cmake-' + MAJOR_VERSION, 'Modules');
  let templatesPath = path.join(rootPath, 'share', 'cmake-' + MAJOR_VERSION, 'Templates');
  let templatesDestPath = path.join(GetBaseDir(), 'share', 'cmake-' + MAJOR_VERSION, 'Templates');

  if (!fs.existsSync(modulesPath)) {
    // Assume this is a source archive
    modulesPath = path.join(rootPath, 'Modules');
    templatesPath = path.join(rootPath, 'Templates');
  }
  
  fse.copySync(modulesPath, modulesDestPath);
  fse.copySync(templatesPath, templatesDestPath);
}

////////////////////////////////////////////////////////////////////////
// Main routine and exports
////////////////////////////////////////////////////////////////////////

function main(forceInstall, forceCompile) {
  // If cmake already exists, then decline to install (unless --force).
  // Don't raise an error here. CheckCMakeExists() also prints status msgs.
  if (CheckCMakeExists(forceInstall))
    return Promise.resolve(0);

  // Get download URL (determined from OS and arch)
  let cmakeUrl = null;
  let cmakeBuild = null;

  if (!forceCompile)
    cmakeUrl = GetCMakeBinaryUrl();

  // Nothing returned? That means we need to build from source.
  if (!cmakeUrl) {
    if (process.platform === 'win32') {
      return Promise.reject('CPU architecture ' + process.arch
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
  return DownloadArchive(cmakeUrl, tmpObj.name)
  .then(function(cmakeTempPath) {
    // If we need to build, do so now.
    if (cmakeBuild)
      BuildCMake(cmakeTempPath);

    // Copy the cmake binaries to module path. Exit on error.
    InstallCMake(cmakeTempPath);

    console.log('Success!');
    return 0;
  })
  .finally(function() {
    tmpObj.removeCallback();
  });
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
