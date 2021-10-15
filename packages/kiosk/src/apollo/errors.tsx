import React from 'react';
import styled from 'styled-components';
import { path, pathOr } from 'rambda';
import TagManager from 'react-gtm-module';
import { GraphQLError } from 'graphql';

import { getDeviceInfo } from './device-info';

const logger = console;

export interface IErrorDetails {
  code: string;
  exception: {
    code?: string;
    description?: string;
    title?: string;
    details: any;
  };
  title?: string;
  details?: any;
}

export interface IGraphqlErrorResponse {
  message: string;
  extensions: IErrorDetails;
}

export interface IGraphqlErrors {
  graphQLErrors: IGraphqlErrorResponse[];
}

export const getRootCause = (error: IGraphqlErrors): IErrorDetails =>
  path(['graphQLErrors', 0, 'extensions'], error);

interface IErrorHandler {
  error: IErrorDetails;
  operationIdentifier: string;
  operationVariables: any;
}

const unauthenticated = () => {
  console.log('Logout');
};

const messageResolvers = {
  'MONEY-004': (error: IErrorDetails) => {
    const maxTransferAmount: number = path(
      ['exception', 'details', 'maxTransfer'],
      error
    );
    if (maxTransferAmount) {
      const formattedAmount = '$0.00';
      return `The maximum transfer amount allowed is ${formattedAmount}. Check value and try again.`;
    }
    return 'The requested operation is not permitted. Check details and try again.';
  },
  'MONEY-005': (error: IErrorDetails) => {
    return error.exception.description;
  }
} as any;

const resolveErrorMessage = (error: IErrorDetails) => {
  if (error.code && error.code in messageResolvers) {
    return messageResolvers[error.code](error);
  }
  return pathOr(
    'The request could not be completed because of an error',
    ['exception', 'description'],
    error
  );
};

const notFound = ({ operationIdentifier }: IErrorHandler) => {
  const notFoundOperationText = {
    bets: {
      title: 'Bet Not Found',
      context: 'The bet you were looking for does not exist'
    },
    default: {
      title: 'Not Found',
      context: 'Entity not found'
    }
  } as any;
  const operationText =
    notFoundOperationText[operationIdentifier] || notFoundOperationText.default;
  return console.log('showNotFoundModal', {
    actionAlign: 'center',
    title: operationText.title,
    context: operationText.context,
    width: 'default'
  });
};

const conflict = ({ error }: IErrorHandler) => {
  console.log('showFailureModal', {
    title: 'Unable to complete transaction',
    context: resolveErrorMessage(error)
  });
};

const showUnprocessableEntityFailureModal = ({
  operationIdentifier
}: IErrorHandler) => {
  const unprocessableEntityOperationText = {
    voidBet: {
      title: 'Unable to Void Bet',
      content: <Message>This bet cannot be voided</Message>,
      context: 'Try again later or contact customer support.'
    },
    payoutBet: {
      title: 'Unable to Payout Bet',
      content: <Message>This bet cannot be paid out</Message>,
      context:
        'This may be because the bet is awaiting settlement. Try again later or contact customer support.'
    },
    default: {
      title: 'Unprocessable Entity',
      content: '',
      context: 'The request could not be completed'
    }
  } as any;
  const operationText =
    unprocessableEntityOperationText[operationIdentifier] ||
    unprocessableEntityOperationText.default;
  return console.log('showFailureModal', {
    title: operationText.title,
    content: operationText.content,
    context: operationText.context
  });
};

const unprocessableEntity = (props: IErrorHandler) => {
  if (props.operationIdentifier === 'placeBets') {
    console.log(
      'handlePlaceBetUnprocessableEntity',
      props.error,
      props.operationVariables
    );
  } else {
    showUnprocessableEntityFailureModal(props);
  }
};

const forbidden = ({ error, operationIdentifier }: IErrorHandler) => {
  if (operationIdentifier === 'placeBets') {
    const reason = error.exception.details.reasons.find(
      (r: any) => r.reason === 'EXCEEDS_MAX_ANON_USER_STAKE'
    );
    if (reason && getDeviceInfo().slotId.type === 'KIOSK') {
      const amount = '$0.00';
      console.log('showInfoModal', {
        title: 'Unable to Place Bet',
        content: (
          <>
            <br />
            <br />
            <strong>Rewards Card Required</strong>
          </>
        ),
        context: `A total wager over ${amount} on a kiosk requires a Rewards Card. Scan your card or you can sign up for one with a member of staff.`
      });
      return;
    }
  }
  console.log('showFailureModal', {
    title: 'Unable to complete transaction',
    context: resolveErrorMessage(error)
  });
};

const systemError = (error: { message: string }[] | IErrorHandler) => {
  const title = 'System Error';
  const message = Array.isArray(error)
    ? error.map(({ message }) => message).join(', ')
    : error.error.code;

  logger.error(message);

  TagManager.dataLayer({
    dataLayer: {
      event: 'global-system-error',
      globalError: {
        name: title,
        message
      }
    },
    dataLayerName: 'USROSI'
  });

  console.log('showFailureModal', {
    title,
    context:
      'There has been a problem with the system. If the problem reoccurs, report to a member of staff.'
  });
};

const graphqlResponseErrorCodesMap = {
  403: forbidden,
  404: notFound,
  409: conflict,
  422: unprocessableEntity,
  400: unprocessableEntity, // Liberty returns 400 where WHBE returned 422 (it shouldn't, so not renaming yet)
  502: systemError
} as any;

export const handleGraphqlResponseErrors = (
  error: IGraphqlErrorResponse[],
  operationIdentifier: string,
  operationVariables: any
) => {
  const [firstError] = error;

  if (['login', 'getAllSports'].includes(operationIdentifier)) {
    return;
  }

  const errorType = pathOr('UNKNOWN', ['extensions', 'code'], firstError);

  if (errorType.startsWith('VOUCHER')) {
    return;
  }
  if (['UNAUTHENTICATED', 'SECURITY-005', 'SECURITY-006'].includes(errorType)) {
    return unauthenticated();
  }
  if (['FORBIDDEN'].includes(errorType)) {
    return;
  }

  // Specific patch to prevent global error when errors are returned for sgp on bettingOpportunities
  // TODO: Expectation is this will be removed when ROSI-11416 is implemented
  if (
    errorType === 'INTERNAL_SERVER_ERROR' &&
    operationIdentifier === 'bettingOpportunities'
  ) {
    return;
  }

  // ROSI-7917 This will be retried upto 10 times and the error message is handled elsewhere.
  if (
    pathOr(null, [0, 'extensions', 'code'], error) === 'BETTING-004' &&
    operationIdentifier === 'bets'
  ) {
    return;
  }

  // Specific patch to prevent the error occurring on the search page.
  const httpStatusPath = pathOr(502, ['path'], firstError);
  if (
    httpStatusPath.length &&
    (httpStatusPath.includes('searchSummary') ||
      httpStatusPath.includes('search'))
  ) {
    return;
  }

  // Specific patch for Rewards Card
  if (
    errorType === 'HTTP-404' &&
    httpStatusPath.length === 1 &&
    httpStatusPath[0] === 'card'
  ) {
    console.log('showCardNotFoundModal');
    return;
  }

  const httpStatusCode = pathOr(
    502,
    ['extensions', 'exception', 'code'],
    firstError
  );
  const errorCodeToUse = Object.keys(graphqlResponseErrorCodesMap).includes(
    httpStatusCode.toString()
  )
    ? httpStatusCode
    : 502;

  // ROSI-6077 Specific patch as we want to avoid the popup for an error that isn't real
  if (
    operationIdentifier === 'bettingOpportunities' &&
    errorCodeToUse === 400
  ) {
    return;
  }

  graphqlResponseErrorCodesMap[errorCodeToUse]({
    error: firstError.extensions,
    operationIdentifier,
    operationVariables
  });
};

const graphqlHttpCodeHandlers = {
  404: notFound,
  502: systemError
} as any;

export const handleGraphqlServerError = (
  responseHttpStatusCode: string,
  errorMessages: (GraphQLError | Error | undefined)[]
) => {
  const errorCodeToUse = Object.keys(graphqlHttpCodeHandlers).includes(
    responseHttpStatusCode
  )
    ? responseHttpStatusCode
    : 502;
  graphqlHttpCodeHandlers[errorCodeToUse](errorMessages);
};

const ApolloErrors = {
  handleGraphqlResponseErrors,
  handleGraphqlServerError
};

export const Message = styled.span`
  font-weight: bold;
  margin-top: 2rem;
  display: block;
`;

export default ApolloErrors;
