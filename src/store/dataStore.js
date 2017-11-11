/**
 * dataStore
 */

/* Node modules */

/* Third-party modules */
const path = require('path');

/* Files */

module.exports = class DataStore {
  constructor () {
  }

  getDataDirectory () {
    return path.join(__dirname, '..', '..', 'data');
  }

  getSunriseSunsetFilePath () {
    return path.join(this.getDataDirectory(), 'sunriseSunset.json');
  }

  getSQLFilePath () {
    return path.join(this.getDataDirectory(), 'pilapse.sql');
  }

  getImagesDirectory () {
    return path.join(this.getDataDirectory(), 'images');
  }

  getFullPathForFilename (filename) {
    return path.join(this.getImagesDirectory(), filename);
  }
};
