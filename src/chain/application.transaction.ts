import { AlgorandEncoder } from "@algorandfoundation/algo-models";
import * as msgpack from "algo-msgpack-with-bigint"
import { Encoder } from "./encoder.role";

export class ApplicationCall {
    type: string
    snd: Uint8Array
    fee: bigint
    fv: bigint
    lv: bigint
    gen: string
    gh: Uint8Array
    apap?: Uint8Array // Approval program
    apsu?: Uint8Array // Clear state program
    apgs?: { 
        nbs?: number 
        nui?: number 
        }; // Global schema
    apls?: { 
        nbs?: number
        nui?: number 
    }; // Local schema
    apid?: bigint // Application id
    apaa?: Uint8Array[] // Application arguments
    apat?: Uint8Array[] // Accounts
    apfa?: number[] // Foreign assets
    apas?: number[] // Foreign apps
    apbx?: { 
        i: number 
        n: string 
    }[] // Boxes
    apan?: number // #onComplete
    apep?: number // Extra program
    note?: Uint8Array // Note
    lx?: Uint8Array // Lease
    rekey?: Uint8Array // Rekey
    grp?: Uint8Array // Group
    
    // encode the transaction
    encode(): Uint8Array {
        // const encoded: Uint8Array = new AlgorandEncoder().encodeTransaction(this)
		return new Uint8Array()
    }
}

export interface IApplicationNoOpTxBuilder {
    addSender(sender: string): IApplicationNoOpTxBuilder;
    addFee(fee: bigint): IApplicationNoOpTxBuilder;
    addFirstValidRound(firstValid: bigint): IApplicationNoOpTxBuilder;
    addLastValidRound(lastValid: bigint): IApplicationNoOpTxBuilder;
    addApprovalProgram(apap: Uint8Array): IApplicationNoOpTxBuilder;
    addClearProgram(apsu: Uint8Array): IApplicationNoOpTxBuilder;
    addGlobalSchema(nbs: number, nui: number): IApplicationNoOpTxBuilder;
    addGlobalSchemaByteSlice(nbs: number): IApplicationNoOpTxBuilder;
    addGlobalSchemaUint(nui: number): IApplicationNoOpTxBuilder;
    addLocalSchema(nbs: number, nui: number): IApplicationNoOpTxBuilder;
    addLocalSchemaByteSlice(nbs: number): IApplicationNoOpTxBuilder;
    addLocalSchemaUint(nui: number): IApplicationNoOpTxBuilder;
    addApplicationId(appId: bigint): IApplicationNoOpTxBuilder;
    addApplicationArgs(args: Uint8Array[]): IApplicationNoOpTxBuilder;
    addAccounts(accounts: string[]): IApplicationNoOpTxBuilder;
    addForeignAssets(assets: number[]): IApplicationNoOpTxBuilder;
    addForeignApps(apps: number[]): IApplicationNoOpTxBuilder;
    addBoxes(boxes: { i: number; n: string }[]): IApplicationNoOpTxBuilder;
    addOnCompleteOption(version: number): IApplicationNoOpTxBuilder;
    addExtraProgram(extraProgram: number): IApplicationNoOpTxBuilder;
    addLease(lease: Uint8Array): IApplicationNoOpTxBuilder;
    addRekey(rekey: Uint8Array): IApplicationNoOpTxBuilder;
    addGroup(group: Uint8Array): IApplicationNoOpTxBuilder; 
    addNote(note: Uint8Array): IApplicationNoOpTxBuilder;

    get(): ApplicationCall;
}

export class ApplicationTxBuilder implements IApplicationNoOpTxBuilder {
    private tx: ApplicationCall;

    constructor(genesisId: string, genesisHash: string) {
        this.tx = new ApplicationCall();
        this.tx.gh = new Uint8Array(Buffer.from(genesisHash, "base64"));
        this.tx.gen = genesisId;
        this.tx.type = "appl";
        // this.tx.grp = new Uint8Array();
        // this.tx.fee = BigInt(1000);
    }

    addSender(sender: string): IApplicationNoOpTxBuilder {
        this.tx.snd = new AlgorandEncoder().decodeAddress(sender);
        return this;
    }

    addFee(fee: bigint): IApplicationNoOpTxBuilder {
        this.tx.fee = fee;
        return this;
    }

    addFirstValidRound(firstValid: bigint): IApplicationNoOpTxBuilder {
        this.tx.fv = firstValid;
        return this;
    }

    addLastValidRound(lastValid: bigint): IApplicationNoOpTxBuilder {
        this.tx.lv = lastValid;
        return this;
    }

    addApprovalProgram(apap: Uint8Array): IApplicationNoOpTxBuilder {
        this.tx.apap = apap;
        return this;
    }

    addClearProgram(apsu: Uint8Array): IApplicationNoOpTxBuilder {
        this.tx.apsu = apsu;
        return this;
    }

    addGlobalSchema(nbs: number, nui: number): IApplicationNoOpTxBuilder {
        this.tx.apgs = { nbs, nui };
        return this;
    }

    addGlobalSchemaByteSlice(nbs: number): IApplicationNoOpTxBuilder {
        // Initialize apgs if it doesn't exist
        if (!this.tx.apgs) {
            this.tx.apgs = {};
        }
        // Only set if value is not 0
        if (nbs !== 0) {
            this.tx.apgs.nbs = nbs;
        }
        return this;
    }

    addGlobalSchemaUint(nui: number): IApplicationNoOpTxBuilder {
        // Initialize apgs if it doesn't exist
        if (!this.tx.apgs) {
            this.tx.apgs = {};
        }
        // Only set if value is not 0
        if (nui !== 0) {
            this.tx.apgs.nui = nui;
        }
        return this;
    }

    addLocalSchema(nbs: number, nui: number): IApplicationNoOpTxBuilder {
        this.tx.apls = { nbs, nui };
        return this;
    }

    addLocalSchemaByteSlice(nbs: number): IApplicationNoOpTxBuilder {
        // Initialize apls if it doesn't exist
        if (!this.tx.apls) {
            this.tx.apls = {};
        }
        // Only set if value is not 0
        if (nbs !== 0) {
            this.tx.apls.nbs = nbs;
        }
        return this;
    }

    addLocalSchemaUint(nui: number): IApplicationNoOpTxBuilder {
        // Initialize apls if it doesn't exist
        if (!this.tx.apls) {
            this.tx.apls = {};
        }
        // Only set if value is not 0
        if (nui !== 0) {
            this.tx.apls.nui = nui;
        }
        return this;
    }   

    addApplicationId(appId: bigint): IApplicationNoOpTxBuilder {
        this.tx.apid = appId;
        return this;
    }

    addApplicationArgs(args: Uint8Array[]): IApplicationNoOpTxBuilder {
        this.tx.apaa = args;
        return this;
    }

    addAccounts(accounts: string[]): IApplicationNoOpTxBuilder {
        this.tx.apat = accounts.map(account => new AlgorandEncoder().decodeAddress(account));
        return this;
    }

    addForeignAssets(assets: number[]): IApplicationNoOpTxBuilder {
        this.tx.apas = assets;
        return this;
    }

    addForeignApps(apps: number[]): IApplicationNoOpTxBuilder {
        this.tx.apfa = apps;
        return this;
    }

    addBoxes(boxes: { i: number; n: string }[]): IApplicationNoOpTxBuilder {
        this.tx.apbx = boxes;
        return this;
    }

    addOnCompleteOption(version: number): IApplicationNoOpTxBuilder {
        this.tx.apan = version;
        return this;
    }

    addExtraProgram(extraProgram: number): IApplicationNoOpTxBuilder {
        this.tx.apep = extraProgram;
        return this;
    }

    addLease(lease: Uint8Array): IApplicationNoOpTxBuilder {
        this.tx.lx = lease;
        return this;
    }
    addRekey(rekey: Uint8Array): IApplicationNoOpTxBuilder {
        this.tx.rekey = rekey;
        return this;
    }
    addGroup(group: Uint8Array): IApplicationNoOpTxBuilder{
        this.tx.grp = group;
        return this;
    } 
    addNote(note : Uint8Array): IApplicationNoOpTxBuilder{
        this.tx.note = note;
        return this;
    }

    get(): ApplicationCall {
        return this.tx;
    }
}
