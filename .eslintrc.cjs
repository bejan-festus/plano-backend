

module.exports = {
  'env': {
    'es2021': true,
    'node': true,
  },
  'extends': 'google',
  'overrides': [
    {
      'env': {
        'node': true,
      },
      'files': [
        '.eslintrc.{js,cjs}',
      ],
      'parserOptions': {
        'sourceType': 'script',
      },
    },
  ],
  'parserOptions': {
    'ecmaVersion': 'latest',
    'sourceType': 'module',
  },
  'rules': {
    'linebreak-style': [ 'error', 'windows' ],
    'require-jsdoc': 'off',
    'arrow-spacing': 'error',
    'key-spacing': [ 'error', { 'beforeColon': false, 'afterColon': true } ],
    'object-curly-spacing': [ 'error', 'always' ],
    'space-in-parens': [ 'error', 'always' ],
    'keyword-spacing': 'error',
    'array-bracket-spacing': [ 'error', 'always' ],
    'spaced-comment': [ 'error', 'always' ],
    'max-len': [ 'error', { 'code': 700 } ],
    'no-unused-vars': 'error',
    'new-cap': [ 'error', { 'newIsCap': true, 'capIsNew': false } ],
    'prefer-const': 'off',
  },
};
