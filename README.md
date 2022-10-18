# Pocket Relay Stress Test
Easily stress test Pocket nodes and Ethereum-based relay chains

## Usage

### Test a node
```
docker run --rm -ti decentralizedauthority/pocket-relay-stress-test:x.x.x --endpoints http://my-pokt-node.example --chain 0021
```

### Test multiple nodes
```
docker run --rm -ti decentralizedauthority/pocket-relay-stress-test:x.x.x --endpoints http://my-pokt-node.example,http://my-eth-node.example --chain 0021
```

### Test a node and save logs
```
docker run --rm -ti -v /home/me/stress-test-logs:/root/log decentralizedauthority/pocket-relay-stress-test:x.x.x --endpoints http://my-pokt-node.example --chain 0021
```

### View the CLI help
```
docker run --rm -ti decentralizedauthority/pocket-relay-stress-test:x.x.x --help
```

## CLI Reference
```
Required flags:
  -e, --endpoints        Comma-separated list of URL endpoints of Pocket nodes with simulate relay enabled or Ethereum-based chain nodes e.g http://localhost:8081
  -c, --chain           Relay chain id (https://docs.pokt.network/supported-blockchains)

Optional flags:
  -i, --instances       Number of runner instances (processes) to divide requests among (default 5)
  -r, --requests        Total number of request to send (default 1800)
  -d, --duration        Total number of minutes to spread the requests over (default 1)
  -m, --method          The RPC method to call on the chain node (default eth_getBlockByNumber)
  --log-dir             Directory to store logs (default $HOME/log)

Other:
  -h, --help            Show CLI help
  -v, --version         Show version
```
