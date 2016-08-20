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

const config = require('./config/config');
const debug = require('debug')('finder');

const ESMongoSync = require('node-elasticsearch-sync');

var fs = require('fs');
var dirTree = require('directory-tree');
var rewriteTree = require('./lib/tree').rewriteTree;
var mimeTree = require('./lib/tree').mimeTree;
var readTextfileTree = require('./lib/tree').readTextfileTree;
var cloneDeep = require('clone-deep');

// database connection for user authentication, ESMongoSync has own connection
const mongoose = require('mongoose');
mongoose.connect(config.mongo.location + config.mongo.database);
mongoose.connection.on('error', () => {
  console.log('could not connect to mongodb on ' + config.mongo.location + config.mongo.collection + ', ABORT');
  process.exit(2);
});

// rolling queue of the last n transformations
var CircularBuffer = require("circular-buffer");
var transformLog = new CircularBuffer(config.sync.logsize);
debug("Logging last %s transformations in %s", transformLog.capacity(), transformLog);

// Express modules and tools
var compression = require('compression');
var express = require('express');
var app = express();
app.use(compression());

app.use((req, res, next) => {
  debug(req.method + ' ' + req.path);
  next();
});

// passport & session modules for authenticating users.
var User = require('./lib/model/user');
var passport = require('passport');
var session = require('express-session');
var MongoDBStore = require('connect-mongodb-session')(session);

passport.serializeUser((user, cb) => {
  cb(null, user.orcid);
});
passport.deserializeUser((id, cb) => {
  debug("Deserialize for %s", id);
  User.findOne({ orcid: id }, (err, user) => {
    if (err) cb(err);
    cb(null, user);
  });
});

// configure express-session, stores reference to authdetails in cookie.
// authdetails themselves are stored in MongoDBStore
var mongoStore = new MongoDBStore({
  uri: config.mongo.location + config.mongo.database,
  collection: config.mongo.collection.session
});
mongoStore.on('error', err => {
  debug(err);
});
app.use(session({
  secret: config.sessionsecret,
  resave: true,
  saveUninitialized: true,
  maxAge: config.session.cookieMaxAge,
  store: mongoStore
}));
app.use(passport.initialize());
app.use(passport.session());

/*
 * authentication-enabled status endpoint
 */
app.get('/status', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (!req.isAuthenticated() || req.user.level < config.user.level.view_status) {
    res.status(401).send('{"error":"not authenticated or not allowed"}');
    return;
  }

  var response = {
    name: "finder",
    version: config.version,
    levels: config.user.level,
    mongodb: config.mongo,
    filesystem: config.fs,
    transformationLog: transformLog.toarray()
  };
  res.send(response);
});

app.listen(config.net.port, () => {
  debug('finder '+  config.version.major + '.' + config.version.minor + '.' +
      config.version.bug + ' with api version ' + config.version.api +
      ' waiting for requests on port ' + config.net.port);
});


/*
 * MongoDB to Elasticsearch syncing
 */

// transform functions for node-elasticsearch-sync
var transformCompendium = function (watcher, compendium, cb) {
  var id = compendium.id;
  debug('Transforming compendium %s', id);

  try {
    // shift IDs
    compendium.compendium_id = compendium.id;
    compendium.id = compendium._id;
    delete compendium._id;
    delete compendium.__v;

    // load file tree
    var tree = null;
    fs.accessSync(config.fs.compendium + id); // throws if does not exist
    tree = dirTree(config.fs.compendium + id);
    tree = mimeTree(tree);

    // create file index for metadata
    if (tree) {
      // rewrite copy of tree to API urls, taken from o2r-muncher
      compendium.files = rewriteTree(cloneDeep(tree),
        config.fs.compendium.length + config.id_length, // remove local fs path and id
        '/api/v1/compendium/' + id + '/data' // prepend proper location
      );
    }

    // load content of txt files
    if (tree) {
      compendium.texts = readTextfileTree(cloneDeep(tree));
      delete compendium.texts.path;
    }

    // attach binary files as base64
    // > https://www.elastic.co/guide/en/elasticsearch/plugins/current/mapper-attachments-usage.html
    // > as nested documents to have many
    //   > http://grokbase.com/t/gg/elasticsearch/148v29ymaf/how-can-we-index-array-of-attachments
    //   > https://www.elastic.co/guide/en/elasticsearch/reference/current/nested.html

    transformLog.enq({ time: new Date().toISOString(), compendium: id, transform: "successful" });
    debug("Done with compendium %s", id);
    cb(compendium);
  } catch (e) {
    transformLog.enq({ time: new Date().toISOString(), compendium: id, transform: "error: " + e.message });
    debug("Error while transforming %s : %s", id, e.message);
    cb(null);
  }
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
  collectionName: config.mongo.collection.compendia,
  index: config.elasticsearch.index, // elastic search index
  type: config.elasticsearch.type.compendia, // elastic search type
  transformFunction: transformCompendium, // can be null if no transformation is needed to be done
  fetchExistingDocuments: config.sync.fetchExisting.compendia, // this will fetch all existing document in collection and index in elastic search
  priority: 0 // defines order of watcher processing. Watchers with low priorities get processed ahead of those with high priorities
};
var jobsWatcher = {
  collectionName: config.mongo.collection.jobs,
  index: config.elasticsearch.index,
  type: config.elasticsearch.type.jobs,
  transformFunction: transformJob,
  fetchExistingDocuments: config.sync.fetchExisting.jobs,
  priority: 10
};

watchers.push(compendiaWatcher, jobsWatcher);

var init = function () {
  debug('Initialized finder in version %s.%s.%s', config.version.major, config.version.minor, config.version.bug);
}

// See https://github.com/toystars/node-elasticsearch-sync/blob/master/SAMPLE.js for options
ESMongoSync.init(config.mongo.location + config.mongo.database, config.elasticsearch.location, init, watchers, config.sync.bulkIndexingDocumentCount);