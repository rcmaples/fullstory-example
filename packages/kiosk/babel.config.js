module.exports = function(api) {
  const presets = ['react-app'];
  api.cache.never();

  return { presets };
};
