const path = require('path');
const { override, addDecoratorsLegacy, babelInclude, addWebpackAlias } = require('customize-cra');

module.exports = (config, env) => {
  // https://github.com/arackaf/customize-cra/issues/282
  config.plugins = config.plugins.filter(plugin => plugin.key !== 'ESLintWebpackPlugin');
  config.resolve.plugins = config.resolve.plugins.filter(plugin => plugin.constructor.name !== `ModuleScopePlugin`);
  return Object.assign(
    config,
    override(
      addDecoratorsLegacy(),
      babelInclude([path.resolve('src'), path.resolve(__dirname, './shared')]),
      addWebpackAlias({
        '@williamhill/rosi-ui-shared': path.resolve(__dirname, './shared/')
      })
    )(config, env)
  );
};
