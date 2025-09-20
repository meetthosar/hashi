import { Post, Body, Controller } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { ConfigService } from "@nestjs/config";
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetParamsBuilder, AlgorandTransactionCrafter, AlgorandEncoder } from '@algorandfoundation/algo-models';    
import { ApiTags } from "@nestjs/swagger";
import { get } from "http";
import { concatArrays } from "../utils/utils";
import { WalletService } from "../wallet/wallet.service";
import { sha512_256 } from "js-sha512";
import * as algosdk from "algosdk";

@ApiTags('Transaction')
@Controller()
export class GroupTransaction {
    constructor(
        private readonly transactionService: TransactionService,
        private readonly configService: ConfigService,
        private readonly crafterFactory: AlgorandTransactionCrafter,
        private readonly encoderFactory: AlgorandEncoder,
        private readonly walletService: WalletService
    ) {
        this.crafterFactory = new AlgorandTransactionCrafter(this.configService.get<string>("GENESIS_ID"), this.configService.get<string>("GENESIS_HASH"))
        this.encoderFactory = new AlgorandEncoder()
    }

    @Post('group-transaction')
    async groupTransaction(
        @Body() body: {
            from: string,
            transactions: Array<{ type: 'payment' | 'application' | 'asset-transfer' | 'asset-create' | 'opt-in' | 'opt-out', params: any }>,
        }
    ): Promise<{ txnIds: string[], error: string }> {
        // const transactions1: Array<{ type: 'payment' | 'application' | 'asset-transfer' | 'asset-create' | 'opt-in' | 'opt-out', params: any }> = [
        //       { type: "payment", params: { to: "46L2HQNPQR2YPYDO7ZEDP4N35RAFZNFNVBRAPBW7CXABXCRXFIF4HBBLIM", amount: 101000 } },
        //     //   { type: "opt-in", params: { assetId: 1140 } },
        //       { type: "application", params: { applicationId: 1142, 
        //         methodName: "opt_in_activity_token(pay,uint64)void", methodArgs: [[1156, "uint64"]], 
        //         accounts: ["46L2HQNPQR2YPYDO7ZEDP4N35RAFZNFNVBRAPBW7CXABXCRXFIF4HBBLIM"],
        //         foreignApps: [1142],appArgs: [new Uint8Array(sha512_256.array(Buffer.from("opt_in_activity_token(pay,uint64)void")).slice(0, 4)), algosdk.encodeUint64(1156)],
        //         foreignAssets: [1156] } },
        //     ]
            const transactions1: Array<{ type: 'payment' | 'application' | 'asset-transfer' | 'asset-create' | 'opt-in' | 'opt-out', params: any }> = [
                { type: "payment", params: { to: "46L2HQNPQR2YPYDO7ZEDP4N35RAFZNFNVBRAPBW7CXABXCRXFIF4HBBLIM", amount: 101000 } },
                { type: "application", params: { appIndex: 1142, 
                    fee: 2000,
                    appArgs: [new Uint8Array(sha512_256.array(Buffer.from("opt_in_activity_token(pay,uint64)void")).slice(0, 4)), algosdk.encodeUint64(1155)],
                  accounts: ["46L2HQNPQR2YPYDO7ZEDP4N35RAFZNFNVBRAPBW7CXABXCRXFIF4HBBLIM"],
                  foreignApps: [1142],
                  foreignAssets: [1155] } },
            ]
            // const prefix = new TextEncoder().encode("act_");           // utf8 bytes for "act_"
            // const idBytes = algosdk.encodeUint64(11); 
            // console.log("prefix", prefix)
            // console.log("idBytes", idBytes)
            const transactions: Array<{ type: 'payment' | 'application' | 'asset-transfer' | 'asset-create' | 'opt-in' | 'opt-out', params: any }> = [
                {
                  type: "payment",
                  params: {
                    to: "SD24T2FFA23VCXBIELSJ763PLQRTK7QEH2Q7QP7V2QE5LIS5DMF6HNHFFA", 
                    amount: 200000
                  }
                },
                {
                  type: "application",
                  params: {
                    appIndex: 1160,
                    fee: 2000,
                    appArgs: [
                        new Uint8Array(
                          sha512_256
                            .array(
                              Buffer.from(
                                "add_activity(pay,uint64,address,address,uint64,uint64)void"
                              )
                            )
                            .slice(0, 4)
                        ),
                        algosdk.encodeUint64(12n), // cc_activity_id
                        algosdk.decodeAddress(
                          "46L2HQNPQR2YPYDO7ZEDP4N35RAFZNFNVBRAPBW7CXABXCRXFIF4HBBLIM"
                        ).publicKey, // cluster_head_address
                        algosdk.decodeAddress(
                          "46L2HQNPQR2YPYDO7ZEDP4N35RAFZNFNVBRAPBW7CXABXCRXFIF4HBBLIM"
                        ).publicKey, // territory_officer_address
                        algosdk.encodeUint64(50n), // no_of_attendees
                        algosdk.encodeUint64(1155n), // activity_token
                      ],
                    boxes: [
                      {
                        appIndex: 1160,
                        name: new Uint8Array([
                            ...Buffer.from("act_"),
                            ...algosdk.encodeUint64(12n),
                          ]),
                      }
                    ],
                    accounts: ["46L2HQNPQR2YPYDO7ZEDP4N35RAFZNFNVBRAPBW7CXABXCRXFIF4HBBLIM", "K6T5O66UU6P4V6UUMMPFYYDNBMANCXXZUI222SW6SOC4TAU6HV2WF2AKWE"],
                    foreignApps: [1160],
                    foreignAssets: [1155]
                  }
                }
              ];
            return await this.transactionService.groupTransactionWithAlgosdk(body.from, body.transactions);
        // return await this.craftGroupTransaction("Meet", transactions1);
    }

    // withsdk
    // [
    //     Uint8Array(4) [ 138, 246, 86, 192 ],
    //     Uint8Array(8) [
    //       0, 0, 0,   0,
    //       0, 0, 4, 131
    //     ]
    //   ]

    // Withoutsdk
    // [
    //     Uint8Array(4) [ 138, 246, 86, 192 ],
    //     Uint8Array(8) [
    //       0, 0, 0,   0,
    //       0, 0, 4, 132
    //     ]
    //   ]
    async craftGroupTransaction(from: string, transactions: Array<{
        type: 'payment' | 'application' | 'asset-transfer' | 'asset-create' | 'opt-in' | 'opt-out',
        params: any
    }>): Promise<{ txnId: string, error: string }> {
        
        const fromAddr = await this.transactionService.get_public_key({ from: from });
        
        const txnGroup = [];
        for (const txn of transactions) {
            const suggestedParams = await this.transactionService.getSuggestedParams();
            switch (txn.type) {
                case 'payment':
                    const paymentTx = this.crafterFactory.pay(Number(txn.params.amount), fromAddr, txn.params.to)
                                    .addFirstValidRound(suggestedParams.firstValid)
                                    .addLastValidRound(suggestedParams.lastValid);
                    txnGroup.push(paymentTx);
                    break;
                case 'asset-transfer':
                    const assetTransferTx = this.crafterFactory.transferAsset(fromAddr, txn.params.assetId, txn.params.to, Number(txn.params.amt))
                                    .addFirstValidRound(suggestedParams.firstValid)
                                    .addLastValidRound(suggestedParams.lastValid);
                    txnGroup.push(assetTransferTx);
                    break;
                case 'asset-create':
                    const decimals = Number(txn.params.decimals)
                    const totalTokens = Number(txn.params.totalTokens)
                    const assetId = Number(txn.params.assetId)
            
                    let defaultFrozen = false;
                    if (txn.params.defaultFrozen !== undefined) {
                        // If it's already a boolean, use it directly
                        if (typeof txn.params.defaultFrozen === 'boolean') {
                            defaultFrozen = txn.params.defaultFrozen;
                        } 
                        // If it's a string 'true' or 'false', convert appropriately
                        else if (typeof txn.params.defaultFrozen === 'string') {
                            defaultFrozen = txn.params.defaultFrozen === 'true';
                        }
                    }
                    const assetParams = new AssetParamsBuilder()
                    .addAssetName(txn.params.assetName)
                    .addUnitName(txn.params.unit)
                    .addTotal(totalTokens)
                    .addManagerAddress(txn.params.managerAddress)
                    .addReserveAddress(txn.params.reserveAddress)
                    .addFreezeAddress(txn.params.freezeAddress)
                    .addClawbackAddress(txn.params.clawbackAddress)
                    .addUrl(txn.params.url)
                    
                    if(decimals){
                        assetParams.addDecimals(decimals)
                    }
                    
                    if(defaultFrozen){
                        assetParams.addDefaultFrozen(defaultFrozen)
                    }


                    let assetCreate = this.crafterFactory.createAsset(fromAddr, assetParams.get())
                                    .addFirstValidRound(suggestedParams.firstValid)
                                    .addLastValidRound(suggestedParams.lastValid)

                                    if(assetId){
                                        assetCreate =  assetCreate.addAssetId(assetId)
                                    }
                                    
                    const assetCreateTx = assetCreate;
                    txnGroup.push(assetCreateTx);
                    break;

                case 'opt-in':
                    const optInTx = this.crafterFactory.transferAsset(fromAddr, txn.params.assetId, fromAddr, 0)
                                    .addFirstValidRound(suggestedParams.firstValid)
                                    .addLastValidRound(suggestedParams.lastValid);
                    txnGroup.push(optInTx);
                    break;
                case 'opt-out':
                    const optOutTx = this.crafterFactory.transferAsset(fromAddr, txn.params.assetId, fromAddr, 0)
                                    .addFirstValidRound(suggestedParams.firstValid)
                                    .addLastValidRound(suggestedParams.lastValid);
                    txnGroup.push(optOutTx);
                    break;

                case 'application':
                    const appCallTx = await this.transactionService.applicationCall({
                        from: fromAddr,
                        approvalProgram: txn.params.approvalProgram,
                        clearProgram: txn.params.clearProgram,
                        globalSchema: txn.params.globalSchema,
                        localSchema: txn.params.localSchema,
                        methodName: txn.params.methodName,
                        methodArgs: txn.params.methodArgs,
                        applicationId: txn.params.applicationId,
                        onComplete: txn.params.onComplete
                    })
                    if (!appCallTx || !appCallTx.txn) {
                        throw new Error(`Application call build failed: ${appCallTx?.error || 'unknown error'}`);
                    }
                    
                    txnGroup.push(appCallTx.txn);
                    break;    
                default:
                    break;
            }
        }

        // Ensure all transactions are valid before computing group ID
        // if (txnGroup.length === 0 || txnGroup.some((t) => !t || typeof t.encode !== 'function')) {
        //     throw new Error('Invalid transaction group: one or more transactions are missing or malformed');
        // }
        console.log(txnGroup);
        
        // Compute group ID over the encoded bytes as expected by the encoder
        const preGroupBytes: Uint8Array[] = txnGroup.map(tx => tx.get().encode());
        const groupId = this.encoderFactory.computeGroupId(preGroupBytes)

        // Set group on each builder
        for (let i = 0; i < txnGroup.length; i++) {
            txnGroup[i] = txnGroup[i].addGroup(groupId)
        }

        // Cache unsigned bytes AFTER group has been set to avoid any mismatch
        const unsignedBytes: Uint8Array[] = txnGroup.map(tx => tx.get().encode());

        const signedTxns = [];
        for (let i = 0; i < txnGroup.length; i++) {
            try {
                const toSign = unsignedBytes[i];
                const sig = await this.transactionService.sign(toSign, from);
                const ready = this.crafterFactory.addSignature(toSign, sig);
                signedTxns.push(ready);
            } catch (error) {
                console.error(`Error signing transaction ${i+1}:`, error);
                throw new Error(`Failed to sign transaction ${i+1}: ${error.message}`);
            }
        }

            const bytestoSubmit = concatArrays(...signedTxns);
            const txnId = await this.walletService.submitTransaction(bytestoSubmit);

            return { txnId: txnId, error: null };
        }
}