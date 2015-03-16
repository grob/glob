/**
 * @fileoverview This module provides a method for shell-style glob pattern
 * expansion.
 *
 * Features:
 * - Single (`?`) and multiple (`*`) character wildcards
 * - Curly brace expansion (`{abc,def,ghj}`, `a{b,c{d,e},{f,g}h}x{y,z}`, `{0..9}`)
 * - Character classes (`[a-z]`)
 * - Globstar (`**`) matching
 * - Pattern negation (leading `!`)
 *
 * Supported options:
 * - `dot`: if true `*` and `?` match a leading dot (defaults to false)
 * - `globstar`: if false `**` doesn't traverse across directory boundaries,
 * instead it's interpreted as two `*` wildcards
 * - `ignore`: An optional glob pattern (or an array of patterns) to ignore, i.e.
 * paths matching the ignore pattern(s) will not be part of the resulting array.
 *
 * All paths and glob patterns are expected in "slash-style" (i.e. using a `/`
 * as separator).
 *
 * @example
 * ```javascript
 * var glob = require("glob");
 * glob("*.md"); // ['README.md']
 * glob("./lib/*.js"); // ['./lib/glob.js']
 * ```
 */
var fs = require("fs");
var fnmatch = require("fnmatch");
var {Pattern} = java.util.regex;
var separator = "/";

/**
 * Resolves the glob pattern passed as argument. If the pattern doesn't start
 * with a slash, the current working directory is used.
 * @param {String} pattern The glob pattern
 * @param {Object} opts An object containing boolean option flags `dot` and `globstar`
 * @returns {Array} An array containing paths matching the glob pattern
 * @name glob
 */
module.exports = function glob(pattern, opts) {
    var options = fnmatch.getOptions(opts);
    var {patterns} = fnmatch.translate(pattern, options);
    var result = [];
    for each (let segments in patterns) {
        let arr = resolve(segments, options);
        if (arr !== null) {
            Array.prototype.push.apply(result, arr);
        }
    }
    if (options.ignore != undefined) {
        result = filterIgnored(result, options.ignore);
    }
    return result.sort();
};

/**
 * Removes all paths matching the ignore pattern(s) from the array of paths
 * passed as argument.
 * @param {Array} paths The paths to filter
 * @param {String|Array} ignore A single glob pattern or an array of patterns
 * @returns {Array} The filtered paths
 */
var filterIgnored = function(paths, ignore) {
    if (!Array.isArray(ignore)) {
        ignore = [ignore];
    }
    ignore = ignore.map(function(pattern) {
        var {patterns, isNegated} = fnmatch.translate(pattern);
        return fnmatch.getMatcher(patterns, !isNegated);
    });
    for each (let matcher in ignore) {
        paths = paths.filter(matcher);
    }
    return paths;
};

/**
 * A custom path segment join method that always uses slashes (`fs.join()` uses
 * the OS separator character, which is of no use here)
 * @param {String...} segment One or multiple path segments to join
 * @returns {String} The joined path segments
 */
var join = function(segment) {
    return Array.prototype.filter.call(arguments, function(p) {
        return p !== "";
    }).join(separator);
};

/**
 * Iterates over the glob pattern segments passed as argument and collects those
 * that are strings, stopping at the first regular expression pattern found.
 * @param {Array} segments The glob pattern segments to iterate over
 * @returns {Array} An array containing the collected prefix strings and the
 * remainder of the pattern segments
 */
var collectPrefix = function(segments) {
    var idx = 0;
    while (idx < segments.length && typeof(segments[idx]) === "string") {
        idx +=1;
    }
    return [segments.splice(0, idx), segments];
};

/**
 * The main resolver
 * @param {Array} segments The glob pattern split by slashes
 * @param {Object} options An object containing globbing options
 * @returns {Array} An array containing the resolved paths
 */
var resolve = function(segments, options) {
    var [prefix, remainder] = collectPrefix(segments);
    if (remainder.length === 0) {
        // path contains only strings
        var target = resolveStringPath(prefix.join(separator));
        if (target !== null) {
            return [target];
        }
    } else {
        var result = [];
        resolveRegExpPath(prefix.join(separator), remainder, result, options);
        return result;
    }
};

/**
 * Resolves a string path, using the current working directory as starting
 * point (in case the path doesn't start with a slash).
 * @param {String} path The file path
 * @returns {String} The path argument, or null if a) the file does not exist, or
 * b) the path points to a directory and doesn't end with a slash
 */
var resolveStringPath = function(path) {
    var absolutePath = fs.resolve(fs.workingDirectory(), path);
    if (fs.exists(absolutePath)) {
        if (path[path.length - 1] === separator && !fs.isDirectory(path)) {
            return null;
        }
        return path;
    }
    return null;
};

/**
 * Helper returning a matcher function
 * @param {String} prefix Path prefix (can be an empty string)
 * @param {String|java.util.regex.Pattern} pattern The glob pattern segment
 * @param {Boolean} limitToDirs If true only directories are considered a match
 * @returns {Function} A matcher function
 */
var getFileMatcher = function(prefix, pattern, limitToDirs) {
    return function(name) {
        var isMatch = (pattern instanceof Pattern) ? pattern.matcher(name).matches() : pattern === name;
        return isMatch && (!limitToDirs || fs.isDirectory(fs.join(prefix, name)));
    }
};

/**
 * Resolves a list of glob pattern segments that contain at least one regular
 * expression segment. Note that the result array argument is directly modified.
 * @param {String} prefix Path prefix (can be an empty string)
 * @param {Array} remainder An array containing remaining glob pattern segments
 * @param {Array} result An array containing the collected paths
 * @param {Object} options An object containing globbing options
 */
var resolveRegExpPath = function(prefix, remainder, result, options) {
    var dir = fs.resolve(fs.workingDirectory(), prefix);
    if (!fs.exists(dir) || !fs.isDirectory(dir)) {
        return null;
    }
    var pattern = remainder.shift();
    var limitToDirs = remainder.length === 1 && remainder[0] === "";
    var isFinished = limitToDirs || remainder.length === 0;
    var candidates = [];
    if (pattern === fnmatch.GLOBSTAR) {
        resolveGlobStar(fs.workingDirectory(), prefix, candidates, limitToDirs, options);
        if (isFinished && limitToDirs) {
            candidates.forEach(function(path, idx, arr) {
                arr[idx] = path + separator;
            });
        }
    } else {
        candidates = fs.list(dir)
            .filter(getFileMatcher(prefix, pattern, limitToDirs))
            .map(function(name) {
                return join(prefix, name);
            });
    }
    if (!isFinished) {
        for each (let candidate in candidates) {
            resolveRegExpPath(candidate, remainder.slice(), result, options);
        }
    } else {
        Array.prototype.push.apply(result, candidates);
    }
};

/**
 * Resolves a globstar (`**`). Note that the result array passed as argument
 * is directly modified.
 * @param {String} workingDir The working directory path
 * @param {String} relativePath The relative path prefix (can be an empty string)
 * @param {Array} result An array containing the collected paths
 * @param {Boolean} limitToDirs If true only directories are considered a match
 * @param {Object} options An object containing globbing options
 */
var resolveGlobStar = function(workingDir, relativePath, result, limitToDirs, options) {
    var absolutePath = fs.resolve(workingDir, relativePath);
    var isDirectory = fs.isDirectory(absolutePath);
    if (relativePath.length > 0 && (!limitToDirs || isDirectory)) {
        result.push(relativePath);
    }
    if (isDirectory && !fs.isLink(absolutePath)) {
        fs.list(absolutePath).forEach(function(name) {
            if (options.dot || name.charAt(0) !== ".") {
                resolveGlobStar(workingDir, join(relativePath, name), result, limitToDirs, options);
            }
        });
    }
};