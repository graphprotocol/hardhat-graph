# Hardhat-graph

## `init` subtask:
  - Expects two parameters: `contractName: 'MyContract'` and `address: '0x123..`
  - Workflow:
    - Generates a subgraph in `./subgraph` using `generateScaffold` from `graph-cli`
    - Generates a network.json file in `./subgraph` using `initNetworksConfig` from `graph-cli`
    - Initialises a new repo if one does not currently exist. (Currently it does not create an initial commit)
    - Generates or updates an existing .gitignore file.
    - Runs `codegen` command
  - Example usage:
```typescript
async function deploy(contractName: string) {
  ....
  await contract.deployed();
  return { contractName: contractName , address: contract.address}
}

deploy()
  .then((result) => hre.run('init', result))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## `update` subtask:
  - Expects two parameters: `contractName: 'MyContract'` and `address: '0x123..`
  - Workflow:
    - Updates the contract ABI in `./subgraph/abis`
    - Updates the contract Address in `network.json` if it's deployed to the same network. If the contract has been deployed to a network that is not present in the config file, adds an entry for the new network.
    - Checks for changes to the contract events. If there are any changes the task will exit and the user will be informed and prompted to address the changes in the subgraph.yaml file and manually run `codegen` and `build`.
    - Runs `codegen` and `build` commands if there are no changes to the contract events.
  - Example usage:
```typescript
async function deploy(contractName: string) {
  ....
  await contract.deployed();
  return { contractName: contractName , address: contract.address}
}

deploy()
  .then((result) => hre.run('update', result))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## `graph` task:
  - Expects two parameters: `contractName: 'MyContract'` and `address: '0x123..` and an optional positional parameter `subtask` <init|update>.
  - Workflow:
    - Conditionally runs either `init` or `update` subtask depending if a subgraph already exists or not. If the optional param `subtask` is passed it will run that subtask instead.
  - Example usage:
```typescript
async function deploy(contractName: string) {
  ....
  await contract.deployed();
  return { contractName: MyContract , address: contract.address}
}

deploy()
  .then((result) => hre.run('graph', result))
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```
or
```sh
npx hardhat graph <init|update> --contract-name MyContract --address 0x123... # the subtask parameter is optional
```
## `add` task:
  - Expects one mandatory parameter: `address: '0x123..`
  - Has four optional paramaters:
    - `subgraphYaml: /path/to/subgraph.yaml` (default is './subgraph.yaml')
    - `abi: /path/to/Contract.json` Loads abi from file
    - `mergeEntities` When this flag is given new entities with already taken names are skipped
    - `contractName: MyContract` (default is 'Contract')
  - Workflow:
    - Checks whether the subgraph exists and creates a command line of the arguments passed
    - Runs `graph add` from the graph-cli with the given params which updates the `subgraph.yaml`, `schema.graphql` and adds a new abi and mapping file
    - Runs `codegen`

  - Example usage:

```sh
npx hardhat add --address 0x123... --merge-entities
```
  

## How to try it out:
NOTE:
npm >7 should auto-install peerDependencies from plugins, but if they are not or you're using `yarn`, add
```
"@graphprotocol/graph-cli": "^0.30.0",
"@graphprotocol/graph-ts": "^0.27.0",
```
to the hardhat project package.json (Because the `graph add` command was added in version 0.30.0, this is also the minimum required version)

The plugin can be installed from the repo:

```json
{
  ...
  "devDependencies": {
    "hardhat-graph": "https://github.com/graphprotocol/hardhat-graph"
    ...
  }
}
```

or from a specific branch:

```json
{
  ...
  "devDependencies": {
    "hardhat-graph": "https://github.com/graphprotocol/hardhat-graph#branch_name"
    ...
  }
}
```

Import the plugin in your `hardhat.config` file:
JS: `require('hardhat-graph')`
TS: `import 'hardhat-graph'`

## Configurable options in hardhat.config file:
JS:
```javascript
module.exports = {
  ...
  subgraph: {
    name: 'MySubgraph', // Defaults to the name of the root folder of the hardhat project
    product: 'hosted-service'|'subgraph-studio', // Defaults to 'subgraph-studio'
    indexEvents: true|false, // Defaults to false
    allowSimpleName: true|false // Defaults to `false` if product is `hosted-service` and `true` if product is `subgraph-studio`
  },
  paths: {
    subgraph: './path/to/subgraph' // Defaults to './subgraph'
  }
}
```

TS:
```typescript
export default {
  ...
  subgraph: {
    name: 'MySubgraph', // Defaults to the name of the root folder of the hardhat project
    product: 'hosted-service'|'subgraph-studio', // Defaults to 'subgraph-studio'
    indexEvents: true|false, // Defaults to false
    allowSimpleName: true|false // Defaults to `false` if product is `hosted-service` and `true` if product is `subgraph-studio`
  },
  paths: {
    subgraph: './path/to/subgraph' // Defaults to './subgraph'
  }
}
```

## Issues to resolve:

- [ ] Instead of subtask `init` and `update` could be functions, this potentially could make them easier to integrated in variety of custom workflows
- [ ] `graph` task could be renamed
- [ ]  Include the `add` subtask/command/function to the `graph` task.
- [ ]  Add an option to auto-resolve events changes.
- [ ] Is it okay to create an initial commit when initialising a repo? We would not want to commit hardhat files that otherwise should not be committed
- [ ] Properly set peerDeps versions
