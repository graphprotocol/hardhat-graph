const Protocol = require('@graphprotocol/graph-cli/src/protocols')
const { withSpinner, step } = require('@graphprotocol/graph-cli/src/command-helpers/spinner')
const { generateScaffold, writeScaffold } = require('@graphprotocol/graph-cli/src/command-helpers/scaffold')
import * as toolbox from 'gluegun'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import path from 'path'
import immutable from 'immutable'

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
          network: hre.network.name,
          subgraphName: path.basename(hre.config.paths.root),
          abi,
          contract: taskArgs.address,
          contractName: contract.contractName,
          indexEvents: false,
          node: 'https://api.studio.thegraph.com/deploy/'
        },
        spinner,
      )
      await writeScaffold(scaffold, 'subgraph', spinner)
      return true
    }
  )

export const initRepository = async (): Promise<boolean> =>
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

export const initGitignore = async (): Promise<boolean> =>
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

export const runCodegen = async (): Promise<boolean> =>
  await withSpinner(
    `Generate ABI and schema types`,
    `Failed to generate code from ABI and GraphQL schema`,
    `Warnings while generating code from ABI and GraphQL schema`,
    async (spinner: any) => {
      await toolbox.system.run('npx graph codegen', { cwd: 'subgraph' } )
      return true
    }
  )
