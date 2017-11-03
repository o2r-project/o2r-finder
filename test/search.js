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
const requestLoadingTimeout = 30000;
const requestReadingTimeout = 30000;
const importJSONCompendium = require('./util').importJSONCompendium;
const resetIndex = require('./util').resetIndex;
const waitSecs = 2;

const queries = require('./queries/queries');

describe('Elasticsearch search API', function () {

    before(function (done) {
        this.timeout(20000);
        let db = mongojs('localhost/muncher', ['users', 'sessions', 'compendia', 'jobs']);
        db.compendia.drop(function (err, doc) {
            if (err) console.log(err);

            resetIndex()
                .then(Promise.all([
                    importJSONCompendium('./test/erc/spatiotemporal/finland2000.json'),
                    importJSONCompendium('./test/erc/spatiotemporal/kongo2005.json'),
                    importJSONCompendium('./test/erc/spatiotemporal/ruhr2010.json'),
                    importJSONCompendium('./test/erc/spatiotemporal/brazil2015.json')
                ]))
                .then(values => {
                    console.log(`Sucessfully created spatiotemporal test data: ${values}`);
                    done();
                }, error => {
                    console.log(error);
                }).catch(error => {
                    console.log(`Error handling promises\' results: ${error.message}`);
                });
        });
    });

    describe('GET /api/v1/search with a simple query', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/search?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return results when querying all documents _after waiting for sync_', (done) => {
            sleep.sleep(waitSecs);
            request(global.test_host + '/api/v1/search?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isDefined(JSON.parse(body).hits, 'results returned');
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return one result when querying for a DOI ', (done) => {
            request(global.test_host + '/api/v1/search?q=10.1006%2Fjeem.1994.1031', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return one result when querying for a DOI URL', (done) => {
            request(global.test_host + '/api/v1/search?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return no results when querying for a string not contained in the compendium', (done) => {
            let randomString = 'Y2AmjvFyBC2rlTonqZnx';
            request(global.test_host + '/api/v1/search?q=' + randomString, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 0);
                done();
            });
        }).timeout(requestReadingTimeout);


    });

    describe('POST /api/v1/search with a complex query', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            let body = {
                "query": {
                    "match_all": {}
                }
            };

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return results when querying all documents', (done) => {
            let body = {
                "query": {
                    "match_all": {}
                }
            };

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isDefined(JSON.parse(body).hits, 'results returned');
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return one result when doing a temporal query (2015-2016)', (done) => {
            let body = queries.temporal;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                assert.equal(hits.hits[0]._source.compendium_id, '0ShuS');
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return two results ("finland" and "ruhr") when doing a spatial query (europe)', (done) => {
            let body = queries.europe;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 2);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return one result when doing a spatio-temoral query (europe, 2010-2011)', (done) => {
            let body = queries.europe2010;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                assert.equal(hits.hits[0]._source.compendium_id, 'mQryh');
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return multiple results when doing a spatio-temoral query (world, 2000-2099)', (done) => {
            let body = queries.world2015;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 4);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return no results when doing a spatio-temoral query (wyoming, USA, 2010-2011)', (done) => {
            let body = queries.wyoming2010;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 0);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return an error when doing a spatial query with an invalid GeoJSON', (done) => {
            let body = queries.invalid;

            request({
                uri: global.test_host + '/api/v1/search',
                method: 'POST',
                form: body,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 400);
                assert.isUndefined(JSON.parse(body).result, 'returned no results');
                assert.propertyVal(JSON.parse(body), 'error', 'complex query failed');
                done();
            });
        }).timeout(requestReadingTimeout);


    });

    describe('GET /api/v1/search with an query string containing special characters', () => {

        it('should not result in an error but return no results instead', (done) => {
            request(global.test_host + '/api/v1/search?q=////**?||\\\\', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 0);
                done();
            });
        }).timeout(requestReadingTimeout);

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
                form: body,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 400);
                assert.isUndefined(JSON.parse(body).result, 'returned no results');
                assert.propertyVal(JSON.parse(body), 'error', 'complex query failed');
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should not allow to modify the index', (done) => {
            request({
                uri: global.test_host + '/api/v1/search/o2r',
                method: 'DELETE',
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                done();
            });
        }).timeout(requestReadingTimeout);
    });

});