import request from 'superagent';
import { RelayResponse } from './interfaces';
import { isPlainObject } from 'lodash';

export class PocketUtils {

  endpoint: string;
  _logError: (err: any) => void;

  constructor(endpoint: string, logError: (err: any) => void) {
    this.endpoint = endpoint;
    this._logError = logError;
  }

  async getVersion(): Promise<any> {
    try {
      const { body } = await request
        .get(`${this.endpoint}/v1`)
        .timeout(10000);
      return body;
    } catch(err) {
      this._logError(err);
      return '';
    }
  }

  async postRelay(chainId: string, payload: any): Promise<RelayResponse> {
    const start = Date.now();
    try {
      const res = await request
        .post(`${this.endpoint}/v1/client/sim`)
        .type('application/json')
        .timeout(60000)
        .send({
          relay_network_id: chainId,
          payload,
        });
      const end = Date.now();
      const { error, result } = JSON.parse(res.body);
      if(error)
        throw JSON.stringify(error);
      return {
        timestamp: start,
        duration: end - start,
        chainId,
        payload,
        response: result,
        error: null,
      };
    } catch(err) {
      if(err?.errno && err?.code && err?.syscall && err?.hostname)
        err = JSON.stringify(err);
      const end = Date.now();
      this._logError(err);
      return {
        timestamp: start,
        duration: end - start,
        chainId,
        payload,
        response: null,
        error: err,
      };
    }
  }

}
