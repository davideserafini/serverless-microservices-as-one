'use strict'

const got = require('got')

/**
 * Define error for route not found
 *
 * @param {string} method
 * @param {string} url
 */
class RouteNotFoundException extends Error {
  constructor (method, url) {
    const name = 'Route Not Found'
    super(`${name}: ${method}, ${url}`)
    this.method = method
    this.url = url
  }
}

/**
 * Find the matching serverless instance for the given route
 *
 * @param {object} mapping
 * @param {object} endpoint
 * @param {string} method
 */
const getServerlessInstance = (mapping, endpoint, method) => {
  return mapping
    .find((element) => {
      return element.path === endpoint && element.method === method
    })
}

/**
 * Create the complete url of the route for the serverless instance
 *
 * @param {object} servelessInstance
 * @param {string} url
 */
const buildServerlessInstanceUrl = (servelessInstance, url) => {
  return servelessInstance.host + url
}

/**
 * Proxy the request to the serverless offline instance (if found) and return its result
 *
 * @param {object} mapping
 * @param {string} endpoint
 * @param {string} url
 * @param {string} method
 * @param {object} headers
 * @param {object} body
 */
const proxyRequest = async (mapping, endpoint, url, method, headers, body) => {
  // Find matching serverless instance
  const servelessInstance = getServerlessInstance(mapping, endpoint, method)

  // Uh oh, nothing found
  if (!servelessInstance) {
    throw new RouteNotFoundException(method, url)
  }

  // Create full url for request
  const serverlessUrl = buildServerlessInstanceUrl(servelessInstance, url)
  console.log(`Mapped request ${method} ${url} to ${serverlessUrl}`)

  // Add options, be sure to proxy everything needed (e.g. authorization header)
  const options = {
    method,
    json: true,
    headers: {
      authorization: headers.authorization
    }
  }

  // Add body for methods that accept it
  if (method === 'post' || method === 'put' || method === 'patch') {
    options.body = body
  }

  // Send and hope it works :D
  return got(serverlessUrl, options)
}

module.exports = {
  proxyRequest,
  RouteNotFoundException
}
