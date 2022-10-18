import { PocketUtils } from './pocket-utils';
import { isError, isString } from 'lodash';
import { getRandom, getRandomInt, createErrorLogger, createLogger, timeout } from './util';
import { ProcessMessage, RelayRequest, RelayResponse } from './interfaces';
import { fork } from 'child_process';
import path from 'path';
import { messageEvent } from './constants';
import colors from 'colors/safe';
import { stdout as log } from 'single-line-log';
import request from 'superagent';
import commandLineArgs from 'command-line-args';
import fs from 'fs-extra';
import Web3 from 'web3';

const definitions = [
  {name: 'endpoints', alias: 'e', type: String},
  {name: 'chain', alias: 'c', type: String},
  {name: 'instances', alias: 'i', type: Number},
  {name: 'requests', alias: 'r', type: Number},
  {name: 'duration', alias: 'd', type: Number},
  {name: 'method', alias: 'm', type: String},
  {name: 'log-dir', type: String},
  {name: 'help', alias: 'h', type: Boolean},
  {name: 'version', alias: 'v', type: Boolean},
];

const { version } = fs.readJsonSync(path.resolve(__dirname, '../package.json'));

const logHelp = () => {
  console.log(`
${colors.bold('Pocket Relay Stress Tester')} v${version}
${colors.dim('Easily stress test Pocket nodes and Ethereum-based relay chains')}

${colors.bold('Required flags:')}
  -e, --endpoints        ${colors.dim('Comma-separated list of URL endpoints of Pocket nodes with simulate relay enabled or Ethereum-based chain nodes e.g http://localhost:8081')}
  -c, --chain           ${colors.dim('Relay chain id (https://docs.pokt.network/supported-blockchains)')}

${colors.bold('Optional flags:')}
  -i, --instances       ${colors.dim('Number of runner instances (processes) to divide requests among (default 5)')}
  -r, --requests        ${colors.dim('Total number of request to send (default 1800)')}
  -d, --duration        ${colors.dim('Total number of minutes to spread the requests over (default 1)')}
  -m, --method          ${colors.dim('The RPC method to call on the chain node (default eth_getBlockByNumber)')}
  --log-dir             ${colors.dim('Directory to store logs (default $HOME/log)')}

${colors.bold('Other:')}
  -h, --help            ${colors.dim('Show CLI help')}
  -v, --version         ${colors.dim('Show version')}
`);
};

const options = commandLineArgs(definitions, {stopAtFirstUnknown: true});

const {
  chain = '',
  instances = 5,
  requests: totalRequests = 1800,
  duration = 1,
  method = 'eth_getBlockByNumber',
  'log-dir': logDir = process.env.HOME ? path.join(process.env.HOME, 'log') : path.resolve(__dirname, '../log'),
} = options;

const endpointsStr = options.endpoints as string || '';

if(options._unknown && options._unknown.length > 0) {
  console.log(`\nUnknown ${options._unknown.length > 1 ? 'options' : 'option'}`);
  logHelp();
  process.exit();
} else if(options.help) {
  logHelp();
  process.exit();
} else if(options.version) {
  console.log(version);
  process.exit();
} else if(!endpointsStr) {
  console.log('Missing required flag --endpoints');
  process.exit();
} else if(!chain) {
  console.log('Missing required flag --chain');
  process.exit();
}

fs.ensureDirSync(logDir);

const logger = createLogger();
const logInfo = (message: string): void => {
  logger.info(message);
};

const errorLogger = createErrorLogger(logDir);
const logError = (err: any): void => {
  if(isString(err)) {
    errorLogger.error(err);
  } else if(isError(err) || (err?.message && err?.stack)) {
    errorLogger.error(`${err?.message}\n${err?.stack}`);
  } else {
    console.error(err);
  }
};

const startRunner = (endpoint: string, chainId: string, length: number, requests: RelayRequest[], isChainEndpoint: boolean, onResponse: (response: RelayResponse)=>void, onError: (err: any)=>void): Promise<RelayResponse[]> => {
  return new Promise((resolve, reject) => {
    const instance = fork(path.join(__dirname, 'start-runner'));
    instance.on('message', message => {
      const { event, payload } = message as ProcessMessage;
      if(event === messageEvent.RESPONSES) {
        resolve(payload as RelayResponse[]);
        instance.kill();
      } else if(event === messageEvent.RESPONSE) {
        onResponse(payload as RelayResponse);
      } else if(event === messageEvent.ERROR) {
        onError(payload);
      }
    });
    instance.on('error', reject);
    instance.send({
      event: messageEvent.REQUESTS,
      payload: {endpoint, chainId, length, requests, isChainEndpoint}
    });
  });
};

const allRequests: RelayRequest[] = [];

const runTests = async function(endpoint: string) {

  const pocketUtils = new PocketUtils(endpoint, err => logError(err));

  const version = await pocketUtils.getVersion();
  let isChainEndpoint = false;

  let startingBlock = 0;

  if(!version || !isString(version)) { // is chain node endpoint
    let body: any;
    try {
      const res = await request
        .post(endpoint)
        .type('application/json')
        .timeout(10000)
        .send({
          id: getRandom(),
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
        });
      body = res.body;
    } catch(err) {
      throw new Error(`Unable to reach endpoint ${endpoint}`);
    }
    if(body?.error) {
      throw new Error(JSON.stringify(body.error));
    }
    startingBlock = Web3.utils.hexToNumber(body.result) - 15000;
    isChainEndpoint = true;
  } else if(method === 'eth_getBlockByNumber') { // is pocket node endpoint
    const { response } = await pocketUtils.postRelay(
      chain,
      {
        data: JSON.stringify({
          id: getRandom(),
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
        }),
        method: 'POST',
        path: '/',
        headers: {}
      }
    );
    startingBlock = Web3.utils.hexToNumber(response) - 15000;
  }

  if(allRequests.length === 0) {
    for(let i = 0; i < totalRequests; i++) {
      const offset = getRandomInt(0, 5000);
      let params: any[] = [];
      if(method === 'eth_getBlockByNumber') {
        params = [Web3.utils.numberToHex(startingBlock - offset), false];
      }
      allRequests.push({
        data: JSON.stringify({
          id: getRandom(),
          jsonrpc: '2.0',
          method,
          params,
        }),
        method: 'POST',
        path: '/',
        headers: {},
      });
    }
  }

  const allResponses: RelayResponse[] = [];

  console.log('');

  let percentComplete = -1;
  const onResponse = (response: RelayResponse) => {
    allResponses.push(response);
    const percent = Math.floor((allResponses.length / totalRequests) * 100);
    if(percent !== percentComplete) {
      let percentStr = percent.toString(10);
      while(percentStr.length < 3) {
        percentStr = ' ' + percentStr;
      }
      percentComplete = percent;
      log(`${percentStr}% ${colors.dim('complete')}`);
    }
  };

  const totalRequestsForRunner = totalRequests / instances;
  const runners = [];
  for(let i = 0; i < instances; i++) {
    const start = i * totalRequestsForRunner;
    const runnerRequests = allRequests.slice(start, start + totalRequestsForRunner);
    runners.push(() => startRunner(endpoint, chain, duration, runnerRequests, isChainEndpoint, onResponse, err => logError(err)));
  }

  await Promise.all(runners.map(r => r()));

  const sortedResponses: RelayResponse[] = allResponses
    .sort((a, b) => a.timestamp === b.timestamp ? 0 : a.timestamp > b.timestamp ? 1 : -1);

  const sortedByDuration: RelayResponse[] = [...sortedResponses]
    .sort((a, b) => a.duration === b.duration ? 0 : a.duration > b.duration ? 1 : -1);

  const shortest = sortedByDuration[0];
  const longest = sortedByDuration[sortedByDuration.length - 1];
  const middle = (sortedByDuration.length / 2);
  let median;
  if(middle !== Math.floor(middle)) {
    median = sortedByDuration[Math.floor(middle)].duration;
  } else {
    const idx0 = middle - 1;
    const idx1 = idx0 + 1;
    median = (sortedByDuration[idx0].duration + sortedByDuration[idx1].duration) / 2;
  }

  // console.log(sortedResponses[0]);
  // console.log(sortedResponses[Math.floor(sortedResponses.length / 2)]);
  // console.log(sortedResponses[sortedResponses.length - 1]);

  const successResponses = sortedResponses.filter(r => !r.error);
  const errorResponses = sortedResponses.filter(r => !!r.error);

  const averageDuration = successResponses.reduce((sum, r) => sum + r.duration, 0) / successResponses.length;

  const durationColor = averageDuration < 100 ? colors.green : averageDuration < 1000 ? colors.yellow : colors.red;

  console.log('\n');
  console.log(`         endpoint:  ${endpoint}`);
  console.log(`           method:  ${method}`);
  console.log(`  median duration:  ${durationColor(median.toFixed(3))}`);
  console.log(` average duration:  ${durationColor(averageDuration.toFixed(3))}`);
  console.log(`shortest duration:  ${durationColor(shortest.duration.toFixed(3))}`);
  console.log(` longest duration:  ${durationColor(longest.duration.toFixed(3))}`);
  console.log(`  reqs per second:  ${instances * totalRequestsForRunner / (duration * 60)}`);
  console.log(`   total requests:  ${sortedResponses.length}`);
  console.log(`    success count:  ${colors.green(successResponses.length.toString(10))}`);
  console.log(`      error count:  ${errorResponses.length > 0 ? colors.red(errorResponses.length.toString(10)) : errorResponses.length.toString(10)}`);

};

const start = async function() {

  const endpoints = endpointsStr
    .split(',')
    .map(s => s.trim())
    .filter(s => !!s);
  for(let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    await runTests(endpoint);
    if(i < endpoints.length - 1)
      await timeout(30000);
  }
}

start()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
