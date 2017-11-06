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
var c = {};
c.version = {};
c.net = {};
c.mongo = {};
c.elasticsearch = {};
var env = process.env;

// Information about finder
c.version = require('../package.json').version;
c.api_version = 1;

// network & databases
c.net.port = env.FINDER_PORT || 8084;
c.mongo.location = env.FINDER_MONGODB || 'mongodb://localhost/';
c.mongo.database = env.FINDER_MONGODB_DATABASE || 'muncher';
c.mongo.initial_connection_attempts = 30;
c.mongo.initial_connection_max_delay = 5000;
c.mongo.initial_connection_initial_delay = 1000;

// fix mongo location if trailing slash was omitted
if (c.mongo.location[c.mongo.location.length - 1] !== '/') {
    c.mongo.location += '/';
}

if(!env.MONGO_OPLOG_URL) {
    env.MONGO_OPLOG_URL = c.mongo.location + c.mongo.database;
}
if(!env.MONGO_DATA_URL) {
    env.MONGO_DATA_URL = c.mongo.location + c.mongo.database;
}
if(!env.BATCH_COUNT) {
    env.BATCH_COUNT = 20;
}

c.mongo.collection = {};
c.mongo.collection.compendia = env.FINDER_MONGODB_COLL_COMPENDIA || 'compendia';
c.mongo.collection.jobs = env.FINDER_MONGODB_COLL_JOBS || 'jobs';
c.mongo.collection.session = env.FINDER_MONGODB_COLL_SESSION || 'sessions';

c.elasticsearch.apiVersion = '5.5';
c.elasticsearch.index = env.FINDER_ELASTICSEARCH_INDEX || 'o2r';
c.elasticsearch.deleteIndexOnStartup = true;
c.elasticsearch.putMappingOnStartup = true;
c.elasticsearch.type = {};
c.elasticsearch.type.compendia = env.FINDER_ELASTICSEARCH_TYPE_COMPENDIA || 'compendia';
c.elasticsearch.type.jobs = env.FINDER_ELASTICSEARCH_TYPE_JOBS || 'jobs';

c.elasticsearch.location = env.ELASTIC_SEARCH_URL || 'http://localhost:9200';
c.elasticsearch.analyzer = 'doi_analyzer';
c.elasticsearch.specialCharField = '_special';

c.elasticsearch.supportURISearch = true;

// startup
c.start = {};
c.start.attempts = env.FINDER_START_PING_ATTEMPS || 6;
c.start.pauseSeconds = 5;

// sync settings
c.sync = {};
c.sync.fetchExisting = {};
c.sync.fetchExisting.compendia = true;
c.sync.fetchExisting.jobs = true;
c.sync.logsize = parseInt(env.FINDER_STATUS_LOGSIZE) || 20;

// session secret
c.sessionsecret = env.SESSION_SECRET || 'o2r';

// authentication levels
c.user = {};
c.user.level = {};
c.user.level.view_status = 500;

c.session = {};
c.session.cookieMaxAge = 60 * 60 * 24 * 7; // one week

// fs paths
c.fs = {};
c.fs.base = env.FILE_BASEPATH || '/tmp/o2r/';
c.fs.compendium = c.fs.base + 'compendium/';

// file tree creation from local files
c.fs.fileTree = {};
c.fs.fileTree.reload = false;
c.fs.fileTree.failOnError = true; //todo implement to not fail on sync error

c.id_length = 5; // must match other services

module.exports = c;
