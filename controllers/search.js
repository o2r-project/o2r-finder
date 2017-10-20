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
const debug = require('debug')('finder');
// standalone Elasticsearch client
const elasticsearch = require('elasticsearch');
const esclient = new elasticsearch.Client({
    host: config.elasticsearch.location,
    log: 'info'
});


exports.simpleSearch = (req, res) => {
    if (typeof req.query.q === 'undefined') {
        debug('no query string provided, aborting');
        res.status(404).send('{"error":"no query provided"}');
        return;
    }

    // escape forward slashes ("/") with ("\/")
    let queryString = req.query.q.replace(/\//g, '\\$&');

    debug('Starting a simple search for query %s', queryString);

    // multi query return 2 results in a "results" array

    // let query = [
    //     // query "_all" field
    //     {index: config.elasticsearch.index, type: config.elasticsearch.type},
    //     {query: {query_string: {default_field: "_all", query: queryString}}},
    //
    //     // additionally, query "_special" field to find DOIs and URLs
    //     {index: config.elasticsearch.index, type: config.elasticsearch.type},
    //     {query: {query_string: {default_field: "_special", query: queryString}}, analyzer: config.elasticsearch.analyzer}
    // ];


    esclient.search({
        index: config.elasticsearch.index,
        body: {
            query: {
                bool: {
                    should : [
                        {query_string: {default_field: "_all", query: queryString}},
                        {query_string: {default_field: "_special", query: queryString}},
                    ]
                }
            }
        }
    }).then(function (resp) {
        debug('Simple query successful. Got %s results and took %s ms', resp.hits.total, resp.took);
        res.status(200).send(resp);
    }).catch(function (err) {
        debug('Error querying index: %s', err);
        res.status(err.status).send({error: err.root_cause[err.root_cause.length-1].reason});
    });
};

exports.complexSearch = (req, res) => {
    if (typeof req.body === 'undefined') {
        debug('no query defined, aborting');
        res.status(404).send('{"error":"no query provided"}');
        return;
    }

    debug('Starting a complex search for query %s', req.body);

    esclient.search({
        index: config.elasticsearch.index,
        body: req.body,
        //analyzer: config.elasticsearch.analyzer
    }).then(function (resp) {
        debug('Complex query successful. Got %s results and took %s ms', resp.hits.total, resp.took);
        //todo send proper json response
        res.status(200).send(resp);
    }).catch(function (err) {
        debug('Error querying index: %s', err);
        res.status(err.status).send({error: err.root_cause[err.root_cause.length-1].reason});
    });

};
