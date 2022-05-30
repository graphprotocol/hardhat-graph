import path from 'path'
import immutable from 'immutable'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const graphCli = require('@graphprotocol/graph-cli/src/cli')
const Protocol = require('@graphprotocol/graph-cli/src/protocols')
const { chooseNodeUrl } = require('@graphprotocol/graph-cli/src/command-helpers/node')
const { withSpinner, step } = require('@graphprotocol/graph-cli/src/command-helpers/spinner')
const { generateScaffold, writeScaffold } = require('@graphprotocol/graph-cli/src/command-helpers/scaffold')

export const initSubgraph = async (taskArgs: { contractName: string, address: string }, hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  await withSpinner(
    `Create subgraph scaffold`,
    `Failed to create subgraph scaffold`,
    `Warnings while creating subgraph scaffold`,
    async (spinner: any) => {
      let node
      let { contractName, address } = taskArgs
      let subgraphPath = hre.config.paths.subgraph!
      let network = hre.network.name || hre.config.defaultNetwork
      let {
        name,
        product,
        indexEvents,
        allowSimpleName,
      } = hre.config.subgraph!

      ;({ node, allowSimpleName } = chooseNodeUrl({ product, allowSimpleName }))

      validateSubgraphName(name!, allowSimpleName)
      validateProduct(product!)

      let protocolInstance = new Protocol('ethereum')
      let ABI = protocolInstance.getABI()
      let artifact = await hre.artifacts.readArtifact(contractName)
      let abi = new ABI(contractName, undefined, immutable.fromJS(artifact.abi))

      let scaffold = await generateScaffold(
        {
          protocolInstance,
          network,
          subgraphName: name,
          abi,
          contract: address,
          contractName,
          indexEvents,
          node,
        },
        spinner,
      )

      await writeScaffold(scaffold, subgraphPath, spinner)

      return true
    }
  )

export const updateNetworksFile = async (toolbox: any, network: string, dataSource: string, address: string, directory: string): Promise<void> => {
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

export const runBuild = async (network: string, directory: string): Promise<boolean> => {
  await graphCli.run(['build', path.join(directory, 'subgraph.yaml'), '-o', path.join(directory, 'build'), '--network', network, '--networkFile', path.join(directory, 'networks.json')])
  return true
}

//0xC75650fe4D14017b1e12341A97721D5ec51D5340
export const runGraphAdd = async (taskArgs: { contractName: string, address: string, mergeEntities: boolean, abi: string, help: boolean }, directory: string) => {
  let commandLine = ['add', taskArgs.address, path.join(directory, 'subgraph.yaml')]
  if (taskArgs.mergeEntities) {
    commandLine.push('--merge-entities')
  }
  if (taskArgs.abi) {
    commandLine.push('-abi', taskArgs.abi)
  }
  if (taskArgs.help) {
    commandLine.push('-h')
  }
  await graphCli.run(commandLine)
}

const validateSubgraphName = (name: string, allowSimpleName: boolean | undefined): void => {
  if (name.split('/').length !== 2 && !allowSimpleName) {
    throw new Error(
`Subgraph name "${name}" needs to have the format "<PREFIX>/${name}".
When using the Hosted Service at https://thegraph.com, <PREFIX> is the
name of your GitHub user or organization. You can configure the name in the hardhat.config:

module.exports = {
  ...
  subgraph: {
    ...
    product: 'hosted-service',
    name: '<PREFIX>/${name}',
    ...
  },
}

Or you can bypass this check by setting allowSimpleName to true in the hardhat.config:
module.exports = {
  ...
  subgraph: {
    ...
    product: 'hosted-service',
    allowSimpleName: true,
    ...
  },
}`)
  }
}


export const validateProduct = (product: string): void => {
  let availableProducts = ['subgraph-studio', 'hosted-service']

  if (!availableProducts.includes(product)) {
    throw new Error(`Unsupported product ${product}. Currently available products are ${availableProducts.join(' and ')}`)
  }
}
