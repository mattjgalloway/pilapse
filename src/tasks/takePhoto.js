/**
 * takePhoto
 */

/* Node modules */
const { exec } = require('child_process');
const path = require('path');

/* Third-party modules */
const mkdirp = require('mkdirp');
const moment = require('moment');

/* Files */
const SunriseSunset = require('../models/sunriseSunset');

module.exports = (logger, db, dataStore, config, sunriseSunset) => Promise.resolve()
  .then(() => {
    if (config.disabled) {
      /* Task has been disabled */
      throw new Error('TASK_DISABLED');
    }

    /* Are we inside the start/end times? */
    const times = {
      sunrise: config.startTime,
      sunset: config.endTime
    };

    /* Ensure we have date objects for the start/end times */
    for (const key in times) {
      const time = times[key];

      if (!time) {
        /* Getting time from the sunrise/sunset */
        times[key] = sunriseSunset.get(key);
      } else {
        /* Converting time to Date */
        const split = time.split(':');

        times[key] = moment()
          .set({
            hour: split[0],
            minute: split[1] || 0,
            second: split[2] || 0,
            millisecond: 0
          })
          .toDate();
      }
    }

    const obj = new SunriseSunset(times);

    /* Allowed values are Y, M or D */
    const group = config.group || 'D';

    /* Default to daily */
    let groupFormat = 'YYYY-MM-DD';
    if (group === 'Y') {
      groupFormat = 'YYYY';
    } else if (group === 'M') {
      groupFormat = 'YYYY-MM';
    }

    const now = moment().unix();
    const groupName = moment().format(groupFormat);
    const groupPath = path.join(dataStore.getImagesDirectory(), groupName);
    const filename = `img_${now}.jpg`;
    const fullPath = path.join(groupPath, filename);
    const filenameWithGroup = path.join(groupName, filename);

    if (obj.isDaylight() === false) {
      /* Nothing to do */
      logger.info({
        code: 'NOPHOTOSCHEDULED',
        now: new Date(now),
        times: obj.getData()
      }, 'No photo scheduled to be taken');

      return;
    }

    return new Promise((resolve, reject) => {
      /* Create the path where the photos are to be stored */
      logger.info({
        groupPath,
        code: 'DIRCREATE'
      }, 'Creating some directories');

      mkdirp(groupPath, err => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    }).then(() => {
      /* Set the options */
      const opts = (config.raspistillOpts || []).reduce((result, opt) => {
        result.push(opt);

        return result;
      }, [
        '-h 720',
        '-w 1280',
        '-q 35',
        '-mm matrix',
        '-ex auto',
        '-n'
      ]);

      /* Create the command */
      const cmd = `/opt/vc/bin/raspistill ${opts.join(' ')} -o ${fullPath}`;

      logger.info({
        cmd,
        code: 'NEWPHOTO'
      }, 'Photo being taken');

      /* Execute the command to take the photo */
      return new Promise((resolve, reject) => {
        exec(cmd, (err) => {
          if (err) {
            reject(err);
            return;
          }

          logger.info({
            cmd: 'NEWPHOTOSUCCESS'
          }, 'Photo successfully taken');

          resolve(cmd);
        });
      }).then(cmd => db.save({
        type: 'img',
        filename: filenameWithGroup,
        group: groupName
      }).then(() => (cmd)));
    });
  });
