import { WRAPPED_SOL_MINT } from '@oyster/common';
import { PublicKey } from '@solana/web3.js';

export * from './labels';
export * from './style';


export const QUOTE_MINT = WRAPPED_SOL_MINT;

export const set_QUOTE_MINT = function(new_qm: PublicKey){
    QUOTE_MINT = new_qm;
}


export let QUOTE_MINT_NAME = "WSOL";

export const set_QUOTE_MINT_NAME = function(new_qmn: string){
    QUOTE_MINT_NAME = new_qmn;
    
}
