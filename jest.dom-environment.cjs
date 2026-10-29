const BaseJSDOMEnvironment = require("@jest/environment-jsdom-abstract").default;

// Use the project's declared DOM implementation for both browser editor tests
// and the standalone EPUB runtime tests, independent of Jest's bundled version.
module.exports = class ProjectDOMEnvironment extends BaseJSDOMEnvironment {
  constructor(config, context) {
    super(config, context, require("jsdom"));
  }
};
