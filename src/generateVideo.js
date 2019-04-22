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
const cronParser = require('cron-parser');

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
const allGenerations = config.generateVideo;

if (allGenerations.length === 0) {
  logger.error("No video generation configuration! See config.json.example for an example.");
  Process.exit(1);
}

const db = new Database(sqlFile, logger);

function makeTempDirectory() {
  return new Promise((resolve, reject) => {
    fs.mkdtemp(path.join(os.tmpdir(), 'pilapse-'), (err, folder) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(folder);
    });
  });
}

function handleGenerationConfig(generationConfig, files, tempDirectory) {
  logger.info("Generating video with config: " + JSON.stringify(generationConfig));

  const tolerance = (generationConfig.tolerance || 3600) * 1000;

  const options = {
    currentDate: files[0].created,
    iterator: true
  }
  const interval = cronParser.parseExpression(generationConfig.interval, options);

  var next = interval.next();
  var i = 0;
  var lastFile = files[0];

  const allCopies = files.reduce((arr, thisFile) => {
    const thisDate = Date.parse(thisFile.created);
    const nextNeededDate = Date.parse(next.value);
    var foundFile = null;

    if (thisDate > nextNeededDate) {
      const thisDateDiff = Math.abs(nextNeededDate - thisDate);
      const lastDateDiff = Math.abs(nextNeededDate - Date.parse(lastFile.created));
      if (thisDateDiff > tolerance && lastDateDiff > tolerance) {
        logger.info("Skipping iteration at " + next.value + " because no file found within tolerance.");
        next = interval.next();
      } else if (thisDateDiff < lastDateDiff) {
        foundFile = thisFile;
      } else {
        foundFile = lastFile;
      }
    }

    if (foundFile !== null) {
      logger.info("Found file at " + foundFile.created + " for iteration at " + next.value);
      next = interval.next();

      const promise = new Promise((resolve, reject) => {
        const localFile = path.join(baseDirectory, foundFile.filename);
        if (!fs.existsSync(localFile)) {
          // This is likely because the image doesn't exist. Just skip it!
          logger.info('Failed to copy file. Just ignoring this one.');
        }

        const tmpFilenumber = ("00000000" + i++).slice(-8);
        const tmpFilename = "image" + tmpFilenumber + ".jpg";
        const tmpFile = path.join(tempDirectory, tmpFilename);
        fs.copyFile(localFile, tmpFile, (err) => {
          if (err) {
            reject(err);
            return;
          }
  
          logger.info('Copied ' + localFile + ' to ' + tmpFile);
          i++;
  
          resolve();
        });
      });

      arr.push(promise);
    }

    lastFile = thisFile;
    return arr;
  }, []);

  return Promise.all(allCopies)
    .then(() => {
      return new Promise((resolve, reject) => {
        logger.info('Creating video...');
    
        const videoFile = path.join(baseDirectory, generationConfig.name + '.mp4');
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
      logger.info("Deleting temporary directory.");
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
    });
}

db.query('SELECT * FROM files ORDER BY created ASC')
  .then(files => {
    if (files.length === 0) {
      return Promise.reject(Error("No files found!"));
    }
  
    return Promise.all(allGenerations.map(generationConfig => {
      return makeTempDirectory()
        .then(tempDirectory => {
          logger.info('Temporary directory: ' + tempDirectory);
          handleGenerationConfig(generationConfig, files, tempDirectory);
        });
    }));
  })
  .catch(err => {
    logger.error('Error:\n' + err);
  });
