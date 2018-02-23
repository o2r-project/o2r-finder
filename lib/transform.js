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

const config = require('../config/config');
const dirTree = require('directory-tree');
const path = require('path');
const fs = require('fs');
const rewriteTree = require('./tree').rewriteTree;
const readTextfileTree = require('./tree').readTextfileTree;
const flattenTree = require('./tree').flattenTree;
const mimeTree = require('./tree').mimeTree;
const cloneDeep = require('clone-deep');

const debug = require('debug')('finder:transform');

const pick = require('lodash.pick');
// rolling queue of the last n transformations
const CircularBuffer = require('circular-buffer');

const transformLog = new CircularBuffer(config.sync.logsize);
debug('Logging last %s transformations in %s', transformLog.capacity(), transformLog);

// transform functions for node-elasticsearch-sync
transformCompendium = function (watcher, compendium, cb) {
    let id = compendium.id;
    debug('Transforming compendium %s', id);

    try {
        // shift IDs so that matching is made based on Mongo's _id
        compendium.compendium_id = compendium.id;
        compendium.id = compendium._id.toString(); // see https://github.com/toystars/node-elasticsearch-sync/issues/13
        delete compendium._id;
        delete compendium.__v;

        /*
         * create file tree from file directory if:
         *
         * 1. compendium.files is not yet defined or
         * 2. config.fs.reloadCompendiumFileTree is set to true
         */
        if (typeof compendium.files === 'undefined' || config.fs.fileTree.reload) {
            // load file tree
            let tree = null;
            fullPath = path.join(config.fs.compendium, id);
            fs.accessSync(fullPath); // throws if does not exist
            tree = dirTree(fullPath);

            // create file tree for metadata
            if (tree) {
                // rewrite copy of tree to API urls, taken from o2r-muncher
                let apiTree = rewriteTree(cloneDeep(tree),
                    fullPath.length, // remove local fs path and id
                    '/api/v1/compendium/' + id + '/data' // prepend proper location
                );
                compendium.files = apiTree;
            }

            // load content of txt files as flat list
            if (tree) {
                let textTree = mimeTree(cloneDeep(tree));
                readTextfileTree(textTree);
                let list = [];
                flattenTree(textTree,
                    config.fs.compendium.length + config.id_length + 1, // make path relative to compendium root
                    list);
                compendium.texts = list;
            }

        }

        // attach binary files as base64
        // > https://www.elastic.co/guide/en/elasticsearch/plugins/current/mapper-attachments-usage.html
        // > as nested documents to have many
        //   > http://grokbase.com/t/gg/elasticsearch/148v29ymaf/how-can-we-index-array-of-attachments
        //   > https://www.elastic.co/guide/en/elasticsearch/reference/current/nested.html

        // remove non o2r metadata
        compendium.metadata = pick(compendium.metadata, ['o2r']);

        transformLog.enq({ time: new Date().toISOString(), compendium: id, transform: 'successful' });
        debug('Transformed compendium %s', id);
        cb(compendium);
    } catch (e) {
        transformLog.enq({ time: new Date().toISOString(), compendium: id, transform: 'error: ' + e.message });
        debug('Error while transforming %s : %s', id, e.message);
        cb(null, new Error('Error while transforming: ' + e.message));
    }
};

transformJob = function (watcher, job, cb) {
    debug('Transforming job %s', job.id);

    // shift IDs
    job.job_id = job.id;
    job.id = job._id;
    delete job._id;
    delete job.__v;

    debug('Transformed job %s', job.id);
    cb(job);
};

module.exports = {
    compendium: transformCompendium,
    job: transformJob,
    log: transformLog
};
