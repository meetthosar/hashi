import { Post, Body, Controller } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { ApiTags } from "@nestjs/swagger";

@ApiTags('Transaction')
@Controller()
export class ApplicationCall {
    constructor(
        private readonly transactionService: TransactionService,
    ) {}

    /**
     * Create an Algorand application from ARC56 contract specification
     * @param body Contains the wallet key name and optional method details
     * @returns Transaction ID, application ID, and any error information
     */
    @Post('application-call')
    async createApplication(
        @Body() body: {
            from: string,
            approvalProgram?: string,
            clearProgram?: string,
            globalSchema?: { numUint: number, numByteSlice: number },
            localSchema?: { numUint: number, numByteSlice: number },
            methodName?: string,
            methodArgs?: string // JSON string of arguments
            applicationId?: number
            onComplete?: number
        }
    ): Promise<{ txnId: string, applicationId: number, error: string }> {
        try {
            const txn = await this.transactionService.applicationCall({
            from: body.from,
            approvalProgram: body.approvalProgram,
            clearProgram: body.clearProgram,
            globalSchema: body.globalSchema,
            localSchema: body.localSchema,
            methodName: body.methodName,
            methodArgs: body.methodArgs,
            applicationId: Number(body.applicationId),
            onComplete: body.onComplete
        });
        console.log(txn);
        
        const encodedTxn = txn.txn.get().encode();

            // Sign and submit the transaction
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
                applicationId: transaction.transaction.createdApplicationIndex?.toString() ?? 0, 
                error: '' 
            };
    } catch (error) {
        console.error('Error in applicationCall:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        return { txnId: '', applicationId: 0, error: errorMessage };
    }
    }
}