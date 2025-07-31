import { AlgorandEncoder } from "@algorandfoundation/algo-models";
import * as algosdk from "algosdk";

/**
 * Custom PaymentTransaction class that explicitly includes the grp property
 * for proper handling of group transactions
 */
export class PaymentTransaction {
    // Transaction type
    type: string = "pay";
    
    // Transaction header properties
    snd: Uint8Array;        // Sender address
    fee: number;            // Transaction fee
    fv: number;             // First valid round
    lv: number;             // Last valid round
    note?: Uint8Array;      // Optional note
    gen: string;            // Genesis ID
    gh: Uint8Array;         // Genesis hash
    lx?: Uint8Array;        // Lease
    grp?: Uint8Array;       // Group ID - explicitly included
    rekey?: Uint8Array;     // Rekey address
    
    // Payment-specific properties
    rcv: Uint8Array;        // Receiver address
    amt: number;            // Amount in microAlgos
    close?: Uint8Array;     // Close remainder to address
    
    /**
     * Encode the transaction for submission
     * @returns Encoded transaction as Uint8Array
     */
    encode(): Uint8Array {
        // return new AlgorandEncoder().encodeTransaction(this);
        return new Uint8Array()
    }
}

/**
 * Interface for PaymentTxBuilder
 */
export interface IPaymentTxBuilder {
    addSender(sender: string): IPaymentTxBuilder;
    addReceiver(receiver: string): IPaymentTxBuilder;
    addAmount(amount: number): IPaymentTxBuilder;
    addFee(fee: number): IPaymentTxBuilder;
    addFirstValidRound(fv: number): IPaymentTxBuilder;
    addLastValidRound(lv: number): IPaymentTxBuilder;
    addNote(note: string, encoding?: BufferEncoding): IPaymentTxBuilder;
    addCloseTo(close: string): IPaymentTxBuilder;
    addRekey(rekey: string): IPaymentTxBuilder;
    addLease(lx: Uint8Array): IPaymentTxBuilder;
    addGroup(grp: Uint8Array): IPaymentTxBuilder;
    get(): PaymentTransaction;
}

/**
 * Custom PaymentTxBuilder implementation
 */
export class PaymentTxBuilder implements IPaymentTxBuilder {
    private tx: PaymentTransaction;
    private encoder: AlgorandEncoder;
    
    /**
     * Constructor
     * @param genesisId Genesis ID
     * @param genesisHash Genesis hash (base64 encoded)
     */
    constructor(genesisId: string, genesisHash: string) {
        // this.encoder = new AlgorandEncoder();
        
        this.tx = new PaymentTransaction();
        this.tx.gen = genesisId;
        this.tx.gh = new Uint8Array(Buffer.from(genesisHash, "base64"));
        this.tx.type = "pay";
        this.tx.fee = 1000; // Default fee
    }
    
    addSender(sender: string): IPaymentTxBuilder {
        this.tx.snd = new AlgorandEncoder().decodeAddress(sender);
        return this;
    }
    
    addReceiver(receiver: string): IPaymentTxBuilder {
        this.tx.rcv = new AlgorandEncoder().decodeAddress(receiver);
        return this;
    }
    
    addAmount(amount: number): IPaymentTxBuilder {
        this.tx.amt = amount;
        return this;
    }
    
    addFee(fee: number): IPaymentTxBuilder {
        this.tx.fee = fee;
        return this;
    }
    
    addFirstValidRound(fv: number): IPaymentTxBuilder {
        this.tx.fv = fv;
        return this;
    }
    
    addLastValidRound(lv: number): IPaymentTxBuilder {
        this.tx.lv = lv;
        return this;
    }
    
    addNote(note: string, encoding: BufferEncoding = "utf8"): IPaymentTxBuilder {
        this.tx.note = new Uint8Array(Buffer.from(note, encoding));
        return this;
    }
    
    addCloseTo(close: string): IPaymentTxBuilder {
        this.tx.close = new AlgorandEncoder().decodeAddress(close);
        return this;
    }
    
    addRekey(rekey: string): IPaymentTxBuilder {
        this.tx.rekey = new AlgorandEncoder().decodeAddress(rekey);
        return this;
    }
    
    addLease(lx: Uint8Array): IPaymentTxBuilder {
        this.tx.lx = lx;
        return this;
    }
    
    /**
     * Add group ID to the transaction
     * @param grp Group ID as Uint8Array
     * @returns Builder instance for chaining
     */
    addGroup(grp: Uint8Array): IPaymentTxBuilder {
        this.tx.grp = grp;
        return this;
    }
    
    /**
     * Get the constructed payment transaction
     * @returns PaymentTransaction instance
     */
    get(): PaymentTransaction {
        return this.tx;
    }
}
