import fs from 'fs'
import path from 'path'
import process from 'process'
import immutable from 'immutable'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { parseName } from 'hardhat/utils/contract-names'

const graphCli = require('@graphprotocol/graph-cli/src/cli')
const Protocol = require('@graphprotocol/graph-cli/src/protocols')
const { chooseNodeUrl } = require('@graphprotocol/graph-cli/src/command-helpers/node')
const { withSpinner } = require('@graphprotocol/graph-cli/src/command-helpers/spinner')
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
      let abi = new ABI(artifact.contractName, undefined, immutable.fromJS(artifact.abi))

      let scaffold = await generateScaffold(
        {
          protocolInstance,
          network,
          subgraphName: name,
          abi,
          contract: address,
          contractName: artifact.contractName,
          dataSourceName: contractName,
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
      Object.assign(config[network], { [dataSource]: { "address": address } })
    } else {
      Object.assign(config, { [network]: { [dataSource]: { "address": address } }})
    }
    return config
  })
}

export const runCodegen = async (directory: string): Promise<boolean> => {
  if (fs.existsSync(directory)) {
    process.chdir(directory)
  }
  await graphCli.run(['codegen'])
  return true
}

export const runBuild = async (network: string, directory: string): Promise<boolean> => {
  if (fs.existsSync(directory)) {
    process.chdir(directory)
  }
  await graphCli.run(['build', '--network', network])
  return true
}

export const runGraphAdd = async (taskArgs: { contractName: string, address: string,
  mergeEntities: boolean, abi: string, subgraphYaml: string }, directory: string) => {
  if (fs.existsSync(directory)) {
    process.chdir(directory)
  }

  let { 
    abi,
    address,
    contractName,
    mergeEntities,
    subgraphYaml
  } = taskArgs

  ;({ contractName } = parseName(contractName))
  let commandLine = ['add', address, '--contract-name', contractName]
  
  if (subgraphYaml.includes(directory)) {
    commandLine.push(path.normalize(subgraphYaml.replace(directory, '')))
  } else {
    commandLine.push(subgraphYaml)
  }

  if (mergeEntities) {
    commandLine.push('--merge-entities')
  }

  if (abi) {
    if (abi.includes(directory)) {
      commandLine.push('--abi', path.normalize(abi.replace(directory, '')))
    } else {
      commandLine.push('--abi', abi)
    }  
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
