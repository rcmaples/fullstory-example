import React from 'react';
import ApolloClient from 'apollo-client';
import { useApolloClient } from 'react-apollo';

export interface IWithApolloClient {
  client: ApolloClient<any>;
}

// There's a similar HoC provided by react-apollo but it doesn't seem to work in conjunction with
// useApolloClient in the same app (throws an invariant client not found error).
export default function withApolloClient<P extends IWithApolloClient>(
  Component: React.ComponentType<P>
) {
  return function WithApolloClientInner(props: Omit<P, 'client'>) {
    const client = useApolloClient();
    return <Component client={client} {...(props as any)} />;
  };
}
