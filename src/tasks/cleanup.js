/**
 * cleanup
 */

/* Node modules */

/* Third-party modules */
const rimraf = require('rimraf');
const path = require('path');

/* Files */

module.exports = (db, config) => Promise.resolve()
  .then(() => {
    if (config.disabled) {
      throw new Error('TASK_DISABLED');
    }

    return db.getDeadFiles();
  })
  .then(files => {
    const tasks = files.map(({ filename }) => new Promise((resolve, reject) => {
      const fullPath = path.join(db.getImagesDirectory(), filename);
      rimraf(fullPath, {
        disableGlob: true
      }, err => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    }));

    return Promise.all(tasks);
  });
