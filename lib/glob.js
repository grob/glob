var fs = require("fs");
var fnmatch = require("fnmatch");
var {separator} = java.io.File;
var {Pattern} = java.util.regex;

var glob = exports.glob = function(path, options) {
    var {patterns, isNegated} = fnmatch.translate(path, options || {});
    var result = [];
    for each (let segments in patterns) {
        let arr = resolve(segments);
        if (arr !== null) {
            Array.prototype.push.apply(result, arr);
        }
    }
    return result.sort();
};

var collectPrefix = function(segments) {
    var idx = 0;
    while (idx < segments.length && typeof(segments[idx]) === "string") {
        idx +=1;
    }
    return [segments.splice(0, idx), segments];
};

var resolve = function(segments) {
    var [prefix, remainder] = collectPrefix(segments);
    if (remainder.length === 0) {
        // path contains only strings
        var target = resolveStringPath(prefix.join("/"));
        if (target !== null) {
            return [target];
        }
    } else {
        var result = [];
        resolveRegExpPath(prefix.join("/"), remainder, result);
        return result;
    }
};

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

var getFileMatcher = function(prefix, pattern, limitToDirs) {
    return function(name) {
        // var isMatch = (typeof(pattern) === "string") ? pattern === name : pattern.test(name);
        var isMatch = (pattern instanceof Pattern) ? pattern.matcher(name).matches() : pattern === name;
        return isMatch && (!limitToDirs || fs.isDirectory(fs.join(prefix, name)));
    }
};

var resolveRegExpPath = function(prefix, remainder, result) {
    var dir = fs.resolve(fs.workingDirectory(), prefix);
    if (!fs.exists(dir) || !fs.isDirectory(dir)) {
        return null;
    }
    var pattern = remainder.shift();
    var limitToDirs = remainder.length === 1 && remainder[0] === "";
    var isFinished = limitToDirs || remainder.length === 0;
    var candidates = [];
    if (pattern === fnmatch.GLOBSTAR) {
        resolveGlobStar(fs.workingDirectory(), prefix, candidates, limitToDirs);
        if (isFinished && limitToDirs) {
            candidates.forEach(function(path, idx, arr) {
                arr[idx] = path + separator;
            });
        }
    } else {
        candidates = fs.list(dir)
            .filter(getFileMatcher(prefix, pattern, limitToDirs))
            .map(function(name) {
                return fs.join(prefix, name);
            });
    }
    if (!isFinished) {
        for each (let candidate in candidates) {
            resolveRegExpPath(candidate, remainder.slice(), result);
        }
    } else {
        Array.prototype.push.apply(result, candidates);
    }
};

var resolveGlobStar = function(workingDir, relativePath, result, limitToDirs) {
    var absolutePath = fs.resolve(workingDir, relativePath);
    var isDirectory = fs.isDirectory(absolutePath);
    if (relativePath.length > 0 && (!limitToDirs || isDirectory)) {
        result.push(relativePath);
    }
    if (isDirectory && !fs.isLink(absolutePath)) {
        fs.list(absolutePath).forEach(function(name) {
            // TODO: options.dot
            if (name.charAt(0) !== ".") {
                resolveGlobStar(workingDir, fs.join(relativePath, name), result, limitToDirs);
            }
        });
    }
};