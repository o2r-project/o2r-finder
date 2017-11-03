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
const config = require('../config/config');
const path = require('path');
const debug = require('debug');
const mongojs = require('mongojs');
const exec = require('child_process').exec;

const esMapping = require('../config/mapping');
const esSettings = require('../config/settings');

const ESMongoSync = require('node-elasticsearch-sync');

// standalone Elasticsearch client
const elasticsearch = require('elasticsearch');
const esclient = new elasticsearch.Client({
    host: config.elasticsearch.location,
    log: 'info'
});

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

function resetIndex() {
    return new Promise((resolve, reject) => {
        /*
         * Delete and recreate index for testing
         */
        ESMongoSync.disconnect();

        esclient.indices.exists({index: config.elasticsearch.index})
            .then(function (resp) {
                // Delete possibly existing index
                if (resp) {
                    debug('Index %s already exists. Deleting index.', config.elasticsearch.index);
                    return esclient.indices.delete({index: config.elasticsearch.index});
                } else {
                    debug('Index %s not found.', config.elasticsearch.index);
                    return false;
                }
            }).then(function (resp) {
                // Create a new index if: 1) index was deleted in the last step 2) index didn't exist in the beginning
                if (typeof resp === 'object' && resp.acknowledged) {
                    debug('Existing index %s successfully deleted. Response: %s', config.elasticsearch.index, JSON.stringify(resp));
                    debug('Recreating index with settings: %s', JSON.stringify(esSettings.settings));
                    return esclient.indices.create({
                        index: config.elasticsearch.index,
                        body: esSettings.settings
                    });
                } else if (!resp) {
                    debug('Creating index %s with settings %s because it does not exist yet.', config.elasticsearch.index, JSON.stringify(esSettings.settings));
                    return esclient.indices.create({
                        index: config.elasticsearch.index,
                        body: esSettings.settings
                    });
                }
            }).then(function (resp) {
                debug('Index (re)created: %s', JSON.stringify(resp));
                debug('Using mapping found in "config/mapping.js" for index %s: %s', config.elasticsearch.index, JSON.stringify(esMapping.mapping));
                return esclient.indices.putMapping({
                    index: config.elasticsearch.index,
                    type: config.elasticsearch.type.compendia,
                    body: esMapping.mapping
                });
            }).then(function (resp) {
                debug('Index and mapping configured.');
                // Reconnect ESMongoSync
                ESMongoSync.reconnect();
                if (typeof resp === 'object') {
                    debug('Mapping successfully created. Elasticsearch response: %s', JSON.stringify(resp));
                    resolve(true);
                } else {
                    resolve(false);
                }
            }).catch(function (err) {
                debug('Error creating index or mapping: %s', err);
                ESMongoSync.reconnect();
                reject(err);
            });
    });
}

/**
 * Imports a single compendium from JSON using db.collection.save()
 * @param {string} path - The path to the JSON file
 */
function importJSONCompendium(path) {
    return new Promise((resolve, reject) => {

        let dbpath = 'localhost/' + config.mongo.database;
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

        let cmd = `mongoimport --db ${config.mongo.database} --collection ${config.mongo.collection.compendia} --type json --file ${path} --jsonArray`;

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
module.exports.resetIndex = resetIndex;


