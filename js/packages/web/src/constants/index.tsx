import { WRAPPED_SOL_MINT } from '@oyster/common';
import { PublicKey } from '@solana/web3.js';

export * from './labels';
export * from './style';

let qm = WRAPPED_SOL_MINT;

try { 
    // @ts-ignore
    qm = new PublicKey(process.env.QUOTE_MINT)
}
catch (err){

}

export let QUOTE_MINT = qm;

export const set_QUOTE_MINT = function(lala: PublicKey){
    QUOTE_MINT = lala;
}
