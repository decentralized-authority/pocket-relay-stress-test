import { PocketUtils } from './pocket-utils';
import { ProcessMessage, RelayRequest, RelayResponse } from './interfaces';
import { Runner } from './runner';
import { messageEvent } from './constants';

const [] = process.argv;

let endpoint = '';
let chainId = '';
let requestsJson = '';
let res = '';

const logError = (err: any): void => {
  if(process.send)
    process.send({event: messageEvent.ERROR, payload: err});
};

process.on('message', message => {
  const { event, payload } = message as ProcessMessage;
  if(event === messageEvent.REQUESTS) {
    const { endpoint, chainId, length, requests, isChainEndpoint } = payload as {endpoint: string, chainId: string, length: number, requests: RelayRequest[], isChainEndpoint: boolean};
    const pocketUtils = new PocketUtils(endpoint, err => logError(err));
    const runner = new Runner(pocketUtils, chainId, requests, length, isChainEndpoint, logError);
    const onResponse = (response: RelayResponse) => {
      if(process.send)
        process.send({event: messageEvent.RESPONSE, payload: response});
    }
    runner.start(onResponse)
      .then(res => {
        if(process.send)
          process.send({event: messageEvent.RESPONSES, payload: res});
      })
      .catch(logError);
  }
});
