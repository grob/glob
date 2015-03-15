var fs = require("fs");
var fnmatch = require("fnmatch");
var {Pattern} = java.util.regex;
var separator = "/";

var glob = exports.glob = function(path, opts) {
    var options = fnmatch.getOptions(opts);
    var {patterns} = fnmatch.translate(path, options);
    var result = [];
    for each (let segments in patterns) {
        let arr = resolve(segments, options);
        if (arr !== null) {
            Array.prototype.push.apply(result, arr);
        }
    }
    if (options.ignore != undefined) {
        result = filterIgnored(result, options.ignore, options);
    }
    return result.sort();
};

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

var join = function() {
    return Array.prototype.filter.call(arguments, function(p) {
        return p !== "";
    }).join(separator);
};

var collectPrefix = function(segments) {
    var idx = 0;
    while (idx < segments.length && typeof(segments[idx]) === "string") {
        idx +=1;
    }
    return [segments.splice(0, idx), segments];
};

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
        var isMatch = (pattern instanceof Pattern) ? pattern.matcher(name).matches() : pattern === name;
        return isMatch && (!limitToDirs || fs.isDirectory(fs.join(prefix, name)));
    }
};

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