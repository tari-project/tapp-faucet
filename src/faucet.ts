import { SubmitTransactionRequest, TariProvider } from "@tariproject/tarijs"
import * as wallet from "./wallet.ts"
import { InitTokensResponse, Token } from "./types.ts"

export const FEE_AMOUNT = "2000"
export const INIT_SUPPLY = "100000"
export const FAUCET_TEMPLATE_ADDRESS = "c465c2858441d5a46b9d14b924455eb846ed3dd4bea303ad0866db64b3b3b152"

export const FIRST_TOKEN_RESOURCE_ADDRESS = "resource_e90768b30d3e97d6e80a794bcb141ca786e5501af32e0ad106ef47c1"
export const FIRST_TOKEN_COMPONENT_ADDRESS = "component_e90768b30d3e97d6e80a794bcb141ca786e5501ac6353f6797bc3029"
export const FIRST_TOKEN_SYMBOL = "A"

export const SECOND_TOKEN_RESOURCE_ADDRESS = "resource_70229469c18f7f70193582d0f28033b7a044171c9ead5d487abe7c32"
export const SECOND_TOKEN_COMPONENT_ADDRESS = "component_70229469c18f7f70193582d0f28033b7a044171cc6353f6797bc3029"
export const SECOND_TOKEN_SYMBOL = "B"

export const defaultFirstToken: Token = {
  substate: {
    resource: FIRST_TOKEN_RESOURCE_ADDRESS,
    component: FIRST_TOKEN_COMPONENT_ADDRESS,
  },
  symbol: FIRST_TOKEN_SYMBOL,
  balance: 0,
}

export const defaultSecondToken: Token = {
  substate: {
    resource: SECOND_TOKEN_RESOURCE_ADDRESS,
    component: SECOND_TOKEN_COMPONENT_ADDRESS,
  },
  symbol: SECOND_TOKEN_SYMBOL,
  balance: 0,
}

export async function takeFreeCoins(provider: TariProvider, faucet_component: string) {
  try {
    const account = await provider.getAccount()
    const instructions = [
      {
        CallMethod: {
          component_address: faucet_component,
          method: "take_free_coins",
          args: [],
        },
      },
      {
        PutLastInstructionOutputOnWorkspace: {
          key: [0],
        },
      },
      {
        CallMethod: {
          component_address: account.address,
          method: "deposit",
          args: [{ Workspace: [0] }],
        },
      },
    ]
    const required_substates = [{ substate_id: account.address }, { substate_id: faucet_component }]

    const result = await wallet.submitAndWaitForTransaction(provider, account, instructions, required_substates)

    return result
  } catch (error) {
    console.error(error)
  }
}

export async function initFaucets(provider: TariProvider): Promise<InitTokensResponse | undefined> {
  const account = await provider.getAccount()
  const req: SubmitTransactionRequest = {
    account_id: 1,
    instructions: [
      {
        CallFunction: {
          template_address: FAUCET_TEMPLATE_ADDRESS,
          function: "mint_with_symbol",
          args: [INIT_SUPPLY, FIRST_TOKEN_SYMBOL],
        },
      },
      {
        CallFunction: {
          template_address: FAUCET_TEMPLATE_ADDRESS,
          function: "mint_with_symbol",
          args: [INIT_SUPPLY, SECOND_TOKEN_SYMBOL],
        },
      },
    ],
    input_refs: [],
    required_substates: [],
    is_dry_run: false,
    fee_instructions: [
      {
        CallMethod: {
          component_address: account.address,
          method: "pay_fee",
          args: [FEE_AMOUNT],
        },
      },
    ],
    inputs: [],
    min_epoch: null,
    max_epoch: null,
  }
  try {
    const txResponse = await provider.submitTransaction(req)
    if (!txResponse) throw new Error("Failed to init tokens")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txResult: any = await wallet.waitForTransactionResult(provider, txResponse.transaction_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upSubstates: any[] = txResult?.result?.result?.Accept.up_substates
    if (!upSubstates) throw new Error("No up substates found")
    const firstToken: Token = {
      substate: {
        resource: upSubstates[2][0].Resource,
        component: upSubstates[4][0].Component,
      },
      symbol: FIRST_TOKEN_SYMBOL,
      balance: 0,
    }
    const secondToken: Token = {
      substate: {
        resource: upSubstates[5][0].Resource,
        component: upSubstates[7][0].Component,
      },
      symbol: SECOND_TOKEN_SYMBOL,
      balance: 0,
    }

    return {
      firstToken,
      secondToken,
    }
  } catch (error) {
    console.error(error)
  }
}
