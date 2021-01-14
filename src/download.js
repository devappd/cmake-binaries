////////////////////////////////////////////////////////////////////////
// Download CMake distribution from cmake.org
////////////////////////////////////////////////////////////////////////

const fs = require('fs');
const url = require('url');
const path = require('path');
const fse = require('fs-extra');
const fetch = require('node-fetch');
const { File } = require('@devappd/nodejs-html5-file-api');
const { Archive } = require('@devappd/libarchive.js');
const { MAJOR_VERSION } = require('./common.js');

// Initialize Archive class properties
Archive.init();

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

async function DownloadToBuffer(url) {
	const response = await fetch(url);
	const buffer = await response.buffer();
	return buffer;
};

async function DownloadToFileObject(url) {
  const buffer = await DownloadToBuffer(url);
  const file = new File(buffer, GetFilenameFromUrl(url));
  return file;
}

function SaveEntry(entry, destPath, options) {
  // entry.path ends with a /, so don't double up
  let filePath = entry.path.concat('', entry.file.name);
  let writeOpts = {};
  let pathFragment = filePath;

  if (options instanceof Object) {
    if ('mode' in options)
      writeOpts.mode = options.mode;
    if ('name' in options)
      pathFragment = options.name;
  }

  let destFilePath = path.join(destPath, pathFragment);

  fse.ensureDirSync(path.dirname(destFilePath));

  fs.writeFileSync(destFilePath, entry.file.buffer, writeOpts);
}

async function ExtractArchive(archive, destPath) {
  let entries = await archive.extractFiles();
  // Accessing a private member is cheating, but we need
  // a flat array of entries.
  entries = archive._objectToArray(entries);

  for (const entry of entries) {
    SaveEntry(entry, destPath);
  }
}

async function ExtractBinaryArchive(archive, destPath) {
  const ext = (process.platform === 'win32' ? '.exe' : '');

  // We only care about two specific files.
  // Notate the file mode because libarchivejs does not expose it.
  const fileList = [
    {
      name: `bin/cmake${ext}`,
      mode: 0o755
    },
    {
      name: `bin/cpack${ext}`,
      mode: 0o755
    }
  ];
  let fileCount = 0;

  // Only copy the files from these directories
  const dirList = [
    ['share', 'cmake-' + MAJOR_VERSION, 'Modules'].join('/'),
    ['share', 'cmake-' + MAJOR_VERSION, 'Templates'].join('/')
  ];

  let entries = await archive.extractFiles();
  // Accessing a private member is cheating, but we need
  // a flat array of entries.
  entries = archive._objectToArray(entries);

  for (entry of entries) {
    // Search for specific files from the fileList array
    // and save the files.
    if (fileCount < fileList.length) {
      for (const search of fileList) {
        // entry.path ends with a /, so don't double up
        let filePath = entry.path.concat('', entry.file.name);
        if (filePath.endsWith(search.name)) {
          fileCount++;
          SaveEntry(entry, destPath, search);
        }
      }
    }
    
    // Save every file from the dirList array.
    for (const dir of dirList) {
      let dirPos = entry.path.indexOf(dir);
      if (dirPos >= 0) {
        let filePath = entry.path.concat('', entry.file.name);
        SaveEntry(entry, destPath, {
          name: filePath.substring(dirPos)
        });
      }
    }
  }
}

async function DownloadCMakeArchive(url, destPath, isSource) {
  console.log('Downloading CMake archive...');

  const destFile = GetFilenameFromUrl(url);
  const folderName = GetFilenameWithoutExt(destFile);

  let archiveFile = await DownloadToFileObject(url);
  let archive = await Archive.open(archiveFile);

  console.log('Extracting CMake archive...');

  // Extract the archive.
  if (!isSource) {
    // Save all the files to their proper place in module
    await ExtractBinaryArchive(archive, destPath);
    return destPath;
  } else {
    await ExtractArchive(archive, destPath);

    // Check if the expected archive root exists: ${tmp}/${filename_without_ext}
    let tmpExtractRoot = path.join(destPath, folderName);

    // If macOS, this will be in ${tmp}/${filename_without_ext}/CMake.app/Contents
    //
    // \todo Does this actually work to extract bin/ and share/ from
    // a .app folder? If not, then just copy the entire .app folder
    // and figure out how to execute it from NPX.
    if (folderName.includes('Darwin'))
      tmpExtractRoot = path.join(tmpExtractRoot, 'CMake.app/Contents');

    if (fs.existsSync(tmpExtractRoot))
      return tmpExtractRoot;
    else
      throw new Error('Expected archive folder does not exist: '
        + tmpExtractRoot);
  }
}

module.exports = DownloadCMakeArchive;
