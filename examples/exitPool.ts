/**
 * Example showing how to exit a pool.
 * (Runs against a local Anvil fork)
 *
 * Run with:
 * pnpm example ./examples/exitPool.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import {
    ChainId,
    ExitKind,
    PoolExit,
    PoolStateInput,
    Slippage,
    InputAmount,
    ExitInput,
    BalancerApi,
} from '../src';
import { parseEther } from 'viem';
import { ANVIL_NETWORKS, startFork } from '../test/anvil/anvil-global-setup';
import { makeForkTx } from './utils/makeForkTx';

const exit = async () => {
    // User defined:
    const chainId = ChainId.MAINNET;
    const userAccount = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const poolId =
        '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014'; // 80BAL-20WETH
    const tokenOut = '0xba100000625a3754423978a60c9317c58a424e3D'; // BAL
    const slippage = Slippage.fromPercentage('1'); // 1%

    // Start a local anvil fork that will be used to query/tx against
    const { rpcUrl } = await startFork(ANVIL_NETWORKS[ChainId[chainId]]);

    // API is used to fetch relevant pool data
    const balancerApi = new BalancerApi(
        'https://backend-v3-canary.beets-ftm-node.com/graphql',
        chainId,
    );
    const poolStateInput: PoolStateInput =
        await balancerApi.pools.fetchPoolState(poolId);

    // Construct the ExitInput, in this case a SingleAsset exit
    const bptIn: InputAmount = {
        rawAmount: parseEther('1'),
        decimals: 18,
        address: poolStateInput.address,
    };
    const exitInput: ExitInput = {
        chainId,
        rpcUrl,
        bptIn,
        tokenOut,
        kind: ExitKind.SingleAsset,
    };

    // Simulate the exit to get the tokens out
    const poolExit = new PoolExit();
    const queryOutput = await poolExit.query(exitInput, poolStateInput);

    console.log('\nExit Query Result:');
    console.log(`BPT In: ${queryOutput.bptIn.amount.toString()}\nTokens Out:`);
    queryOutput.amountsOut.map((a) =>
        console.log(a.token.address, a.amount.toString()),
    );

    // Apply slippage to the tokens out received from the query and construct the call
    const call = poolExit.buildCall({
        ...queryOutput,
        slippage,
        sender: userAccount,
        recipient: userAccount,
    });

    console.log('\nWith slippage applied:');
    console.log(`Max BPT In: ${call.maxBptIn.toString()}`); // TODO these should be InputAmounts or TokenAmounts?
    console.log(`Min amounts out: ${call.minAmountsOut}`); // TODO these should be InputAmounts or TokenAmounts?

    // Make the tx against the local fork and print the result
    await makeForkTx(
        call,
        {
            rpcUrl,
            chainId,
            impersonateAccount: userAccount,
            forkTokens: [
                {
                    address: bptIn.address,
                    slot: 0,
                    rawBalance: bptIn.rawAmount,
                },
            ],
        },
        poolStateInput,
    );
};

exit();
