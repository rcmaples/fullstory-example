import { ApolloLink } from 'apollo-link';
import { customAlphabet } from 'nanoid';
import { getDeviceInfo } from './device-info';

const generateCorrelationId = () =>
  customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 12)();

export const globalHeadersMiddleware = new ApolloLink((operation, forward) => {
  const headers = operation.getContext().headers;
  const deviceInfo = getDeviceInfo();
  const playerCardForBetPayout = localStorage.getItem('playerCardForBetPayout');
  const playerCard = playerCardForBetPayout
    ? playerCardForBetPayout
    : localStorage.getItem('playerCard');
  const activitySession = localStorage.getItem('activitySession');
  const optionalHeaders = {
    ...(playerCard !== 'NONE' && playerCard && { 'Player-Id': playerCard }),
    ...(activitySession && { 'Activity-Session-Id': activitySession })
  };
  operation.setContext({
    headers: {
      ...headers,
      ...optionalHeaders,
      'Device-Id': deviceInfo.deviceId,
      'Device-Type': deviceInfo.slotId.type,
      'Correlation-Id': generateCorrelationId(),
      'Slot-Number': deviceInfo.slotId.slotNumber,
      'Venue-Id': deviceInfo.slotId.venueId,
      'Venue-Code': deviceInfo.slotId.venueCode,
      'Tenant-Id': '99'
    }
  });
  return forward(operation);
});

export const authHeaderMiddleware = new ApolloLink((operation, forward) => {
  const headers = operation.getContext().headers;
  operation.setContext({
    headers: {
      ...headers,
      Authorization: `Bearer ${localStorage.getItem('user')}`
    }
  });
  return forward(operation);
});

export const appNameHeaderMiddleware = (appName: string) =>
  new ApolloLink((operation, forward) => {
    const headers = operation.getContext().headers;
    operation.setContext({
      headers: {
        ...headers,
        'Application-Name': appName
      }
    });
    return forward(operation);
  });
