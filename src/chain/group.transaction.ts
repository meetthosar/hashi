import { AlgorandEncoder } from "@algorandfoundation/algo-models";
import * as algosdk from "algosdk";
import { Encoder } from "./encoder.role";
import nacl from "tweetnacl";
import { msgpackRawEncode } from "algosdk";
import { concatArrays } from "../utils/utils";
import sha512 from 'js-sha512';

const ALGORAND_MAX_TX_GROUP_SIZE = 16;
const TX_GROUP_TAG = new TextEncoder().encode('TG');
const TX_TAG = new TextEncoder().encode('TX');
const ALGORAND_TRANSACTION_LENGTH = 32;

export class GroupTransaction {
    transactions: any[];
    groupId: Uint8Array;
    snd: Uint8Array;
    fee: bigint;
    fv: bigint;
    lv: bigint;
    gen: string;
    gh: Uint8Array;

    constructor() {
        this.transactions = [];
    }

    // Add a transaction to the group
    addTransaction(transaction: any): void {
        this.transactions.push(transaction);
    }

    rawTxID(txn: any): Uint8Array {
        
        const enMsg = txn.get().encode();
        // const gh = concatArrays(TX_TAG, enMsg);
        
        return Uint8Array.from(sha512.sha512_256.array(enMsg));
      }     

    txGroupPreimage(txnHashes: Uint8Array[]): Uint8Array {
        if (txnHashes.length > ALGORAND_MAX_TX_GROUP_SIZE) {
          throw new Error(
            `${txnHashes.length} transactions grouped together but max group size is ${ALGORAND_MAX_TX_GROUP_SIZE}`
          );
        }
        if (txnHashes.length === 0) {
          throw new Error('Cannot compute group ID of zero transactions');
        }
        const bytes = algosdk.msgpackRawEncode({
          txlist: txnHashes,
        });
        return bytes;// concatArrays(TX_GROUP_TAG, bytes);
      }

    computeGroupID(txns: any[]): Uint8Array {
       return new AlgorandEncoder().computeGroupId(txns);
      }

    assignGroupID(txns: any[]) {
        const gid = this.computeGroupID(txns);
        for (const txn of txns) {
          // Use the correct property name 'grp' instead of 'group'
          txn.grp = gid;
        }
        return txns;
      }

    // Encode all transactions
    encodeAll(): Uint8Array[] {
        try {
            // Make sure we have a group ID
            if (!this.groupId && this.transactions.length > 0) {
                // Compute the group ID if not already set
                this.groupId = this.computeGroupID(this.transactions);
                
                // Assign the group ID to all transactions
                for (let i = 0; i < this.transactions.length; i++) {
                    // For transactions that have an addGroup method (like from algo-models)
                    // if (typeof this.transactions[i].addGroup === 'function') {
                    
                    console.log(`Using addGroup method for transaction ${i+1}`);
                    this.transactions[i].addGroup(this.groupId);
                    
                }
            }
            
            if (this.groupId) {
                console.log(`Encoding ${this.transactions.length} transactions with group ID: ${Buffer.from(this.groupId).toString('base64')}`);
            } else {
                console.log(`Encoding ${this.transactions.length} transactions without group ID`);
            }

            console.log(this.transactions[0].get(), this.transactions[1].get());
            
            
            const encodedTxns = [];
            
            for (let i = 0; i < this.transactions.length; i++) {
                const tx = this.transactions[i];
                try {
                    
                    if (typeof tx.get().encode === 'function') {
                        try {                             
                            const encoded = tx.get().encode();
                            encodedTxns.push(encoded);
                        } catch (encodeSpecificError) {
                            console.error(`Error in encode() method for transaction ${i+1}:`, encodeSpecificError);
                            throw encodeSpecificError;
                        }
                    } else {
                        console.error(`Transaction ${i+1} does not have encode method. Properties:`, Object.keys(tx));
                        throw new Error(`Transaction ${i+1} does not have an encode method`);
                    }
                } catch (encodeError) {
                    console.error(`Error encoding transaction ${i+1}:`, encodeError);
                    
                    // Try to continue with the remaining transactions instead of failing completely
                    if (i === this.transactions.length - 1) {
                        // If this is the last transaction and we have at least one encoded transaction,
                        // we can return what we have
                        if (encodedTxns.length > 0) {
                            console.warn(`Returning ${encodedTxns.length} encoded transactions despite errors`);
                            break;
                        } else {
                            throw new Error(`Failed to encode any transactions: ${encodeError.message}`);
                        }
                    }
                    
                    // Skip this transaction and continue with the next one
                    console.warn(`Skipping transaction ${i+1} due to encoding error`);
                    continue;
                }
            }
            
            return encodedTxns;
        } catch (error) {
            console.error('Error encoding transactions:', error);
            throw new Error(`Failed to encode transactions: ${error.message}`);
        }
    }


    // Get the transactions with group ID assigned
    getTransactions(): any[] {
        return this.transactions;
    }
}

export interface IGroupTransactionBuilder {
    addSender(sender: string): IGroupTransactionBuilder;
    addFee(fee: bigint): IGroupTransactionBuilder;
    addFirstValidRound(firstValid: bigint): IGroupTransactionBuilder;
    addLastValidRound(lastValid: bigint): IGroupTransactionBuilder;
    addTransactions(transactions: any[]): IGroupTransactionBuilder;
    get(): GroupTransaction;
}

export class GroupTransactionBuilder implements IGroupTransactionBuilder {
    private tx: GroupTransaction;

    constructor(genesisId: string, genesisHash: string) {
        this.tx = new GroupTransaction();
        this.tx.gh = new Uint8Array(Buffer.from(genesisHash, "base64"));
        this.tx.gen = genesisId;
        this.tx.fee = BigInt(1000);
    }

    addSender(sender: string): IGroupTransactionBuilder {
        this.tx.snd = new AlgorandEncoder().decodeAddress(sender);
        return this;
    }

    addFee(fee: bigint): IGroupTransactionBuilder {
        this.tx.fee = fee;
        return this;
    }

    addFirstValidRound(firstValid: bigint): IGroupTransactionBuilder {
        this.tx.fv = firstValid;
        return this;
    }

    addLastValidRound(lastValid: bigint): IGroupTransactionBuilder {
        this.tx.lv = lastValid;
        return this;
    }

    addTransactions(transactions: any[]): IGroupTransactionBuilder {
        // Clear existing transactions to avoid mixing different groups
        this.tx.transactions = [];
        
        // Add each transaction to the group
        for (const tx of transactions) {
            this.tx.addTransaction(tx);
        }
        
        return this;
    }

    get(): GroupTransaction {
        return this.tx;
    }
}
