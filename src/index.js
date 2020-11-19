const install = require('./install.js');
const cmake = require('./cmake.js');
const cpack = require('./cpack.js');

module.exports = {
  install: install.install,
  exists: install.exists,
  getCommand: install.getCommand,
  run: cmake.run,
  run_cpack: cpack.run
};
