import request from 'superagent';
import { RelayResponse } from './interfaces';

export class PocketUtils {

  _endpoint: string;
  _logError: (err: any) => void;

  constructor(endpoint: string, logError: (err: any) => void) {
    this._endpoint = endpoint;
    this._logError = logError;
  }

  async getVersion(): Promise<string> {
    try {
      const { body } = await request
        .get(`${this._endpoint}/v1`);
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
        .post(`${this._endpoint}/v1/client/sim`)
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
