import { PocketUtils } from './pocket-utils';
import { logError } from './util';
import { ProcessMessage, RelayRequest, RelayResponse } from './interfaces';
import { Runner } from './runner';
import { messageEvent } from './constants';

const [] = process.argv;

let endpoint = '';
let chainId = '';
let requestsJson = '';
let res = '';

process.on('message', message => {
  const { event, payload } = message as ProcessMessage;
  if(event === messageEvent.REQUESTS) {
    const { endpoint, chainId, length, requests } = payload as {endpoint: string, chainId: string, length: number, requests: RelayRequest[]};
    const pocketUtils = new PocketUtils(endpoint, err => logError(err));
    const runner = new Runner(pocketUtils, chainId, requests, length);
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
