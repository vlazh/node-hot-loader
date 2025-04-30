/* eslint-disable import/extensions */
import path from 'path';
import { NodeHotLoaderWebpackPlugin } from '../../dist/NodeHotLoaderWebpackPlugin.js';

export default {
  entry: {
    main: './index.js',
  },

  output: {
    path: path.join(import.meta.dirname, 'out'),
    filename: 'bundle.js',
  },

  target: 'node',
  mode: 'development',

  plugins: [new NodeHotLoaderWebpackPlugin({ inMemory: true })],
};
