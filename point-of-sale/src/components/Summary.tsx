import React, { FC } from 'react';
import { useMediaQuery } from 'react-responsive';
import { Amount } from './Amount';
import { useConfig } from '../hooks/useConfig';
import * as styles from './Summary.module.css';

export const Summary: FC = () => {
    const { symbol } = useConfig();
    const phone = useMediaQuery({ query: '(max-width: 767px)' });

    return phone ? null : (
        <div className={styles.root}>
            <div className={styles.title}>Balance Due</div>
            <div className={styles.total}>
                <div className={styles.totalLeft}>Total</div>
                <div className={styles.totalRight}>
                    <div className={styles.symbol}>{symbol}</div>
                    <div className={styles.amount}>
                        <Amount />
                    </div>
                </div>
            </div>
        </div>
    );
};
