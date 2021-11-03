import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { NextPageContext } from 'next';
import Head from 'next/head';
import { Storefront } from '@oyster/common';
import { getStorefront } from './../actions/getStorefront';
import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import { applyTheme } from '../actions/applyTheme';

const CreateReactAppEntryPoint = dynamic(() => import('../App'), {
  ssr: false,
});

interface AppProps {
  storefront: Storefront;
}

if (process.env.NEXT_PUBLIC_BUGSNAG_API_KEY) {
  Bugsnag.start({
    apiKey: process.env.BUGSNAG_API_KEY || '',
    plugins: [new BugsnagPluginReact()],
  });
}

export async function getServerSideProps(context: NextPageContext) {
  const headers = context?.req?.headers || {};
  const forwarded = headers.forwarded
    ?.split(';')
    .reduce((acc: Record<string, string>, entry) => {
      const [key, value] = entry.split('=');
      acc[key] = value;

      return acc;
    }, {});
  const host = (forwarded?.host || headers.host) ?? '';
  let subdomain = host.split(':')[0].split('.')[0];

  if (process.env.SUBDOMAIN && !process.env.STRICT_SUBDOMAIN) {
    subdomain = process.env.SUBDOMAIN;
  }

  const storefront = await getStorefront(subdomain);

  if (storefront) {
    return { props: { storefront } };
  }

  return {
    notFound: true,
  };
}

function App({ storefront }: AppProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [hasLogo, setHasLogo] = useState(false);
  const [hasStylesheet, setHasStylesheet] = useState(false);

  useEffect(() => {
    if (hasLogo && hasStylesheet) {
      setIsMounted(true);
    }
  }, [hasLogo, hasStylesheet]);

  useEffect(() => {
    const doc = document.documentElement;

    applyTheme(storefront.theme, doc.style);
    setHasStylesheet(true);
  }, []);

  useEffect(() => {
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
  const appBody = (
    <>
      <Head>
        {storefront.meta.favicon && (
          <>
            <link rel="icon" type="image/png" href={storefront.meta.favicon} />
          </>
        )}
        <meta name="description" content={storefront.meta.description} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={storefront.theme.logo} />
        <meta property="og:title" content={storefront.meta.title} />
        <meta property="og:description" content={storefront.meta.description} />
        <title>{storefront.meta.title}</title>
      </Head>
      {isMounted && <CreateReactAppEntryPoint storefront={storefront} />}
    </>
  );

  if (process.env.NEXT_PUBLIC_BUGSNAG_API_KEY) {
    //@ts-ignore
    const ErrorBoundary = Bugsnag.getPlugin('react').createErrorBoundary(React);
    return <ErrorBoundary>{appBody}</ErrorBoundary>;
  }

  return <>{appBody}</>;
}

export default App;
