import { subtask, task } from 'hardhat/config'
import { initSubgraph, initRepository, initGitignore, runCodegen } from './task_helpers'
import * as toolbox from 'gluegun'
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
    if(toolbox.filesystem.exists("subgraph")) {
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
      let repo = await initRepository()
      if (repo !== true) {
        process.exitCode = 1
        return
      }
    }

    // Maybe Not needed?
    let gitignore = await initGitignore()
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
  .setAction(async (taskArgs) => {
    // Update the ABI in the subgraph/abis folder
    // Update the address in the networks file
    // Update the address in the subgraph.yaml
    // Check for changes to the events and inform the user
  })
