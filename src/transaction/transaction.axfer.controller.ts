import { Post, Body, Controller } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { ConfigService } from "@nestjs/config";
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetParamsBuilder, AlgorandTransactionCrafter } from '@algorandfoundation/algo-models';    
import { ApiTags } from "@nestjs/swagger";

@ApiTags('Transaction')
@Controller()
export class AssetTransfer {
    constructor(
        private readonly transactionService: TransactionService,
        private readonly configService: ConfigService,
        private readonly crafterFactory: AlgorandTransactionCrafter,
    ) {
        this.crafterFactory = new AlgorandTransactionCrafter(this.configService.get<string>("GENESIS_ID"), this.configService.get<string>("GENESIS_HASH"))
    }

    @Post('asset-transfer')
    async assetTransfer(@Body() body: { assetId: number, from: string, to: string, amount: number }) {
        const amount = Number(body.amount)
        const fromAddr = await this.transactionService.get_public_key({from: body.from})
        const suggestedParams = await this.transactionService.getSuggestedParams()
        try {
            const encoded = this.crafterFactory.transferAsset(fromAddr, body.assetId, body.to, amount)
                            .addFirstValidRound(suggestedParams.firstValid)
                            .addLastValidRound(suggestedParams.lastValid)
                            .get().encode();

            const txnId = await this.transactionService.signAndSubmitTransaction(encoded, body.from);

            return { txnId, error: null};

        } catch (error) {
            console.error('Asset transfer error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error transferring asset';
            throw new Error(errorMessage);
        }
    }

    @Post('opt-in-asset')
    async optIn(@Body() body: { assetId: number, from: string  }) {
        const fromAddr = await this.transactionService.get_public_key({from: body.from})
        const suggestedParams = await this.transactionService.getSuggestedParams()
        try {
            const encoded = this.crafterFactory.transferAsset(fromAddr, body.assetId, fromAddr, 0)
                            .addFirstValidRound(suggestedParams.firstValid)
                            .addLastValidRound(suggestedParams.lastValid)
                            .get().encode();

            const txnId = await this.transactionService.signAndSubmitTransaction(encoded, body.from);

            return { txnId, error: null};

        } catch (error) {
            console.error('Asset opt-in error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error opting in to asset';
            throw new Error(errorMessage);
        }
    }

    @Post('opt-out-asset')
    async optOut(@Body() body: { assetId: number, from: string, close: string  }) {
        const fromAddr = await this.transactionService.get_public_key({from: body.from})
        const suggestedParams = await this.transactionService.getSuggestedParams()
        try {
            const encoded = this.crafterFactory.transferAsset(fromAddr, body.assetId, fromAddr, 0)
                            .addAssetCloseTo(body.close)
                            .addFirstValidRound(suggestedParams.firstValid)
                            .addLastValidRound(suggestedParams.lastValid)
                            .get().encode();

            const txnId = await this.transactionService.signAndSubmitTransaction(encoded, body.from);

            return { txnId, error: null};

        } catch (error) {
            console.error('Asset opt-out error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error opting out of asset';
            throw new Error(errorMessage);
        }
    }
}