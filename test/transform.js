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

describe('Document transformation', function () {
    var db = mongojs('localhost/muncher', ['compendia', 'jobs']);

    before(function (done) {
        this.timeout(20000);
        db.compendia.drop(function (err, doc) {
            //if (err) console.log(err);

            db.jobs.drop(function (err2, doc2) {
                //if (err2) console.log(err2);

                resetIndex()
                    .then(Promise.all([
                        importJSONCompendium('./test/compendium/finland2000.json'),
                        importJSONCompendium('./test/compendium/kongo2005.json'),
                        importJSONCompendium('./test/compendium/ruhr2010.json'),
                        importJSONCompendium('./test/compendium/brazil2015.json')
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

    describe('only o2r metadata is indexed', () => {

        it('should have the o2r property under metadata', (done) => {
            request(global.test_host + '/api/v1/search?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                response = JSON.parse(body);
                
                response.hits.hits.forEach(hit => {
                    assert.property(hit._source, 'metadata');
                    assert.property(hit._source.metadata, 'o2r');
                });
                done();
            });
        });

        it('should have no other sub-properties under metadata', (done) => {
            request(global.test_host + '/api/v1/search?q=*', (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                response = JSON.parse(body);
                
                response.hits.hits.forEach(hit => {
                    assert.lengthOf(Object.keys(hit._source.metadata), 1);
                    assert.deepEqual(Object.keys(hit._source.metadata), ['o2r']);
                });
                done();
            });
        });

    });

});