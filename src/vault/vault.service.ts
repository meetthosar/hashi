import { HttpService } from "@nestjs/axios"
import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { AxiosResponse } from "axios"

export type KeyType = "ed25519" | "ecdsa-p256"
export type HashAlgorithm = "sha2-256" | "sha2-512"

@Injectable()
export class VaultService {
	private latestToken: string;
	private vaultBaseUrl: string

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService
	) {
		this.vaultBaseUrl = this.configService.get<string>("VAULT_BASE_URL")
	}

	async auth(token: string): Promise<boolean> {
		const res: AxiosResponse = await this.httpService.axiosRef.get(`${this.vaultBaseUrl}/v1/sys/auth`, {
			headers: {
				"X-Vault-Token": token,
			},
		})

		const isOkay = res.status === 200
		if (isOkay) this.latestToken = token

		return isOkay
	}

	/**
	 * 
	 * @param byteLength 
	 * @returns 
	 */
	// async randomBytes(byteLength: number): Promise<Uint8Array> {
	// 	const res: AxiosResponse = await this.httpService.axiosRef.post(
	// 		`http://localhost:8200/v1/sys/tools/random/${byteLength}`,
	// 		{
	// 			format: "hex",
	// 		},
	// 		{
	// 			headers: {
	// 				"X-Vault-Token": this.latestToken,
	// 			},
	// 		}
	// 	)

	// 	return new Uint8Array(Buffer.from(res.data.data.random_bytes, "hex"))
	// }

	/**
	 *
	 * @param keyName
	 * @returns
	 */
	async keyGen(keyName: string, keyType: KeyType): Promise<Buffer> {
		// fetch root token
		// const token: string = JSON.parse(fs.readFileSync("vault-seal-keys.json").toString()).root_token
		// const sampleKey: string = crypto.randomUUID()
		const transitKeyURL = `${this.vaultBaseUrl}/v1/transit/keys/${keyName}`;
		let res: AxiosResponse = null;
		try{
			res = await this.httpService.axiosRef.post(
			transitKeyURL,
			{
				type: keyType,
				derived: false,
				allow_deletion: true,
			},
			{
				headers: {
					"X-Vault-Token": this.latestToken,
					"Content-Type": "application/json",
				},
			}
		)
		} catch (error) {
			Logger.error("Failed to generate keys to vault", "VaultService.keyGen", error)
		}

		const publicKey: Buffer = res && Buffer.from(res.data.data.keys["1"].public_key, "base64")

		// log key created
		Logger.debug(publicKey?.toString("base64"), `VaultService.keyGen`)
		return publicKey
	}

	/**
	 *
	 * @param data
	 * @param hashAlgorithm
	 * @returns
	 */
	async sign(keyName: string, data: Buffer, hashAlgorithm: HashAlgorithm, permissionedToken?: string): Promise<Buffer> {
		const result: AxiosResponse = await this.httpService.axiosRef.post(
			`${this.vaultBaseUrl}/v1/transit/sign/${keyName}`,
			{
				input: data.toString("base64"),
			},
			{
				headers: {
					"X-Vault-Token": permissionedToken || this.latestToken,
				},
			}
		)

		return result.data.data.signature
	}
}
