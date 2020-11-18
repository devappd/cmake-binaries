#!/usr/bin/env node
// cmake-binaries - cpack.js
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
// Based on work by Brion Vibber (MIT License)
//
// https://github.com/brion/emsdk-npm/blob/30d75423493fb446605dc49324adebb8170e89d7/src/common.js
// https://github.com/brion/emsdk-npm/blob/30d75423493fb446605dc49324adebb8170e89d7/src/emsdk-run.js

const common = require('./common.js');

function run(args) {
  return common.run_executable('cpack', args);
}

if(require.main === module)
  run(process.argv.slice(2))
  .then(function (result) {
    process.exit(result.code);
  })
  .catch(function (err) {
    if (err instanceof ChildProcessError
      && err.code != 0)
      process.exit(err.code);
    else {
      console.error(err.message);
      process.exit(1);
    }
  });

module.exports = {
  run: run
};
