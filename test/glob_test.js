const assert = require("assert");
const system = require("system");
const fs = require("fs");

const glob = require("../lib/glob");

const TMP_DIR = java.lang.System.getProperty("java.io.tmpdir");
const WORK_DIR = fs.join(TMP_DIR, "glob_test");
const {separator} = java.io.File;

const makeFile = function() {
    const path = getAbsolutePath.apply(null, arguments);
    const directory = fs.directory(path);
    if (!fs.exists(directory)) {
        fs.makeTree(directory);
    }
    fs.touch(path);
    assert.isTrue(fs.isFile(path));
};

const getAbsolutePath = function() {
    Array.prototype.unshift.call(arguments, WORK_DIR);
    return changeSeparator(fs.resolve(fs.join.apply(null, arguments)));
};

const changeSeparator = function(path) {
    if (separator !== "/") {
        return path.replace(separator, "/", "g");
    }
    return path;
};

const changeWorkingDirectory = function(path) {
    java.lang.System.setProperty('user.dir', path);
};

const fixSeparator = function(arg) {
    if (Array.isArray(arg)) {
        return arg.map(changeSeparator);
    }
    return changeSeparator(arg);
};

const equals = function(arr1, arr2, comment) {
    if (!Array.isArray(arr1)) {
        arr1 = [arr1];
    }
    if (!Array.isArray(arr2)) {
        arr2 = [arr2];
    }
    assert.deepEqual(arr1, arr2.sort(), comment || "");
};

const list = function() {
    const path = Array.prototype.join.call(arguments, separator);
    return fs.list(path || fs.workingDirectory()).filter(function(file) {
        return file.charAt(0) !== ".";
    }).map(function(file) {
        return fs.join(path, file);
    });
};

/**
 *
 * WORK_DIR
 * - /a/D
 * - /aab/F
 * - /aac/F
 * - /.aa/G
 * - /.bb/H
 * - /aaa/zzzF
 * - /ZZZ
 * - /a/bcd/EF
 * - /a/bcd/efg/ha
 *
 */
exports.setUp = function() {
    if (fs.exists(WORK_DIR)) {
        fs.removeTree(WORK_DIR);
    }
    fs.makeDirectory(WORK_DIR);
    changeWorkingDirectory(WORK_DIR);
    makeFile("a", "D");
    makeFile('aab', 'F');
    makeFile('aac', 'F');
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
    const tests = [
        {
            "pattern": "a",
            "expected": ["a"]
        },
        {
            "pattern": "a/D",
            "expected": ["a/D"]
        },
        {
            "pattern": "aab",
            "expected": ["aab"]
        },
        {
            "pattern": "zymurgy",
            "expected": []
        },
        {
            "pattern": "*",
            "expected": list()
        }
    ];
    tests.forEach(function(test, idx) {
        equals(glob(test.pattern), fixSeparator(test.expected), "Relative test " + idx);
    });
    changeWorkingDirectory(TMP_DIR);
    tests.forEach(function(test, idx) {
        equals(glob(getAbsolutePath(test.pattern)), test.expected.map(function(path) {
            return getAbsolutePath(fixSeparator(path));
        }), "Absolute path test " + idx);
    });
};

exports.testGlobList = function() {
    const tests = [
        {
            "pattern": "{aab,aac}/F",
            "expected": [
                "aab/F", "aac/F"
            ]
        },
        {
            "pattern": "aa{b,c,x}/*",
            "expected": [
                "aab/F", "aac/F"
            ]
        }
    ];
    tests.forEach(function(test, idx) {
        equals(glob(test.pattern), test.expected, "Relative test " + idx);
    });
    changeWorkingDirectory(TMP_DIR);
    tests.forEach(function(test, idx) {
        equals(glob(getAbsolutePath(test.pattern)), test.expected.map(function(path) {
            return getAbsolutePath(path);
        }), "Absolute path test " + idx);
    });
};

exports.testGlobOneDirectory = function() {
    const tests = [
        {
            "pattern": "a*",
            "expected": ["a", "aab", "aaa", "aac"]
        },
        {
            "pattern": "*a",
            "expected": ["a", "aaa"]
        },
        {
            "pattern": ".*",
            "expected": [".aa", ".bb"]
        },
        {
            "pattern": "?aa",
            "expected": ["aaa"]
        },
        {
            "pattern": "aa?",
            "expected": ["aaa", "aab", "aac"]
        },
        {
            "pattern": "aa[ab]",
            "expected": ["aaa", "aab"]
        },
        {
            "pattern": "q*",
            "expected": []
        }
    ];
    tests.forEach(function(test, idx) {
        equals(glob(test.pattern), test.expected, "Test " + idx);
    });
};

exports.testGlobNestedDirectory = function() {
    const tests = [
        {
            "pattern": "a/bcd/E*",
            "expected": ["a/bcd/EF"]
        },
        {
            "pattern": "a/bcd/*g",
            "expected": ["a/bcd/efg"]
        }
    ];
    tests.forEach(function(test, idx) {
        equals(glob(test.pattern), test.expected, "Test " + idx);
    });
};

exports.testGlobDirectoryNames = function() {
    const tests = [
        {
            "pattern": "*/D",
            "expected": ["a/D"]
        },
        {
            "pattern": "*/*a",
            "expected": []
        },
        {
            "pattern": "a/*/*/*a",
            "expected": ["a/bcd/efg/ha"]
        },
        {
            "pattern": "a*/F",
            "expected": ["aab/F", "aac/F"]
        },
        {
            "pattern": "?a?/*F",
            "expected": ["aaa/zzzF", "aab/F", "aac/F"]
        }
    ];
    tests.forEach(function(test, idx) {
        equals(glob(test.pattern), test.expected, "Test " + idx);
    });
};

exports.testGlobDirectoryWithTrailingSlash = function() {
    // Patterns ending with a slash shouldn't match non-dirs
    const tests = [
        {
            "pattern": "*ZZ",
            "expected": []
        },
        {
            "pattern": "Z*Z",
            "expected": []
        },
        {
            "pattern": "ZZZ",
            "expected": []
        },
        {
            "pattern": "aa*",
            "expected": ["aab", "aaa", "aac"]
        }
    ];
    tests.forEach(function(test, idx) {
        equals(glob(test.pattern + "/"), test.expected, "Test " + idx);
    });
};

exports.testGlobStar = function() {
    const tests = [
        {
            "pattern": "**",
            "expected": [
                "ZZZ",
                "a",
                "a/D",
                "a/bcd",
                "a/bcd/EF",
                "a/bcd/efg",
                "a/bcd/efg/ha",
                "aaa",
                "aaa/zzzF",
                "aab",
                "aab/F",
                "aac",
                "aac/F"
            ]
        },
        {
            "pattern": "*/**",
            "expected": [
                "a",
                "a/D",
                "a/bcd",
                "a/bcd/EF",
                "a/bcd/efg",
                "a/bcd/efg/ha",
                "aaa",
                "aaa/zzzF",
                "aab",
                "aab/F",
                "aac",
                "aac/F"
            ]
        },
        {
            "pattern": "./**/*",
            "expected": [
                "./ZZZ",
                "./a",
                "./a/D",
                "./a/bcd",
                "./a/bcd/EF",
                "./a/bcd/efg",
                "./a/bcd/efg/ha",
                "./aaa",
                "./aaa/zzzF",
                "./aab",
                "./aab/F",
                "./aac",
                "./aac/F"
            ]
        },
        {
            "pattern": "**/",
            "expected": [
                "a/",
                "a/bcd/",
                "a/bcd/efg/",
                "aaa/",
                "aab/",
                "aac/"
            ]
        },
        {
            "pattern": "./**/[gh]",
            "expected": []
        },
        {
            "pattern": "./**/[DF]",
            "expected": ["./a/D", "./aab/F", "./aac/F"]
        },
        // options.dot = true
        {
            "pattern": "./**/[GH]",
            "expected": ["./.aa/G", "./.bb/H"],
            "options": {"dot": true}
        },
        // options.globstar = false
        {
            "pattern": "./**",
            "expected": ["./ZZZ", "./a", "./aaa", "./aab", "./aac"],
            "options": {"globstar": false}
        }
    ];
    tests.forEach(function(test, idx) {
        equals(glob(test.pattern, test.options), test.expected, "Test " + idx);
    });
};

exports.testGlobStarAbsolute = function() {
    const tests = [
        {
            "pattern": "**",
            "expected": [
                "",
                "ZZZ",
                "a",
                "a/D",
                "a/bcd",
                "a/bcd/EF",
                "a/bcd/efg",
                "a/bcd/efg/ha",
                "aaa",
                "aaa/zzzF",
                "aab",
                "aab/F",
                "aac",
                "aac/F"
            ]
        },
        {
            "pattern": "*/**",
            "expected": [
                "a",
                "a/D",
                "a/bcd",
                "a/bcd/EF",
                "a/bcd/efg",
                "a/bcd/efg/ha",
                "aaa",
                "aaa/zzzF",
                "aab",
                "aab/F",
                "aac",
                "aac/F"
            ]
        },
        {
            "pattern": "**/*",
            "expected": [
                "ZZZ",
                "a",
                "a/D",
                "a/bcd",
                "a/bcd/EF",
                "a/bcd/efg",
                "a/bcd/efg/ha",
                "aaa",
                "aaa/zzzF",
                "aab",
                "aab/F",
                "aac",
                "aac/F"
            ]
        }
    ];
    changeWorkingDirectory(TMP_DIR);
    tests.forEach(function(test, idx) {
        const expected = test.expected.map(function(path) {
            return getAbsolutePath(path);
        });
        equals(glob(getAbsolutePath(test.pattern)), expected,
            "Absolute path test " + idx);
    });
};

exports.testIgnore = function() {
    const tests = [
        {
            "pattern": "**",
            "expected": [
                "ZZZ",
                "aaa",
                "aaa/zzzF",
                "aab",
                "aab/F",
                "aac",
                "aac/F"
            ],
            "options": {"ignore": "a"}
        },
        {
            "pattern": "a/**/*",
            "expected": [
                "a/D",
                "a/bcd/EF",
                "a/bcd/efg",
                "a/bcd/efg/ha"
            ],
            "options": {"ignore": "a/bcd"}
        },
        {
            "pattern": "a/**/*",
            "expected": [
                "a/bcd/EF",
                "a/bcd/efg",
                "a/bcd/efg/ha"
            ],
            "options": {"ignore": "a/*"}
        }
    ];
    tests.forEach(function(test, idx) {
        equals(glob(test.pattern, test.options), test.expected, "Test " + idx);
    });
};

if (require.main == module.id) {
    system.exit(require("test").run.apply(null,
            [exports].concat(system.args.slice(1))));
}
