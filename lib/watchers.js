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
const transform = require('./transform');

compendiaWatcher = {
    collectionName: config.mongo.collection.compendia,
    index: config.elasticsearch.index.compendia, // elastic search index
    type: config.elasticsearch.index.compendia, // elastic search type
    transformFunction: transform.compendium, // can be null if no transformation is needed to be done
    fetchExistingDocuments: config.sync.fetchExisting.compendia, // this will fetch all existing document in collection and index in elastic search
    priority: 1 // defines order of watcher processing. Watchers with low priorities get processed ahead of those with high priorities
};

jobsWatcher = {
    collectionName: config.mongo.collection.jobs,
    index: config.elasticsearch.index.jobs,
    type: config.elasticsearch.index.jobs,
    transformFunction: transform.job,
    fetchExistingDocuments: config.sync.fetchExisting.jobs,
    priority: 2
};

module.exports = [compendiaWatcher, jobsWatcher]
