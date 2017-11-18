/**
 * PiLapse - Generate video
 */

/* Node modules */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

/* Third-party modules */
const bunyan = require('bunyan');
const rimraf = require('rimraf');

/* Files */
const config = require('../config.json');
const Database = require('./lib/database');

const logger = bunyan.createLogger({
  name: 'pilapse',
  serializers: bunyan.stdSerializers,
  streams: [{
    stream: process.stdout,
    level: process.env.LOG_LEVEL
  }]
});

const baseDirectory = config.dropboxBase;
const sqlFile = path.join(baseDirectory, 'pilapse.sql');
const videoFile = path.join(baseDirectory, 'video.mp4');

const db = new Database(sqlFile, logger);

const makeTmp = new Promise((resolve, reject) => {
  fs.mkdtemp(path.join(os.tmpdir(), 'pilapse-'), (err, folder) => {
    if (err) {
      reject(err);
      return;
    }
    resolve(folder);
  });
});

const fetchFiles = db.query('SELECT * FROM files ORDER BY created ASC');
var tempDirectory = undefined;

Promise.all([
  makeTmp,
  fetchFiles,
])
.then(([ tmpDir, files ]) => {
  logger.info('Temporary directory: ' + tmpDir);
  tempDirectory = tmpDir;

  var offset = 0;
  const allCopies = files.map((file, i) => {
    const tmpFilenumber = ("00000000" + (i + offset)).slice(-8);
    const tmpFilename = "image" + tmpFilenumber + ".jpg";
    const localFile = path.join(baseDirectory, file.filename);
    const tmpFile = path.join(tempDirectory, tmpFilename);
    return new Promise((resolve, reject) => {
      fs.copyFile(localFile, tmpFile, (err) => {
        if (err) {
          reject(err);
          return;
        }
  
        logger.info('Copied ' + localFile + ' to ' + tmpFile);
  
        resolve();
      });
    }).catch((err) => {
      // This is likely because the image doesn't exist. Just skip it!
      offset++;
      logger.info('Failed to copy file. Just ignoring this one.');
    });
  });

  return Promise.all(allCopies);
})
.then(() => {
  return new Promise((resolve, reject) => {
    logger.info('Creating video...');

    const cmd = 'ffmpeg -y -r 24 -i ' + path.join(tempDirectory, "image%08d.jpg") + ' -vcodec libx264 -pix_fmt yuv420p -q:v 3 ' + videoFile;
    exec(cmd, (err) => {
      if (err) {
        reject(err);
        return;
      }

      logger.info('Video created successfully. ' + videoFile);

      resolve();
    });
  });
})
.catch(err => {
  logger.error('Error:\n' + err);
})
.then(() => {
  if (tempDirectory !== undefined) {
    return new Promise((resolve, reject) => {
      rimraf(tempDirectory, {
          disableGlob: true
      }, err => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  } else {
    return Promise.resolve();
  }
})
.catch(err => {
  logger.error('Error:\n' + err);
});
