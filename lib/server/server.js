'use strict'

const express = require('express')
const proxy = require('./proxy')

/**
 * Istantiate the server
 *
 * @param {number} port
 * @param {object} mapping
 */
const createServer = (port, mapping) => {
  const app = express()
  app.use(express.json())
  app.set('port', port)

  setupRoutes(mapping, app)

  return app.listen(app.get('port'))
}

/**
 * Convert path params in aws format to the one used by express
 *
 * e.g. /{id} is converted into /:id
 * @param {string} path - path of the lambda function as declared in serverless.yml
 * @returns {string} path converted for express route
 */
const convertAwsPathParamToExpressPathParam = (path) => {
  // TODO: test if a regex replace would be faster
  return '/' + path.replace('{', ':').replace('}', '')
}

/**
 * Create all the routes for the express app
 *
 * @param {object} mapping
 * @param {object} app
 */
const setupRoutes = (mapping, app) => {
  mapping = mapping.map((element) => {
    element.path = convertAwsPathParamToExpressPathParam(element.path)
    return element
  })

  mapping.forEach((element) => {
    app[element.method](element.path, async (req, res) => {
      // Get necessary info to proxy request
      const endpoint = req.route.path
      const url = req.url
      const method = req.method.toLowerCase()
      const body = req.body
      const headers = req.headers

      try {
        // Proxy the request and return the result
        const response = await proxy.proxyRequest(mapping, endpoint, url, method, headers, body)
        res.status(response.statusCode).send(response.body)
      } catch (error) {
        // This should never happen, as express already returns 404 if the route is not found
        if (error instanceof proxy.RouteNotFoundException) {
          res
            .status(404)
            .send(`Route ${error.method} ${error.url} not found`)
        }
      }
    })
  })
}

exports = module.exports = createServer
