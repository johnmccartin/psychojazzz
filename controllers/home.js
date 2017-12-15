/**
 * GET /
 * Home page.
 */
exports.index = (req, res) => {
  res.render('home', {
    title: 'Home',
    slug: ['home', 'front-end']
  });
};

/**
 * GET /
 * Instrument Builder
 */
exports.builder = (req, res) => {
  res.render('builder', {
    title: 'Builder',
    slug: ['builder', 'back-end']
  });
};
