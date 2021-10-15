import { DocumentNode } from 'apollo-link';
import { FetchPolicy } from 'apollo-client';

interface IContext {
  headers?: object;
  skipGlobalErrorHandling?: boolean;
}
export interface IPerformMutationSpec {
  client: any;
  context?: IContext;
  displayProcessingMessage?: string;
  variables: any;
  successCallback?(result?: any): void;
  failureCallback?(error: any): void;
  fetchPolicy?: FetchPolicy;
  mutation: DocumentNode;
}

export const genericSuccessModal = () => null;

export const handleFailure = (callback: any) => (error: any) =>
  callback ? callback(error) : null;

export const performMutation = (spec: IPerformMutationSpec) => {
  if (spec.displayProcessingMessage) {
    console.log(spec.displayProcessingMessage);
  }

  return spec.client
    .mutate({
      context: spec.context,
      mutation: spec.mutation,
      variables: spec.variables
    })
    .then(spec.successCallback || genericSuccessModal, (error: any) => {
      return spec.failureCallback ? spec.failureCallback(error) : null;
    });
};
