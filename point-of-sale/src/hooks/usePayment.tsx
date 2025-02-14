import {
    createTransaction,
    encodeURL,
    findTransactionSignature,
    FindTransactionSignatureError,
    parseURL,
    validateTransactionSignature,
} from '@solana/pay';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ConfirmedSignatureInfo, Keypair, PublicKey, TransactionSignature } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import React, { createContext, FC, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConfig } from './useConfig';

export enum PaymentStatus {
    New = 'New',
    Waiting = 'Waiting',
    Confirmed = 'Confirmed',
    Valid = 'Valid',
    Invalid = 'Invalid',
    Finalized = 'Finalized',
}

export interface PaymentContextState {
    amount: BigNumber | undefined;
    setAmount(amount: BigNumber | undefined): void;
    message: string | undefined;
    setMessage(message: string | undefined): void;
    memo: string | undefined;
    setMemo(memo: string | undefined): void;
    reference: PublicKey | undefined;
    signature: TransactionSignature | undefined;
    status: PaymentStatus;
    confirmations: number;
    url: string;
    reset(): void;
    generate(): void;
}

export const PaymentContext = createContext<PaymentContextState>({} as PaymentContextState);

export function usePayment(): PaymentContextState {
    return useContext(PaymentContext);
}

export interface PaymentProviderProps {
    children: ReactNode;
}

export const PaymentProvider: FC<PaymentProviderProps> = ({ children }) => {
    const { connection } = useConnection();
    const { recipient, token, label } = useConfig();
    const { publicKey, sendTransaction } = useWallet();

    const [amount, setAmount] = useState<BigNumber>();
    const [message, setMessage] = useState<string>();
    const [memo, setMemo] = useState<string>();
    const [reference, setReference] = useState<PublicKey>();
    const [signature, setSignature] = useState<TransactionSignature>();
    const [status, setStatus] = useState(PaymentStatus.New);
    const [confirmations, setConfirmations] = useState(0);

    const url = useMemo(
        () =>
            encodeURL({
                recipient,
                amount,
                token,
                reference,
                label,
                message,
                memo,
            }),
        [recipient, amount, token, reference, label, message, memo]
    );

    const reset = useCallback(() => {
        setAmount(undefined);
        setMessage(undefined);
        setMemo(undefined);
        setReference(undefined);
        setSignature(undefined);
        setStatus(PaymentStatus.New);
        setConfirmations(0);
    }, []);

    const generate = useCallback(() => {
        if (status === PaymentStatus.New && !reference) {
            setReference(Keypair.generate().publicKey);
            setStatus(PaymentStatus.Waiting);
        }
    }, [status, reference]);

    // TODO: remove this
    // Use the connected wallet to sign and send the transaction for now
    useEffect(() => {
        if (status === PaymentStatus.Waiting && publicKey) {
            let changed = false;

            const run = async () => {
                try {
                    const { recipient, amount, token, reference, memo } = parseURL(url);
                    if (!amount) return;

                    const transaction = await createTransaction(connection, publicKey, recipient, amount, {
                        token,
                        reference,
                        memo,
                    });

                    if (!changed) {
                        await sendTransaction(transaction, connection);

                        clearTimeout(timeout);
                    }
                } catch (error) {
                    console.error(error);
                    setTimeout(run, 3000);
                }
            };
            const timeout = setTimeout(run, 3000);

            return () => {
                changed = true;
                clearTimeout(timeout);
            };
        }
    }, [status, publicKey, url, connection, sendTransaction]);

    // When the status is waiting, poll for the transaction using the reference key
    useEffect(() => {
        if (!(status === PaymentStatus.Waiting && reference && !signature)) return;
        let changed = false;

        const interval = setInterval(async () => {
            let signature: ConfirmedSignatureInfo;
            try {
                signature = await findTransactionSignature(connection, reference, undefined, 'confirmed');

                if (!changed) {
                    clearInterval(interval);
                    setSignature(signature.signature);
                    setStatus(PaymentStatus.Confirmed);
                }
            } catch (error: any) {
                if (!(error instanceof FindTransactionSignatureError)) {
                    console.error(error);
                }
            }
        }, 250);

        return () => {
            changed = true;
            clearInterval(interval);
        };
    }, [status, reference, signature, connection]);

    // When the status is confirmed, validate the transaction
    useEffect(() => {
        if (!(status === PaymentStatus.Confirmed && signature && amount)) return;
        let changed = false;

        (async () => {
            try {
                await validateTransactionSignature(
                    connection,
                    signature,
                    recipient,
                    amount,
                    token,
                    reference,
                    'confirmed'
                );

                if (!changed) {
                    setStatus(PaymentStatus.Valid);
                }
            } catch (error: any) {
                console.log(error);
                setStatus(PaymentStatus.Invalid);
            }
        })();

        return () => {
            changed = true;
        };
    }, [status, signature, amount, connection, recipient, token, reference]);

    // When the status is valid, wait for the transaction to finalize
    useEffect(() => {
        if (!(status === PaymentStatus.Valid && signature)) return;
        let changed = false;

        const interval = setInterval(async () => {
            try {
                const response = await connection.getSignatureStatus(signature);
                const status = response.value;
                if (!status) return;
                if (status.err) throw status.err;

                if (!changed) {
                    setConfirmations(status.confirmations || 0);

                    if (status.confirmationStatus === 'finalized') {
                        clearInterval(interval);
                        setStatus(PaymentStatus.Finalized);
                    }
                }
            } catch (error: any) {
                console.log(error);
            }
        }, 250);

        return () => {
            changed = true;
            clearInterval(interval);
        };
    }, [status, signature, connection]);

    return (
        <PaymentContext.Provider
            value={{
                amount,
                setAmount,
                message,
                setMessage,
                memo,
                setMemo,
                reference,
                signature,
                status,
                confirmations,
                url,
                reset,
                generate,
            }}
        >
            {children}
        </PaymentContext.Provider>
    );
};
