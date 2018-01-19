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

const config = require('./config/config');
const esMappings = require('./config/mapping');
const esSettings = require('./config/settings');
const debug = require('debug')('finder');

// MongoDB > Elasticsearch sync
const ESMongoSync = require('node-elasticsearch-sync');


// standalone Elasticsearch client
const elasticsearch = require('elasticsearch');
const esclient = new elasticsearch.Client({
    host: config.elasticsearch.location,
    log: 'info',
    apiVersion: config.elasticsearch.apiVersion
});

const fs = require('fs');
const dirTree = require('directory-tree');
const rewriteTree = require('./lib/tree').rewriteTree;
const readTextfileTree = require('./lib/tree').readTextfileTree;
const flattenTree = require('./lib/tree').flattenTree;
const mimeTree = require('./lib/tree').mimeTree;
const cloneDeep = require('clone-deep');

// database connection for user authentication, ESMongoSync has own connection
const mongoose = require('mongoose');
const backoff = require('backoff');

const dbURI = config.mongo.location + config.mongo.database;
var dbOptions = {
    autoReconnect: true,
    reconnectTries: Number.MAX_VALUE,
    keepAlive: 30000,
    socketTimeoutMS: 30000,
    useMongoClient: true,
    promiseLibrary: global.Promise // use ES6 promises for mongoose    
};
mongoose.connection.on('error', (err) => {
    debug('Could not connect to MongoDB @ %s: %s', dbURI, err);
});

// rolling queue of the last n transformations
const CircularBuffer = require('circular-buffer');
const transformLog = new CircularBuffer(config.sync.logsize);
debug('Logging last %s transformations in %s', transformLog.capacity(), transformLog);

// Express modules and tools
const compression = require('compression');
const express = require('express');
const app = express();
const responseTime = require('response-time');
const bodyParser = require('body-parser');

// load controllers
const search = require('./controllers/search');

app.use(compression());

app.use((req, res, next) => {
    debug(req.method + ' ' + req.path);
    next();
});

app.use(responseTime());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// passport & session modules for authenticating users.
const User = require('./lib/model/user');
const passport = require('passport');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

passport.serializeUser((user, cb) => {
    cb(null, user.orcid);
});
passport.deserializeUser((id, cb) => {
    debug('Deserialize for %s', id);
    User.findOne({ orcid: id }, (err, user) => {
        if (err) cb(err);
        cb(null, user);
    });
});

function initApp(callback) {
    debug('Initialize application');

    try {
        // configure express-session, stores reference to auth details in cookie.
        // auth details themselves are stored in MongoDBStore
        const mongoStore = new MongoDBStore({
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
         * configure routes
         */
        app.get('/api/v1/search', search.simpleSearch);
        app.post('/api/v1/search', search.complexSearch);

        /*
         * authentication-enabled status endpoint
         */
        app.get('/status', function (req, res) {
            res.setHeader('Content-Type', 'application/json');
            if (!req.isAuthenticated() || req.user.level < config.user.level.view_status) {
                res.status(401).send('{"error":"not authenticated or not allowed"}');
                return;
            }

            let response = {
                name: 'finder',
                version: config.version,
                levels: config.user.level,
                mongodb: config.mongo,
                filesystem: config.fs,
                transformationLog: transformLog.toarray()
            };

            // add status info from elasticsearch to response
            Promise.all([
                esclient.indices.stats({ human: true }),
                esclient.info()
            ]).then(values => {
                response.elasticsearch = {};
                response.elasticsearch.status = values[1];
                response.elasticsearch.indices = values[0].indices;
                res.send(response);
            }, error => {
                debug('Error getting info from Elasticsearch: %s', error.message);
                response.elasticsearch = error;
            }).catch(error => {
                debug('Error handling promises\' results from Elasticsearch: %s', error.message);
                res.send(response);
            });
        });

        /*
         * Elasticsearch indexes and mappings setup
         */
        Promise.all([
            createIndexAndPutMappings(config.elasticsearch.index.compendia),
            createIndexAndPutMappings(config.elasticsearch.index.jobs)
        ]).then(function (resp) {
            debug('Indexes %s created and mappings configured?',
                JSON.stringify([config.elasticsearch.index.compendia, config.elasticsearch.index.jobs]),
                JSON.stringify(resp));

            startSyncWithRetry(watchers, config.start.attempts, config.start.pauseSeconds);

            /*
            * final startup message
            */
            const server = app.listen(config.net.port, () => {
                debug('finder %s with API version %s waiting for requests on port %s',
                    config.version,
                    config.api_version,
                    config.net.port);
            });

        }).catch(function (err) {
            debug('Error creating index or mapping: %s', err);
            callback(err);
        });
    } catch (err) {
        callback(err);
    }

    callback(null);
}

function createIndexAndPutMappings(indexToCreate) {
    return esclient.indices.exists({ index: indexToCreate })
        .then(function (resp) {
            // Delete possibly existing index if deleteIndexOnStartup is true
            if (resp) {
                debug('Index %s already exists.', indexToCreate);
                if (config.elasticsearch.deleteIndexOnStartup) {
                    debug('Deleting elasticsearch index %s.', indexToCreate);
                    return esclient.indices.delete({ index: indexToCreate });
                } else {
                    debug('Index %s already exists and will not be recreated. Make sure that the mapping is compatible.', indexToCreate);
                    return resp;
                }
            } else {
                debug('Index %s not found.', indexToCreate);
                return false;
            }
        }).then(function (resp) {
            // Create a new index if: 1) index was deleted in the last step 2) index didn't exist in the beginning
            if (typeof resp === 'object' && resp.acknowledged) {
                debug('Existing index %s successfully deleted. Response: %s', indexToCreate, JSON.stringify(resp));
                debug('Recreating index with settings: %s', JSON.stringify(esSettings.settings));
                return esclient.indices.create({
                    index: indexToCreate,
                    body: esSettings.settings
                });
            } else if (!resp) {
                debug('Creating index %s with settings %s because it does not exist yet.', indexToCreate, JSON.stringify(esSettings.settings));
                return esclient.indices.create({
                    index: indexToCreate,
                    body: esSettings.settings
                });
            } else {
                debug('Working with existing index %s.', indexToCreate);
                return false;
            }
        }).then(function (resp) {
            debug('Index (re)created? %s', JSON.stringify(resp));
            if (config.elasticsearch.putMappingOnStartup) {
                mapping = esMappings[indexToCreate];
                if (mapping) {
                    debug('Using mapping found in "config/mapping.js" for index %s: %s', indexToCreate, mapping);
                    return esclient.indices.putMapping({
                        index: indexToCreate,
                        type: indexToCreate,
                        body: mapping
                    });
                } else {
                    debug('No mapping found in "config/mapping.js" for index %s', indexToCreate);
                    return true;
                }
            } else {
                debug('Not creating mapping because "config.elasticsearch.putMappingOnStartup" is deactivated.');
                return false;
            }
        });
}

// transform functions for node-elasticsearch-sync
const transformCompendium = function (watcher, compendium, cb) {
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
            fs.accessSync(config.fs.compendium + id); // throws if does not exist
            tree = dirTree(config.fs.compendium + id);

            // create file tree for metadata
            if (tree) {
                // rewrite copy of tree to API urls, taken from o2r-muncher
                let apiTree = rewriteTree(cloneDeep(tree),
                    config.fs.compendium.length + config.id_length, // remove local fs path and id
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

        transformLog.enq({ time: new Date().toISOString(), compendium: id, transform: 'successful' });
        debug('Transformed compendium %s', id);
        cb(compendium);
    } catch (e) {
        transformLog.enq({ time: new Date().toISOString(), compendium: id, transform: 'error: ' + e.message });
        debug('Error while transforming %s : %s', id, e.message);
        cb(null, new Error('Error while transforming: ' + e.message));
    }
};

const transformJob = function (watcher, job, cb) {
    debug('Transforming job %s', job.id);

    // shift IDs
    job.job_id = job.id;
    job.id = job._id;
    delete job._id;
    delete job.__v;

    debug('Transformed job %s', job.id);
    cb(job);
};

// watchers for node-elasticsearch-sync
const watchers = [];
const compendiaWatcher = {
    collectionName: config.mongo.collection.compendia,
    index: config.elasticsearch.index.compendia, // elastic search index
    type: config.elasticsearch.index.compendia, // elastic search type
    transformFunction: transformCompendium, // can be null if no transformation is needed to be done
    fetchExistingDocuments: config.sync.fetchExisting.compendia, // this will fetch all existing document in collection and index in elastic search
    priority: 1 // defines order of watcher processing. Watchers with low priorities get processed ahead of those with high priorities
};
const jobsWatcher = {
    collectionName: config.mongo.collection.jobs,
    index: config.elasticsearch.index.jobs,
    type: config.elasticsearch.index.jobs,
    transformFunction: transformJob,
    fetchExistingDocuments: config.sync.fetchExisting.jobs,
    priority: 2
};

watchers.push(compendiaWatcher, jobsWatcher);

// http://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let attempts = 1;

function startSyncWithRetry(watcherArray, maximumNumberOfAttempts, pauseSeconds) {
    if (attempts > maximumNumberOfAttempts) {
        debug('NOT STARTED, number of attempts to connect to Elasticsearch at %s (%s) has been reached.', process.env['ELASTIC_SEARCH_URL'], maximumNumberOfAttempts);

        process.exit(1);
    }

    // try to connect to ES before starting sync
    let EsClient = new elasticsearch.Client({
        host: process.env['ELASTIC_SEARCH_URL'],
        keepAlive: true,
        apiVersion: config.elasticsearch.apiVersion
    });
    debug('Ping Elasticsearch @ %s', process.env['ELASTIC_SEARCH_URL']);
    EsClient.ping({
        requestTimeout: 2000
    }, function (error, response, status) {
        if (error) {
            debug('ElasticSearch no reachable, trying again in %s seconds', pauseSeconds);
            attempts++;
            sleep(pauseSeconds * 1000).then(() => {
                startSyncWithRetry(watchers, maximumNumberOfAttempts, pauseSeconds);
            });
        } else {
            debug('Pinged ElasticSearch at %s with result %s (status %s)', process.env['ELASTIC_SEARCH_URL'], response, status);

            // See https://github.com/toystars/node-elasticsearch-sync/blob/master/SAMPLE.js for options
            // See also https://github.com/toystars/node-elasticsearch-sync/issues/10
            debug('Starting ESMongoSync with mongo data "%s" | mongo oplog "%s" | elasticsearch "%s" | batch count "%s" | watchers: \n',
                process.env['MONGO_DATA_URL'],
                process.env['MONGO_OPLOG_URL'],
                process.env['ELASTIC_SEARCH_URL'],
                process.env['BATCH_COUNT'],
                JSON.stringify(watchers));

            ESMongoSync.init(watcherArray, null, () => {
                debug('ESMongoSync initialized');
            });
        }
    });

}

var dbBackoff = backoff.fibonacci({
    randomisationFactor: 0,
    initialDelay: config.mongo.initial_connection_initial_delay,
    maxDelay: config.mongo.initial_connection_max_delay
});

dbBackoff.failAfter(config.mongo.initial_connection_attempts);
dbBackoff.on('backoff', function (number, delay) {
    debug('Trying to connect to MongoDB (#%s) in %sms', number, delay);
});
dbBackoff.on('ready', function (number, delay) {
    debug('Connect to MongoDB (#%s)', number, delay);
    mongoose.connect(dbURI, dbOptions, (err) => {
        if (err) {
            debug('Error during connect: %s', err);
            mongoose.disconnect(() => {
                debug('Mongoose: Disconnected all connections.');
            });
            dbBackoff.backoff();
        } else {
            // delay app startup to when MongoDB and Elasticsearch are available
            debug('Initial connection open to %s: %s', dbURI, mongoose.connection.readyState);
            initApp((err) => {
                if (err) {
                    debug('Error during init!\n%s', err);
                    mongoose.disconnect(() => {
                        debug('Mongoose: Disconnected all connections.');
                    });
                    dbBackoff.backoff();
                }
            });
        }
    });
});
dbBackoff.on('fail', function () {
    debug('Eventually giving up to connect to databases');
    process.exit(1);
});

dbBackoff.backoff();

