import "./type-extensions";
import {extendConfig} from "hardhat/config";
export * from "./tasks";

extendConfig((config) => {
  if(!config.paths.subgraph) {
    config.paths.subgraph = './subgraph'
  }
});
