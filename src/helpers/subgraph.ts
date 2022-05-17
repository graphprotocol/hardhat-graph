import path from 'path'
import immutable from 'immutable'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const graphCli = require('@graphprotocol/graph-cli/src/cli')
const Protocol = require('@graphprotocol/graph-cli/src/protocols')
const { chooseNodeUrl } = require('@graphprotocol/graph-cli/src/command-helpers/node')
const { withSpinner, step } = require('@graphprotocol/graph-cli/src/command-helpers/spinner')
const { generateScaffold, writeScaffold } = require('@graphprotocol/graph-cli/src/command-helpers/scaffold')

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
      let { node, allowSimpleName } = chooseNodeUrl({
        product: hre.config.subgraph?.product,
        allowSimpleName: hre.config.subgraph?.allowSimpleName
      })

      let scaffold = await generateScaffold(
        {
          protocolInstance,
          network: hre.network.name || hre.config.defaultNetwork,
          subgraphName: hre.config.subgraph?.name,
          abi,
          contract: taskArgs.address,
          contractName: contract.contractName,
          indexEvents: hre.config.subgraph?.indexEvents,
          node,
        },
        spinner,
      )

      await writeScaffold(scaffold, hre.config.paths.subgraph, spinner)

      return true
    }
  )

export const updateNetworksFile = async(toolbox: any, network: string, dataSource: string, address: string, directory: string): Promise<void> => {
  await toolbox.patching.update(path.join(directory, 'networks.json'), (config: any) => {
    if(Object.keys(config).includes(network)) {
      config[network][dataSource].address = address
    } else {
      config[network] = { [dataSource]: { address: address } }
    }
    return config
  })
}

export const runCodegen = async (directory: string): Promise<boolean> => {
  await graphCli.run(['codegen', path.join(directory, 'subgraph.yaml'), '-o',  path.join(directory, 'generated')])
  return true
}

export const runBuild = async(network: string, directory: string): Promise<boolean> => {
  await graphCli.run(['build', path.join(directory,'subgraph.yaml'), '-o', path.join(directory, 'build'), '--network', network, '--networkFile', path.join(directory,'networks.json')])
  return true
}
