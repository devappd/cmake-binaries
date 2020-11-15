const install = require('./install.js');
const cmake = require('./cmake.js');
const cpack = require('./cpack.js');

module.exports = {
  install: install.install,
  run_cmake: cmake.run,
  run_cpack: cpack.run
};
