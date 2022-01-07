import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { NextPageContext } from 'next';
import Head from 'next/head';
import { Storefront, useMeta, useStore } from '@oyster/common';
import { getStorefront } from './../actions/getStorefront';
import Bugsnag from '@bugsnag/js';
import BugsnagPluginReact from '@bugsnag/plugin-react';
import { applyTheme } from '../actions/applyTheme';
import { AppProps } from './_app';
import App from '../App';
import { useRouter } from 'next/router';

const CreateReactAppEntryPoint = dynamic(() => import('../App'), {
  ssr: false,
});

if (process.env.NEXT_PUBLIC_BUGSNAG_API_KEY) {
  Bugsnag.start({
    apiKey: process.env.NEXT_PUBLIC_BUGSNAG_API_KEY || '',
    plugins: [new BugsnagPluginReact()],
  });
}

// export const HomeViewNextJs = () => {
//   console.log('enter home view');
//   const { isLoading, store } = useMeta();
//   // const navigate = useNavigate();
//   // const location = useLocation();
//   const router = useRouter();

//   const { isConfigured } = useStore();

//   useEffect(() => {
//     if (isLoading) {
//       return;
//     }
//     // const [_, auction] = window.location.hash //  split(location.hash, `#/auction/`);

//     if (!store || !isConfigured) {
//       // navigate("/setup");
//       router.push('/setup');
//       return;
//     }

//     // if (auction) {
//     //   navigate(`/listings/${auction}`);
//     // } else {
//     //   navigate('/listings?view=live');
//     // }
//     router.push('/listings?view=live');
//   }, [isLoading, store, isConfigured]);

//   return <></>;
// };

// const storefrontDenyList = ['solboogle'];

// export async function getServerSideProps(context: NextPageContext) {
//   const headers = context?.req?.headers || {};
//   const forwarded = headers.forwarded
//     ?.split(';')
//     .reduce((acc: Record<string, string>, entry) => {
//       const [key, value] = entry.split('=');
//       acc[key] = value;

//       return acc;
//     }, {});
//   const host = (forwarded?.host || headers.host) ?? '';
//   let subdomain = host.split(':')[0].split('.')[0];

//   if (process.env.SUBDOMAIN && !process.env.STRICT_SUBDOMAIN) {
//     subdomain = process.env.SUBDOMAIN;
//   }

//   const storefront = await getStorefront(subdomain);

//   if (storefront && !storefrontDenyList.includes(subdomain)) {
//     return { props: { storefront } };
//   }

//   return {
//     notFound: true,
//   };
// }

function AppWrapper({ storefront, isMounted, ...props }: AppProps) {
  // const [isMounted, setIsMounted] = useState(false);
  // const [hasLogo, setHasLogo] = useState(false);
  // const [hasStylesheet, setHasStylesheet] = useState(false);

  // useEffect(() => {
  //   if (hasLogo && hasStylesheet) {
  //     setIsMounted(true);
  //   }
  // }, [hasLogo, hasStylesheet]);

  //  useEffect(() => {
  //    const doc = document.documentElement;

  //    const cleanup = applyTheme(storefront.theme, doc.style, document.head);
  //    setHasStylesheet(true);

  //    return cleanup;
  //  }, [storefront.theme]);
  console.log('index page render props', {
    props,
    isMounted,
  });

  useEffect(() => {
    console.log('index page effect props', {
      props,
      isMounted,
    });
    //  const onHasLogo = () => {
    //    setHasLogo(true);
    //  };

    //  if (!storefront.theme.logo) {
    //    onHasLogo();
    //    return;
    //  }

    //  const logo = new Image();
    //  logo.src = storefront.theme.logo;

    //  logo.onload = onHasLogo;
    //  logo.onerror = onHasLogo;
  }, []);
  const appBody = (
    <>
      <Head>
        {storefront.meta.favicon && (
          <>
            <link rel="icon" type="image/png" href={storefront.meta.favicon} />
          </>
        )}
        <title>{storefront.meta.title}</title>
        <meta
          name="description"
          content={storefront.meta.description}
          key="description"
        />
        <meta
          property="og:title"
          content={storefront.meta.title}
          key="og:title"
        />
        <meta
          property="og:description"
          content={storefront.meta.description}
          key="og:description"
        />
        <meta
          property="og:image"
          content={storefront.theme.logo}
          key="og:image"
        />
        <meta property="og:type" content="website" key="og:type" />
      </Head>
      {isMounted && <CreateReactAppEntryPoint storefront={storefront} />}
      {/* {isMounted && <HomeViewNextJs />} */}
    </>
  );
  // {isMounted && <App storefront={storefront} />}
  // {isMounted &&  <CreateReactAppEntryPoint storefront={storefront} /> }

  // if (process.env.NEXT_PUBLIC_BUGSNAG_API_KEY) {
  //   //@ts-ignore
  //   const ErrorBoundary = Bugsnag.getPlugin('react').createErrorBoundary(React);
  //   return <ErrorBoundary>{appBody}</ErrorBoundary>;
  // }

  return <>{appBody}</>;
}

export default AppWrapper;
