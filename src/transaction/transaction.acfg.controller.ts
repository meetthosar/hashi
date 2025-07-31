import { Post, Body, Controller } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { ConfigService } from "@nestjs/config";
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { AssetParamsBuilder, AlgorandTransactionCrafter } from '@algorandfoundation/algo-models';    
import { ApiTags } from "@nestjs/swagger";

// DTO for required parameters
export class CreateAssetRequiredDto {
    @IsString()
    from: string;

    @IsString()
    unit: string;

    @IsNumber()
    @Type(() => Number)
    decimals: number;

    @IsNumber()
    @Type(() => Number)
    totalTokens: number;
}

// DTO for optional parameters
export class CreateAssetOptionalDto {

    @IsNumber()
    @Type(() => Number)
    assetId?: number;
    
    @IsString()
    @IsOptional()
    assetName?: string;

    @IsString()
    @IsOptional()
    url?: string;

    @IsBoolean()
    @IsOptional()
    defaultFrozen?: boolean;

    @IsString()
    @IsOptional()
    managerAddress?: string;

    @IsString()
    @IsOptional()
    reserveAddress?: string;

    @IsString()
    @IsOptional()
    freezeAddress?: string;

    @IsString()
    @IsOptional()
    clawbackAddress?: string;
}

// Combined DTO
export class CreateAssetDto extends CreateAssetRequiredDto implements Partial<CreateAssetOptionalDto> {
    assetName?: string;
    url?: string;
    defaultFrozen?: boolean;
    managerAddress?: string;
    reserveAddress?: string;
    freezeAddress?: string;
    clawbackAddress?: string;
    assetId: any;
}

@ApiTags("Transaction")
@Controller()
export class AssetConfig {
    constructor(private readonly txnService: TransactionService, private readonly crafterFactory: AlgorandTransactionCrafter, private readonly configService: ConfigService) {
        this.crafterFactory = new AlgorandTransactionCrafter(this.configService.get<string>("GENESIS_ID"), this.configService.get<string>("GENESIS_HASH"))
    }

    @Post("asset")
    async assetConfig(@Body() body: CreateAssetDto): Promise<{ assetId: string, txnId: string, error: string}> {

        const decimals = Number(body.decimals)
        const totalTokens = Number(body.totalTokens)
        const assetId = Number(body.assetId)

        let defaultFrozen = false;
        if (body.defaultFrozen !== undefined) {
            // If it's already a boolean, use it directly
            if (typeof body.defaultFrozen === 'boolean') {
                defaultFrozen = body.defaultFrozen;
            } 
            // If it's a string 'true' or 'false', convert appropriately
            else if (typeof body.defaultFrozen === 'string') {
                defaultFrozen = body.defaultFrozen === 'true';
            }
        }

        const params = {
            assetId: assetId,
            assetName: body.assetName,
            url: body.url,
            defaultFrozen: defaultFrozen,
            managerAddress: body.managerAddress,
            reserveAddress: body.reserveAddress,
            freezeAddress: body.freezeAddress,
            clawbackAddress: body.clawbackAddress
        }
        
        const suggestedParams = await this.txnService.getSuggestedParams();

        const assetParams = new AssetParamsBuilder()
        .addAssetName(body.assetName)
        .addUnitName(body.unit)
        .addTotal(totalTokens)
        .addManagerAddress(body.managerAddress)
        .addReserveAddress(body.reserveAddress)
        .addFreezeAddress(body.freezeAddress)
        .addClawbackAddress(body.clawbackAddress)
        .addUrl(body.url)
        
        if(decimals){
            assetParams.addDecimals(decimals)
        }
        
        if(defaultFrozen){
            assetParams.addDefaultFrozen(defaultFrozen)
        }
        
        const fromAddr = await this.txnService.get_public_key({from: body.from})
        try {
            const encoded = this.crafterFactory.createAsset(fromAddr, assetParams.get())
                            .addFirstValidRound(suggestedParams.firstValid)
                            .addLastValidRound(suggestedParams.lastValid)
                            .get().encode();

            const txnId = await this.txnService.signAndSubmitTransaction(encoded, body.from);

            const algorand = this.txnService.algorand(this.configService.get<string>("ALGORAND_NETWORK"))

            const transaction = await this.txnService.waitForTransaction(txnId, 10, 2000, algorand)

            const asset = transaction.transaction.createdAssetIndex;

            return { assetId: asset?.toString() || params.assetId, txnId, error: null};

        } catch (error) {
            console.error('Asset creation error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error creating asset';
            throw new Error(errorMessage);
        }

        // return await this.txnService.asset(body.from, body.unit, decimals, totalTokens, params)
        
        // const assetId = await this.txnService.asset('test', 'kavya', 0, 1, { assetName: 'test', url: 'http://test.com', defaultFrozen: false, 
        //     managerAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M', 
        //     reserveAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M', 
        //     freezeAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M', 
        //     clawbackAddress: 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M' })

        // return assetId
    }
}