/*
 * (C) Copyright 2017 o2r project.
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

// General modules
const config = require('../config/config');
const debug = require('debug')('finder:search');

// standalone Elasticsearch client
const elasticsearch = require('elasticsearch');
const esclient = new elasticsearch.Client({
    host: config.elasticsearch.location,
    log: 'info'
});


exports.simpleSearch = (req, res) => {
    // check user level
    if (!req.isAuthenticated()) {
        res.status(401).send('{"error":"user is not authenticated"}');
        return;
    }

    // if (req.user.level < config.user.level.create_compendium) {
    //     res.status(401).send('{"error":"user level does not allow compendium creation"}');
    //     return;
    // }

    if (typeof req.query.q === 'undefined') {
        debug('no query string provided, aborting');
        res.status(404).send('{"error":"no query provided"}');
        return;
    }

    let query = req.query.q;
    debug('Starting a simple search for query %s', query);


    esclient.search({
        index: config.elasticsearch.index,
        q: query
    }).then(function (resp) {
        //debug('Query successful. Got %s results', JSON.stringify(resp));
        //todo send json response
        res.status(200).send(resp);
    }).catch(function (err) {
        debug('Error querying index: %s', err);
        //todo do not expose full elasticsearch error messages
        res.status(500).send({error: err});
    });
};

exports.complexSearch = (req, res) => {
    debug();

    // check user level
    if (!req.isAuthenticated()) {
        res.status(401).send('{"error":"user is not authenticated"}');
        return;
    }

    // if (req.user.level < config.user.level.create_compendium) {
    //     res.status(401).send('{"error":"user level does not allow compendium creation"}');
    //     return;
    // }

    if (typeof req.body === 'undefined') {
        debug('no query defined, aborting');
        res.status(404).send('{"error":"no query provided"}');
        return;
    }

    debug('Starting a complex search for query %s', req.body);

    esclient.search({
        index: config.elasticsearch.index,
        body: req.body
    }).then(function (resp) {
        //debug('Query successful. Got %s results', JSON.stringify(resp));
        //todo send json response
        res.status(200).send(resp);
    }).catch(function (err) {
        debug('Error querying index: %s', err);
        //todo do not expose full elasticsearch error messages
        res.status(500).send({error: err});
    });

};
