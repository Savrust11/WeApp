// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prefer ./shared (bundled copy for EAS Build) over ../shared (monorepo sibling for local dev)
const localShared = path.resolve(__dirname, 'shared');
const siblingShared = path.resolve(__dirname, '../shared');
const sharedPath = fs.existsSync(localShared)
  ? localShared
  : fs.existsSync(siblingShared)
    ? siblingShared
    : null;

if (sharedPath) {
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    '@shared': sharedPath,
  };
  config.watchFolders = [
    ...(config.watchFolders ?? []),
    sharedPath,
  ];
}

module.exports = config;
