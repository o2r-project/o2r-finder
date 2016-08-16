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
var c = {};
c.version = {};
c.net = {};
c.mongo = {};
c.elasticsearch = {};
var env = process.env;

// Information about finder
c.version.major  = 0;
c.version.minor  = 1;
c.version.bug    = 0;
c.version.api    = 1;

// network & databases
//c.net.port         = env.FINDER_PORT || 8084;
c.mongo.location   = env.FINDER_MONGODB || 'mongodb://localhost/';
c.mongo.database   = env.FINDER_MONGODB_DATABASE || 'muncher';
c.mongo.collection = {};
c.mongo.collection.compendia = env.FINDER_MONGODB_COLL_COMPENDIA || 'compendia';
c.mongo.collection.jobs = env.FINDER_MONGODB_COLL_JOBS || 'jobs';

c.elasticsearch.location   = env.FINDER_ELASTICSEARCH || 'elasticsearch:9200';
c.elasticsearch.index = env.FINDER_ELASTICSEARCH_INDEX || 'o2r';
c.elasticsearch.type = {};
c.elasticsearch.type.compendia = env.FINDER_ELASTICSEARCH_TYPE_COMPENDIA || 'compendia';
c.elasticsearch.type.jobs = env.FINDER_ELASTICSEARCH_TYPE_JOBS || 'jobs';

// fix mongo location if trailing slash was omitted
if (c.mongo.location[c.mongo.location.length-1] !== '/') {
  c.mongo.location += '/';
}

// sync settings
c.sync = {};
c.sync.fetchExisting = {};
c.sync.fetchExisting.compendia = true;
c.sync.fetchExisting.jobs = true;
c.sync.bulkIndexingDocumentCount = 17;

module.exports = c;
