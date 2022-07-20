import path from 'path'
import "./type-extensions"
import { extendConfig, experimentalAddHardhatNetworkMessageTraceHook } from "hardhat/config"
import { config } from 'process'

export * from "./tasks"

extendConfig((config) => {
  console.log("in extendConfig")
  if (!config.paths.subgraph) {
    config.paths.subgraph = './subgraph'
  }

  const defaultConfig = {
    name: path.basename(config.paths.root),
    product: 'subgraph-studio',
    allowSimpleName: false,
    indexEvents: false,
  }

  config.subgraph = Object.assign(defaultConfig, config.subgraph)
})

experimentalAddHardhatNetworkMessageTraceHook(async (hre, trace, isMessageTraceFromACall) => {
  console.log('TRACE: ' + trace);
});
