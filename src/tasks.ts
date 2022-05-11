import { subtask, task } from 'hardhat/config'
import { initSubgraph, initRepository, initGitignore, runCodegen, runBuild, checkForRepo, getEvents, eventsDiff, updateNetworksFile } from './task_helpers'
import * as toolbox from 'gluegun'
import * as YAML from 'yaml'
import path from 'path'
import immutable from 'immutable'
import { ethers } from 'ethers'
import { spawn } from 'child_process'
const { withSpinner, step } = require('@graphprotocol/graph-cli/src/command-helpers/spinner')
const { initNetworksConfig } = require('@graphprotocol/graph-cli/src/command-helpers/network')

task("graph", "A do all task")
  .addOptionalPositionalParam("subtask", "Specify which subtask to execute")
  .addParam("contract", "The name of the contract")
  .addParam("address", "The address of the contract")
  .setAction(async (taskArgs, hre) => {
      let subgraph = toolbox.filesystem.exists(hre.config.paths.subgraph) == "dir" && toolbox.filesystem.exists(path.join(hre.config.paths.subgraph, 'subgraph.yaml')) == "file"
      let command = subgraph ? "update" : "init"
      let { subtask, ...args } = taskArgs

      await hre.run(subtask || command, args)
  });


/// MAYBE INIT AND UPDATE SHOULD NOT BE SUBTASKS BUT JUST FUNCTIONS?
subtask("init", "Initialize a subgraph")
  .addParam("contract", "The name of the contract")
  .addParam("address", "The address of the contract")
  .setAction(async (taskArgs, hre) => {
    if(toolbox.filesystem.exists(hre.config.paths.subgraph) == "dir" && toolbox.filesystem.exists(path.join(hre.config.paths.subgraph, 'subgraph.yaml')) == "file") {
      toolbox.print.error("Subgraph already exists! Please use the update subtask to update an existing subgraph!")
      process.exit(1)
    }

    let scaffold = await initSubgraph(taskArgs, hre)
    if (scaffold !== true) {
      process.exitCode = 1
      return
    }

    let networkConfig = await initNetworksConfig(toolbox, hre.config.paths.subgraph, 'address')
    if (networkConfig !== true) {
      process.exitCode = 1
      return
    }

    let isGitRepo = await checkForRepo(toolbox)
    if (!isGitRepo) {
      let repo = await initRepository(toolbox)
      if (repo !== true) {
        process.exitCode = 1
        return
      }
    }

    // Maybe Not needed?
    let gitignore = await initGitignore(toolbox)
    if (gitignore !== true) {
      process.exitCode = 1
      return
    }

    let codegen = await runCodegen(hre)
    if (codegen !== true) {
      process.exitCode = 1
      return
    }
  })

subtask("update", "Updates an existing subgraph from artifact or contract address")
  .addParam("contract", "The name of the contract")
  .addParam("address", "The address of the contract")
  .setAction(async (taskArgs: any, hre) => {
    const network = hre.network.name || hre.config.defaultNetwork
    const subgraph = await toolbox.filesystem.read(path.join(hre.config.paths.subgraph, 'subgraph.yaml'), 'utf8')
    if (!toolbox.filesystem.exists(hre.config.paths.subgraph) || !subgraph) {
      toolbox.print.error("No subgraph found! Please first initialize a new subgraph!")
      process.exit(1)
    }

    await withSpinner(
      `Update subgraph`,
      `Failed to update subgraph`,
      `Warnings while updating subgraph`,
      async (spinner: any) => {
        // New contract version
        step(spinner, `Fetching new contract version`)
        let contract = await hre.artifacts.readArtifact(taskArgs.contract)

        // Old contract version
        step(spinner, `Fetching current contract version from subgraph`)
        let manifest = YAML.parse(subgraph)
        let dataSource = manifest.dataSources.find((source: { source: { abi: { name: string } } }) => source.source.abi == taskArgs.contract)
        let subgraphAbi = dataSource.mapping.abis.find((abi: { name: string }) => abi.name == taskArgs.contract)
        let abiJson = await toolbox.filesystem.read(path.join(hre.config.paths.subgraph, subgraphAbi.file))

        if (!abiJson) {
          toolbox.print.error(`Could not read ${path.join(hre.config.paths.subgraph, subgraphAbi.file)}`)
          process.exit(1)
        }
        // Convert to Interface
        let newAbi = new ethers.utils.Interface(contract.abi)
        let currentAbi = new ethers.utils.Interface(abiJson)

        // Fetch new events from Interface
        let newAbiEvents = await getEvents(newAbi)
        // Fetch current dataSource events from subgraph.yaml
        let currentAbiEvents = dataSource.mapping.eventHandlers.map((handler: { event: string }) => { return handler.event })
        let newEvents = await eventsDiff(newAbiEvents, currentAbiEvents)
        let removedEvents = await eventsDiff(currentAbiEvents, newAbiEvents)

        // Update the subgraph ABI
        step(spinner, `Updating contract ABI in subgraph`)
        await toolbox.patching.update(path.join(hre.config.paths.subgraph, subgraphAbi.file), (abi: any) => {
          return contract.abi
        })

        step(spinner, `Updating contract's ${network} address in networks.json`)
        await updateNetworksFile(network, dataSource.name, taskArgs.address, hre, toolbox)

        step(spinner, `Checking for changes to the contract events`)
        if(newAbiEvents.length != currentAbiEvents.length || newEvents.length != 0 || removedEvents.length != 0) {
          toolbox.print.warning(
            `Contract events have been changed!\nCurrent events:\n ${currentAbiEvents.join('\n ')}\nNew events:\n ${newAbiEvents.join('\n ')}\nPlease address the change in your subgraph.yaml and run graph codegen and graph build from the subgraph folder!`
          )
        } else {
          let codegen = await runCodegen(hre)
          if (codegen !== true) {
            process.exit(1)
            return
          }

          let build = await runBuild(network, hre)
          if (build !== true) {
            process.exitCode = 1
            return
          }
        }
        return true
      }
    )
  })
