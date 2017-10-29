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
const config = require('../config/config');

const mongojs = require('mongojs');
const sleep = require('sleep');

require("./setup");
const cookie_o2r = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';
const requestLoadingTimeout = 30000;
const requestReadingTimeout = 30000;
const importJSONCompendium = require('./util').importJSONCompendium;
const resetIndex = require('./util').resetIndex;
const waitSecs = 5;

describe('Elasticsearch search API', function () {

    before(function (done) {
        this.timeout(10000);
        let db = mongojs('localhost/muncher', ['users', 'sessions', 'compendia', 'jobs']);
        db.compendia.drop(function (err, doc) {

            return resetIndex()
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
            let body = {
                "query": {
                    "bool": {
                        "must": {
                            "match_all": {}
                        },
                        "filter": [
                            {
                                "range": {
                                    "metadata.o2r.temporal.begin": {
                                        "from": "2015-01-01T00:00:00.000Z"
                                    }
                                }
                            },
                            {
                                "range": {
                                    "metadata.o2r.temporal.end": {
                                        "to": "2016-01-02T00:00:00.000Z"
                                    }
                                }
                            }
                        ]
                    }
                },
                "from": 0,
                "size": 10
            };

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
                //todo add assert
                done();
            });
        }).timeout(requestReadingTimeout);

        it.only('should return one result when doing a spatial query (europe)', (done) => {
            let body = {
                "query": {
                    "bool": {
                        "must": {
                            "match_all": {}
                        },
                        "filter": {
                            "geo_shape": {
                                "metadata.o2r.spatial.union.geojson.geometry": {
                                    "shape": {
                                        "type": "polygon",
                                        "coordinates":
                                            [
                                                [
                                                    [
                                                        6.532745361328125,
                                                        51.205162601119824
                                                    ],
                                                    [
                                                        7.551727294921875,
                                                        51.205162601119824
                                                    ],
                                                    [
                                                        7.551727294921875,
                                                        51.5463350479341
                                                    ],
                                                    [
                                                        6.532745361328125,
                                                        51.5463350479341
                                                    ],
                                                    [
                                                        6.532745361328125,
                                                        51.205162601119824
                                                    ]
                                                ]
                                            ]
                                    },
                                    "relation": "within"
                                }
                            }
                        }
                    }
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
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                //todo add assert
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return one result when doing a spatio-temoral query (europe, 2010-2011)', (done) => {
            request(global.test_host + '/api/v1/search?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return multiple results when doing a spatio-temoral query (world, 2015-2016)', (done) => {
            request(global.test_host + '/api/v1/search?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return no results when doing a spatio-temoral query (germany, 2010-2011)', (done) => {
            request(global.test_host + '/api/v1/search?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return an error when doing a spatial query with an invalid GeoJSON', (done) => {
            request(global.test_host + '/api/v1/search?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.total, 1);
                done();
            });
        }).timeout(requestReadingTimeout);


    });

    describe('GET /api/v1/search with an invalid query string', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/search?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestReadingTimeout);

    });

    describe('POST /api/v1/search with an invalid body', () => {

        it('should respond with HTTP 400 when JSON is invalid', (done) => {
            request(global.test_host + '/api/v1/search?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should not allow to modify the index', (done) => {
            request(global.test_host + '/api/v1/search?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isDefined(JSON.parse(body).hits, 'results returned');
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return one result when querying for a DOI', (done) => {
            request(global.test_host + '/api/v1/search?q=10.1006%2Fjeem.1994.1031', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestReadingTimeout);

        it('should return one result when querying for a DOI URL', (done) => {
            request(global.test_host + '/api/v1/search?q=https://dx.doi.org/10.1115/1.2128636', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                let hits = JSON.parse(body).hits;
                assert.isDefined(hits, 'results returned');
                assert.equal(hits.length, 1);
                done();
            });
        }).timeout(requestReadingTimeout);


    });

    //...
});