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
const watchers = require('./lib/watchers');
const transformLog = require('./lib/transform').log;
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

// database connection for user authentication, ESMongoSync has own connection
const mongoose = require('mongoose');
const backoff = require('backoff');

const dbURI = config.mongo.location + config.mongo.database;
var dbOptions = {
    autoReconnect: true,
    reconnectTries: Number.MAX_VALUE,
    keepAlive: 30000,
    socketTimeoutMS: 30000,
    promiseLibrary: global.Promise, // use ES6 promises for mongoose    
    useNewUrlParser: true
    
};
mongoose.connection.on('error', (err) => {
    debug('Could not connect to MongoDB @ %s: %s', dbURI, err);
});

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
                debug('Existing index %s successfully deleted. Response: %o', indexToCreate, resp);
                debug('Recreating index with settings %O', esSettings.settings);
                return esclient.indices.create({
                    index: indexToCreate,
                    body: esSettings.settings
                });
            } else if (!resp) {
                debug('Creating index %s with because it does not exist yet, using settings %O', indexToCreate, esSettings.settings);
                return esclient.indices.create({
                    index: indexToCreate,
                    body: esSettings.settings
                });
            } else {
                debug('Working with existing index %s.', indexToCreate);
                return false;
            }
        }).then(function (resp) {
            debug('Index (re)created? %o', resp);
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
                startSyncWithRetry(watcherArray, maximumNumberOfAttempts, pauseSeconds);
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

