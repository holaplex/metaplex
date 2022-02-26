import { LoadingOutlined } from '@ant-design/icons';
import { useMeta, useStore } from '@oyster/common';
import { Spin } from 'antd';
import React, { FC } from 'react';
import cx from 'classnames';
import { PublicKey } from '@solana/web3.js';
import { QUOTE_MINT, set_QUOTE_MINT, QUOTE_MINT_NAME, set_QUOTE_MINT_NAME } from '../../constants';
export const LoaderProvider: FC = ({ children }) => {
  const { isLoading } = useMeta();
  const { storefront, loadingStore } = useStore();
  set_QUOTE_MINT(new PublicKey(storefront.meta.mint));
  set_QUOTE_MINT_NAME(storefront.meta.mintname);
  
  const loading = isLoading || loadingStore;
  return (
    <>
      <div id="metaplex-loading" className={cx({ "loading": loading })}>
        <img id="metaplex-loading-icon" src={storefront.theme.logo} />
        <div id="metaplex-loading-text">loading</div>
        <Spinner />
      </div>
      {!loading && children}
    </>
  );
};

export const Spinner = () => {
  return <Spin indicator={<LoadingOutlined />} />;
};
 