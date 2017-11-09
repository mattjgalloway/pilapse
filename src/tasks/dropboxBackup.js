/**
 * dropboxBackup
 */

/* Node modules */
const fs = require('fs');
const path = require('path');

/* Third-party modules */
const Dropbox = require('dropbox');

/* Files */

function upload (db, config, file) {
  const dbx = new Dropbox({
    accessToken: config.accessToken
  });

  const { filename } = file;
  const localPath = path.join(db.getImagesDirectory(), filename);
  const remotePath = path.join(config.savePath, filename);

  return new Promise((resolve, reject) => {
    fs.readFile(localPath, (err, contents) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(contents);
    });
  }).then(contents => dbx.filesUpload({
    path: remotePath,
    contents,
    autorename: true,
    mute: true
  })).then(result => {
    file.uploaded = 1;

    return db.save(file)
      .then(() => result);
  });
}

module.exports = (logger, db, config) => Promise.resolve()
  .then(() => {
    if (config.disabled) {
      throw new Error('TASK_DISABLED');
    }

    /* Get the files */
    db.getFilesToUpload()
    .then((photos) => {
      const uploads = photos;

      const pause = config.pause || 10000;

      return uploads.reduce((thenable, file) => thenable
        .then(() => upload(db, config, file))
        .then(() => {
          logger.info({
            file,
            pause,
            code: 'DROPBOXUPLOAD'
          }, 'Uploaded file to Dropbox, now pausing');

          return new Promise(resolve => setTimeout(resolve, pause));
        }), Promise.resolve());
    });
  });
