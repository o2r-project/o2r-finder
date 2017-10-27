/*
 * (C) Copyright 2017 o2r project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const request = require('request');
const tmp = require('tmp');
const AdmZip = require('adm-zip');
const fs = require('fs');
const c = require('../config/config');
const path = require('path');
const debug = require('debug');
const mongojs = require('mongojs');
const exec = require('child_process').exec;

const sessionId_o2r = 'C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo';
const orcid_o2r = '0000-0001-6021-1617';

function uploadCompendium(path, cookie) {
  var zip = new AdmZip();
  zip.addLocalFolder(path);
  var tmpfile = tmp.tmpNameSync() + '.zip';
  //var zipBuffer = zip.toBuffer(); could not make buffer work with multipart/form
  zip.writeZip(tmpfile);

  let formData = {
    'content_type': 'compendium',
    'compendium': {
      value: fs.createReadStream(tmpfile),
      options: {
        filename: 'another.zip',
        contentType: 'application/zip'
      }
    }
  };
  let j = request.jar();
  let ck = request.cookie('connect.sid=' + cookie);
  j.setCookie(ck, global.test_host);

  let reqParams = {
    uri: global.test_host_upload + '/api/v1/compendium',
    method: 'POST',
    jar: j,
    formData: formData,
    timeout: 10000
  };

  return (reqParams);
}

/**
 * Imports a single compendium from JSON using db.collection.save()
 * @param {string} path - The path to the JSON file
 */
function importJSONCompendium(path) {
    return new Promise((resolve, reject) => {

        let dbpath = 'localhost/' + c.mongo.database;
        const db = mongojs(dbpath, ['users', 'sessions', 'compendia']);

        fs.readFile(path, (err, data) => {
            if (err) throw err;
            db.compendia.save(JSON.parse(data), function (err, doc) {
                if (err) reject(err);
                resolve(true);
            })
        });

    });
}

/**
 * Imports multiple compendia from a JSON array using mongoimport
 * @param {string} path - The path to the JSON file
 */
function importJSONCompendia(path) {
    return new Promise((fulfill, reject) => {

        let cmd = `mongoimport --db ${c.mongo.database} --collection ${c.mongo.collection.compendia} --type json --file ${path} --jsonArray`;

        console.log(`Importing compendia with command: ${cmd}`);
        exec(cmd, (error, stdout, stderr) => {
            if (error || stderr) {
                console.log(error, stderr, stdout);
                error.status = 500;
                reject(error);
            } else {
                console.log(`Import finished for file ${path}`);
                fulfill(true);
            }
        });
    });
}

module.exports.uploadCompendium = uploadCompendium;
module.exports.importJSONCompendium = importJSONCompendium;
module.exports.importJSONCompendia = importJSONCompendia;


