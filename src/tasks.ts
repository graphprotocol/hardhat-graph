import path from 'path'
import * as YAML from 'yaml'
import * as toolbox from 'gluegun'
import { subtask, task } from 'hardhat/config'
import { compareAbiEvents } from './helpers/events'
import { checkForRepo, initRepository, initGitignore } from './helpers/git'
import { parseName } from 'hardhat/utils/contract-names'
import { initSubgraph, runCodegen, runBuild, updateNetworksFile, runGraphAdd } from './helpers/subgraph'


const Protocol = require('@graphprotocol/graph-cli/src/protocols')
const Subgraph = require('@graphprotocol/graph-cli/src/subgraph')
const { withSpinner, step } = require('@graphprotocol/graph-cli/src/command-helpers/spinner')
const { initNetworksConfig } = require('@graphprotocol/graph-cli/src/command-helpers/network')

task("graph", "Wrapper task that will conditionally execute init, update or add.")
  .addOptionalPositionalParam("subtask", "Specify which subtask to execute")
  .addParam("contractName", "The name of the contract")
  .addParam("address", "The address of the contract")
  .addFlag("mergeEntities", "Whether the entities should be merged")
  .setAction(async (taskArgs, hre) => {
    let directory = hre.config.paths.subgraph
    let manifestPath = path.join(directory, 'subgraph.yaml')
    let subgraph = toolbox.filesystem.exists(directory) == "dir" && toolbox.filesystem.exists(manifestPath) == "file"
    let command = 'init'
    
    if (subgraph) {
      let protocol = new Protocol('ethereum')
      let manifest = await Subgraph.load(manifestPath, { protocol })
      let { contractName } = taskArgs
      
      ;({ contractName } = parseName(contractName))
      
      let dataSourcePresent = manifest.result.get('dataSources').map((ds: any) => ds.get('name')).contains(contractName)

      command = dataSourcePresent ? "update" : "add"
    }

    let { subtask, ...args } = taskArgs
    if(command == 'add') args.abi = await getArtifactPath(hre, taskArgs.contractName)
    await hre.run(subtask || command, args)
  });

  const getArtifactPath = async (hre: any, contractName: string): Promise<string> => {
    let artifact = await hre.artifacts.readArtifact(contractName)
    return path.join(hre.config.paths.artifacts, artifact.sourceName, `${artifact.contractName}.json`)
  }


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

    // Generate matchstick.yaml
    toolbox.filesystem.file('matchstick.yaml', {
      content: YAML.stringify({
        testsFolder: `${directory}/tests`,
        manifestPath: `${directory}/subgraph.yaml`
      })
    })

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
  .setAction(async (taskArgs, hre) => {
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
        let artifact = await hre.artifacts.readArtifact(taskArgs.contractName)

        step(spinner, `Fetching current contract version from subgraph`)
        let manifest = YAML.parse(subgraph)

        let dataSource = manifest.dataSources.find((source: { source: { abi: string } }) => source.source.abi == artifact.contractName)
        let subgraphAbi = dataSource.mapping.abis.find((abi: { name: string }) => abi.name == artifact.contractName)
        let currentAbiJson = toolbox.filesystem.read(path.join(directory, subgraphAbi.file))

        if (!currentAbiJson) {
          toolbox.print.error(`Could not read ${path.join(directory, subgraphAbi.file)}`)
          process.exit(1)
        }

        step(spinner, `Updating contract ABI in subgraph`)
        await toolbox.patching.update(path.join(directory, subgraphAbi.file), (abi: any) => {
          return artifact.abi
        })

        step(spinner, `Updating contract's ${network} address in networks.json`)
        await updateNetworksFile(toolbox, network, dataSource.name, taskArgs.address, directory)

        step(spinner, `Checking events for changes`)
        let eventsChanged = await compareAbiEvents(spinner, toolbox, dataSource, artifact.abi)
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
  .addOptionalParam("subgraphYaml", "The location of the subgraph.yaml file", "subgraph.yaml")
  .addOptionalParam("contractName", "The name of the contract", "Contract")
  .addFlag("mergeEntities", "Whether the entities should be merged")
  .addOptionalParam("abi", "Path to local abi file")
  .setAction(async (taskArgs, hre) => {
    const directory = hre.config.paths.subgraph
    const subgraph = toolbox.filesystem.read(path.join(directory, taskArgs.subgraphYaml), 'utf8')

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
        await runGraphAdd(taskArgs, directory)
        return true
      }
    )
  })
