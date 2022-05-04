import { subtask, task } from 'hardhat/config'
import { initSubgraph, initRepository, initGitignore, runCodegen, runBuild } from './task_helpers'
import * as toolbox from 'gluegun'
import * as YAML from 'yaml'
import path from 'path'
import immutable from 'immutable'
import { ethers } from 'ethers'
import { spawn } from 'child_process'
const { initNetworksConfig } = require('@graphprotocol/graph-cli/src/command-helpers/network')

task("graph", "A do all task")
  // .addOptionalPositionalParam("subtask", "Specify which subtask to execute")
  // .addParam("contract", "The name of the contract")
  // .addParam("address", "The address of the contract")
  .setAction(async (taskArgs) => {
      // Check if subgraph folder exists
      // If not run init
      // If exists check if contract exists
      // If exists, update
      // else add (when the add command is ready)
      // Alternatively pass a specific subtask to execute
  });


/// MAYBE INIT AND UPDATE SHOULD NOT BE SUBTASKS BUT JUST FUNCTIONS?
subtask("init", "Initialize a subgraph")
  .addParam("contract", "The name of the contract")
  .addParam("address", "The address of the contract")
  .setAction(async (taskArgs, hre) => {
    if(toolbox.filesystem.exists("subgraph") == "dir" && toolbox.filesystem.exists("subgraph/subgraph.yaml") == "file") {
      toolbox.print.error("Subgraph already exists! Please use the update subtask to update an existing subgraph!")
      process.exit(1)
    }

    let scaffold = await initSubgraph(taskArgs, hre)
    if (scaffold !== true) {
      process.exitCode = 1
      return
    }

    let networkConfig = await initNetworksConfig(toolbox, 'subgraph', 'address')
    if (networkConfig !== true) {
      process.exitCode = 1
      return
    }

    let isGitRepo = toolbox.filesystem.exists('.git')
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

    let codegen = await runCodegen()
    if (codegen !== true) {
      process.exitCode = 1
      return
    }
  })

subtask("update", "Updates an existing subgraph from artifact or contract address")
  .addParam("contract", "The name of the contract")
  .addParam("address", "The address of the contract")
  .setAction(async (taskArgs: any, hre) => {
    // Update the ABI in the subgraph/abis folder
    // Update the address in the networks file
    // Update the address in the subgraph.yaml
    // Check for changes to the events and inform the user
    let subgraph = await toolbox.filesystem.read(path.join('subgraph', 'subgraph.yaml'), 'utf8')
    if (!subgraph) {
      toolbox.print.error("No subgraph found! Please first initialize a new subgraph!")
      process.exit(1)
    }

    // New contract version
    let contract = await hre.artifacts.readArtifact(taskArgs.contract)

    // Old contract version
    let manifest = YAML.parse(subgraph)
    let dataSource = manifest.dataSources.find((source: { source: { abi: { name: string } } }) => source.source.abi == taskArgs.contract)
    let subgraphAbi = dataSource.mapping.abis.find((abi: { name: string }) => abi.name == taskArgs.contract)
    let abiJson = await toolbox.filesystem.read(path.join('subgraph', subgraphAbi.file))

    if (!abiJson) {
      toolbox.print.error(`Could not read ${path.join('subgraph', subgraphAbi.file)}`)
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
    await toolbox.patching.update(path.join('subgraph', subgraphAbi.file), (abi: any) => {
      return contract.abi
    })

    await updateNetworksFile(hre.network.name, dataSource.name, taskArgs.address)

    if(newAbiEvents.length != currentAbiEvents.length || newEvents.length != 0 || removedEvents.length != 0) {
      toolbox.print.warning(
        `Contract events have been changed!\nCurrent events:\n ${currentAbiEvents.join('\n ')}\nNew events:\n ${newAbiEvents.join('\n ')}\nPlease address the change in your subgraph.yaml and run graph codegen and graph build from the subgraph folder!`
      )
    } else {
      let codegen = await runCodegen()
      if (codegen !== true) {
        process.exitCode = 1
        return
      }

      let build = await runBuild(hre.network.name)
      if (build !== true) {
        process.exitCode = 1
        return
      }
    }
  })

const getEvents = async (abi: ethers.utils.Interface): Promise<string[]> => {
  return Object.keys(abi.events)
}

const eventsDiff = async (array1: string[], array2: string[]): Promise<string[]> => {
  return array1.filter(x => !array2.includes(x))
}

const updateNetworksFile = async(network: string, dataSource: string, address: string): Promise<void> => {
  await toolbox.patching.update(path.join('subgraph', 'networks.json'), (config: any) => {
    config[network][dataSource].address = address
    return config
  })
}
