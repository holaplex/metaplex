import { useStore } from '@oyster/common';
import { useWallet } from '@solana/wallet-adapter-react';
import React from 'react';
import Link from 'next/link';
// import { Link, useResolvedPath, useMatch } from 'react-router-dom';
import { useRouter } from 'next/router';
import cx from 'classnames';
import { SecondaryMenu } from '../SecondaryMenu';

export const AppBar = () => {
  const { connected, publicKey } = useWallet();
  const { ownerAddress, storefront } = useStore();
  const logo = storefront?.theme?.logo || '';
  const router = useRouter();

  const getMenuItem = (key: string, linkAppend?: string, title?: string) => {
    return {
      key,
      title: title || key[0].toUpperCase() + key.substring(1),
      link: `/${key + (linkAppend ? linkAppend : '')}`,
      group: `/${key}`,
    };
  };

  let menu = [
    getMenuItem('listings', '?views=live'),
    getMenuItem('creators', `/${ownerAddress}`),
  ];

  if (connected) {
    menu = [...menu, getMenuItem('owned')];
  }

  if (publicKey?.toBase58() === ownerAddress) {
    menu = [...menu, getMenuItem('admin')];
  }

  interface MenuItemProps {
    to: string;
    key: string;
    group?: string;
    title: string;
  }

  const MenuItem = ({ to, title, group }: MenuItemProps) => {
    // const resolved = useResolvedPath(group || to);
    const match = router.pathname.includes(group || to); // useMatch({ path: resolved.pathname, end: false });

    return (
      <Link href={to} passHref>
        <a
          className={cx('main-menu-item', {
            active: match,
          })}
        >
          {title}
        </a>
      </Link>
    );
  };

  return (
    <div className="app-bar-wrapper">
      <div className="app-bar-left-wrapper">
        <Link href="/" passHref>
          <a
            className={cx('app-bar-logo-wrapper', {
              hide: router.pathname.endsWith('listings'), // TODO: Double check this // useMatch('listings'),
            })}
          >
            <img src={logo || ''} className="app-bar-logo" />
          </a>
        </Link>
        <div className="main-menu-wrapper">
          {menu.map(({ key, title, link, group }) => (
            <MenuItem to={link} key={key} group={group} title={title} />
          ))}
        </div>
      </div>
      <SecondaryMenu />
    </div>
  );
};
