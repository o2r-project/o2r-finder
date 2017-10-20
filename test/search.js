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

require("./setup");
const cookie_o2r = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';
const requestLoadingTimeout = 30000;
const requestReadingTimeout = 10000;
const uploadCompendium = require('./util').uploadCompendium;
const importJSONCompendium = require('./util').importJSONCompendium;

describe('Elasticsearch complex search', function () {

    before(function (done) {
        importJSONCompendium('./text/erc/spatiotemporal/finland2000.json');
        importJSONCompendium('./text/erc/spatiotemporal/kongo2005.json');
        importJSONCompendium('./text/erc/spatiotemporal/ruhr2010.json');
        importJSONCompendium('./text/erc/spatiotemporal/brazil2015.json');
        this.timeout(10000);
    });

    describe('POST /api/v1/search with a spatial query', () => {

        it('should respond with HTTP 200 OK and valid JSON', (done) => {

            request(global.test_host + '/api/v1/search', (err, res, body) => {

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 200);
                    done();
                });
            });
        }).timeout(requestLoadingTimeout);

    });
    //...
});