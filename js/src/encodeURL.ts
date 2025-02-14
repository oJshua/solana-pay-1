import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';

export interface EncodeURLParams {
    amount?: BigNumber;
    token?: PublicKey;
    reference?: PublicKey | PublicKey[];
    label?: string;
    message?: string;
    memo?: string;
}

export interface EncodeURLComponents extends EncodeURLParams {
    recipient: PublicKey;
}

export function encodeURL({ recipient, ...params }: EncodeURLComponents): string {
    let url = `solana:` + encodeURIComponent(recipient.toBase58());

    const encodedParams = encodeURLParams(params);
    if (encodedParams) {
        url += '?' + encodedParams;
    }

    return url;
}

export function encodeURLParams({ amount, token, reference, label, message, memo }: EncodeURLParams): string {
    const params: [string, string][] = [];

    if (amount) {
        params.push(['amount', String(amount)]);
    }

    if (token) {
        params.push(['spl-token', token.toBase58()]);
    }

    if (reference) {
        if (!Array.isArray(reference)) {
            reference = [reference];
        }

        for (const pubkey of reference) {
            params.push(['reference', pubkey.toBase58()]);
        }
    }

    if (label) {
        params.push(['label', label]);
    }

    if (message) {
        params.push(['message', message]);
    }

    if (memo) {
        params.push(['memo', memo]);
    }

    return params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
}
