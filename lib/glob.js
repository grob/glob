var fs = require("fs");
var fnmatch = require("fnmatch");
var {separator} = java.io.File;

const RE_MAGIC = /[*?\{\[]/;

var hasMagic = function(str) {
    return RE_MAGIC.test(str);
};

var splitPath = function(path) {
    var idx = path.lastIndexOf(separator) + 1;
    var head = path.slice(0, idx);
    var tail = path.slice(idx);
    if (head && head.slice(-1) === separator) {
        do {
            head = head.slice(0, -1);
        } while (head.slice(-1) === separator);
    }
    return [head, tail];
};

var glob = exports.glob = function(path) {
    if (!hasMagic(path)) {
        // java.io.File.exists ignores trailing slash for file paths, so
        // additional checks are necessary
        if (fs.exists(path) && (path.slice(-1) !== separator || fs.isDirectory(path))) {
            return [path];
        }
        return [];
    }
    var [dirname, basename] = splitPath(path);
    if (!dirname) {
        return byPattern(fs.workingDirectory(), basename);
    }
    var dirs = [];
    if (dirname !== path && hasMagic(dirname)) {
        dirs = glob(dirname);
    } else {
        dirs = [dirname];
    }
    var result = [];
    var globFunc = (hasMagic(basename)) ? byPattern : byLiteral;
    for each (let dir in dirs) {
        for each (let name in globFunc(dir, basename)) {
            result.push(fs.join(dir, name));
        }
    }
    return result;
};

var byPattern = function(directory, pattern) {
    if (fs.isDirectory(directory)) {
        return fnmatch.filter(fs.list(directory), pattern);
    }
    return [];
};

var byLiteral = function(directory, name) {
    if (name === "") {
        if (fs.isDirectory(directory)) {
            return [name];
        }
    } else {
        if (fs.exists(fs.join(directory, name))) {
            return [name];
        }
    }
    return [];
};