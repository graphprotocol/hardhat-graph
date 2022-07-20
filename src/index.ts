import path from 'path'
import "./type-extensions"
import { extendConfig, experimentalAddHardhatNetworkMessageTraceHook, subtask } from "hardhat/config"
import { TASK_NODE_SERVER_READY } from "hardhat/builtin-tasks/task-names";
import { BlockWithTransactions, TransactionResponse, TransactionReceipt } from '@ethersproject/abstract-provider';
import '@nomiclabs/hardhat-ethers';

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

subtask(TASK_NODE_SERVER_READY).setAction(async (args, hre, runSuper) => {
  hre.ethers.provider.on('block', (blockNumber: number, error: any) => console.log('block #: ' + blockNumber));
  hre.ethers.provider.on('error', (error: any) => console.log(error));
  hre.ethers.provider.on('pending', () => console.log("pending"));
  await runSuper(args);
});

experimentalAddHardhatNetworkMessageTraceHook(async (hre, trace, isMessageTraceFromACall) => {
  console.log('TRACE: ' + trace);
});
