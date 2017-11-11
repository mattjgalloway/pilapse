/**
 * filesDb
 */

/* Node modules */

/* Third-party modules */
const _ = require('lodash');

/* Files */

module.exports = class FileDb {
  constructor (db) {
    this._db = db;
  }

  createTable () {
    const sql = 'CREATE TABLE IF NOT EXISTS `files` ' +
      '(`id` INTEGER,' +
      '`filename` TEXT UNIQUE,' +
      '`uploaded` INTEGER NOT NULL DEFAULT 0,' +
      '`group` TEXT,' +
      '`type` TEXT,' +
      '`created` TEXT,' +
      '`updated` TEXT, ' +
      'PRIMARY KEY(`id`));';

    return this._db.query(sql);
  }

  getByFilename (filename) {
    return this._db.query('SELECT * FROM files WHERE filename = ?', [
      filename
    ]);
  }

  getDeadFiles () {
    return this._db.query('SELECT * FROM files WHERE uploaded = ?', [
      1
    ]);
  }

  getFilesToUpload () {
    return this._db.query('SELECT * FROM files WHERE uploaded = ?', [
      0
    ]);
  }

  getGroup (group) {
    return this._db.query('SELECT * FROM files WHERE `group` = ? ORDER BY created ASC', [
      group
    ]);
  }

  save (data = {}) {
    let sql = '';
    let inserts = [];

    const isUpdate = _.has(data, 'id') && data.id;

    if (isUpdate) {
      /* Updating the record */
      data.updated = new Date().toISOString();

      sql = 'UPDATE files SET';
      const obj = {};
      for (const key in data) {
        sql += '`' + key + '`' + ` = $${key},`;
        obj[`$${key}`] = data[key];
      }
      sql = sql.substr(0, sql.length - 1);
      sql += ' WHERE id = $id';

      inserts = obj;
    } else {
      /* New record */
      data.created = new Date().toISOString();

      sql = 'INSERT INTO files (%cols%) VALUES (%vals%)';

      const columns = [];
      const values = [];
      for (const key in data) {
        columns.push('`' + key + '`');
        values.push(data[key]);
      }

      sql = sql.replace('%cols%', columns.join(', '))
        .replace('%vals%', values.map(() => '?').join(', '));

      inserts = [
        ...values
      ];
    }

    return this._db.query(sql, inserts);
  }
};
