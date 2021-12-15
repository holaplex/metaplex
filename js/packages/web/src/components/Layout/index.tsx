import { Storefront } from '@oyster/common';
import { Layout, notification } from 'antd';
import React, { ReactNode, useEffect } from 'react';
import { AppBar } from '../AppBar';

const { Content } = Layout;

export const AppLayout = React.memo(function AppLayout(props: {
  children?: ReactNode;
  storefront?: Storefront;
}) {
  useEffect(() => {
    notification.config({
      placement: 'bottomLeft',
      duration: 15,
      maxCount: 3,
    });
  }, []);

  return (
    <>
      <Layout>
        <div className="header">
          <AppBar logo={props.storefront?.theme?.logo || ''} />
        </div>
        <Content id="metaplex-layout-content">{props.children}</Content>
      </Layout>
    </>
  );
});
