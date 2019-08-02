import HmrServer from './HmrServer';
import { tweakWebpackConfig } from './loader';

export default class NodeHotLoaderWebpackPlugin {
  options;

  /**
   * @param {{
   *  force: boolean;
   *  fork: boolean | string[];
   *  inMemory: boolean;
   *  logLevel: string;
   * }} options
   */
  constructor(options) {
    this.options = options;
  }

  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply(compiler) {
    if (!this.options.force && !compiler.options.watch) return;
    tweakWebpackConfig(compiler.options);
    const hmrServer = new HmrServer({ compiler, ...this.options });
    hmrServer.run(false);
  }
}
