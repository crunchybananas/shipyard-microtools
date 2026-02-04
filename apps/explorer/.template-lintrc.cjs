'use strict';

module.exports = {
  extends: 'recommended',
  rules: {
    'no-html-comments': false,
    // Dashboard uses inline styles for dynamic widths
    'no-inline-styles': 'off',
    'style-concatenation': 'off',
    // Using aria-label instead of wrapping labels
    'require-input-label': 'off',
    // Allow subexpressions for imported helpers
    'no-unnecessary-curly-parens': 'off',
  },
};
