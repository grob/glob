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
 * const glob = require("glob");
 * glob("*.md"); // ['README.md']
 * glob("./lib/*.js"); // ['./lib/glob.js']
 * ```
 */
const fs = require("fs");
const fnmatch = require("fnmatch");
const {Pattern} = java.util.regex;
const separator = "/";

/**
 * Resolves the glob pattern passed as argument. If the pattern doesn't start
 * with a slash, the current working directory is used.
 * @param {String} pattern The glob pattern
 * @param {Object} opts An object containing boolean option flags `dot` and `globstar`
 * @returns {Array} An array containing paths matching the glob pattern
 * @name glob
 */
module.exports = (pattern, opts) => {
    const options = fnmatch.getOptions(opts);
    const {patterns} = fnmatch.translate(pattern, options);
    let result = patterns.reduce((result, segments) => {
        const arr = resolve(segments, options);
        return (arr !== null) ? result.concat(arr) : result;
    }, []);
    if (options.ignore !== undefined) {
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
const filterIgnored = (paths, ignore) => {
    if (!Array.isArray(ignore)) {
        ignore = [ignore];
    }
    return ignore.reduce((result, pattern) => {
        const {patterns, isNegated} = fnmatch.translate(pattern);
        const matcher = fnmatch.getMatcher(patterns, !isNegated);
        return result.filter(matcher);
    }, paths);
};

/**
 * A custom path segment join method that always uses slashes (`fs.join()` uses
 * the OS separator character, which is of no use here)
 * @param {String...} segment One or multiple path segments to join
 * @returns {String} The joined path segments
 */
const join = function(segment) {
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
const collectPrefix = (segments) => {
    let idx = 0;
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
const resolve = (segments, options) => {
    const [prefix, remainder] = collectPrefix(segments);
    if (remainder.length === 0) {
        // path contains only strings
        const target = resolveStringPath(prefix.join(separator));
        if (target !== null) {
            return [target];
        }
        return null;
    } else {
        const result = [];
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
const resolveStringPath = (path) => {
    const absolutePath = fs.resolve(fs.workingDirectory(), path);
    if (fs.exists(absolutePath)) {
        if (path[path.length - 1] === separator && !fs.isDirectory(path)) {
            return null;
        }
        return path;
    }
    return null;
};

/**
 * Resolves a list of glob pattern segments that contain at least one regular
 * expression segment. Note that the result array argument is directly modified.
 * @param {String} prefix Path prefix (can be an empty string)
 * @param {Array} remainder An array containing remaining glob pattern segments
 * @param {Array} result An array containing the collected paths
 * @param {Object} options An object containing globbing options
 */
const resolveRegExpPath = (prefix, remainder, result, options) => {
    const dir = fs.resolve(fs.workingDirectory(), prefix);
    if (!fs.exists(dir) || !fs.isDirectory(dir)) {
        return null;
    }
    const pattern = remainder.shift();
    const limitToDirs = remainder.length === 1 && remainder[0] === "";
    const isFinished = limitToDirs || remainder.length === 0;
    let candidates = [];
    if (pattern === fnmatch.GLOBSTAR) {
        resolveGlobStar(fs.workingDirectory(), prefix, candidates, limitToDirs, options);
        if (isFinished && limitToDirs) {
            candidates = candidates.map(path => path + separator);
        }
    } else {
        candidates = fs.list(dir)
            .filter((name) => {
                const isMatch = (pattern instanceof Pattern) ?
                        pattern.matcher(name).matches() :
                        pattern === name;
                return isMatch && (!limitToDirs || fs.isDirectory(fs.join(dir, name)));
            })
            .map(function(name) {
                return join(prefix, name);
            });
    }
    if (!isFinished) {
        candidates.forEach(candidate => {
            resolveRegExpPath(candidate, remainder.slice(), result, options);
        });
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
const resolveGlobStar = (workingDir, relativePath, result, limitToDirs, options) => {
    const absolutePath = fs.resolve(workingDir, relativePath);
    const isDirectory = fs.isDirectory(absolutePath);
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