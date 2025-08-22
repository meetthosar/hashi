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
    ): Promise<{ txnId: string, error: string }> {
        // const transactions = [
        //                 {
        //                     type: 'payment' as const,
        //                     params: {
        //                         to: 'O3KJ7QUIEA3BGIDGJ6CRR7NMAKBFX4S4DK5QKNJNZDMUPECOZ5T4MFIULQ',//body.receiverAddress,
        //                         amount: 202000//body.amount
        //                     }
        //                 },
        //                 {
        //                     type: 'application' as const,
        //                     params: {
        //                         appIndex: 739832186,
        //                         appArgs: [new Uint8Array(sha512_256.array(Buffer.from("opt_in_to_asset(pay)void")).slice(0, 4))],
        //                         // accounts: ['5OD3JPPNBR2PYDCB2I2XJVW7FVPA7A6ECM3GXG5H6OOIG2HJLMS7SSPFKI'],
        //                         foreignAssets: [737154202],
        //                         fee: 2000
        //                     }
        //                 }
        //             ];
        return await this.craftGroupTransaction(body.from, body.transactions);
    }

    async craftGroupTransaction(from: string, transactions: Array<{
        type: 'payment' | 'application' | 'asset-transfer' | 'asset-create' | 'opt-in' | 'opt-out',
        params: any
    }>): Promise<{ txnId: string, error: string }> {
        
        const fromAddr = await this.transactionService.get_public_key({ from: from });
        const suggestedParams = await this.transactionService.getSuggestedParams();
        
        const txnGroup = [];
        for (const txn of transactions) {
            switch (txn.type) {
                case 'payment':
                    const paymentTx = this.crafterFactory.pay(Number(txn.params.amount), fromAddr, txn.params.to)
                                    .addFirstValidRound(suggestedParams.firstValid)
                                    .addLastValidRound(suggestedParams.lastValid)
                                    .get();
                    txnGroup.push(paymentTx);
                    break;
                case 'asset-transfer':
                    const assetTransferTx = this.crafterFactory.transferAsset(fromAddr, txn.params.assetId, txn.params.to, Number(txn.params.amt))
                                    .addFirstValidRound(suggestedParams.firstValid)
                                    .addLastValidRound(suggestedParams.lastValid)
                                    .get();
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
                                    
                    const assetCreateTx = assetCreate.get();
                    txnGroup.push(assetCreateTx);
                    break;

                case 'opt-in':
                    const optInTx = this.crafterFactory.transferAsset(fromAddr, txn.params.assetId, fromAddr, 0)
                                    .addFirstValidRound(suggestedParams.firstValid)
                                    .addLastValidRound(suggestedParams.lastValid)
                                    .get();
                    txnGroup.push(optInTx);
                    break;
                case 'opt-out':
                    const optOutTx = this.crafterFactory.transferAsset(fromAddr, txn.params.assetId, fromAddr, 0)
                                    .addFirstValidRound(suggestedParams.firstValid)
                                    .addLastValidRound(suggestedParams.lastValid)
                                    .get();
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
                        applicationId: txn.params.applicationId
                    })
                                    
                    txnGroup.push( appCallTx.txn);
                    break;    
                default:
                    break;
            }
        }

        const groupId = this.encoderFactory.computeGroupId(txnGroup)

        for (let i = 0; i < txnGroup.length; i++) {
            txnGroup[i].addGroupId(groupId)
        }
        
        const signedTxns = [];
        for (let i = 0; i < txnGroup.length; i++) {
                try {
                    // Sign the transaction using the wallet service
                    const signedTxn = await this.transactionService.sign(txnGroup[i].encode(), from);
                    
                    // Add signature to the transaction
                    const ready = this.crafterFactory.addSignature(txnGroup[i].encode(), signedTxn);
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