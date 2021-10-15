import React from 'react';
import { ApolloProvider } from 'react-apollo';
import gql from 'graphql-tag';
import { useLazyQuery } from '@apollo/react-hooks';
import initApolloClient from './apollo/client';

// import * as FullStory from '@fullstory/browser';
// FullStory.init({ orgId: 'WRNY6' });

const client = initApolloClient('kiosk', {
  http: 'http://localhost:4000/graphql',
  ws: 'ws://localhost:4000/graphql'
});

const QUERY = gql`
  query {
    ping
  }
`;

const FAIL_QUERY = gql`
  query {
    nope
  }
`;

const App = () => {
  const [successQuery, successResult] = useLazyQuery(QUERY);
  const [failQuery, failResult] = useLazyQuery(FAIL_QUERY);
  return (
    <div>
      <div>This is the app</div>
      <div>
        {/* @ts-ignore */}
        <button onClick={successQuery}>Success</button>
        {successResult.data?.ping}
      </div>
      <div>
        {/* @ts-ignore */}
        <button onClick={failQuery}>Failure</button>
        {failResult?.error?.message}
      </div>
    </div>
  );
};

// eslint-disable-next-line
export default () => (
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
);
