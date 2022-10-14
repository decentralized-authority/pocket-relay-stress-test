export interface RelayRequest {
  data: string
  method: string
  path: string
  headers: any
}

export interface RelayResponse {
  timestamp: number
  duration: number
  chainId: string
  payload: any
  response: any
  error: Error|string|null
}

export interface ProcessMessage {
  event: string
  payload: any
}
