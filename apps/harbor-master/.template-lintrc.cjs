'use strict';

module.exports = {
  extends: 'recommended',
  rules: {
    'no-html-comments': false,
    // Game requires mousedown for path drawing start detection
    'no-pointer-down-event-binding': 'off',
  },
};
