import { DynamicModule, ForwardReference, Module, Type } from "@nestjs/common"
import { WalletModule } from "./wallet/wallet.module"
import { AppController } from "./app.controller"
import { VaultModule } from "./vault/vault.module"
import { WalletService } from "./wallet/wallet.service"
import { HttpModule, HttpService } from "@nestjs/axios"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { Transaction } from "algosdk"
import { TransactionService } from "./transaction/transaction.service"
import { AlgorandTransactionCrafter } from '@algorandfoundation/algo-models'
import { TransactionModule } from "./transaction/transaction.module"
// import { AlgoTxCrafter, CrafterFactory } from "src/chain/crafter.factory"
import { AlgorandClient, Config } from '@algorandfoundation/algokit-utils'

function configuredModules(): Array<Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference> {
	const csv_modules_names: string[] = process.env.CHOOSEN_MODULES ? process.env.CHOOSEN_MODULES.split(",") : []
	const modules: Array<Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference> = csv_modules_names.length == 0 ? [WalletModule] : []

	csv_modules_names.forEach((module_name: string) => {
		switch (module_name) {
			case "wallet":
				modules.push(WalletModule)
				break
			default:
				throw new Error(`Unknown module name: ${module_name}`)
		}
	})

	return modules
}

@Module({
	imports: [ConfigModule.forRoot({ isGlobal: true }), WalletModule, VaultModule, HttpModule, TransactionModule], // ...configuredModules()
	controllers: [],
	providers: [
		WalletService,
		ConfigService,	
		TransactionService,
		AlgorandTransactionCrafter,
		String,
		Object,
	],
})
export class AppModule {}

