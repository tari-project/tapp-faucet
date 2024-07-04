import { useCallback, useEffect, useRef, useState } from "react"
import { Box, Button, Paper, Stack, Typography } from "@mui/material"
import {
  SubmitTransactionRequest,
  TariPermissions,
  TariUniverseProvider,
  TariUniverseProviderParameters,
  permissions as walletPermissions,
} from "@tariproject/tarijs"
import { waitForTransactionResult } from "./wallet"
import { takeFreeCoins } from "./faucet"

const { TariPermissionAccountInfo, TariPermissionKeyList, TariPermissionSubstatesRead, TariPermissionTransactionSend } =
  walletPermissions

const permissions = new TariPermissions()
permissions.addPermission(new TariPermissionKeyList())
permissions.addPermission(new TariPermissionAccountInfo())
permissions.addPermission(new TariPermissionTransactionSend())
permissions.addPermission(new TariPermissionSubstatesRead())
const optionalPermissions = new TariPermissions()
const params: TariUniverseProviderParameters = {
  permissions: permissions,
  optionalPermissions,
}

const FEE_AMOUNT = "2000"
const INIT_SUPPLY = "100000"
const FAUCET_TEMPLATE_ADDRESS = "e9afe3eda226a3c5e43ac9bd82adeea08677e562d3d286a3983277df1b9256ee"

const FIRST_TOKEN_RESOURCE_ADDRESS = "resource_e71c7c68bd239f3c4938d98b408e680259369ef415165801db0ef56b"
const FIRST_TOKEN_COMPONENT_ADDRESS = "component_e71c7c68bd239f3c4938d98b408e680259369ef4abe881c6f48043fe"
const FIRST_TOKEN_SYMBOL = "A"

const SECOND_TOKEN_RESOURCE_ADDRESS = "resource_a9af4f7fd8233de7e03e771b70bbbcd66f2e9a0a485135ef64d5a68a"
const SECOND_TOKEN_COMPONENT_ADDRESS = "component_a9af4f7fd8233de7e03e771b70bbbcd66f2e9a0aabe881c6f48043fe"
const SECOND_TOKEN_SYMBOL = "B"

type InitTokensResponse = {
  firstToken: Token
  secondToken: Token
}

type Substate = {
  resource: string
  component: string
}

type Token = {
  substate: Substate
  symbol: string
  balance: number
}

const defaultFirstToken: Token = {
  substate: {
    resource: FIRST_TOKEN_RESOURCE_ADDRESS,
    component: FIRST_TOKEN_COMPONENT_ADDRESS,
  },
  symbol: FIRST_TOKEN_SYMBOL,
  balance: 0,
}

const defaultSecondToken: Token = {
  substate: {
    resource: SECOND_TOKEN_RESOURCE_ADDRESS,
    component: SECOND_TOKEN_COMPONENT_ADDRESS,
  },
  symbol: SECOND_TOKEN_SYMBOL,
  balance: 0,
}

async function initFaucets(
  provider: TariUniverseProvider,
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
    const txResult: any = await waitForTransactionResult(provider, txResponse.transaction_id)
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

function App() {
  const provider = useRef<TariUniverseProvider>(new TariUniverseProvider(params))
  const [firstToken, setFirstToken] = useState<Token>(defaultFirstToken)
  const [secondToken, setSecondToken] = useState<Token>(defaultSecondToken)

  useEffect(() => {
    refreshBalances()
  }, [])

  const setup = async () => {
    const account = await getAccount()
    if (!account) throw new Error("Account not initialized")

    const tokens = await initFaucets(provider.current, account.address)
    if (!tokens) throw new Error("Failed to init tokens")

    setFirstToken(tokens.firstToken)
    setSecondToken(tokens.secondToken)
    console.log("Deployed tokens: ", tokens)
  }

  const takeCoins = async () => {
    if (!firstToken || !secondToken) throw new Error("Tokens not initialized")

    const firstTokenComponent = firstToken.substate.component
    const secondTokenComponent = secondToken.substate.component

    await takeFreeCoins(provider.current, firstTokenComponent)
    await takeFreeCoins(provider.current, secondTokenComponent)

    refreshBalances()
  }

  const refreshBalances = useCallback(async () => {
    const account = await getAccount()
    if (!firstToken || !secondToken) throw new Error("Tokens not initialized")

    const accountBalances = await provider.current.getAccountBalances(account.address)
    const firstTokenBalance =
      accountBalances.balances.find(
        (balance) => balance.resource_address.toLowerCase() === firstToken?.substate.resource.toLowerCase()
      )?.balance || 0
    const secondTokenBalance =
      accountBalances.balances.find(
        (balance) => balance.resource_address.toLowerCase() === secondToken?.substate.resource.toLowerCase()
      )?.balance || 0

    setFirstToken({ ...firstToken, balance: firstTokenBalance })
    setSecondToken({ ...secondToken, balance: secondTokenBalance })
  }, [firstToken, secondToken])

  const getAccount = useCallback(async () => {
    const account = await provider.current.getAccount()
    if (!account) throw new Error("Account not initialized")
    return account
  }, [provider])

  return (
    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" width="100%">
      <Paper variant="outlined" elevation={0} sx={{ padding: 3, borderRadius: 4, marginBottom: 3, width: "20%" }}>
        <Stack direction="column" spacing={2}>
          <Button variant="contained" sx={{ width: "100%" }} onClick={setup}>
            Deploy and Setup
          </Button>
          <Button variant="contained" sx={{ width: "100%" }} onClick={takeCoins}>
            Take free coins
          </Button>
          <Button variant="contained" sx={{ width: "100%" }} onClick={refreshBalances}>
            Refresh account balances
          </Button>
        </Stack>
      </Paper>

      <Box display="flex" flexDirection="column" alignItems="center" width="50%">
        <Paper variant="outlined" elevation={0} sx={{ padding: 3, borderRadius: 4, marginBottom: 2, width: "100%" }}>
          <Typography variant="h6">First Token</Typography>
          <Typography>Resource: {firstToken ? firstToken.substate.resource : ""}</Typography>
          <Typography>Component: {firstToken ? firstToken.substate.component : ""}</Typography>
          <Typography>Symbol: {firstToken ? firstToken.symbol : ""}</Typography>
          <Typography>Balance: {firstToken ? firstToken.balance : 0}</Typography>
        </Paper>

        <Paper variant="outlined" elevation={0} sx={{ padding: 3, borderRadius: 4, marginBottom: 2, width: "100%" }}>
          <Typography variant="h6">Second Token</Typography>
          <Typography>Resource: {secondToken ? secondToken.substate.resource : ""}</Typography>
          <Typography>Component: {secondToken ? secondToken.substate.component : ""}</Typography>
          <Typography>Symbol: {secondToken ? secondToken.symbol : ""}</Typography>
          <Typography>Balance: {secondToken ? secondToken.balance : 0}</Typography>
        </Paper>
      </Box>
    </Box>
  )
}

export default App
