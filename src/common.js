// emsdk-npm - common.js 
// Copyright 2019 Brion Vibber
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

const path = require('path');

const child_process = require('child_process');

function base() {
    const srcdir = path.dirname(module.filename);
    const basedir = path.dirname(srcdir);
    return basedir;
}

function run(command, args) {
    const child = child_process.spawn(
        command,
        args,
        {
            stdio: [
                'inherit',
                'inherit',
                'inherit'
            ]
        }
    );
    child.on('exit', (e) => {
        process.exit(e.code);
    });
    child.on('error', (err) => {
        throw err;
    });
}

function run_executable(executable_name, args) {
  const basedir = base();
  const bindir = path.join(basedir, 'bin');
  const suffix = (process.platform === 'win32') ? '.exe' : '';
  const executable_run = path.join(bindir, executable_name + suffix);

  // If our local EXE does not exist, try running it anyway
  // in case it is in PATH.

  run(executable_run, args);
}

module.exports = {
    base: base,
    run: run,
    run_executable: run_executable
};
