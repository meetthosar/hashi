import { Post, Body, Controller, UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Express } from 'express';
import { TransactionService } from "./transaction.service";
import { ConfigService } from "@nestjs/config";
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetParamsBuilder, AlgorandTransactionCrafter, ApplicationCallTxBuilder, StateSchema } from '@algorandfoundation/algo-models';    
import { ApiTags } from "@nestjs/swagger";
import algosdk from "algosdk";
import { sha512_256 } from "js-sha512";
import { CrafterFactory } from "../chain/crafter.factory";

@ApiTags('Transaction')
@Controller()
export class ApplicationCall {
    constructor(
        private readonly transactionService: TransactionService,
        private readonly configService: ConfigService,
        private readonly crafterFactory: AlgorandTransactionCrafter,
    ) {
        this.crafterFactory = new AlgorandTransactionCrafter(this.configService.get<string>("GENESIS_ID"), this.configService.get<string>("GENESIS_HASH"))
    }

    /**
     * Create an Algorand application from ARC56 contract specification
     * @param body Contains the wallet key name and optional method details
     * @param file The uploaded ARC56 contract specification file
     * @returns Transaction ID, application ID, and any error information
     */
    @Post('application-call')
    async createApplication(
        @Body() body: {
            from: string,
            approvalProgram: string,
            clearProgram: string,
            globalSchema: { numUint: number, numByteSlice: number },
            localSchema: { numUint: number, numByteSlice: number },
            methodName?: string,
            methodArgs?: string // JSON string of arguments
            applicationId?: number
        }
    ): Promise<{ txnId: string, applicationId: number, error: string }> {

        try {
            // Validate input
            if (!body.from) {
                return { txnId: '', applicationId: 0, error: 'Sender address (from) is required' };
            }

            if (!body.approvalProgram) {
                return { txnId: '', applicationId: 0, error: 'Approval program is required' };
            }

            if (!body.clearProgram) {
                return { txnId: '', applicationId: 0, error: 'Clear program is required' };
            }

            if (!body.globalSchema) {
                return { txnId: '', applicationId: 0, error: 'Global schema is required' };
            }

            if (!body.localSchema) {
                return { txnId: '', applicationId: 0, error: 'Local schema is required' };
            }

            // Parse method arguments if provided
            let methodArgs: any[] = [];
            if (body.methodArgs) {
                try {
                    methodArgs = JSON.parse(body.methodArgs);
                } catch (error) {
                    return { txnId: '', applicationId: 0, error: 'Invalid JSON in methodArgs' };
                }
            }

            
            // Extract approval and clear programs from bytecode
            const approvalProgram = body.approvalProgram 
                    ? algosdk.base64ToBytes(body.approvalProgram) 
                    : new Uint8Array(0);
            const clearProgram = body.clearProgram 
                    ? algosdk.base64ToBytes(body.clearProgram) 
                    : new Uint8Array(0);

            if (!approvalProgram || !clearProgram) {
                return { txnId: '', applicationId: 0, error: 'Approval and clear programs are required' };
            }

            // Extract schema information - only set non-zero values
            let globalSchema: StateSchema | undefined;
            if (body.globalSchema && (body.globalSchema.numUint > 0 )) {
                globalSchema = {
                    nui: Number(body.globalSchema.numUint) > 0 ? Number(body.globalSchema.numUint) : 0,
                };
            }

            if (body.globalSchema && (body.globalSchema.numByteSlice > 0)) {
                globalSchema = {
                    nbs: Number(body.globalSchema.numByteSlice) > 0 ? Number(body.globalSchema.numByteSlice) : 0
                };
            }

            let localSchema: StateSchema | undefined;
            if (body.localSchema && (body.localSchema.numUint > 0 )) {
                localSchema = {
                    nui: Number(body.localSchema.numUint) > 0 ? Number(body.localSchema.numUint) : 0,
                };
            }

            if (body.localSchema && (body.localSchema.numByteSlice > 0)) {
                localSchema = {
                    nbs: Number(body.localSchema.numByteSlice) > 0 ? Number(body.localSchema.numByteSlice) : 0
                };
            }


            

            // Check if this is a bare application creation (no method call)
            const isBareCreation = body.methodName == null || body.methodName == undefined || body.methodName == "";
            
            let encodedArgs: Uint8Array[] = [];
            
            if (!isBareCreation && body.methodName) {
                // Create method selector (first 4 bytes of SHA-512/256 hash)
                const methodSelector = new Uint8Array(sha512_256.array(Buffer.from(body.methodName)).slice(0, 4));
                encodedArgs = [methodSelector];
                
                if (methodArgs && methodArgs.length > 0) {
                    for (let i = 0; i < methodArgs.length; i++) {
                        const arg = methodArgs[i][1];
                        if (arg === 'uint64') {
                            encodedArgs.push(algosdk.encodeUint64(methodArgs[i][0]));
                        } else if (arg === 'string') {
                            encodedArgs.push(new Uint8Array(Buffer.from(methodArgs[i][0])));
                        } else {
                            // Default encoding for other types
                            encodedArgs.push(new Uint8Array(Buffer.from(methodArgs[i][0])));
                        }
                    }
                }

            } else if (!isBareCreation) {
                return { txnId: '', applicationId: 0, error: 'Either provide a methodName or ensure the contract supports bare creation with NoOp' };
            }

            // Get sender address and suggested parameters
            const fromAddr = await this.transactionService.get_public_key({ from: body.from });
            const suggestedParams = await this.transactionService.getSuggestedParams();

            // Create application call transaction using ApplicationTxBuilder directly
            const genesisId = this.configService.get<string>("GENESIS_ID");
            const genesisHash = this.configService.get<string>("GENESIS_HASH");
            
            let applicationCallTransaction = new ApplicationCallTxBuilder(genesisId, genesisHash)
                .addSender(fromAddr)
                .addApprovalProgram(approvalProgram)
                .addClearStateProgram(clearProgram)
                .addFirstValidRound(BigInt(suggestedParams.firstValid))
                .addLastValidRound(BigInt(suggestedParams.lastValid))
                .addFee(BigInt(Number(suggestedParams.fee) < 1000 ? 1000 : suggestedParams.fee))
                

            // Add global and local schema only if they have non-zero values
            if (globalSchema) {
                applicationCallTransaction = applicationCallTransaction.addGlobalSchema(globalSchema);
            }
            if (localSchema) {
                applicationCallTransaction = applicationCallTransaction.addLocalSchema(localSchema);
            }


            // Add application arguments if any
            if (encodedArgs && encodedArgs.length > 0) {
                applicationCallTransaction = applicationCallTransaction.addApplicationArgs(encodedArgs);
            }

            if( body.applicationId > 0 || body.applicationId !== undefined )
                applicationCallTransaction.addApplicationId(BigInt(body.applicationId));

            const txn = applicationCallTransaction.get();
            
            const encodedTxn = txn.encode();

            // Sign the transaction
            // const signature = await this.transactionService.sign(encodedTxn, body.from);
            // const signed = this.crafterFactory.addSignature(encodedTxn, signature);

            // Submit the transaction
            const txnId = await this.transactionService.signAndSubmitTransaction(encodedTxn, body.from);

            // Wait for transaction confirmation
            const transaction = await this.transactionService.waitForTransaction(
                txnId, 
                20, 
                2000, 
                this.transactionService.algorand("testnet")
            );

            return { 
                txnId, 
                applicationId: transaction.transaction.createdApplicationIndex.toString()?? 0, 
                error: '' 
            };

        } catch (error) {
            console.error('Error in createApplication:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
            return { txnId: '', applicationId: 0, error: errorMessage };
        }
    }
}