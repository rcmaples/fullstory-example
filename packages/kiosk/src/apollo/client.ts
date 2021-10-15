import ApolloClient, { DefaultOptions } from 'apollo-client';
import { ApolloLink, split, from } from 'apollo-link';
import { onError } from 'apollo-link-error';
import { HttpLink } from 'apollo-link-http';
import { getMainDefinition } from 'apollo-utilities';
import {
  InMemoryCache,
  IntrospectionFragmentMatcher
} from 'apollo-cache-inmemory';
import { SubscriptionClient } from 'subscriptions-transport-ws';
import {
  handleGraphqlServerError,
  handleGraphqlResponseErrors
} from './errors';
import {
  globalHeadersMiddleware,
  authHeaderMiddleware,
  appNameHeaderMiddleware
} from './middleware';
import { getDeviceInfo } from './device-info';

const responseHttpCodeIs200 = (response: any) =>
  response && response.status && response.status === 200;

const onGraphqlServerError = onError(
  ({ graphQLErrors, networkError, operation }) => {
    const { response, skipGlobalErrorHandling } = operation.getContext();
    if (!responseHttpCodeIs200(response) && !skipGlobalErrorHandling) {
      const errorCode = response ? response.status : 502;
      const errors = graphQLErrors
        ? [networkError, ...graphQLErrors]
        : [networkError];

      handleGraphqlServerError(errorCode, errors);
    }
  }
);

export const interceptHttpResponse = new ApolloLink((operation, forward) => {
  return forward(operation).map(response => {
    if (response.errors && !operation.getContext().skipGlobalErrorHandling) {
      handleGraphqlResponseErrors(
        response.errors as any,
        operation.operationName,
        operation.variables
      );
    }
    return response;
  });
});

const fragmentMatcher = new IntrospectionFragmentMatcher({
  introspectionQueryResultData: {
    __schema: {
      types: [
        {
          kind: 'INTERFACE',
          name: 'BetMessagePayload',
          possibleTypes: [
            {
              name: 'BetPlacedPayload'
            },
            {
              name: 'BetRejectedPayload'
            }
          ]
        }
      ]
    }
  }
});

export default function initClient(appName: string, urls: any) {
  const link = new HttpLink({ uri: urls.http });
  const httpLink = interceptHttpResponse.concat(link);

  const { slotId } = getDeviceInfo();

  const wsClient = new SubscriptionClient(urls.ws, {
    reconnect: true,
    connectionParams: {
      venueId: slotId.venueId,
      deviceType: slotId.type,
      slotNumber: slotId.slotNumber
    }
  });

  const httpLinkWithSubscriptions = split(
    ({ query }) => {
      const { kind, operation }: any = getMainDefinition(query);
      return kind === 'OperationDefinition' && operation === 'subscription';
    },
    wsClient as any,
    httpLink
  );

  const defaultOptions: DefaultOptions = {
    watchQuery: {
      fetchPolicy: 'cache-and-network'
    },
    query: {
      fetchPolicy: 'network-only'
    }
  };

  const client = new ApolloClient({
    cache: new InMemoryCache({ fragmentMatcher }),
    link: from([
      globalHeadersMiddleware,
      appNameHeaderMiddleware(appName),
      authHeaderMiddleware,
      onGraphqlServerError,
      httpLinkWithSubscriptions
    ]),
    defaultOptions
  });

  (client as any).domain = urls.http;
  return client;
}
