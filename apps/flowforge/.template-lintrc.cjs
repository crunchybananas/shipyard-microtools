'use strict';

module.exports = {
  extends: 'recommended',
  rules: {
    'require-input-label': 'off',
    // Flow canvas requires pointer down events for drag interactions
    'no-pointer-down-event-binding': 'off',
    'no-invalid-interactive': 'off',
  },
};
