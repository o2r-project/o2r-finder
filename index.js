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

/*
 * initialize node-elasticsearch-sync
 */

// transform functions
var transformCompendium = function (watcher, compendium, cb) {
  // user.fullName = user.firstName + ' ' + user.lastName;
  debug('transforming compendium %s', compendium.id);
  compendium.compendium_id = compendium.id;
  compendium.id = compendium._id;
  delete compendium._id;
  delete compendium.__v;
  cb(compendium);
};

var transformJob = function (watcher, job, cb) {
  // user.fullName = user.firstName + ' ' + user.lastName;
  debug('transforming compendium %s', job.id);
  job.job_id = job.id;
  job.id = job._id;
  delete job._id;
  delete job.__v;
  cb(job);
};

// watchers
var watchers = [];
var compendiaWatcher = {
  collectionName: 'compendia',
  index: c.elasticsearch.index, // elastic search index
  type: 'compendia', // elastic search type
  transformFunction: transformCompendium, // can be null if no transformation is needed to be done
  fetchExistingDocuments: c.sync.fetchExisting.compendia, // this will fetch all existing document in collection and index in elastic search
  priority: 0 // defines order of watcher processing. Watchers with low priorities get processed ahead of those with high priorities
};
var jobsWatcher = {
  collectionName: 'jobs',
  index: c.elasticsearch.index,
  type: 'jobs',
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