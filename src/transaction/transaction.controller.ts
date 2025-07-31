import { Body, Controller, Get, Logger, Param, Post, Res, Query } from "@nestjs/common"
import { WalletService } from "../wallet/wallet.service"
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { EncoderFactory } from "../chain/encoder.factory"
import { Crafter } from "../chain/crafter.role"
import { ConfigService } from "@nestjs/config"
import { CrafterFactory } from "../chain/crafter.factory"
import { ApiTags } from "@nestjs/swagger"
import { TransactionService } from "./transaction.service"
import algosdk from "algosdk";
import {sha512_256} from "js-sha512";
import { AlgorandEncoder, AlgorandTransactionCrafter, AssetParamsBuilder } from '@algorandfoundation/algo-models'
import { concatArrays } from "../utils/utils"
import { log } from "console";
import nacl from 'tweetnacl';



@ApiTags("Transaction")
@Controller()
export class Transaction {
    constructor(private readonly walletService: WalletService, private readonly configService: ConfigService, private readonly txnService: TransactionService) {}


//     @Post("payment")
//     async makePayment(@Body() body: { from: string, to: string, amt: number }): Promise<{txnId:string}> {
//         const amount = Number(body.amt)
//         return await this.txnService.makePayment(body.from, body.to, amount)
//         // return await this.txnService.makePayment('test', 'VYG6BEXIW7YKJW3X5MUMYWZU226IPFIJLBZYQJ3FRWMRNR4IT7Q6TIAFWA', 1000)

//     }
//     /**
//      * Create and submit a group transaction with multiple transaction types
//      * @param body Contains the wallet key name and array of transaction configurations
//      * @returns Transaction ID and any error information
//      */
//     @Post("group-transaction")
//     async createGroupTransaction(@Body() body: {
//         from: string,
//         transactions: Array<{
//             type: 'payment' | 'application' | 'asset-transfer' | 'asset-create' | 'opt-in' | 'opt-out',
//             params: any
//         }>
//     }): Promise<{ txnIds: Array<string>, error: string }> {
//         try {
//             // Validate input
//             if (!body.from) {
//                 return { txnIds: [], error: 'Sender address (from) is required' };
//             }
            
//             if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
//                 return { txnIds: [], error: 'At least one transaction is required' };
//             }
            
//             if (body.transactions.length > 16) {
//                 return { txnIds: [], error: 'Maximum 16 transactions allowed in a group' };
//             }
            
//             // Validate each transaction
//             for (const txn of body.transactions) {
//                 if (!txn.type) {
//                     return { txnIds: [], error: 'Transaction type is required for all transactions' };
//                 }
                
//                 if (!txn.params) {
//                     return { txnIds: [], error: 'Transaction parameters are required for all transactions' };
//                 }
                
//                 // Type-specific validation
//                 switch (txn.type) {
//                     case 'payment':
//                         if (!txn.params.to) {
//                             return { txnIds: [], error: 'Receiver address is required for payment transactions' };
//                         }
//                         if (txn.params.amount === undefined) {
//                             return { txnIds: [], error: 'Amount is required for payment transactions' };
//                         }
//                         break;
//                     case 'application':
//                         if (!txn.params.appIndex && txn.params.appIndex !== 0) {
//                             return { txnIds: [], error: 'Application ID is required for application call transactions' };
//                         }
//                         break;
//                     case 'asset-transfer':
//                     case 'opt-in':
//                     case 'opt-out':
//                         if (!txn.params.assetIndex && txn.params.assetIndex !== 0) {
//                             return { txnIds: [], error: 'Asset ID is required for asset transactions' };
//                         }
//                         break;
//                     case 'asset-create':
//                         if (!txn.params.total) {
//                             return { txnIds: [], error: 'Total supply is required for asset creation' };
//                         }
//                         if (txn.params.decimals === undefined) {
//                             return { txnIds: [], error: 'Decimals is required for asset creation' };
//                         }
//                         break;
//                     default:
//                         return { txnIds: [], error: `Unsupported transaction type: ${txn.type}` };
//                 }
//             }
            
//             // Process the group transaction using algosdk
//             return await this.txnService.groupTransactionWithAlgosdk(
//                 body.from,
//                 body.transactions
//             );
//         } catch (error) {
//             console.error('Error in group transaction API:', error);
//             throw Error(error.message || 'An unexpected error occurred processing the group transaction')
//         }
//     }
    
//     @Post("asset-transfer")
//     async transferAsset(@Body() body: { assetId: number, from: string, to: string, amount: number }): Promise<{ txnId: string, error:string }> {

//         const assetId = Number(body.assetId)
//         const amount = Number(body.amount)

//         return await this.txnService.transferToken(assetId, body.from, body.to, amount)

//         // return { txnId : await this.txnService.transferToken(734471494, 'test ', 'V5LR6C5SVHBQY3SPTEPD5WEGNBBUDNEP2MSDIONQIODZXZHRMC6QF3CTZI', 1)}
//     }

//     @Post("opt-in-asset")
//     async optInAsset(@Body() body: { assetId: number, from: string }): Promise<{ txnId: string }> {
//         const assetId = Number(body.assetId)    
    
//         return await this.txnService.optInAsset(assetId, body.from)
//         // return { txnId : await this.txnService.optInAsset(734469357, 'test1')}
//     }

//     @Post("opt-out-asset")
//     async optOutAsset(@Body() body: { assetId: number, from: string, close: string }): Promise<{ txnId: string }> {
//         const assetId = Number(body.assetId)    
    
//         return await this.txnService.optOutAsset(assetId, body.from, body.close)
//     }

//     /**
//      * Creates a transaction group with multiple transaction types in the specified order
//      */
//     // @Post("group-transaction")
//     // async groupTransaction(@Body() body: { 
//     //     from: string, 
//     //     transactions: Array<{
//     //         type: 'payment' | 'application' | 'asset-transfer' | 'asset-create',
//     //         params: any
//     //     }>
//     // }): Promise<{ txnId: string, error: string }> {
//     //     return await this.txnService.groupTransaction(
//     //         body.from,
//     //         body.transactions
//     //     );
//     // }

//     @Post("example-group-transaction")
//     async exampleGroupTransaction(@Body() body: { 
//         from: string,
//         receiverAddress: string,
//         amount: number,
//         assetId: number
//     }): Promise<{ txnIds: Array<string>, error: string }> {
//         // Create a group transaction with two transactions:
//         // 1. A payment transaction
//         // 2. An asset transfer transaction
        
//         const transactions = [
//             {
//                 type: 'payment' as const,
//                 params: {
//                     to: 'O3KJ7QUIEA3BGIDGJ6CRR7NMAKBFX4S4DK5QKNJNZDMUPECOZ5T4MFIULQ',//body.receiverAddress,
//                     amount: 202000//body.amount
//                 }
//             },
//             {
//                 type: 'application' as const,
//                 params: {
//                     appIndex: 739832186,
//                     appArgs: [new Uint8Array(sha512_256.array(Buffer.from("opt_in_to_asset(pay)void")).slice(0, 4))],
//                     // accounts: ['5OD3JPPNBR2PYDCB2I2XJVW7FVPA7A6ECM3GXG5H6OOIG2HJLMS7SSPFKI'],
//                     foreignAssets: [737154202],
//                     fee: 2000
//                 }
//             }
//         ];
             

//         return await this.txnService.groupTransaction(
//             body.from,
//             transactions
//         );
//     }


//     async algosdkGroupTransaction(@Body() body: {   
//     }): Promise<{ txnId: string, error: string }> {

//         // const hashitxn = await this.exampleGroupTransaction_1();
        
//         const acct1 = '5OD3JPPNBR2PYDCB2I2XJVW7FVPA7A6ECM3GXG5H6OOIG2HJLMS7SSPFKI';
//         const acct2 = 'V5LR6C5SVHBQY3SPTEPD5WEGNBBUDNEP2MSDIONQIODZXZHRMC6QF3CTZI';

//         // example: ATOMIC_CREATE_TXNS
//         const suggestedParams = await this.txnService.getSuggestedParams();

//         const alicesTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
//             sender: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
//             receiver: acct1,
//             amount: 1e5,
//             suggestedParams,
//         });

//         const bobsTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
//             sender: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',
//             receiver: acct2,
//             amount: 1e5,
//             suggestedParams,
//         });
//         // example: ATOMIC_CREATE_TXNS
        
        
//         // example: ATOMIC_GROUP_TXNS
//         const encodedTxns = [alicesTxn, bobsTxn];

//         console.log(encodedTxns);
        
//         const txnGroup = algosdk.assignGroupID(encodedTxns);
        
//         console.log(txnGroup);
        
        
//         const txnCrafter = new AlgorandTransactionCrafter('testnet-v1.0', 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=')

//         // assignGroupID returns the same txns with the group ID set
//         // const txnGroup = algosdk.assignGroupID(txnArray);
//         const signedTxns = [];
            
//             // First sign all transactions
//             for (let i = 0; i < txnGroup.length; i++) {
//                 try {
//                     const signedTxn = await this.txnService.sign(txnGroup[i].bytesToSign(), 'test');
//                     const ready = await txnCrafter.addSignature(txnGroup[i].bytesToSign(), signedTxn);    
//                     signedTxns.push(ready);
//                 } catch (error) {
//                     console.error(`Error signing transaction ${i+1}:`, error);
//                     throw new Error(`Failed to sign transaction ${i+1}: ${error.message}`);
//                 }
//             }
            
//             // Now submit all transactions as a group
//             try {

//                 const bytestoSubmit = concatArrays(...signedTxns);
                
//                 const txnId = await this.walletService.submitTransaction(bytestoSubmit);
                
//                 return { txnId, error: null };
//             } catch (error) {
//                 console.error('Error in group transaction processing:', error);
//                 return { txnId: null, error: error.message || 'Unknown error in group transaction' };
//             }

        
//         return { txnId: '', error: '' };
//     }
        
//     //736766885
//    @Post('application-call')
//    async applicationCall(@Body() body: { from: string, 
//     approvalProgram?: string, 
//     clearProgram?: string, 
//     globalSchema?: { numByteSlice: number, numUint: number }, 
//     localSchema?: { numByteSlice: number, numUint: number } , 
//     appIndex?: number, 
//     appArgs?: Array<Uint8Array>, 
//     foreignApps?: Array<number>, 
//     foreignAssets?: Array<number>,
//     accounts?: Array<string>,
//     fee?: number
//     }
//     ): Promise<{ txnId: string, error: string }> {



//         // Participation Token Application Call
//         return await this.txnService.applicationCall('test', 0,
//             'CiADAAEEJgEIYXNzZXRfaWSABG6nG1OABBV0U1qABCIZu6eABPFXdyaABDOzSZ42GgCOBQABABYALAA4AEQAMRkURDEYFEQ2GgEXNhoCF4gAPiNDMRkURDEYRDEWIwlJOBAjEkSIAD0jQzEZFEQxGESIAGQjQzEZFEQxGESIAH0jQzEZgQUSRDEYRIgAiCNDigIAKIv+Z4AIcXVhbnRpdHmL/2eJigEAMQAyCRJEMgoiKGVEcABFARREi/84BzIKEkSxIihlRDIKIrISshSyESSyECKyAbOJigAAMQAiKGVEcABFARREsSIoZUQxACKyErIUshEkshAisgGziYoAALEiKGVEMQAjshKyFLIRJLIQIrIBs4mKAAAxADIJEkSxIihlRDIJSbIVIrISshSyESSyECKyAbOxMglJsgkisgiyByOyECKyAbOJ',
//             'CoEBQw==', 
//             { numByteSlice: 0, numUint: 2 }, { numByteSlice: 0, numUint: 0 },
//             [new Uint8Array(sha512_256.array(Buffer.from("create_application(uint64,uint64)void")).slice(0, 4)), algosdk.encodeUint64(737154202), algosdk.encodeUint64(10) ], 
//             [], [],[],
//             1000
//             );

//         // var {txnId, error} = await this.txnService.makePayment('test', '5OD3JPPNBR2PYDCB2I2XJVW7FVPA7A6ECM3GXG5H6OOIG2HJLMS7SSPFKI', 202000)


//         // return await this.txnService.applicationCall('test', 736444345,
//         //     null,
//         //     null, 
//         //     null, null,
//         //     [new Uint8Array(sha512_256.array(Buffer.from("opt_in_to_asset(pay)void")).slice(0, 4)), Buffer.from("EJVPKD4RQELEMZ7D4W756LORLPBH6OBN773URZXAS22WPRLZW6OQ")], 
//         //     [], [735261053],
//         //     ['SEHSPKLFLP55PHXKKZPXAZ5DFE7DDBH3BHPVTRRKIEYCBJOJWTE4V42HLI']
//         //     );

//         // For all other application calls, use the standard method
//         return await this.txnService.applicationCall(
//             body.from, 
//             body.appIndex??0, 
//             body.approvalProgram??'', 
//             body.clearProgram??'', 
//             body.globalSchema??{ numByteSlice: 0, numUint: 0 }, 
//             body.localSchema??{ numByteSlice: 0, numUint: 0 }, 
//             body.appArgs??[], 
//             body.foreignApps??[], 
//             body.foreignAssets??[],
//             body.accounts??[],
//             body.fee
//         )


//     }

}

