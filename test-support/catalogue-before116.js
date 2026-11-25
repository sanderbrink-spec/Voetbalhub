'use strict';

// Exercise historical recovery paths that explicitly start with no eligible artwork.
module.exports = function catalogueBefore116(t) {
  const library = require('../image-library49');
  const historical = library.catalog().filter(asset => !asset.id.startsWith('stadium116-'));
  t.mock.method(library, 'catalog', () => historical);
};
