/*
 * (C) Copyright 2016 o2r project
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

const c = require('./config/config');
const debug = require('debug')('finder');

//const express = require('express');
//const mongoose = require('mongoose');

const ESMongoSync = require('node-elasticsearch-sync');

var fs = require('fs');
var dirTree = require('directory-tree');
var rewriteTree = require('./lib/tree').rewriteTree;
var mimeTree = require('./lib/tree').mimeTree;
var readTextfileTree = require('./lib/tree').readTextfileTree;
var cloneDeep = require('clone-deep');


// transform functions for node-elasticsearch-sync
var transformCompendium = function (watcher, compendium, cb) {
  var id = compendium.id;
  debug('Transforming compendium %s', id);
  
  // shift IDs
  compendium.compendium_id = compendium.id;
  compendium.id = compendium._id;
  delete compendium._id;
  delete compendium.__v;

  // load file tree
  var tree = null;
  try {
    fs.accessSync(c.fs.compendium + id); // throws if does not exist

    tree = dirTree(c.fs.compendium + id);
  } catch (e) {
    debug("Error loading file tree while transforming %s : %s", id, e);
  }

  tree = mimeTree(tree);

  // create file index for metadata
  if(tree) {
    // rewrite copy of tree to API urls, taken from o2r-muncher
    compendium.files = rewriteTree(cloneDeep(tree),
      c.fs.compendium.length + c.id_length, // remove local fs path and id
      '/api/v1/compendium/' + id + '/data' // prepend proper location
    );
  }

  // load content of txt files
  if(tree) {
    compendium.texts = readTextfileTree(cloneDeep(tree));
    delete compendium.texts.path;
  }

  // attach binary files as base64
  // > https://www.elastic.co/guide/en/elasticsearch/plugins/current/mapper-attachments-usage.html
  // > as nested documents to have many
  //   > http://grokbase.com/t/gg/elasticsearch/148v29ymaf/how-can-we-index-array-of-attachments
  //   > https://www.elastic.co/guide/en/elasticsearch/reference/current/nested.html

  cb(compendium);
};

var transformJob = function (watcher, job, cb) {
  debug('Transforming job %s', job.id);

  // shift IDs
  job.job_id = job.id;
  job.id = job._id;
  delete job._id;
  delete job.__v;
  cb(job);
};

// watchers for node-elasticsearch-sync
var watchers = [];
var compendiaWatcher = {
  collectionName: c.mongo.collection.compendia,
  index: c.elasticsearch.index, // elastic search index
  type: c.elasticsearch.type.compendia, // elastic search type
  transformFunction: transformCompendium, // can be null if no transformation is needed to be done
  fetchExistingDocuments: c.sync.fetchExisting.compendia, // this will fetch all existing document in collection and index in elastic search
  priority: 0 // defines order of watcher processing. Watchers with low priorities get processed ahead of those with high priorities
};
var jobsWatcher = {
  collectionName: c.mongo.collection.jobs,
  index: c.elasticsearch.index,
  type: c.elasticsearch.type.jobs,
  transformFunction: transformJob,
  fetchExistingDocuments: c.sync.fetchExisting.jobs,
  priority: 10
};

watchers.push(compendiaWatcher, jobsWatcher);

var init = function () {
  debug('Initialized finder in version %s.%s.%s', c.version.major, c.version.minor, c.version.bug);
}

// See https://github.com/toystars/node-elasticsearch-sync/blob/master/SAMPLE.js for options
ESMongoSync.init(c.mongo.location + c.mongo.database, c.elasticsearch.location, init, watchers, c.sync.bulkIndexingDocumentCount);

// Potentially expose controlling features (disconnect, reconnet, destroy + re-initialize) via HTTP?