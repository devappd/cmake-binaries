// cmake-npm - install.js
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

const MAJOR_VERSION = '3.18'
const VERSION = '3.18.4';

const URL_ROOT = 'https://cmake.org/files/v' + MAJOR_VERSION + '/cmake-' + VERSION;

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

function CheckCMakeExists() {
  if (commandExistsSync('cmake')) {
    console.log('Command "cmake" already exists in PATH.');

    if (!process.argv.includes('--force')) {
      console.log('To force-install via NPM, pass --force');
      return true;
    } else
      console.log('Forcing install via NPM...');
  }
  return false;
}

function GetCMakeBinaryUrl() {
  if (process.platform === 'win32') {
    if (process.arch === 'x64')
      return URL_ROOT + '-win64-x64.zip';
    else if (process.arch === 'x86')
      return URL_ROOT + '-win32-x86.zip';
  } else if (process.platform === 'darwin') {
    if (process.arch === 'x64')
      return URL_ROOT + '-Darwin-x86_64.tar.gz';
  } else {
    if (process.arch === 'x64')
      return URL_ROOT + '-Linux-x86_64.tar.gz';
  }

  // Binary download not supported
  return false;
}

function DownloadArchive(url) {
  console.log('Downloading CMake archive...');

  var destFile = GetFilenameFromUrl(url);
  var folderName = GetFilenameWithoutExt(destFile);

  var tmpObj = tmp.dirSync({
    'unsafeCleanup': true
  });

  var tmpArchiveDest = path.join(tmpObj.name, destFile);

  return Download(url, tmpArchiveDest)
  .then(function() {
    console.log('Extracting CMake archive. This may take a while...');
    // Extract the archive. CMake archives have a folder in root,
    // so just extract to tmp folder.
    return decompress(tmpArchiveDest, tmpObj.name);
  })
  .then(function() {
    // Check if the expected archive root exists: ${tmp}/${filename_without_ext}
    var tmpExtractRoot = path.join(tmpObj.name, folderName);

    if (fs.existsSync(tmpExtractRoot)) {
      return tmpExtractRoot;
    } else {
      throw new Error('Expected archive folder does not exist: '
        + tmpExtractRoot);
    }
  });
}

function BuildCMake(srcPath) {
  console.log('Now building CMake...');

  execSync('./configure --prefix=pwd', {
    'cwd': srcPath,
    'stdio': 'inherit'
  });

  execSync('./make', {
    'cwd': srcPath,
    'stdio': 'inherit'
  });
}

function InstallCMake(rootPath) {
  console.log('Installing CMake to NPM module...');

  var binPath = path.join(rootPath, 'bin');
  var destPath = path.join(GetBaseDir(), 'bin');

  if (!fs.existsSync(destPath))
    fs.mkdirSync(destPath);

  var ext = (process.platform === 'win32' ? '.exe' : '');
  var cmakePath = path.join(binPath, 'cmake' + ext);
  var cpackPath = path.join(binPath, 'cpack' + ext);

  var cmakeDestPath = path.join(destPath, 'cmake' + ext);
  fs.copyFileSync(cmakePath, cmakeDestPath);
  fs.chmodSync(cmakeDestPath, 0o775);

  var cpackDestPath = path.join(destPath, 'cpack' + ext);
  fs.copyFileSync(cpackPath, cpackDestPath);
  fs.chmodSync(cpackDestPath, 0o775);
}

function main() {
  // If cmake already exists, then decline to install (unless --force)
  // Don't raise an error here.
  if (CheckCMakeExists())
    return Promise.resolve(0);

  // Get download URL (determined from OS and arch)
  var forceCompile = (process.argv.includes('--compile'));
  var cmakeUrl = false;

  if (!forceCompile)
    cmakeUrl = GetCMakeBinaryUrl();

  // Nothing returned? That means we need to build from source.
  if (!cmakeUrl) {
    if (process.platform === 'win32') {
      return Promise.reject('CPU architecture ' + process.arch
        + ' is not supported for compiling on Windows!');
    }

    var cmakeBuild = true;
    cmakeUrl = URL_ROOT + '.tar.gz';
  }

  // Download archive and extract.
  // Binary downloads are located in ${zip_root}/${filename_without_ext}/bin
  // Source download, after building, will also build to ${zip_root}/${filename_without_ext}/bin
  return DownloadArchive(cmakeUrl)
  .then(function(cmakeTempPath) {
    // If we need to build, do so now.
    if (cmakeBuild)
      BuildCMake(cmakeTempPath);

    // Copy the cmake binaries to module path. Exit on error.
    InstallCMake(cmakeTempPath);

    console.log('Success!');
    return 0;
  });
}

// Run main and return its error code.
main()
.then(function(exitCode) {
  process.exit(exitCode);
})
.catch(function(error) {
  console.error(error);
  process.exit(1);
});
