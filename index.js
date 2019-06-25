'use strict'

const {
  readdirSync,
  statSync
} = require('fs')
const argv = require('minimist')(process.argv.slice(2))
const path = require('path')

const server = require('./lib/server/server')
const serverlessConfig = require('./lib/serverless/configuration')
const processManager = require('./lib/server/process_manager')

/**
 * Check if all required command line arguments are passed
 * @param {object} args
 */
const checkRequiredArguments = (commandLineArguments) => {
  const requiredArguments = ['servicesFolderPath']
  const commandLineArgumentNames = Object.keys(commandLineArguments)
  return requiredArguments.every((argument) => {
    return commandLineArgumentNames.includes(argument)
  })
}

// STARTUP

// Check if required args are present
if (!checkRequiredArguments(argv)) {
  console.log('Usage node index.js --servicesFolderPath path/to/services/directory')
  process.exitCode = 1
} else {
  // Parse serverless config files
  const serviceFolderPath = argv['servicesFolderPath']
  const servicesRootDir = path.isAbsolute(serviceFolderPath) ? serviceFolderPath : path.join(__dirname, serviceFolderPath)
  const serviceDirectories = readdirSync(servicesRootDir).filter((element) => statSync(path.join(servicesRootDir, element)).isDirectory())

  // Get serverless offline args
  let slsOfflineArgs = []
  const stage = argv['stage'] || null
  if (stage) {
    slsOfflineArgs = [...slsOfflineArgs, '--stage', stage]
  }

  // Get app port
  const appPort = argv['appPort'] || 3001

  // Restrict sls starting port to a value greater than appPort, to avoid collisions
  const slsBasePort = argv['port'] && argv['port'] > appPort ? argv['port'] : appPort + 1

  let mapping = [] // Maps each endpoint to its serverless offline server
  const slsProcessManager = processManager()

  // Loop on each service and start it. A reference will be added to childProcesses
  serviceDirectories.forEach((serviceDir, index) => {
    const serviceFullPath = path.join(servicesRootDir, serviceDir)
    // Read serverless.yml config
    const serverlessFile = serverlessConfig.readServerlessFile(serviceFullPath)

    const processPort = slsBasePort + index
    // Get endpoints for service and add the info related to the matching serverless offline server
    let endpoints = serverlessConfig.getEndpointsInService(serverlessFile)
    endpoints = endpoints.map((element) => {
      element.host = `http://localhost:${processPort}`
      return element
    })

    // Update mappings
    mapping = mapping.concat(endpoints)

    // Run serverless offline. As this is running in its own process, its execution becomes async once the process is spawn
    slsProcessManager.startService(serviceFullPath, slsOfflineArgs, processPort)
  })

  // INIT SERVER
  const appServer = server(appPort, mapping)

  // Ensure all child processes always exit
  process.on('SIGTERM', function () {
    slsProcessManager.stopService('SIGTERM')
    appServer.close()
    process.exit(1)
  })
  process.on('SIGINT', function () {
    slsProcessManager.stopService('SIGINT')
    appServer.close()
    process.exit(0)
  })
}
