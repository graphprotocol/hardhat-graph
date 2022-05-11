import { HardhatRuntimeEnvironment } from 'hardhat/types'
import path from 'path'
import immutable from 'immutable'
const graphCli = require('@graphprotocol/graph-cli/src/cli')
const Protocol = require('@graphprotocol/graph-cli/src/protocols')
const { chooseNodeUrl } = require('@graphprotocol/graph-cli/src/command-helpers/node')
const { withSpinner, step } = require('@graphprotocol/graph-cli/src/command-helpers/spinner')
const { generateScaffold, writeScaffold } = require('@graphprotocol/graph-cli/src/command-helpers/scaffold')
import { ethers } from 'ethers'

export const initSubgraph = async (taskArgs: { contract: string, address: string }, hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  await withSpinner(
    `Create subgraph scaffold`,
    `Failed to create subgraph scaffold`,
    `Warnings while creating subgraph scaffold`,
    async (spinner: any) => {
      let protocolInstance = new Protocol('ethereum')
      let ABI = protocolInstance.getABI()

      let contract = await hre.artifacts.readArtifact(taskArgs.contract)
      let abi = new ABI(contract.contractName, undefined, immutable.fromJS(contract.abi))
      let product = hre.config.subgraph?.product || 'subgraph-studio'
      let { node, allowSimpleName } = chooseNodeUrl({
        product: product,
        studio: undefined,
        node: undefined,
        allowSimpleName: true
      })
      // Maybe stuff like subgraphName, node/product, can be configuren in the hardhat.config under subgraph key
      // module.exports = {
      //  solidity: "0.8.4",
      //  subgraph: {
      //    name: "MySubgraph",
      //    product: "hosted-service" / 'subgraph-studio',
      //    ...
      //  },
      //  ...
      // }
      // then they can be accessed from hre.config.subgraph
      let scaffold = await generateScaffold(
        {
          protocolInstance,
          network: hre.network.name || hre.config.defaultNetwork,
          subgraphName: path.basename(hre.config.paths.root),
          abi,
          contract: taskArgs.address,
          contractName: contract.contractName,
          indexEvents: true,
          node,
        },
        spinner,
      )
      await writeScaffold(scaffold, hre.config.paths.subgraph, spinner)
      return true
    }
  )

export const initRepository = async (toolbox: any): Promise<boolean> =>
  await withSpinner(
    `Create git repository`,
    `Failed to create git repository`,
    `Warnings while creating git repository`,
    async (spinner: any) => {
      await toolbox.system.run('git init')
      // Not sure if it's okay to commit, as there may be hardhat files that are not supposed to be commited?
      // await system.run('git add --all')
      // await system.run('git commit -m "Initial commit"')
      return true
    }
  )

export const initGitignore = async (toolbox: any): Promise<boolean> =>
  await withSpinner(
    `Add subgraph files to .gitignore`,
    `Failed to add subgraph files to .gitignore`,
    `Warnings while adding subgraph files to .gitignore`,
    async (spinner: any) => {
      step(spinner, "Check if .gitignore already exists")
      let ignoreExists = await toolbox.filesystem.exists('.gitignore')
      if (!ignoreExists) {
        step(spinner, "Create .gitignore file")
        await toolbox.system.run('touch .gitignore')
      }

      step(spinner, "Add subgraph files and folders to .gitignore file")
      await toolbox.patching.append('.gitignore', '# Matchstick\nsubgraph/tests/.*/\n\n# Subgraph\nsubgraph/generated/\nsubgraph/build/\n')
      return true
    }
  )

export const runCodegen = async (hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  await graphCli.run(['codegen', path.join(hre.config.paths.subgraph, 'subgraph.yaml'), '-o',  path.join(hre.config.paths.subgraph, 'generated')])
  return true
}

export const runBuild = async(network: string, hre: HardhatRuntimeEnvironment): Promise<boolean> => {
  await graphCli.run(['build', path.join(hre.config.paths.subgraph,'subgraph.yaml'), '-o', path.join(hre.config.paths.subgraph,'build'), '--network', network, '--networkFile', path.join(hre.config.paths.subgraph,'networks.json')])
  return true
}

export const checkForRepo = async (toolbox: any): Promise<boolean> => {
  try {
    let result = await toolbox.system.run('git rev-parse --is-inside-work-tree')
    return result === 'true'
  } catch(err: any) {
    if (err.stderr.includes('not a git repository')) {
      return false
    } else {
      throw Error(err.stderr)
    }
  }
}

export const getEvents = async (abi: ethers.utils.Interface): Promise<string[]> => {
  return Object.keys(abi.events)
}

export const eventsDiff = async (array1: string[], array2: string[]): Promise<string[]> => {
  return array1.filter(x => !array2.includes(x))
}

export const updateNetworksFile = async(network: string, dataSource: string, address: string, hre: HardhatRuntimeEnvironment, toolbox: any): Promise<void> => {
  await toolbox.patching.update(path.join(hre.config.paths.subgraph, 'networks.json'), (config: any) => {
    if(Object.keys(config).includes(network)) {
      config[network][dataSource].address = address
    } else {
      config[network] = { [dataSource]: { address: address } }
    }
    return config
  })
}
