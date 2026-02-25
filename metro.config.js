// metro.config.js
// Ensures any accidental `cheerio` import resolves to an RN-compatible build.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  cheerio: require.resolve("cheerio-without-node-native"),
};

module.exports = config;

