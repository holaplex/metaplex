import App from 'next/app';
import type { AppContext, AppProps } from 'next/app';
import Head from 'next/head';
import React, { useEffect, useState } from 'react';
import '../styles/index.less';
import { getStorefront } from '../actions/getStorefront';
import { Storefront } from '@oyster/common';
import { applyTheme } from '../actions/applyTheme';
import dynamic from 'next/dynamic';

function SafeHydrate({ children }) {
  console.log('safe hydrate');
  return (
    <div suppressHydrationWarning>
      {typeof window === 'undefined' ? null : children}
    </div>
  );
}

function MyApp({ Component, pageProps }: AppProps) {
  console.log('_app entry');
  const [isMounted, setIsMounted] = useState(false);
  const [hasLogo, setHasLogo] = useState(false);
  const [hasStylesheet, setHasStylesheet] = useState(false);
  const storefront = pageProps.storefront;

  useEffect(() => {
    if (hasLogo && hasStylesheet) {
      setIsMounted(true);
    }
  }, [hasLogo, hasStylesheet]);

  useEffect(() => {
    const doc = document.documentElement;

    const cleanup = applyTheme(storefront.theme, doc.style, document.head);
    setHasStylesheet(true);

    return cleanup;
  }, [storefront.theme]);

  useEffect(() => {
    console.log('_app effect props', {
      pageProps,
      isMounted,
    });
    const onHasLogo = () => {
      setHasLogo(true);
    };

    if (!storefront.theme.logo) {
      onHasLogo();
      return;
    }

    const logo = new Image();
    logo.src = storefront.theme.logo;

    logo.onload = onHasLogo;
    logo.onerror = onHasLogo;
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div>
        <SafeHydrate>
          <ClientProviders storefront={storefront}>
            <Component {...pageProps} isMounted={isMounted} />
          </ClientProviders>
        </SafeHydrate>
      </div>
    </>
  );
}

// Only uncomment this method if you have blocking data requirements for
// every single page in your application. This disables the ability to
// perform automatic static optimization, causing every page in your app to
// be server-side rendered.
//
const storefrontDenyList = ['solboogle'];

export interface AppProps {
  storefront: Storefront;
}

const ClientProviders = dynamic(() => import('../providers'), {
  ssr: false,
});

MyApp.getInitialProps = async (appContext: AppContext) => {
  // calls page's `getInitialProps` and fills `appProps.pageProps`
  console.log('_app initial props');
  const context = appContext.ctx;
  const headers = context?.req?.headers || {};
  const query = context.query;
  const forwarded = headers.forwarded
    ?.split(';')
    .reduce((acc: Record<string, string>, entry) => {
      const [key, value] = entry.split('=');
      acc[key] = value;

      return acc;
    }, {});
  const host = (forwarded?.host || headers.host) ?? '';
  let subdomain = host.split(':')[0].split('.')[0];

  // console.log('App initial props', {
  //   subdomain,
  //   headers,
  //   query,
  // });
  if (process.env.SUBDOMAIN && !process.env.STRICT_SUBDOMAIN) {
    subdomain = process.env.SUBDOMAIN;
  }

  const storefront = await getStorefront(subdomain);

  const appProps = await App.getInitialProps(appContext);
  // console.log('found storefront in _app', {
  //   subdomain,
  //   storefront: storefront?.meta.title,
  //   appProps,
  // });
  // const componentProps = await appContext.Component.getInitialProps({  });
  if (storefront && !storefrontDenyList.includes(subdomain)) {
    return {
      ...appProps,
      pageProps: {
        ...appProps.pageProps,
        storefront,
        subdomain,
        path: context.pathname,
        query,
      },
    };
  } else {
    return {
      ...appProps,
      notFound: true,
    };
  }
};

export default MyApp;
