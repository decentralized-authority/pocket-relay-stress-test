import { RelayRequest, RelayResponse } from './interfaces';
import { getRandom, timeout } from './util';
import { PocketUtils } from './pocket-utils';
import request from 'superagent';

export class Runner {

  _pocketUtils: PocketUtils;
  _chainId: string;
  _requests: RelayRequest[]
  _length: number;
  _totalRequests: number;
  _isChainEndpoint: boolean;
  _logError: (err: any) => void;

  constructor(pocketUtils: PocketUtils, chainId: string, requests: RelayRequest[], length: number, isChainEndpoint: boolean, logError: (err: any)=>void) {
    this._pocketUtils = pocketUtils;
    this._chainId = chainId;
    this._requests = [...requests];
    this._length = length;
    this._totalRequests = requests.length;
    this._isChainEndpoint = isChainEndpoint;
    this._logError = logError;
  }

  async start(onResponse: (reponse: RelayResponse)=> void) {
    const responses: RelayResponse[] = [];
    await new Promise<void>(resolve => {
      const interval = (this._length * 60) / this._totalRequests;
      const requestInterval = setInterval(async () => {
        const [ currentRequest ] = this._requests.splice(0, 1);
        if(!currentRequest)
          return;
        let res: RelayResponse;
        if(this._isChainEndpoint) {
          const start = Date.now();
          try {
            const { body } = await request
              .post(`${this._pocketUtils.endpoint}${currentRequest.path}`)
              .type('application/json')
              .timeout(60000)
              .send(JSON.parse(currentRequest.data));
            const end = Date.now();
            const { error, result } = body;
            if(error)
              throw JSON.stringify(error);
            res = {
              timestamp: start,
              duration: end - start,
              chainId: this._chainId,
              payload: currentRequest.data,
              response: result,
              error: null,
            };
          } catch(err) {
            const end = Date.now();
            if(err?.errno && err?.code && err?.syscall && err?.hostname)
              err = JSON.stringify(err);
            this._logError(err);
            res = {
              timestamp: start,
              duration: end - start,
              chainId: this._chainId,
              payload: currentRequest.data,
              response: null,
              error: err,
            };
          }
        } else {
          res = await this._pocketUtils.postRelay(this._chainId, currentRequest);
        }
        responses.push(res);
        onResponse(res);
        if(responses.length === this._totalRequests) {
          clearInterval(requestInterval);
          resolve();
        }
      }, interval * 1000);
    });
    return responses
      .sort((a, b) => a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? 1 : -1);
  }

}
