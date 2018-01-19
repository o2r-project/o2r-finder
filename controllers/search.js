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
const sizeof = require('object-sizeof');
const util = require('util');

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

    let indices = config.elasticsearch.default_indices;
    if (req.query.resources) {
        if (req.query.resources === "all") {
            indices = config.elasticsearch.default_indices;
        } else {
            queryIndices = req.query.resources.split(',').map(f => { return f.trim(); }).filter(String);
            if ((queryIndices).includes("all"))
                indices = config.elasticsearch.default_indices;
            else if (queryIndices.length > 0)
                indices = queryIndices.join(',');

        }
    }

    if (config.elasticsearch.supportURISearch) {
        if (queryString.includes('://')) {
            // remove colon from query string to allow exact matching for URIs in elasticsearch
            queryString = '//' + queryString.split('://')[1];
        }
    }

    // escape forward slashes ("/") with ("\/")
    queryString = queryString.replace(/\//g, '\\$&');

    body = {
        query: {
            bool: {
                should: [
                    {
                        query_string: {
                            fields: ["_all", config.elasticsearch.specialCharField],
                            query: queryString
                        }
                    }
                ]
            }
        }
    };

    debug('Starting a simple search on indices %s: %s', indices, util.inspect(body, { depth: null, color: true }));

    esclient.search({
        index: indices,
        body: body
    }).then(function (resp) {
        debug('Simple query successful. Got %s results and took %s ms', resp.hits.total, resp.took);
        answer = buildAnswer(resp);
        res.status(200).send(answer);
        debug('Sent response of size %sB', sizeof(answer));
    }).catch(function (err) {
        debug('Error querying index: %s', util.inspect(err, {color: true}));
        if (err.root_cause && err.root_cause[0].reason) {
            res.status(err.status).send({ error: err.root_cause[0].reason });
        } if (err.displayName) {
            res.status(err.status).send({ error: err.displayName });
        } else {
            res.status(err.status).send({ error: 'simple query failed' });
        }
    });
};

exports.complexSearch = (req, res) => {
    if (typeof req.body === 'undefined') {
        debug('No query body provided, returning error.');
        res.status(400).send({ error: 'no query provided' });
        return;
    }

    debug('Starting a complex search for query %s', util.inspect(req.body, {depth: null, color: true}));

    esclient.search({
        index: config.elasticsearch.default_indices,
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
