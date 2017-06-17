module.exports = {
    "root": true,
    "env": {
        "browser": true,
        "node": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module"
    },
    "rules": {

        "no-unused-vars": [
            "warn",
            { "vars": "all", "args": "after-used", "ignoreRestSiblings": false }
        ],
        "no-console": [
            "warn"
        ],

        "indent": [
            "warn",
            4,
            {SwitchCase: 1}
        ],
        "linebreak-style": [
            "off",
            "unix"
        ],
        "quotes": [
            "error",
            "double"
        ],
        "semi": [
            "error",
            "always"
        ],

        "no-var": 2,

        /* Node.js */
        "callback-return":     "error", //enforce return after a callback
        "global-require":      2, //enforce require() on top-level module scope
        "handle-callback-err": 2, //enforce error handling in callbacks
        "no-mixed-requires":   2, //disallow mixing regular variable and require declarations
        "no-new-require":      2, //disallow use of new operator with the require function
        "no-path-concat":      "error", //disallow string concatenation with __dirname and __filename
        "no-process-exit":     2, //disallow process.exit()
        "no-restricted-modules": [1, ""], //restrict usage of specified node modules
        "no-sync": 1, //disallow use of synchronous methods
    }
};