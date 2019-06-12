const {
  readdirSync,
  statSync
} = require('fs');
const path = require('path');
const yaml = require('yaml-boost');
const {
  spawn
} = require('child_process');

// Get lambdas from config file
const getLambdas = (config) => {
  return config.functions;
}

// Parse endpoints for each function
const getEndpointsForService = (configFile) => {
  const lambdas = getLambdas(configFile);
  const events = Object.keys(lambdas)
    .filter((element) => lambdas[element].events && lambdas[element].events[0].http)
    .map((element) => {
      const event = lambdas[element].events[0].http;
      const path = event.path
        .split('/')
        .map((element) => {
          // Express uses :param for named parameters, serverless uses {param}
          if (!element.startsWith('{')) {
            return element;
          } else {
            return element.replace('{', ':').replace('}', '');
          }
        })
        .join('/');
      return {
        path: path,
        method: event.method
      }
    });
  return events;
}

// Run servless offline, bind its console output to the main console output and return the child process
const runService = (path, args, port) => {
  const slsArgs = ['offline', 'start', '--port', port].concat(args);
  const child = spawn('sls', slsArgs, {
    env: {...process.env, SLS_DEBUG: '*'},
    cwd: path
  });

  // Push all the console output to the app console output
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', function (data) {
    console.log(data);
  });

  child.on('close', function (code) {
    //Here you can get the exit code of the script
    if (code === 1) {
      console.log(`ERROR on service ${path}, it's not working now. Please check serveress.yml for issues`);
      // TODO: stop the entire app if somethings goes wrong here
    } else {
      console.log(`closing code: ${code} for service ${path}`);
    }
  });
  return child;
}


// STARTUP

// Parse config files
// TODO: pass /functions as argument from command line
const servicesRootDir = path.join(__dirname, '/../functions/')
const serviceDirectories = readdirSync(servicesRootDir).filter((element) => statSync(path.join(servicesRootDir, element)).isDirectory());

const childProcesses = [];
const basePort = 3002; // 3001 must be kept free for the proxy
let mapping = []; // Maps each endpoint to its serverless offline server

// Loop on each service and start it. A reference will be added to childProcesses
serviceDirectories.forEach((serviceDir, index) => {
  const serviceFullPath = path.join(servicesRootDir, '/', serviceDir);
  const processPort = basePort + index;
  // Run serverless offline. As this is running in its own process, it's execution become async once the process is spawn
  // TODO: pass stage argument from command line
  childProcesses.push(runService(serviceFullPath, ['--stage', 'dev'], processPort));

  // Read serverless.yml config
  const serverless = yaml.load(path.join(serviceFullPath, '/serverless.yml'));

  // Get endpoints for service and add the info related to the matching serverless offline server
  let endpoints = getEndpointsForService(serverless);
  endpoints = endpoints.map((element) => { element.host = `http://localhost:${processPort}`; return element; })

  // Update mappings
  mapping = mapping.concat(endpoints);
});

// INIT PROXY
const got = require('got');
const express = require('express');
const app = express();
app.use(express.json());
const appPort = 3001;
app.set('port', appPort);

console.log(mapping);

mapping.forEach((element) => {
  app[element.method]('/' + element.path, async (req, res) => {
    // Get necessary info to proxy request
    const endpoint = req.route.path.substr(1); // Remove initial /
    const url = req.url;
    const method = req.method.toLowerCase();
    const body = req.body;

    console.log({
      endpoint,
      url,
      method,
      body
    });

    // Find matching serverless server
    const servelessServer = mapping
      .find((element) => {
        return element.path === endpoint && element.method === method;
      });

    // Uh oh, nothing found
    if (!servelessServer) {
      res
        .status(404)
        .send(`Route ${method} ${url} not found`);
    } else {
      // Create full url for request
      const serverlessUrl = servelessServer.host + url;
      console.log(`Mapped request ${method} ${url} to ${serverlessUrl}`);

      // Add options, be sure to proxy everything needed (e.g. authorization header)
      const options = {
        method,
        json: true,
        headers: {
          authorization: req.headers.authorization
        }
      }

      // Add body
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        options.body = body;
      }

      // Send and hope it works :D
      const response = await got(serverlessUrl, options);
      res.status(response.statusCode).send(response.body);
    }
  });
});

const server = app.listen(app.get('port'), () => {
  console.log(`Example app listening on port ${appPort}!`);
});

// Ensure all child processes always exit
process.on( 'SIGTERM', function () {
  childProcesses.forEach((child) => {
    child.kill();
  });
  server.close();
  process.exit(1);
});
process.on( 'SIGINT', function () {
  childProcesses.forEach((child) => {
    child.kill();
  });
  server.close();
  process.exit(0);
});
