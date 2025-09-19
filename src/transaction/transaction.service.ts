import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { VaultService } from "../vault/vault.service"
import { HttpService } from "@nestjs/axios"
import { ConfigService } from "@nestjs/config"
import { AlgorandEncoder, AlgorandTransactionCrafter, AssetParamsBuilder, ApplicationCallTxBuilder, StateSchema, ApplicationCallTransaction, IApplicationCallTxBuilder } from '@algorandfoundation/algo-models'
// import { AssetParams, AssetParamsBuilder } from "src/chain/algorand.asset.params";
import { WalletService } from "../wallet/wallet.service"
import { EncoderFactory } from "../chain/encoder.factory"
// import { AlgoTxCrafter, CrafterFactory } from "src/chain/crafter.factory"
// import { AssetConfigTxBuilder, IAssetConfigTxBuilder } from "src/chain/algorand.transaction.acfg"
import algosdk from "algosdk"
import { algo, AlgorandClient, Config } from '@algorandfoundation/algokit-utils'
import { encode } from "punycode"
import { type } from "os"
import { concatArrays } from "../utils/utils"
import { sha512_256 } from "js-sha512"


interface Assetparams {
    assetId?: number;
    assetName?: string;
    url?: string;
    defaultFrozen?: boolean;
    managerAddress?: string;
    reserveAddress?: string;
    freezeAddress?: string;
    clawbackAddress?: string;
}


@Injectable()
export class TransactionService implements OnModuleInit {
    constructor(private readonly vaultService: VaultService, 
        private readonly httpService: HttpService, 
        private readonly configService: ConfigService, 
        // private crafter: AlgoTxCrafter, 
        private txnCrafter: AlgorandTransactionCrafter,
        private readonly walletService: WalletService,
        private genesisId :string,
        private genesisHash: string,
        ) {
            this.genesisId = configService.get<string>("GENESIS_ID")
			this.genesisHash = configService.get<string>("GENESIS_HASH")
            this.txnCrafter = new AlgorandTransactionCrafter(this.genesisId, this.genesisHash)
        }
    
    /**
	 *
	 */
	async onModuleInit() {
		await this.auth(this.configService.get<string>("VAULT_TOKEN"))
	}

    /**
	 *
	 * @param token
	 * @returns
	 */
	async auth(token: string): Promise<boolean> {
		let isOkay: boolean = false

		try {
			isOkay = await this.vaultService.auth(token)
		} catch (error) {
			Logger.error("Failed to auth to vault", "WalletService.auth")
		}

		return isOkay
	}

    async sign(data: Uint8Array, key: string): Promise<Uint8Array> {
		//TODO: prompt new auth method

		const string: string = (await this.walletService.rawSign(Buffer.from(data), key)).toString()
		// split vault specific prefixes vault:${version}:signature
		const signature = string.split(":")[2]

		// vault default base64 decode
		const decoded: Buffer = Buffer.from(signature, "base64")

        // console.log(algosdk.secretKeyToMnemonic(new Uint8Array(decoded)));
        
		// return as Uint8Array
		return new Uint8Array(decoded)
	}
    

    // async makePaymentTxn(from: string, to: string, amt: number, suggestedParams:any) {
    //     const fromAddr = await this.get_public_key({ from });

    //     // const suggestedParams = await this.getSuggestedParams();
        
    //     // Get a crafter that uses our custom PaymentTxBuilder
    //     const crafter = CrafterFactory.getCrafter("algorand", this.configService);
        
    //     // Use our custom payment method that properly handles group IDs
    //     return crafter.payment(fromAddr, to, amt, Number(suggestedParams.firstValid), Number(suggestedParams.lastValid));
    // }

    /**
     * 
     * @param from 
     * @param to 
     * @param amt 
     * @returns 
     */
    // async makePayment(from:string, to:string, amt:number): Promise<{ txnId: string, error: string}> {
        
    //     if (!from || !to || amt === undefined || amt === null) {
    //         throw new Error('Invalid payment parameters');
    //     }


    //     const suggestedParams = await this.getSuggestedParams();

    //     try {
    //         const encoded = (await this.makePaymentTxn(from, to, amt, suggestedParams)).get().encode();
    //         console.log(encoded);
    //         const txnId = await this.signAndSubmitTransaction(encoded, from);
            
    //         return { txnId, error : null }

    //     } catch (error) {
    //         const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    //         return { txnId: null, error: errorMessage };
    //     }
    // }


    // async assetConfigTxn(params:Assetparams, from: string, unit: string, decimals: number, totalTokens: number) { 
    //     const fromAddr = await this.get_public_key({ from });

    //     const suggestedParams = await this.getSuggestedParams();

    //     const crafter = CrafterFactory.getCrafter("algorand", this.configService)

    //     const assetCreateTxBuilder = crafter.asset(fromAddr, unit, decimals, totalTokens, Number(suggestedParams.firstValid), Number(suggestedParams.lastValid), params.defaultFrozen)

    //     if (params.assetId) {
    //         assetCreateTxBuilder.addAssetId(params.assetId);
    //     }
    //     // Add optional parameters if they exist
    //     if (params.assetName) {
    //         assetCreateTxBuilder.addName(params.assetName);
    //     }
    //     if (params.url) {
    //         assetCreateTxBuilder.addUrl(params.url);
    //     }
        
    //     if (params.managerAddress) {
    //         assetCreateTxBuilder.addManagerAddress(params.managerAddress);
    //     }
    //     if (params.reserveAddress) {
    //         assetCreateTxBuilder.addReserveAddress(params.reserveAddress);
    //     }
    //     if (params.freezeAddress) {
    //         assetCreateTxBuilder.addFreezeAddress(params.freezeAddress);
    //     }
    //     if (params.clawbackAddress) {
    //         assetCreateTxBuilder.addClawbackAddress(params.clawbackAddress);
    //     }
        
    //     return assetCreateTxBuilder
    // }

    /**
     * 
     * @param from - Hashi vault key name
     * @param unit 
     * @param decimals 
     * @param totalTokens 
     * @param params 
     * @returns 
     */
    // async asset(from: string, unit: string, decimals: number, totalTokens: number, params: Assetparams = {}): Promise<{txnId:string, assetId: string, error : string}> {
    //     if (!from || !unit || totalTokens === undefined || totalTokens === null || decimals === undefined || decimals === null) {
    //         throw new Error('Invalid asset creation parameters');
    //     }
 
    //     try {
    //         const encoded = (await this.assetConfigTxn(params, from, unit, decimals, totalTokens)).get().encode(); 

    //         const txnId = await this.signAndSubmitTransaction(encoded, from);

    //         const algorand = this.algorand("testnet")

    //         const transaction = await this.waitForTransaction(txnId, 10, 2000, algorand)

    //         const assetId = transaction.transaction.createdAssetIndex;

    //         return { assetId: assetId?.toString() || params.assetId, txnId, error: null};

    //     } catch (error) {
    //         console.error('Asset creation error:', error);
    //         // Safely extract error message without assuming response structure
    //         const errorMessage = error.response?.data?.message || error.message || 'Unknown error creating asset';
    //         throw new Error(errorMessage);
    //     }
       
    // }


    // async transferTokenTxn(params: { from: string, to: string, amount: number, assetId: number }) {  
    //     const fromAddr = await this.get_public_key({ from: params.from }); 

    //     const suggestedParams = await this.getSuggestedParams();

    //     return this.txnCrafter.transferAsset(fromAddr, params.assetId, params.to, params.amount)
                                        // .addFirstValidRound(Number(suggestedParams.firstValid))
                                        // .addLastValidRound(Number(suggestedParams.lastValid))
                                        
    // }


    /**
     * 
     * @param assetId 
     * @param from - Hashi vault key name
     * @param to 
     * @param amount 
     * @returns 
     */
    // async transferToken(assetId: number, from: string, to: string, amount: number): Promise<{ txnId:string, error : string }> {
    //     if (!from || !to || amount === undefined || amount === null || assetId === undefined || assetId === null) {
    //         throw new Error('Invalid asset transfer parameters');
    //     }

    //     try {            
    //         const encoded = (await this.transferTokenTxn({ from, to, amount, assetId })).get().encode();

    //         const txnId = await this.signAndSubmitTransaction(encoded, from);

    //         return { txnId, error: null};

    //     } catch (error) {
    //         return { txnId: null, error: error.response?.data?.message || error.message || 'Unknown error transferring token'};
    //     }
    // }

    // async optInAssetTxn(params: { from: string, assetId: number }) {
    //     const fromAddr = await this.get_public_key({ from: params.from });

    //     const suggestedParams = await this.getSuggestedParams();

    //     const crafter = CrafterFactory.getCrafter("algorand", this.configService);
        
    //     return crafter.assetTransfer(params.assetId, fromAddr, fromAddr, 0)
    //                             .addFirstValidRound(Number(suggestedParams.firstValid))
    //                             .addLastValidRound(Number(suggestedParams.lastValid))
    //                             .get()
    // }

    // async optInAsset(assetId: number, from: string): Promise<{ txnId:string, error : string }> {
    //     if (!from || assetId === undefined || assetId === null) {
    //         throw new Error('Invalid asset opt-in parameters');
    //     }       

    //     try {
    //         const encoded = (await this.optInAssetTxn({ from, assetId })).encode();

    //         const txnId = await this.signAndSubmitTransaction(encoded, from);
            
    //         return { txnId, error: null};

    //     } catch (error) {
    //         console.error('Asset opt-in error:', error);
    //         // Safely extract error message without assuming response structure
    //         const errorMessage = error.response?.data?.message || error.message || 'Unknown error opting into asset';
    //         throw new Error(errorMessage);
    //     }
    // }

    // async optOutAssetTxn(params: { from: string, assetId: number, close: string }) {
    //     const fromAddr = await this.get_public_key({ from: params.from });

    //     const suggestedParams = await this.getSuggestedParams();

    //     const crafter = CrafterFactory.getCrafter("algorand", this.configService)

    //     return crafter.assetTransfer(params.assetId, fromAddr, fromAddr, 0)
    //                             .addFirstValidRound(Number(suggestedParams.firstValid))
    //                             .addLastValidRound(Number(suggestedParams.lastValid))
    //                             .addClose(params.close)
    //                             .get()
    // }           

    // async optOutAsset(assetId: number, from: string, close: string): Promise<{ txnId:string, error : string }> {
    //     if (!from || assetId === undefined || assetId === null) {
    //         throw new Error('Invalid asset opt-out parameters');
    //     }       

    //     try {
    //         const encoded = (await this.optOutAssetTxn({ from, assetId, close })).encode();

    //         const txnId = await this.signAndSubmitTransaction(encoded, from)
            
    //         return  { txnId, error: null};
    //     } catch (error) {
    //         console.error('Token transfer error:', error);
    //         // Safely extract error message without assuming response structure
    //         const errorMessage = error.response?.data?.message || error.message || 'Unknown error transferring token';
    //         throw new Error(errorMessage);
    //     }
    // }

    algorand(net : string): AlgorandClient {
        if (net === "mainnet") {
            return AlgorandClient.mainNet()
        }
        if (net === "localnet") {
            return AlgorandClient.defaultLocalNet()
        }
        return AlgorandClient.testNet()
    }

    async getSuggestedParams(): Promise<algosdk.SuggestedParams> {
        const params = await this.algorand(this.configService.get<string>("ALGORAND_NETWORK")).getSuggestedParams();
        return params;
    }

    async waitForTransaction(txnId, maxRetries = 10, delayMs = 2000, algorand:AlgorandClient): Promise<any> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const transaction = await algorand.client.indexer.lookupTransactionByID(txnId).do();
                
                return transaction;
            } catch (error) {
                if (i === maxRetries - 1) {
                    throw new Error(`Transaction not found after ${maxRetries} attempts: ${error.message}`);
                }
                console.log(`Attempt ${i + 1}: Transaction not yet indexed, retrying in ${delayMs/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    /**
     * Helper method to concatenate multiple Uint8Arrays into a single Uint8Array
     * @param arrays An array of Uint8Arrays to concatenate
     * @returns A single Uint8Array containing all the input arrays
     */
    // async concatArrays(...arrs: ArrayLike<number>[]) {
    //     const size = arrs.reduce((sum, arr) => sum + arr.length, 0);
    //     const c = new Uint8Array(size);
      
    //     let offset = 0;
    //     for (let i = 0; i < arrs.length; i++) {
    //       c.set(arrs[i], offset);
    //       offset += arrs[i].length;
    //     }
      
    //     return c;
    //   }

    async get_public_key(params: { from: string }) {
        const publicKey: Buffer = await this.walletService.getPublicKey(params.from);
        const fromAddr = EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);
        return fromAddr;
    }

    async signAndSubmitTransaction(encoded: Uint8Array, from: string): Promise<string> {
        const sig = await this.sign(encoded, from);

        const ready = await this.txnCrafter.addSignature(encoded, sig)

        const txtId = await this.walletService.submitTransaction(ready)

        return txtId;
    }

    // private async applicationCallTxn(params: {
    //     from: string,
    //     approvalProgram?: string,
    //     clearProgram?: string,
    //     globalSchema?: { numByteSlice: number, numUint: number },
    //     localSchema?: { numByteSlice: number, numUint: number },
    //     appArgs?: Array<Uint8Array>,
    //     foreignApps?: Array<number>,
    //     foreignAssets?: Array<number>,
    //     accounts?: Array<string>,
    //     appIndex?: number,
    //     fee?: number
    // }) {
        
    //     const fromAddr = await this.get_public_key(params);
        
    //     const suggestedParams = await this.getSuggestedParams();
    //     const crafter = CrafterFactory.getCrafter("algorand", this.configService);
        
    //     const approvalProgramBytes = params.approvalProgram 
    //         ? algosdk.base64ToBytes(params.approvalProgram) 
    //         : new Uint8Array(0);
            
    //     const clearProgramBytes = params.clearProgram 
    //         ? algosdk.base64ToBytes(params.clearProgram) 
    //         : new Uint8Array(0);
            
    //     const applicationBuilder = crafter.applicationCall(
    //         fromAddr, 
    //         approvalProgramBytes, 
    //         clearProgramBytes,
    //         params.appArgs || [], 
    //         params.globalSchema || { numByteSlice: 0, numUint: 0 }, 
    //         params.localSchema || { numByteSlice: 0, numUint: 0 }, 
    //         BigInt(suggestedParams.firstValid), 
    //         BigInt(suggestedParams.lastValid),
    //         params.foreignApps || [], 
    //         params.foreignAssets || [],
    //         BigInt(params.appIndex || 0),
    //         params.fee || 1000, // Default fee
    //         params.accounts || [])

    //     return applicationBuilder;
    // }

    /**
     * 
     * @param from - Hashi vault key name
     * @param appIndex 
     * @param approvalProgram 
     * @param clearProgram 
     * @param globalSchema 
     * @param localSchema 
     * @param appArgs 
     * @param foreignApps 
     * @param foreignAssets 
     * @param accounts 
     * @returns 
     */
    // async applicationCall(
    //     from: string, 
    //     appIndex: number, 
    //     approvalProgram?: string, 
    //     clearProgram?: string, 
    //     globalSchema?: { numByteSlice: number, numUint: number }, 
    //     localSchema?: { numByteSlice: number, numUint: number }, 
    //     appArgs?: Array<Uint8Array>, 
    //     foreignApps?: Array<number>, 
    //     foreignAssets?: Array<number>,
    //     accounts?: Array<string>, fee?: number): Promise<{ txnId: string, applicationId: number, error: string }> {  
    //         try {
    //             const params = {
    //                 from,
    //                 appIndex,
    //                 approvalProgram,
    //                 clearProgram,
    //                 globalSchema,
    //                 localSchema,
    //                 appArgs,
    //                 foreignApps,
    //                 foreignAssets,
    //                 accounts,
    //                 fee
    //             }

    //             const  call1 = (await this.applicationCallTxn(params)).get(); console.log(call1);
                
    //             const encoded = (await this.applicationCallTxn(params)).get().encode();

    //             const txnId = await this.signAndSubmitTransaction(encoded, from);

    //             const transaction = await this.waitForTransaction(txnId, 10, 2000, this.algorand("testnet"))     

    //             return { txnId, applicationId: transaction.transaction.createdApplicationIndex ?? appIndex, error: null };
    //         } catch (error) {
    //             console.error('Error in applicationCall:', error);  
    //             // Safely extract error message without assuming response structure
    //             const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    //             return { txnId: '', applicationId: appIndex, error: errorMessage };
    //         }
        
    // }



    /**
     * Creates a transaction group with multiple transaction types in the specified order
     * @param from Sender address (wallet key name)
     * @param transactions Array of transaction configurations
     * @returns Transaction ID and error information
     */
    /**
     * Creates a transaction group with multiple transaction types using algosdk directly
     * @param from Sender address (wallet key name)
     * @param transactions Array of transaction configurations
     * @returns Transaction ID and error information
     */
    async groupTransactionWithAlgosdk(
        from: string,
        transactions: Array<{
            type: 'payment' | 'application' | 'asset-transfer' | 'asset-create' | 'opt-in' | 'opt-out',
            params: any
        }>
    ): Promise<{ txnIds:  Array<string>, error: string }> {
        try {
            const publicKey: Buffer = await this.walletService.getPublicKey(from);
            const fromAddr = EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);
            const suggestedParams = await this.getSuggestedParams();
            console.log(suggestedParams);
            
            // Create individual transactions based on their type using algosdk directly
            const txObjects = [];
            
            for (const txConfig of transactions) {
                let txObject;
                
                switch (txConfig.type) {
                    case 'payment':
                        // Payment transaction using algosdk
                        txObject = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                            sender: fromAddr,
                            receiver: txConfig.params.to,
                            amount: txConfig.params.amount,
                            suggestedParams: suggestedParams
                        });
                        break;
                    case 'application':
                        // Application call transaction using algosdk
                        const appArgs = txConfig.params.appArgs ? 
                            txConfig.params.appArgs.map(arg => new Uint8Array(Buffer.from(arg))) : 
                            [];
                        console.log(appArgs);
                        
                        const accounts = txConfig.params.accounts || [];

                        var sp = suggestedParams;
                        sp.fee = BigInt(txConfig.params.fee)

                        txObject = algosdk.makeApplicationNoOpTxnFromObject({
                            sender: fromAddr,
                            appIndex: txConfig.params.appIndex,
                            appArgs: appArgs,
                            accounts: accounts,
                            foreignApps: txConfig.params.foreignApps || [],
                            foreignAssets: txConfig.params.foreignAssets || [],
                            suggestedParams: sp,})
                        break;
                    case 'asset-transfer':
                        // Asset transfer transaction using algosdk
                        txObject = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                            sender: fromAddr,
                            receiver: txConfig.params.to,
                            assetIndex: txConfig.params.assetIndex,
                            amount: txConfig.params.amount,
                            suggestedParams: suggestedParams
                        });
                        break;
                    case 'asset-create':
                        // Asset creation transaction using algosdk
                        txObject = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
                            sender: fromAddr,
                            total: txConfig.params.total,
                            decimals: txConfig.params.decimals,
                            defaultFrozen: txConfig.params.defaultFrozen || false,
                            unitName: txConfig.params.unitName,
                            assetName: txConfig.params.assetName,
                            manager: txConfig.params.manager || fromAddr,
                            reserve: txConfig.params.reserve || fromAddr,
                            freeze: txConfig.params.freeze || fromAddr,
                            clawback: txConfig.params.clawback || fromAddr,
                            suggestedParams: suggestedParams
                        });
                        break;
                    case 'opt-in':
                        // Asset opt-in transaction using algosdk
                        txObject = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                            sender: fromAddr,
                            receiver: fromAddr,
                            assetIndex: txConfig.params.assetIndex,
                            amount: 0,
                            suggestedParams: suggestedParams
                        });
                        break;
                    case 'opt-out':
                        // Asset opt-out transaction using algosdk
                        txObject = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                            sender: fromAddr,
                            receiver: txConfig.params.closeTo,
                            assetIndex: txConfig.params.assetIndex,
                            amount: 0,
                            closeRemainderTo: txConfig.params.closeTo,
                            suggestedParams: suggestedParams
                        });
                        break;
                    default:
                        throw new Error(`Unsupported transaction type: ${txConfig.type}`);
                }
                
                txObjects.push(txObject);
            }

            console.log(txObjects);
            
            // Assign group ID using algosdk
            const txnGroup = algosdk.assignGroupID(txObjects);
            
            // Sign all transactions
            const signedTxns = [];

            const txnCrafter = new AlgorandTransactionCrafter('testnet-v1.0', 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=')
            
            for (let i = 0; i < txnGroup.length; i++) {
                try {
                    // Sign the transaction using the wallet service
                    const signedTxn = await this.sign(txnGroup[i].bytesToSign(), from);
                    
                    // Add signature to the transaction
                    const ready = await txnCrafter.addSignature(txnGroup[i].bytesToSign(), signedTxn);
                    signedTxns.push(ready);
                } catch (error) {
                    console.error(`Error signing transaction ${i+1}:`, error);
                    throw new Error(`Failed to sign transaction ${i+1}: ${error.message}`);
                }
            }
            
            // Submit the signed transaction group
            try {
                const bytestoSubmit = concatArrays(...signedTxns);
                const txnId = await this.walletService.submitTransaction(bytestoSubmit);

                var txnGroupIds = [];
                for (let i = 0; i < txnGroup.length; i++) {
                    txnGroupIds.push(txnGroup[i].txID());
                }
                return { txnIds: txnGroupIds, error: null };
            } catch (error) {
                console.error('Error in group transaction processing:', error);
                return { txnIds: [], error: error.message || 'Unknown error in group transaction' };
            }
        } catch (error) {
            console.error('Error in groupTransactionWithAlgosdk:', error);
            return { txnIds: [], error: error.message || 'Unknown error' };
        }
    }
    
    // async groupTransaction(
    //     from: string,
    //     transactions: Array<{
    //         type: 'payment' | 'application' | 'asset-transfer' | 'asset-create' | 'opt-in' | 'opt-out',
    //         params: any
    //     }>
    // ): Promise<{ txnIds: Array<string>, error: string }> {
    //     try {
    //         const publicKey: Buffer = await this.walletService.getPublicKey(from);
    //         const fromAddr = EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);
    //         const suggestedParams = await this.getSuggestedParams();
            
    //         // Get the crafter      
    //         const crafter = CrafterFactory.getCrafter("algorand", this.configService);
            
    //         // Create individual transactions based on their type
    //         const txObjects = [];
            
    //         for (const txConfig of transactions) {
    //             let txObject;
                
    //             switch (txConfig.type) {
    //                 case 'payment':
    //                     // Payment transaction
    //                     const paymentParams = txConfig.params;
    //                     txObject = await this.makePaymentTxn(from, paymentParams.to, paymentParams.amount, suggestedParams);
    //                     break;
                        
    //                 case 'application':
    //                     // Application call transaction
    //                     const appParams = txConfig.params;
                        
    //                     txObject = await this.applicationCallTxn({
    //                         from: from,
    //                         appIndex: appParams.appIndex || 0,
    //                         approvalProgram: appParams.approvalProgram,
    //                         clearProgram: appParams.clearProgram,
    //                         globalSchema: appParams.globalSchema,
    //                         localSchema: appParams.localSchema,
    //                         appArgs: appParams.appArgs || [],
    //                         foreignApps: appParams.foreignApps || [],
    //                         foreignAssets: appParams.foreignAssets || [],
    //                         accounts: appParams.accounts || [],
    //                         fee: appParams.fee || 1000
    //                     });
    //                     break;
                        
    //                 case 'asset-transfer':
    //                     // Asset transfer transaction
    //                     const assetParams = txConfig.params;
    //                     txObject = await this.transferTokenTxn({
    //                         from: from,
    //                         to: assetParams.receiver,
    //                         amount: assetParams.amount,
    //                         assetId: assetParams.assetId
    //                     });
                    
    //                     break;
                        
    //                 case 'asset-create':
    //                     // Asset creation transaction
    //                     const createParams = txConfig.params;
    //                     txObject = await this.assetConfigTxn(
    //                         createParams, 
    //                         from, 
    //                         createParams.assetName, 
    //                         createParams.decimals, 
    //                         createParams.totalSupply
    //                     );
    //                     break;

    //                 case 'opt-in':
    //                     // Asset opt-in transaction
    //                     const optInParams = txConfig.params;
    //                     txObject = await this.optInAssetTxn({
    //                         from: from,
    //                         assetId: optInParams.assetId
    //                     });
    //                     break;

    //                 case 'opt-out':
    //                     // Asset opt-out transaction
    //                     const optOutParams = txConfig.params;
    //                     txObject = await this.optOutAssetTxn({
    //                         from: from,
    //                         assetId: optOutParams.assetId,
    //                         close: optOutParams.closeTo
    //                     });
    //                     break;  
                        
    //                 default:
    //                     throw new Error(`Unsupported transaction type: ${txConfig.type}`);
    //             }
                
    //             txObjects.push(txObject);
    //         }
            
    //         // Group the transactions
    //         const groupTx = crafter.groupTransaction(
    //             fromAddr,
    //             BigInt(suggestedParams.firstValid),
    //             BigInt(suggestedParams.lastValid),
    //             txObjects
    //         ).get();
            
    //         const encodedTxns = groupTx.encodeAll();       
                        
            
    //         const signedTxns = [];
            
    //         // First sign all transactions
    //         for (let i = 0; i < encodedTxns.length; i++) {
    //             try {
    //                 const signedTxn = await this.sign(encodedTxns[i], from);
    //                 const ready = await this.txnCrafter.addSignature(encodedTxns[i], signedTxn);    
    //                 signedTxns.push(ready);
    //             } catch (error) {
    //                 console.error(`Error signing transaction ${i+1}:`, error);
    //                 throw new Error(`Failed to sign transaction ${i+1}: ${error.message}`);
    //             }
    //         }
            
    //         // // Now submit all transactions as a group
    //       try {

    //             const bytestoSubmit = concatArrays(...signedTxns);
                
    //             const txnId = await this.walletService.submitTransaction(bytestoSubmit);
                
    //             return { txnIds: [txnId], error: null };
    //         } catch (error) {
    //             console.error('Error in group transaction processing:', error);
    //             return { txnIds: [], error: error.message || 'Unknown error in group transaction' };
    //         }
            
    //     } catch (error) {
    //         console.error('Error in groupTransaction:', error);
    //         const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    //         return { txnIds: [], error: errorMessage };
    //     }
    // }

    /**
     * Create an Algorand application call transaction
     * @param params Application call parameters
     * @returns Transaction ID, application ID, and any error information
     */
    async applicationCall(params: {
        from: string,
        approvalProgram?: string,
        clearProgram?: string,
        globalSchema?: { numUint: number, numByteSlice: number },
        localSchema?: { numUint: number, numByteSlice: number },
        methodName?: string,
        // Accept either a JSON string or an already parsed array of [value, type]
        methodArgs?: string | any[],
        applicationId?: number,
        onComplete?: number,
        accounts?: string[],
        foreignApps?: number[],
        foreignAssets?: number[],
        fee?: number
    }): Promise<{ txn : IApplicationCallTxBuilder | null, error: string | undefined } > {
        try {
            
            // Validate input
            if (!params.from) {
                throw new Error('Sender address (from) is required');
            }

            const isExistingAppCall = typeof params.applicationId === 'number' && params.applicationId > 0;

            // Only require programs and schema for app creation (no applicationId provided)
            if (!isExistingAppCall) {
                if (!params.approvalProgram) {
                    throw new Error('Approval program is required for application creation');
                }

                if (!params.clearProgram) {
                    throw new Error('Clear program is required for application creation');
                }

                if (!params.globalSchema) {
                    throw new Error('Global schema is required for application creation');
                }

                if (!params.localSchema) {
                    throw new Error('Local schema is required for application creation');
                }
            }
            
            // Parse method arguments if provided
            let methodArgs: any[] = [];
            if (params.methodArgs) {
                try {
                    if (typeof params.methodArgs === 'string') {
                        methodArgs = JSON.parse(params.methodArgs);
                    } else if (Array.isArray(params.methodArgs)) {
                        methodArgs = params.methodArgs;
                    } else {
                        throw new Error('methodArgs must be a JSON string or an array');
                    }
                } catch (error) {
                    throw new Error('Invalid JSON in methodArgs');
                }
            }

            // Extract approval and clear programs from bytecode
            const approvalProgram = params.approvalProgram 
                    ? algosdk.base64ToBytes(params.approvalProgram) 
                    : undefined;
            const clearProgram = params.clearProgram 
                    ? algosdk.base64ToBytes(params.clearProgram) 
                    : undefined;

            // Extract schema information - only set non-zero values
            let globalSchema: StateSchema | undefined;
            if (params.globalSchema && (params.globalSchema.numUint > 0)) {
                globalSchema = {
                    nui: Number(params.globalSchema.numUint) > 0 ? Number(params.globalSchema.numUint) : 0,
                };
            }

            if (params.globalSchema && (params.globalSchema.numByteSlice > 0)) {
                globalSchema = {
                    nbs: Number(params.globalSchema.numByteSlice) > 0 ? Number(params.globalSchema.numByteSlice) : 0
                };
            }

            let localSchema: StateSchema | undefined;
            if (params.localSchema && (params.localSchema.numUint > 0)) {
                localSchema = {
                    nui: Number(params.localSchema.numUint) > 0 ? Number(params.localSchema.numUint) : 0,
                };
            }

            if (params.localSchema && (params.localSchema.numByteSlice > 0)) {
                localSchema = {
                    nbs: Number(params.localSchema.numByteSlice) > 0 ? Number(params.localSchema.numByteSlice) : 0
                };
            }

            // Check if this is a bare application creation (no method call)
            const isBareCreation = params.methodName == null || params.methodName == undefined || params.methodName == "";

            let encodedArgs: Uint8Array[] = [];
            
            if (!isBareCreation && params.methodName) {
                // Create method selector (first 4 bytes of SHA-512/256 hash)
                const methodSelector = new Uint8Array(sha512_256.array(Buffer.from(params.methodName)).slice(0, 4));
                encodedArgs = [methodSelector];
                
                if (methodArgs && methodArgs.length > 0) {
                    for (let i = 0; i < methodArgs.length; i++) {
                        const [val, argType] = methodArgs[i];
                        if (argType === 'uint64') {
                            // Coerce to number/bigint to satisfy algosdk.encodeUint64
                            const n = typeof val === 'string' ? Number(val) : val;
                            console.log('Value of arg', n);
                            encodedArgs.push(algosdk.encodeUint64(n));
                        } else if (argType === 'addr' || argType === 'address') {
                            // ABI address is 32-byte public key
                            const pk = new AlgorandEncoder().decodeAddress(String(val));
                            encodedArgs.push(pk);
                        } else if (argType === 'bytes' || argType === 'byte[]') {
                            // Support base64 or utf8 input; prefer base64 if it decodes
                            try {
                                const b = Buffer.from(String(val), 'base64');
                                if (b.length > 0) {
                                    encodedArgs.push(new Uint8Array(b));
                                } else {
                                    encodedArgs.push(new Uint8Array(Buffer.from(String(val))));
                                }
                            } catch {
                                encodedArgs.push(new Uint8Array(Buffer.from(String(val))));
                            }
                        } else if (argType === 'string') {
                            encodedArgs.push(new Uint8Array(Buffer.from(String(val))));
                        } else {
                            // Default: treat as string/byte input
                            encodedArgs.push(new Uint8Array(Buffer.from(String(val))));
                        }
                    }
                    
                }
                console.log(encodedArgs);
                
                
            } else if (!isBareCreation) {
                return { txn: null, error: 'Either provide a methodName or ensure the contract supports bare creation with NoOp' };
            }

            // Get sender address and suggested parameters
            const fromAddr = await this.get_public_key({ from: params.from });
            const suggestedParams = await this.getSuggestedParams();

            // Create application call transaction using ApplicationTxBuilder directly
            let applicationCallTransaction = new ApplicationCallTxBuilder(this.genesisId, this.genesisHash)
                .addSender(fromAddr)
                .addFirstValidRound(BigInt(suggestedParams.firstValid))
                .addLastValidRound(BigInt(suggestedParams.lastValid))
                .addFee(BigInt(params.fee && params.fee > 0 ? params.fee : (Number(suggestedParams.fee) < 1000 ? 1000 : suggestedParams.fee)));

            // Only add programs for creation
            if (!isExistingAppCall) {
                applicationCallTransaction = applicationCallTransaction
                    .addApprovalProgram(approvalProgram!)
                    .addClearStateProgram(clearProgram!);
            }

            // Add global and local schema only if they have non-zero values
            if (globalSchema) {
                applicationCallTransaction = applicationCallTransaction.addGlobalSchema(globalSchema);
            }
            if (localSchema) {
                applicationCallTransaction = applicationCallTransaction.addLocalSchema(localSchema);
            }

            // Add application arguments if any (expects Uint8Array[])
            if (encodedArgs && encodedArgs.length > 0) {
                applicationCallTransaction = applicationCallTransaction.addApplicationArgs(encodedArgs);
            }

            if (typeof params.applicationId === 'number' && params.applicationId > 0) {
                applicationCallTransaction = applicationCallTransaction.addApplicationId(BigInt(params.applicationId));
            }

            // Optional references and flags
            if (params.accounts && params.accounts.length > 0) {
                applicationCallTransaction = applicationCallTransaction.addAccounts(params.accounts);
            }
            if (params.foreignApps && params.foreignApps.length > 0) {
                const fa = params.foreignApps.map((n) => BigInt(n));
                applicationCallTransaction = applicationCallTransaction.addForeignApps(fa);
            }
            if (params.foreignAssets && params.foreignAssets.length > 0) {
                const fas = params.foreignAssets.map((n) => BigInt(n));
                applicationCallTransaction = applicationCallTransaction.addForeignAssets(fas);
            }
            if (typeof params.onComplete === 'number' && params.onComplete > 0) {
                applicationCallTransaction = applicationCallTransaction.addOnComplete(params.onComplete);
            }
console.log(applicationCallTransaction);

            const txn = applicationCallTransaction;
            return {txn : txn, error : null};

        } catch (error) {
            console.log(error);
            
            console.error('Error in applicationCall:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
            return { txn : null, error : errorMessage };
        }
    }
}
