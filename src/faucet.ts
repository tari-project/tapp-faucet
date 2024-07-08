import { SubmitTransactionRequest, TariProvider } from "@tariproject/tarijs"
import * as wallet from "./wallet.ts"
import { InitTokensResponse, Token } from "./types.ts"

export async function createFaucet(
  provider: TariProvider,
  faucet_template: string,
  initial_supply: number,
  symbol: string
) {
  const account = await provider.getAccount()
  const initial_supply_arg = `Amount(${initial_supply})`
  const instructions = [
    {
      CallFunction: {
        template_address: faucet_template,
        function: "mint_with_symbol",
        args: [initial_supply_arg, symbol],
      },
    },
  ]
  const required_substates = [{ substate_id: account.address }]

  const result = await wallet.submitAndWaitForTransaction(provider, account, instructions, required_substates)
  return result
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

export const FEE_AMOUNT = "2000"
export const INIT_SUPPLY = "100000"
export const FAUCET_TEMPLATE_ADDRESS = "e9afe3eda226a3c5e43ac9bd82adeea08677e562d3d286a3983277df1b9256ee"

export const FIRST_TOKEN_RESOURCE_ADDRESS = "resource_e71c7c68bd239f3c4938d98b408e680259369ef415165801db0ef56b"
export const FIRST_TOKEN_COMPONENT_ADDRESS = "component_e71c7c68bd239f3c4938d98b408e680259369ef4abe881c6f48043fe"
export const FIRST_TOKEN_SYMBOL = "A"

export const SECOND_TOKEN_RESOURCE_ADDRESS = "resource_a9af4f7fd8233de7e03e771b70bbbcd66f2e9a0a485135ef64d5a68a"
export const SECOND_TOKEN_COMPONENT_ADDRESS = "component_a9af4f7fd8233de7e03e771b70bbbcd66f2e9a0aabe881c6f48043fe"
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

export async function initFaucets(
  provider: TariProvider,
  accountAddress: string
): Promise<InitTokensResponse | undefined> {
  const req: SubmitTransactionRequest = {
    account_id: 1,
    instructions: [
      {
        CallFunction: {
          template_address: FAUCET_TEMPLATE_ADDRESS,
          function: "mint_with_symbol",
          args: [INIT_SUPPLY, "A"],
        },
      },
      {
        CallFunction: {
          template_address: FAUCET_TEMPLATE_ADDRESS,
          function: "mint_with_symbol",
          args: [INIT_SUPPLY, "B"],
        },
      },
    ],
    input_refs: [],
    required_substates: [],
    is_dry_run: false,
    fee_instructions: [
      {
        CallMethod: {
          component_address: accountAddress,
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
