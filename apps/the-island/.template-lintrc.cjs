'use strict';

module.exports = {
  extends: 'recommended',
  rules: {
    'no-html-comments': false,
    // Game needs pointer events on SVG elements
    'no-invalid-interactive': 'off',
  },
};
