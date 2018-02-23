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

'use strict';

const debug = require('debug')('finder-tree');

var fs = require('fs');

var override = require('../config/custom-mime.json');
var Mimos = require('mimos');
var mime = new Mimos({ override });

/**
 * Function to rewrite the basepath of a directory-tree listing.
 * It will recursively remove a number trunc of chars from the
 * beginning of tree.path and replace them with the string newpath.
 *
 * Also adds MIME type information to entries that are not folders (i. e.
 * have no children array).
 *
 * @param {json} tree file directory tree
 * @param {int} trunc number of chars to remove from the beginning of tree.path
 * @param {character} newpath replacement characters for removed chars
 * @return {json} the rewritten directory tree
 */
function rewriteTree(tree, trunc, newpath) {
  tree.path = tree.path.substring(trunc);
  tree.path = newpath + tree.path;
  if (tree.children) {
    tree.children.map(child => {
      return rewriteTree(child, trunc, newpath);
    });
  } else {
    if (!tree.type) {
      var mimetype = mime.path(tree.path).type;
      tree.type = mimetype;
    }
  }
  return tree;
}

/**
 * Adds MIME type information to entries that are not folders (i. e.
 * have no children array).
 *
 * @param {json} tree file directory tree
 * @return {json} the rewritten directory tree
 */
function mimeTree(tree) {
  if (tree.children) {
    tree.children.map(child => {
      return mimeTree(child);
    });
  } else {
    var mimetype = mime.path(tree.path).type;
    tree.type = mimetype;
  }
  return tree;
}

/**
 * @param {json} tree a file tree
 * @return {json} the given file tree with the content of text files in the field `content`
 */
function readTextfileTree(tree) {
  if (tree.children) {
    tree.children.map(child => {
      return readTextfileTree(child);
    });
  } else {
    if (tree.type && (tree.type.startsWith("text") || tree.type.startsWith("script"))) {
      debug("Reading file %o", tree);
      // read file
      try {
        tree.content = fs.readFileSync(tree.path, { encoding: "utf-8" });
        debug("Read file of length %s", tree.content.length);
      }
      catch (err) {
        debug("Error reading file: %s", err);
      }
    }
  }
  return tree;
}

/**
 * Function to retrieve a flat list of all files in a tree.
 *
 * Also adds MIME type information to entries that are not folders (i. e. have no children array).
 *
 * @param {json} tree file directory tree
 * @param {int} truncsize the number of characters to remove from the start of the path
 * @param {array} list array to push files into
 * @return {json} the rewritten directory array
 */
function flattenTree(tree, truncsize, list) {
  if (tree.children) {
    tree.children.map(child => {
      return flattenTree(child, truncsize, list);
    });
  } else {
    tree.path = tree.path.substring(truncsize);
    var mimetype = mime.path(tree.path).type;
    tree.type = mimetype;
    list.push(tree);
  }
  return tree;
}

module.exports = { rewriteTree, mimeTree, readTextfileTree, flattenTree };
