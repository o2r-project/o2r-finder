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

/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');

const mongojs = require('mongojs');
const sleep = require('sleep');

require("./setup");
const importJSONCompendium = require('./util').importJSONCompendium;
const importJSONJob = require('./util').importJSONJob;
const resetIndex = require('./util').resetIndex;

const queries = require('./queries/queries');

describe('Elasticsearch search API', function () {
    var db = mongojs('localhost/muncher', ['compendia', 'jobs']);

    before(function (done) {
        this.timeout(20000);
        db.compendia.drop(function (err, doc) {
            //if (err) console.log(err);

            db.jobs.drop(function (err2, doc) {
                //if (err2) console.log(err2);

                resetIndex()
                    .then(Promise.all([
                        importJSONCompendium('./test/compendium/finland2000.json'),
                        importJSONCompendium('./test/compendium/kongo2005.json'),
                        importJSONCompendium('./test/compendium/ruhr2010.json'),
                        importJSONCompendium('./test/compendium/brazil2015.json'),
                        importJSONJob('./test/job/success.json'),
                        importJSONJob('./test/job/failure.json')
                    ]))
                    .then(values => {
                        sleep.sleep(2);
                        console.log('Successfully created spatiotemporal test data: ${values}');
                        db.close();
                        done();
                    }, error => {
                        console.log(error);
                    }).catch(error => {
                        console.log('Error handling promises\' results: ${error.message}');
                        db.close();
                    });
            });
        });
    });

    after(function (done) {
        db.close();
        done();
    });

    describe('POST /api/v1/search with a complex query', () => {

        it('should respond with HTTP 200 OK and valid JSON when querying all documents', (done) => {
            let body = {
                "query": {
                    "match_all": {}
                }
            };

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body));
                done();
            });
        });

        it('should return results when querying all documents', (done) => {
            let body = {
                "query": {
                    "match_all": {}
                }
            };

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                response = JSON.parse(body);
                assert.property(response, 'hits');
                assert.isAtLeast(response.hits.total, 1);
                done();
            });
        });

        it('should return one result when doing a temporal query (2015-2016)', (done) => {
            let body = queries.temporal;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.equal(hits.total, 1);
                assert.lengthOf(hits.hits, 1);
                assert.equal(hits.hits[0]._source.compendium_id, '0ShuS');
                done();
            });
        });

        it('should return two results ("finland" and "ruhr") when doing a spatial query (europe)', (done) => {
            let body = queries.europe;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 2);
                done();
            });
        });

        it('should return one result ("finland") when doing a spatial intersects query (finland)', (done) => {
            let body = queries.finlandIntersects;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                assert.equal(hits.hits[0]._source.compendium_id, 'XiQu8');
                done();
            });
        });

        it('should return all results when doing a spatial disjoint query (australia)', (done) => {
            let body = queries.australiaDisjoint;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 4);
                done();
            });
        });

        it('should return one result ("kongo") when doing a spatial contains query (kongo)', (done) => {
            let body = queries.kongoKontains;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                assert.equal(hits.hits[0]._source.compendium_id, 'Ks1Bc');
                done();
            });
        });

        it('should return one result ("ruhr") when doing a spatio-temoral query (europe, 2010-2011)', (done) => {
            let body = queries.europe2010;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                assert.equal(hits.hits[0]._source.compendium_id, 'mQryh');
                done();
            });
        });

        it('should return multiple results when doing a spatio-temoral query (world, 2000-2099)', (done) => {
            let body = queries.world2015;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 4);
                done();
            });
        });

        it('should return no results when doing a spatio-temoral query (wyoming, USA, 2010-2011)', (done) => {
            let body = queries.wyoming2010;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 0);
                done();
            });
        });

        it('should return an error with HTTP 400 when doing a spatial query with an invalid GeoJSON', (done) => {
            let body = queries.invalid;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 400);
                assert.isUndefined(JSON.parse(body).result, 'returned no results');
                assert.propertyVal(JSON.parse(body), 'error', 'complex query failed');
                done();
            });
        });


    });

    describe('POST /api/v1/search with a complex query on specific index', () => {

        it('should respond with HTTP 200 OK and valid JSON when querying all compendia', (done) => {
            let body = {
                query: {
                    terms: {
                        _index: ['compendia']
                    }
                }
            };

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                response = JSON.parse(body);
                assert.isObject(response);
                done();
            });
        });

        it('should respond with all compendia', (done) => {
            let body = {
                query: {
                    terms: {
                        _index: ['compendia']
                    }
                }
            };

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                response = JSON.parse(body);
                assert.property(response, 'hits');
                assert.propertyVal(response.hits, 'total', 4);
                assert.lengthOf(response.hits.hits, 4);

                response.hits.hits.forEach(hit => {
                    assert.property(hit._source, 'metadata');
                    assert.notProperty(hit._source, 'steps');
                });

                done();
            });
        });

        it('should respond with all jobs', (done) => {
            let body = {
                query: {
                    terms: {
                        _index: ['jobs']
                    }
                }
            };

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                response = JSON.parse(body);
                assert.property(response, 'hits');
                assert.propertyVal(response.hits, 'total', 2);
                assert.lengthOf(response.hits.hits, 2);

                response.hits.hits.forEach(hit => {
                    assert.notProperty(hit._source, 'metadata');
                    assert.property(hit._source, 'steps');
                });

                done();
            });
        });
    });

    describe('POST /api/v1/search with an invalid body', () => {

        it('should respond with HTTP 400 when query is invalid', (done) => {
            let body = {
                "query": {
                    "bool": {}
                },
                "analyzer": "notdefined"
            };

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 400);
                assert.isUndefined(JSON.parse(body).result, 'returned no results');
                assert.propertyVal(JSON.parse(body), 'error', 'complex query failed');
                done();
            });
        });

        it('should not allow to modify the index', (done) => {
            request({
                uri: global.test_host + '/api/v1/search/o2r',
                method: 'DELETE'
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        });
    });

});