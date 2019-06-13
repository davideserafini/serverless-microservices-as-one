'use strict'

const path = require('path')
const yaml = require('yaml-boost')

/**
 * Get lambdas from config file
 * @param {object} config - serverless.yml, as parsed by yaml-boost
 * @returns {object} the functions object as parsed from serverless.yml
 */
const getLambdas = (config) => {
  return config.functions
}

/**
 * Convert path params in aws format to the one used by express
 *
 * e.g. /{id} is converted into /:id
 * @param {string} path - path of the lambda function as declared in serverless.yml
 * @returns {string} path converted for express route
 */
const convertAwsPathParamToExpressPathParam = (path) => {
  return path.replace('{', ':').replace('}', '')
}

/**
 * Test if event is an http event
 * @param {object} event - event object as declared in serverless.yml for a single function
 * @returns {boolean}
 */
const isHttpEvent = (event) => {
  return !!event.http
}

/**
 * Test if one of these events is an http event
 * @param {object} lambda - lambda function as declared in serverless.yml
 * @returns {boolean}
 */
const hasHttpEvent = (lambda) => {
  return lambda.events && lambda.events.some((element) => isHttpEvent(element))
}

/**
 * Return the http event specification for this event, if present
 * @param {object} lambda - lambda function as declared in serverless.yml
 * @returns {(object|null)} the http object, or null if not found
 */
const getHttpEvent = (lambda) => {
  const event = lambda.events.find((element) => isHttpEvent(element))
  return (event && event.http) || null
}

/**
 * Get endpoint info for every function in the service
 * @param {object} configFile - serverless.yml, as parsed by yaml-boost
 * @returns {Array} array of endpoints objects with path and method
 */
const getEndpointsInService = (configFile) => {
  const lambdas = getLambdas(configFile)
  const endpoints = Object.keys(lambdas)
    .filter((lambdaName) => hasHttpEvent(lambdas[lambdaName]))
    .map((lambdaName) => {
      const event = getHttpEvent(lambdas[lambdaName])
      // TODO: test if a regex replace would be faster
      const path = event.path
        .split('/')
        .map((element) => convertAwsPathParamToExpressPathParam(element))
        .join('/')
      return {
        path: path,
        method: event.method
      }
    })
  return endpoints
}

/**
 * Parse serverless.yml file in given path
 * @param {string} servicePath - path of a service
 */
const readServerlessFile = (servicePath) => {
  return yaml.load(path.join(servicePath, 'serverless.yml'))
}

module.exports = {
  readServerlessFile,
  getEndpointsInService
}
