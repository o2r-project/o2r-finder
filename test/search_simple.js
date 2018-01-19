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
            if (err) console.log(err);

            db.jobs.drop(function (err2, doc2) {
                if (err2) console.log(err2);

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
                        console.log('Successfully created spatiotemporal test data: ' + JSON.stringify(values));
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

    describe('GET /api/v1/search with a simple query', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/search?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body));
                done();
            });
        });

        it('should return all results when querying with "*"', (done) => {
            request(global.test_host + '/api/v1/search?q=*', (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(JSON.parse(body).hits, 'results returned');
                assert.equal(hits.total, 6);
                done();
            });
        });

        it('should return one result when querying for a DOI ', (done) => {
            request(global.test_host + '/api/v1/search?q=10.1006%2Fjeem.1994.1031', (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                done();
            });
        });

        it('should return one result when querying for a DOI URL', (done) => {
            request(global.test_host + '/api/v1/search?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                done();
            });
        });

        it('should return results when querying for a simple string ', (done) => {
            let string = 'Kuznets';
            request(global.test_host + '/api/v1/search?q=' + string, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                assert.equal(hits.hits[0]._source.compendium_id, '0ShuS');
                done();
            });
        });

        it('should return no results when querying for a string not contained in the compendium', (done) => {
            let randomString = 'Y2AmjvFyBC2rlTonqZnx';
            request(global.test_host + '/api/v1/search?q=' + randomString, (err, res, body) => {
                assert.ifError(err);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 0);
                done();
            });
        });

    });

    describe('GET /api/v1/search with an query string containing special characters', () => {

        it('should not result in an error but return no results', (done) => {
            request(global.test_host + '/api/v1/search?q=////**?||\\\\', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 0);
                done();
            });
        });

    });

    describe('GET /api/v1/search with only compendia', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=compendia', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let response = JSON.parse(body);
                assert.isObject(response);
                done();
            });
        });

        it('should only provide compendia in response', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=compendia', (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                //console.log(require('util').inspect(response, { depth: 2, color: true}));
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
    });

    describe('GET /api/v1/search with only jobs', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=jobs', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isNotObject(body);
                done();
            });
        });

        it('should only provide jobs in response', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=jobs', (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
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

    describe('GET /api/v1/search with both jobs and compendia', () => {

        it('should respond with HTTP 200 OK and valid JSON for job,compendium', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=jobs,compendia', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isNotObject(body);
                done();
            });
        });

        it('should respond with HTTP 200 OK and valid JSON for compendium,job', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=compendia,jobs', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isNotObject(body);
                done();
            });
        });

        it('should return both when asking for job,compendium', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=jobs,compendia', (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.property(response, 'hits')
                assert.propertyVal(response.hits, 'total', 6);
                done();
            });
        });

        it('should return both when asking for compendium,job', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=compendia,jobs', (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.property(response, 'hits')
                assert.propertyVal(response.hits, 'total', 6);
                done();
            });
        });

        it('should handle empty elements in comma-separated resource list', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=,compendia,,jobs,', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let response = JSON.parse(body);
                assert.property(response, 'hits')
                assert.propertyVal(response.hits, 'total', 6);
                done();
            });
        });
    });

    describe('GET /api/v1/search with all', () => {

        it('should respond with HTTP 200 OK and valid JSON for "all"', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=all', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isNotObject(body);
                done();
            });
        });

        it('should return both when asking for "all"', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=all', (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.property(response, 'hits')
                assert.propertyVal(response.hits, 'total', 6);
                done();
            });
        });

        it('should return both when having "all" in the list', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=jobs,all', (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.property(response, 'hits')
                assert.propertyVal(response.hits, 'total', 6);
                done();
            });
        });

        it('should return both when having "all" first in the list', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=all,compendia', (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.property(response, 'hits')
                assert.propertyVal(response.hits, 'total', 6);
                done();
            });
        });
    });

    describe('GET /api/v1/search with empty resource parameter', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isNotObject(body);
                done();
            });
        });

        it('should return all resources', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=', (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.property(response, 'hits');
                assert.propertyVal(response.hits, 'total', 6);
                done();
            });
        });
    });

    describe('GET /api/v1/search with wrong resource parameter', () => {

        it('should respond with HTTP 404 error and valid JSON, if a valid value is also provided', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=does_not_exist,jobs', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                let response = JSON.parse(body);
                assert.isObject(response);
                assert.notProperty(response, 'hits');
                done();
            });
        });

        it('should return HTTP 404 error and valid JSON but no hits if only unknown resource type is provided', (done) => {
            request(global.test_host + '/api/v1/search?q=*&resources=none', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                let response = JSON.parse(body);
                assert.isObject(response);
                assert.notProperty(response, 'hits');
                done();
            });
        });
    });

});