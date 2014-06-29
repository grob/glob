var assert = require("assert");
var fs = require("fs");

var {glob} = require("../lib/glob");

var TMP_DIR = java.lang.System.getProperty("java.io.tmpdir");
var WORK_DIR = fs.join(TMP_DIR, "glob_test");
var {separator} = java.io.File;

var makeFile = function() {
    var path = getPath.apply(null, arguments);
    var directory = fs.directory(path);
    if (!fs.exists(directory)) {
        fs.makeTree(directory);
    }
    fs.touch(path);
    assert.isTrue(fs.isFile(path));
};

var getPath = function() {
    return fs.join(WORK_DIR, fs.join.apply(null, arguments));
};

var doGlob = function() {
    var pattern = (arguments.length === 1) ? arguments[0] : fs.join.apply(null, arguments);
    return glob(fs.join(WORK_DIR, pattern));
};

var eqNoOrder = function(arr1, arr2) {
    if (!Array.isArray(arr1)) {
        arr1 = [arr1];
    }
    if (!Array.isArray(arr2)) {
        arr2 = [arr2];
    }
    assert.deepEqual(arr1.sort(), arr2.sort());
};

var list = function() {
    var path = getPath.apply(null, arguments);
    return fs.list(path).filter(function(file) {
        return file.charAt(0) !== ".";
    }).map(function(file) {
        return fs.join(path, file);
    });
};

exports.setUp = function() {
    fs.makeDirectory(WORK_DIR);
    makeFile("a", "D");
    makeFile('aab', 'F');
    makeFile('.aa', 'G');
    makeFile('.bb', 'H');
    makeFile('aaa', 'zzzF');
    makeFile('ZZZ');
    makeFile('a', 'bcd', 'EF');
    makeFile('a', 'bcd', 'efg', 'ha');
    // TODO: symlinks...
};

exports.tearDown = function() {
    if (fs.exists(WORK_DIR) && fs.isDirectory(WORK_DIR)) {
        fs.removeTree(WORK_DIR);
    }
};

exports.testGlob = function() {
    eqNoOrder(doGlob("a"), getPath("a"));
    eqNoOrder(doGlob("a", "D"), getPath("a", "D"));
    eqNoOrder(doGlob("aab"), getPath("aab"));
    eqNoOrder(doGlob("zymurgy"), []);
    eqNoOrder(doGlob("*"), list());
};

exports.testGlobOneDirectory = function() {
    eqNoOrder(doGlob("a*"), [getPath("a"), getPath("aab"), getPath("aaa")]);
    eqNoOrder(doGlob("*a"), [getPath("a"), getPath("aaa")]);
    eqNoOrder(doGlob(".*"), [getPath(".aa"), getPath(".bb")]);
    eqNoOrder(doGlob("?aa"), [getPath("aaa")]);
    eqNoOrder(doGlob("aa?"), [getPath("aaa"), getPath("aab")]);
    eqNoOrder(doGlob("aa[ab]"), [getPath("aaa"), getPath("aab")]);
    eqNoOrder(doGlob("q*"), []);
};

exports.testGlobNestedDirectory = function() {
    var isCaseInSensitiveFS = fs.exists(getPath("A"));
    if (isCaseInSensitiveFS) {
        eqNoOrder(doGlob("a", "bcd", "E*"), [getPath("a", "bcd", "EF"), getPath("a", "bcd", "efg")]);

    } else {
        eqNoOrder(doGlob("a", "bcd", "E*"), [getPath("a", "bcd", "EF")]);
    }
    eqNoOrder(doGlob("a", "bcd", "*g"), [getPath("a", "bcd", "efg")]);
};

exports.testGlobDirectoryNames = function() {
    eqNoOrder(doGlob("*", "D"), [getPath("a", "D")]);
    eqNoOrder(doGlob("*", "*a"), []);
    eqNoOrder(doGlob("a", "*", "*", "*a"), [getPath("a", "bcd", "efg", "ha")]);
    eqNoOrder(doGlob("?a?", "*F"), [getPath("aaa", "zzzF"), getPath("aab", "F")]);
};

exports.testGlobDirectoryWithTrailingSlash = function() {
    // Patterns ending with a slash shouldn't match non-dirs
    eqNoOrder(glob(getPath("Z*Z") + separator), []);
    eqNoOrder(glob(getPath("ZZZ") + separator), []);
    // When there is a wildcard pattern which ends with separator, glob()
    // doesn't blow up.
    eqNoOrder(glob(getPath("aa*") + separator), [getPath("aab"), getPath("aaa")]);
};