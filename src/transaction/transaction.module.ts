import { HttpModule } from "@nestjs/axios"
import { Module } from "@nestjs/common"
import { AssetConfig } from "./transaction.acfg.controller"
import { WalletService } from "../wallet/wallet.service"
import { VaultModule } from "../vault/vault.module"
import { VaultService } from "../vault/vault.service"
import { ChainModule } from "../chain/chain.module"
import { ConfigModule } from "@nestjs/config"
import { TransactionService } from "./transaction.service"
import { AlgorandTransactionCrafter, AlgorandEncoder } from '@algorandfoundation/algo-models'
import { Payment } from "./transaction.pay.controller"
import { AssetTransfer } from "./transaction.axfer.controller"
import { ApplicationCall } from "./transaction.appl.controller"
import { GroupTransaction } from "./transaction.group.controller"
// import { AlgoTxCrafter, CrafterFactory } from "src/chain/crafter.factory"

@Module({
    imports: [HttpModule, VaultModule, ChainModule, ConfigModule.forRoot()],
    controllers: [AssetConfig, Payment, AssetTransfer, ApplicationCall, GroupTransaction],
    providers: [WalletService, VaultService, TransactionService, AlgorandTransactionCrafter, AlgorandEncoder, String, Object],
})

export class TransactionModule {}