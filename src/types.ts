export type InitTokensResponse = {
  firstToken: Token
  secondToken: Token
}

export type Substate = {
  resource: string
  component: string
}

export type Token = {
  substate: Substate
  symbol: string
  balance: number
}
