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

const config = require('../config/config');
const debug = require('debug')('finder');
const pick = require('lodash.pick');
const unset = require('lodash.unset');

const elasticsearch = require('elasticsearch');
const esclient = new elasticsearch.Client({
    host: config.elasticsearch.location,
    log: 'info'
});

const unset_hit_properties = ["_index", "_type", "_id"];

// build answer manually to only include public information (drop _index fields etc.)
buildAnswer = (resp) => {
    answer = {};
    answer.hits = {};
    answer.hits = pick(resp.hits, ["total", "max_score"]);
    answer.hits.hits = resp.hits.hits.map(h => {
        hit = pick(h, ["_score", "_source"]);
        ["id", "createdAt", "updatedAt"].forEach(e => unset(hit._source, e));
        return (hit);
    });
    return (answer);
};

exports.simpleSearch = (req, res) => {
    if (typeof req.query.q === 'undefined') {
        debug('No query string provided, returning error.');
        res.status(404).send({ error: 'no query provided' });
        return;
    }

    let queryString = decodeURIComponent(req.query.q);

    if (config.elasticsearch.supportURISearch) {
        if (queryString.includes('://')) {
            // remove colon from query string to allow exact matching for URIs in elasticsearch
            queryString = '//' + queryString.split('://')[1];
        }
    }

    // escape forward slashes ("/") with ("\/")
    queryString = queryString.replace(/\//g, '\\$&');

    debug('Starting a simple search for query %s', queryString);

    esclient.search({
        index: config.elasticsearch.index,
        body: {
            query: {
                bool: {
                    should: [
                        { query_string: { default_field: "_all", query: queryString } },
                        { query_string: { default_field: config.elasticsearch.specialCharField, query: queryString } },
                    ]
                }
            }
        }
    }).then(function (resp) {
        debug('Simple query successful. Got %s results and took %s ms', resp.hits.total, resp.took);
        answer = buildAnswer(resp);
        res.status(200).send(answer);
        debug('Sent response.');
    }).catch(function (err) {
        debug('Error querying index: %s', err);
        if (err.root_cause && err.root_cause[0].reason) {
            res.status(err.status).send({ error: err.root_cause[0].reason });
        } else {
            res.status(err.status).send({ error: 'simple query failed' });
        }
    });
};

exports.complexSearch = (req, res) => {
    if (typeof req.body === 'undefined') {
        debug('No query string provided, returning error.');
        res.status(404).send({ error: 'no query provided' });
        return;
    }

    debug('Starting a complex search for query %s', JSON.stringify(req.body));

    esclient.search({
        index: config.elasticsearch.index,
        body: req.body,
    }).then(function (resp) {
        debug('Complex query successful. Got %s results and took %s ms', resp.hits.total, resp.took);
        answer = buildAnswer(resp);
        res.status(200).send(answer);
        debug('Sent response.');
    }).catch(function (err) {
        debug('Error querying index: %s', err);
        if (err.root_cause && err.root_cause[0].reason) {
            res.status(err.status).send({ error: err.root_cause[0].reason });
        } else {
            res.status(err.status).send({ error: 'complex query failed' });
        }
    });
};
