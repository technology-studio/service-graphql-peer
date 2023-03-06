/**
 * @Author: Rostislav Simonik <rostislav.simonik@technologystudio.sk>
 * @Date:   2018-07-04T16:21:57+02:00
 * @Copyright: Technology Studio
**/

import type { ServiceError } from '@txo/service-prop'
import {
  ServiceErrorKey,
} from '@txo/service-prop'
import { Log } from '@txo/log'
import type {
  FetchResult,
  ApolloError,
  ServerError,
  ServerParseError,
} from '@apollo/client'
import {
  isApolloError,
} from '@apollo/client'

import type {
  OperationOptions,
  ExtendedGraphQlError,
} from '../Model/Types'
import { UNKNOWN_ERROR } from '../Model'

const log = new Log('txo.service-graphql-peer.Services.ResponseTranslator')

const populateGraphQLErrors = (serviceErrorList: ServiceError[], error: ExtendedGraphQlError): void => {
  serviceErrorList.push({
    key: error.key != null && error.key !== ''
      ? error.key
      : (error.extensions?.code != null && error.extensions.code !== '')
          ? error.extensions.code as string
          : ServiceErrorKey.SERVER_ERROR,
    message: error.message,
    data: error,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isApolloErrorInternal = (response: any): response is ApolloError => isApolloError(response)
export const isServerError = (error: Error | ServerParseError | ServerError): error is ServerError => 'result' in error
export const isServerParseError = (error: Error | ServerParseError | ServerError): error is ServerParseError => 'statusCode' in error

export const defaultErrorResponseTranslator = (response: FetchResult<unknown> | ApolloError, options: OperationOptions): ServiceError[] => {
  log.debug('TRANSLATE GRAPH_QL ERROR RESPONSE', { response, options })
  const serviceErrorList: ServiceError[] = []
  if (isApolloErrorInternal(response)) {
    const { networkError, clientErrors, graphQLErrors, message } = response
    if (networkError != null) {
      serviceErrorList.push({
        key: isServerParseError(networkError) ? ServiceErrorKey.CLIENT_ERROR : ServiceErrorKey.NETWORK_ERROR,
        message: (networkError.message != null && networkError.message.length > 0)
          ? networkError.message
          : message,
        data: networkError,
      })
      if (isServerError(networkError)) {
        networkError.result.errors?.forEach((error: ExtendedGraphQlError) => {
          populateGraphQLErrors(serviceErrorList, error)
        })
      }
    }
    graphQLErrors.forEach((graphQLError: ExtendedGraphQlError) => {
      const { key } = graphQLError
      serviceErrorList.push({
        key: (key != null && key !== '')
          ? key
          : ServiceErrorKey.CLIENT_ERROR,
        message: (graphQLError.message != null && graphQLError.message !== '')
          ? graphQLError.message
          : message,
        data: graphQLError,
      })
    })
    clientErrors.forEach((error) => {
      serviceErrorList.push({
        key: ServiceErrorKey.CLIENT_ERROR,
        message: error.message,
        data: error,
      })
    })
  } else {
    response.errors?.forEach(error => {
      populateGraphQLErrors(serviceErrorList, error)
    })
  }
  if (serviceErrorList.length === 0) {
    serviceErrorList.push({
      key: UNKNOWN_ERROR,
      message: 'Unknown error',
      data: response,
    })
  }
  return serviceErrorList
}
