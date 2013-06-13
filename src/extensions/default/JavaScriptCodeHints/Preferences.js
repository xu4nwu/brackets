/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/**

    This class parses configuration values from a JSON object. The expected
    name of the file is “.jscodehints” but this class does not actually read
    the file, it just provides a constant, FILE_NAME.

    The following properties are supported:

     "excluded-directories" - An array of directory strings that match
     directories that will be excluded from analysis. Directories may be
     excluded if they contain automated tests that aren’t relevant for code hinting.
     The wildcards “*” and “?” are supported in strings.

     "excluded-files" - An array of file strings that match files that will
     be excluded from analysis. Files are typically excluded because
     their API is in a JSON file or they are known to cause problems with either
     stability or performance. The wildcards “*” and “?” are supported in strings.

     "max-file-count" - Limits the total number of files that can be processed for
     hints.

     "max-file-size" - Files larger than this number of bytes will not be parsed.

     The strings in "excluded-directories" or "excluded-files" will be treated as a
     regular expression if the first and last characters of the string are the '/'
     character. Note the '\' character in a regular expression needs to be escaped
     to be valid in a JSON formatted file. For example "/[\d]/" becomes "/[\\d]/".

     Example file:

     {
     "excluded-directories" : ["/ex[\\w]*ed/"],
     "excluded-files" : ["require.js", "jquery*.js", "less*.min.js", "ember*.js", "d2?.js", "d3*"],
     "max-file-count": 100,
     "max-file-size": 524288
     }

 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, brackets, $ */

define(function (require, exports, module) {
    "use strict";

    var StringUtils      = brackets.getModule("utils/StringUtils");

    /**
     *  Convert an array of strings with optional wildcards, to an equivalent
     *  regular expression.
     *
     * @param {Array.<string|RegExp>} settings
     * @param {RegExp} defaultRegExp - default regular expression to use
     * if none if provided.
     * @return {RegExp} Regular expression that captures the array of string
     * with optional wildcards.
     */
    function settingsToRegExp(settings, defaultRegExp) {
        var regExpString = "";

        if (settings instanceof Array && settings.length > 0) {

            // Append default settings to user settings. The default
            // settings are builtin and cannot be overridden.
            if (defaultRegExp) {
                settings.push("/" + defaultRegExp.source + "/");
            }

            // convert each string, with optional wildcards to an equivalent
            // string in a regular expression.
            settings.forEach(function (value, index) {

                if (typeof value === "string") {
                    var isRegExp = value[0] === '/' && value[value.length - 1] === '/';

                    if (isRegExp) {
                        value = value.substring(1, value.length - 1);
                    } else {
                        value = StringUtils.regexEscape(value);

                        // convert user input wildcard, "*" or "?", to a regular
                        // expression. We can just replace the escaped "*" or "?"
                        // since we know it is a wildcard.
                        value = value.replace("\\?", ".?");
                        value = value.replace("\\*", ".*");
                    }

                    if (index > 0) {
                        regExpString += "|";
                    }

                    // Add "^" and "$" to prevent matching in the middle of strings.
                    regExpString = regExpString.concat("^" + value + "$");
                }
            });
        }

        if (!regExpString) {
            return defaultRegExp;
        }

        return new RegExp(regExpString);
    }

    /**
     * Constructor to create a default preference object.
     *
     * @constructor
     * @param {Object=} prefs - preference object
     */
    function Preferences(prefs) {
        var DEFAULT_EXCLUDED_DIRECTORIES = null, /* no exclusions */
            // exclude require and jquery since we have special knowledge of those
            // temporarily exclude less*min.js because it is causing instability in tern.
            // exclude ember*.js as it is currently causing problems
            DEFAULT_EXCLUDED_FILES = /^require.*\.js$|^jquery.*\.js$|^less.*\.min\.js$/,
            DEFAULT_MAX_FILE_COUNT = 100,
            DEFAULT_MAX_FILE_SIZE = 512 * 1024;

        if (prefs) {
            this._excludedDirectories = settingsToRegExp(prefs["excluded-directories"],
                DEFAULT_EXCLUDED_DIRECTORIES);
            this._excludedFiles = settingsToRegExp(prefs["excluded-files"],
                DEFAULT_EXCLUDED_FILES);
            this._maxFileCount = prefs["max-file-count"];
            this._maxFileSize = prefs["max-file-size"];

            // sanity check values
            if (!this._maxFileCount || this._maxFileCount < 0) {
                this._maxFileCount = DEFAULT_MAX_FILE_COUNT;
            }

            if (!this._maxFileSize || this._maxFileSize < 0) {
                this._maxFileSize = DEFAULT_MAX_FILE_SIZE;
            }

        } else {
            this._excludedDirectories = DEFAULT_EXCLUDED_DIRECTORIES;
            this._excludedFiles = DEFAULT_EXCLUDED_FILES;
            this._maxFileCount = DEFAULT_MAX_FILE_COUNT;
            this._maxFileSize = DEFAULT_MAX_FILE_SIZE;
        }
    }

    Preferences.FILE_NAME = ".jscodehints";

    /**
     * Get the regular expression for excluded directories.
     *
     * @returns {?RegExp} Regular expression matching the directories that should
     * be excluded. Returns null if no directories are excluded.
     */
    Preferences.prototype.getExcludedDirectories = function () {
        return this._excludedDirectories;
    };

    /**
     * Get the regular expression for excluded files.
     *
     * @returns {?RegExp} Regular expression matching the files that should
     * be excluded. Returns null if no files are excluded.
     */
    Preferences.prototype.getExcludedFiles = function () {
        return this._excludedFiles;
    };

    /**
     * Get the maximum number of files that will be analyzed.
     *
     * @returns {number}
     */
    Preferences.prototype.getMaxFileCount = function () {
        return this._maxFileCount;
    };

    /**
     * Get the maximum size of a file that will be analyzed. Files that are
     * larger will be ignored.
     *
     * @returns {number}
     */
    Preferences.prototype.getMaxFileSize = function () {
        return this._maxFileSize;
    };

    module.exports = Preferences;

});

