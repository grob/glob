# glob

A glob pattern resolver for RingoJS

## Features

This module uses the [fnmatch](https://github.com/grob/fnmatch) module for glob
pattern conversion, and thus supports all of its glob pattern features.

## Usage

```javascript
var glob = require("glob");
var paths = glob("./**/*.js");
console.dir(paths);
```

## Options

- `dot` (default: false): `glob` by default doesn't match files or directories
  whose name contains a leading dot. This changes if this option is set to `true`.
- `globstar` (default: true): if false `**` doesn't traverse across directory
  boundaries, instead it's interpreted as two `*` wildcards
- `ignore`: A single glob pattern or an array of patterns to be ignored, i.e.
  all resolved paths matching this option will be excluded from the result.

## Glob results

The result returned by `glob` is always an array. If the pattern can't be resolved,
`glob` returns an empty array. All paths returned are sorted in the way the
default [Array.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
behaves.

## Notes

- `glob` as of now doesn't follow symlinks
- `glob` doesn't have an `ignoreCase` option because the internally used
  `java.io.File` doesn't have one. So it entirely relies on the case
  (in-)sensitivity of the underlying operating system.
- Any glob pattern negation (leading `!`) is ignored. Use the `ignore` option
  instead.

## A note for Windows users

`glob` expects all patterns to be forward slash (`/`) separated, and will return
all paths using the forward slash as separator. These paths can be used directly
(eg. by utilizing the standard RingoJS `fs` module).
