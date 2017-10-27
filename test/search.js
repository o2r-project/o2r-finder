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
const fse = require('fs-extra');
const config = require('../config/config');
const path = require('path');
const fs = require('fs');

const mongojs = require('mongojs');

require("./setup");
const cookie_o2r = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';
const requestLoadingTimeout = 30000;
const requestReadingTimeout = 10000;
const uploadCompendium = require('./util').uploadCompendium;
const importJSONCompendium = require('./util').importJSONCompendium;
const importJSONCompendia = require('./util').importJSONCompendia;


describe('Elasticsearch complex search', function () {

    // before(function (done) {
    //     this.timeout(10000);
    //     let db = mongojs('localhost/muncher', ['users', 'sessions', 'compendia', 'jobs']);
    //     db.compendia.drop(function (err, doc) {
    //         db.jobs.drop(function (err, doc) {
    //             done();
    //         });
    //     });
    // });

    describe('GET /api/v1/search with a simple query', () => {

        before(function (done) {
            this.timeout(10000);
            // Promise.all([
            //     importJSONCompendium('./test/erc/spatiotemporal/finland2000.json'),
            //     importJSONCompendium('./test/erc/spatiotemporal/kongo2005.json'),
            //     importJSONCompendium('./test/erc/spatiotemporal/ruhr2010.json'),
            //     importJSONCompendium('./test/erc/spatiotemporal/brazil2015.json')
            // ]).then(values => {
            //     console.log(`Sucessfully created spatiotemporal test data: ${values}`);
            //     done();
            // }, error => {
            //     console.log(error);
            // }).catch(error => {
            //     console.log(`Error handling promises\' results: ${error.message}`);
            // });
            return importJSONCompendia('./test/erc/spatiotemporal.json')
                .then(resp => {
                    console.log(`Import successful: ${resp}`);
                })
                .catch(err => {
                    console.log(`Error handling promise: ${err.message}`);
                });
        });

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/search/?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return results when querying all documents', (done) => {
            request(global.test_host + '/api/v1/search/?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isDefined(JSON.parse(body).hits, 'results returned');
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return one result when querying for a DOI', (done) => {
            request(global.test_host + '/api/v1/search/?q=10.1006%2Fjeem.1994.1031', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return one result when querying for a DOI URL', (done) => {
            request(global.test_host + '/api/v1/search/?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return no results when querying for a string not contained in the compendium', (done) => {
            request(global.test_host + '/api/v1/search/?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 0);
                done();
            });
        }).timeout(requestLoadingTimeout);


    });

    describe('POST /api/v1/search with a complex query', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/search/?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return results when querying all documents', (done) => {
            request(global.test_host + '/api/v1/search/?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isDefined(JSON.parse(body).hits, 'results returned');
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return one result when doing a temporal query (2015-2016)', (done) => {
            request(global.test_host + '/api/v1/search/?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return one result when doing a spatial query (europe)', (done) => {
            request(global.test_host + '/api/v1/search/?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return one result when doing a spatio-temoral query (europe, 2010-2011)', (done) => {
            request(global.test_host + '/api/v1/search/?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return multiple results when doing a spatio-temoral query (world, 2015-2016)', (done) => {
            request(global.test_host + '/api/v1/search/?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return no results when doing a spatio-temoral query (germany, 2010-2011)', (done) => {
            request(global.test_host + '/api/v1/search/?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return an error when doing a spatial query with an invalid GeoJSON', (done) => {
            request(global.test_host + '/api/v1/search/?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);


    });

    describe('GET /api/v1/search with an invalid query string', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/search/?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestLoadingTimeout);

    });

    describe('POST /api/v1/search with an invalid body', () => {

        it('should respond with HTTP 400 when JSON is invalid', (done) => {
            request(global.test_host + '/api/v1/search/?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should not allow to modify the index', (done) => {
            request(global.test_host + '/api/v1/search/?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isDefined(JSON.parse(body).hits, 'results returned');
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return one result when querying for a DOI', (done) => {
            request(global.test_host + '/api/v1/search/?q=10.1006%2Fjeem.1994.1031', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should return one result when querying for a DOI URL', (done) => {
            request(global.test_host + '/api/v1/search/?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestLoadingTimeout);


    });

    //...
});