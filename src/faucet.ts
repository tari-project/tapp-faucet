import { TariProvider } from "@tariproject/tarijs"
import * as wallet from "./wallet.ts"

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
}
