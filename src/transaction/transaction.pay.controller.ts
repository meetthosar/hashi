import { Post, Body, Controller } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { ConfigService } from "@nestjs/config";
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetParamsBuilder, AlgorandTransactionCrafter } from '@algorandfoundation/algo-models';    
import { ApiTags } from "@nestjs/swagger";

@ApiTags('Transaction')
@Controller()
export class Payment {
    constructor(
        private readonly transactionService: TransactionService,
        private readonly configService: ConfigService,
        private readonly crafterFactory: AlgorandTransactionCrafter,
    ) {
        this.crafterFactory = new AlgorandTransactionCrafter(this.configService.get<string>("GENESIS_ID"), this.configService.get<string>("GENESIS_HASH"))
    }

    @Post('payment')
    async makePayment(@Body() body: { from: string, to: string, amt: number }) {
        const amount = Number(body.amt)
        const fromAddr = await this.transactionService.get_public_key({from: body.from})
        const suggestedParams = await this.transactionService.getSuggestedParams()
        try {
            const encoded = this.crafterFactory.pay(amount, fromAddr, body.to)
                            .addFirstValidRound(suggestedParams.firstValid)
                            .addLastValidRound(suggestedParams.lastValid)
                            .get().encode();

            const txnId = await this.transactionService.signAndSubmitTransaction(encoded, body.from);

            return { txnId, error: null};

        } catch (error) {
            console.error('Payment error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error making payment';
            throw new Error(errorMessage);
        }
    }
}
