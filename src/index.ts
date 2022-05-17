import path from 'path'
import "./type-extensions"
import {extendConfig} from "hardhat/config"

export * from "./tasks"

extendConfig((config) => {
  if(!config.paths.subgraph) {
    config.paths.subgraph = './subgraph'
  }

  if(!config.subgraph) config.subgraph = {}
  if(!config.subgraph.product) config.subgraph.product = 'subgraph-studio'
  if(!config.subgraph.name) config.subgraph.name = path.basename(config.paths.root)
})
