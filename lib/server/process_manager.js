'use strict'

const {
  spawn
} = require('child_process')

/**
 * ProcessManager is used to handle all logic related to child processes
 */
function ProcessManager () {
  // Will handle references to all child processes
  let childProcesses = []

  /**
   * Run servless offline, bind its console output to the main console output and return the child process
   *
   * @param {string} path
   * @param {array} args
   * @param {integer} port
   */
  const startService = (path, args, port) => {
    const slsArgs = ['offline', 'start', '--port', port].concat(args)
    const child = spawn('sls', slsArgs, {
      cwd: path
    })

    // Push all the console output to the app console output
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (data) => {
      console.log(data)
    })

    child.on('close', (code) => {
      // Here you can get the exit code of the script
      if (code === 1) {
        console.log(`ERROR on service ${path}, it's not working now. Please check serveress.yml for issues`)
        // TODO: stop the entire app if somethings goes wrong here
      } else {
        console.log(`closing code: ${code} for service ${path}`)
      }
    })
    childProcesses = [...childProcesses, child]
  }

  /**
   * Send stop signal to every child process
   * @param {string} mode, i.e. SIGTERM
   */
  const stopService = (mode) => {
    childProcesses.forEach((child) => {
      child.kill(mode)
    })
    childProcesses = []
  }

  return {
    startService,
    stopService
  }
}

/**
 * Return an instance of ProcessManager
 */
const createProcessManager = () => {
  return new ProcessManager()
}

exports = module.exports = createProcessManager
