import { formatUSD } from '@oyster/common';
import { Space, Statistic } from 'antd';
import React, { useEffect, useState } from 'react';
import { useSolPrice } from '../../contexts';
import { SolCircle } from '../Custom';

interface IAmountLabel {
  amount: number;
  displayUSD?: boolean;
  displaySOL?: boolean;
  title?: string;
  customPrefix?: JSX.Element;
}

export const AmountLabel = (props: IAmountLabel) => {
  const {
    amount,
    displayUSD = true,
    displaySOL = false,
    title = '',
    customPrefix,
  } = props;

  const solPrice = useSolPrice();

  const [priceUSD, setPriceUSD] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (solPrice !== undefined) setPriceUSD(solPrice * amount);
  }, [amount, solPrice]);

  const PriceNaN = isNaN(amount);

  return (
    <>
      <Space direction="horizontal" align="baseline">
        {PriceNaN === false && (
          <Statistic
            value={`${amount.toLocaleString()}${displaySOL ? ' SOL' : ''}`}
            prefix={customPrefix || <SolCircle />}
          />
        )}
        {displayUSD && <span style={{ opacity: '0.5' }}>|</span>}
        {displayUSD && (
          <div>
            {PriceNaN === false ? formatUSD.format(priceUSD || 0) : 'Place Bid'}
          </div>
        )}
      </Space>
      <p className="auction-status">{title}</p>
    </>
  );
};
