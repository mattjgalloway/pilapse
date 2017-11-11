/**
 * dropboxBackup
 */

/* Node modules */
const fs = require('fs');
const path = require('path');

/* Third-party modules */
const Dropbox = require('dropbox');

/* Files */

function upload (config, localPath, remotePath, mode) {
  mode = mode || 'add';

  const dbx = new Dropbox({
    accessToken: config.accessToken
  });

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
    mode,
    autorename: true,
    mute: true
  }));
}

module.exports = (logger, db, dataStore, config) => Promise.resolve()
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
        .then(() => {
          const { filename } = file;
          const localPath = path.join(dataStore.getImagesDirectory(), filename);
          const remotePath = path.join(config.savePath, filename);
          return upload(config, localPath, remotePath)
            .then(result => {
              file.uploaded = 1;
              return db.save(file).then(() => result);
            });
        })
        .then(() => {
          logger.info({
            file,
            pause,
            code: 'DROPBOXUPLOAD'
          }, 'Uploaded file to Dropbox, now pausing');

          return new Promise(resolve => setTimeout(resolve, pause));
        }), Promise.resolve());
    })
    .then(() => {
      const localPath = dataStore.getSQLFilePath();
      const remotePath = path.join(config.savePath, path.basename(localPath));
      return upload(config, localPath, remotePath, 'overwrite');
    });
  });
