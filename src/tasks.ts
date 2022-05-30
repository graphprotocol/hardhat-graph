import path from 'path'
import * as YAML from 'yaml'
import immutable from 'immutable'
import * as toolbox from 'gluegun'
import { subtask, task } from 'hardhat/config'
import { compareAbiEvents } from './helpers/events'
import { checkForRepo, initRepository, initGitignore } from './helpers/git'
import { initSubgraph, runCodegen, runBuild, updateNetworksFile, runGraphAdd } from './helpers/subgraph'

const { withSpinner, step } = require('@graphprotocol/graph-cli/src/command-helpers/spinner')
const { initNetworksConfig } = require('@graphprotocol/graph-cli/src/command-helpers/network')

task("graph", "A do all task")
  .addOptionalPositionalParam("subtask", "Specify which subtask to execute")
  .addParam("contractName", "The name of the contract")
  .addParam("address", "The address of the contract")
  .setAction(async (taskArgs, hre) => {
      let directory = hre.config.paths.subgraph
      let subgraph = toolbox.filesystem.exists(directory) == "dir" && toolbox.filesystem.exists(path.join(directory, 'subgraph.yaml')) == "file"
      let command = subgraph ? "update" : "init"
      let { subtask, ...args } = taskArgs

      await hre.run(subtask || command, args)
  });


/// MAYBE INIT AND UPDATE SHOULD NOT BE SUBTASKS BUT JUST FUNCTIONS?
subtask("init", "Initialize a subgraph")
  .addParam("contractName", "The name of the contract")
  .addParam("address", "The address of the contract")
  .setAction(async (taskArgs, hre) => {
    const directory = hre.config.paths.subgraph

    if (toolbox.filesystem.exists(directory) == "dir" && toolbox.filesystem.exists(path.join(directory, 'subgraph.yaml')) == "file") {
      toolbox.print.error("Subgraph already exists! Please use the update subtask to update an existing subgraph!")
      process.exit(1)
    }

    let scaffold = await initSubgraph(taskArgs, hre)
    if (scaffold !== true) {
      process.exit(1)
    }

    let networkConfig = await initNetworksConfig(toolbox, directory, 'address')
    if (networkConfig !== true) {
      process.exit(1)
    }

    let isGitRepo = await checkForRepo(toolbox)
    if (!isGitRepo) {
      let repo = await initRepository(toolbox)
      if (repo !== true) {
        process.exit(1)
      }
    }

    // Maybe Not needed?
    let gitignore = await initGitignore(toolbox)
    if (gitignore !== true) {
      process.exit(1)
    }

    let codegen = await runCodegen(directory)
    if (codegen !== true) {
      process.exit(1)
    }
  })

subtask("update", "Updates an existing subgraph from artifact or contract address")
  .addParam("contractName", "The name of the contract")
  .addParam("address", "The address of the contract")
  .setAction(async (taskArgs: any, hre) => {
    const directory = hre.config.paths.subgraph
    const network = hre.network.name || hre.config.defaultNetwork
    const subgraph = toolbox.filesystem.read(path.join(directory, 'subgraph.yaml'), 'utf8')

    if (!toolbox.filesystem.exists(directory) || !subgraph) {
      toolbox.print.error("No subgraph found! Please first initialize a new subgraph!")
      process.exit(1)
    }

    await withSpinner(
      `Update subgraph`,
      `Failed to update subgraph`,
      `Warnings while updating subgraph`,
      async (spinner: any) => {
        step(spinner, `Fetching new contract version`)
        let contract = await hre.artifacts.readArtifact(taskArgs.contractName)

        step(spinner, `Fetching current contract version from subgraph`)
        let manifest = YAML.parse(subgraph)
        let dataSource = manifest.dataSources.find((source: { source: { abi: { name: string } } }) => source.source.abi == taskArgs.contractName)
        let subgraphAbi = dataSource.mapping.abis.find((abi: { name: string }) => abi.name == taskArgs.contractName)
        let currentAbiJson = toolbox.filesystem.read(path.join(directory, subgraphAbi.file))

        if (!currentAbiJson) {
          toolbox.print.error(`Could not read ${path.join(directory, subgraphAbi.file)}`)
          process.exit(1)
        }

        step(spinner, `Updating contract ABI in subgraph`)
        await toolbox.patching.update(path.join(directory, subgraphAbi.file), (abi: any) => {
          return contract.abi
        })

        step(spinner, `Updating contract's ${network} address in networks.json`)
        await updateNetworksFile(toolbox, network, dataSource.name, taskArgs.address, directory)

        step(spinner, `Checking events for changes`)
        let eventsChanged = await compareAbiEvents(spinner, toolbox, dataSource, contract.abi, currentAbiJson)
        if (eventsChanged) {
          process.exit(1)
        } else {
          let codegen = await runCodegen(directory)
          if (codegen !== true) {
            process.exit(1)
          }

          let build = await runBuild(network, directory)
          if (build !== true) {
            process.exit(1)
          }
        }
        return true
      }
    )
  })

task("add", "Add a datasource to the project")
  .addParam("address", "The address of the contract")
  .addOptionalParam("contractName", "The name of the contract", "Contract")
  .addOptionalParam("mergeEntities", "Whether the entities should be merged")
  .addOptionalParam("abi", "Path to local abi file")
  .setAction(async (taskArgs: any, hre) => {
    const directory = hre.config.paths.subgraph
    const subgraph = toolbox.filesystem.read(path.join(directory, 'subgraph.yaml'), 'utf8')

    if (!toolbox.filesystem.exists(directory) || !subgraph) {
      toolbox.print.error("No subgraph found! Please first initialize a new subgraph!")
      process.exit(1)
    }

    await withSpinner(
      `Add a new datasource`,
      `Failed to add a new datasource`,
      `Warnings while adding a new datasource`,
      async (spinner: any) => {
        step(spinner, `Initiating graph add command`)
        // let manifest = YAML.parse(subgraph)
        console.log(`\ndir: ${directory}\ncn: ${taskArgs.contractName}\naddress: ${taskArgs.address}\nmerge: ${taskArgs.mergeEntities}\nabi: ${taskArgs.abi}`)
        // let dataSource = manifest.dataSources.find((source: { source: { abi: { name: string } } }) => source.source.abi == taskArgs.contractName)
        await runGraphAdd(taskArgs, directory)
        return true
      }
    )
  })
