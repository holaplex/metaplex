import { LoadingOutlined } from '@ant-design/icons';
import { loadMetadataForCreator, useConnection, useMeta } from '@oyster/common';
import { Col, Divider, Row, Spin } from 'antd';
import { Head } from 'next/document';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
// import { Link, useParams } from 'react-router-dom';
import Link from 'next/link';
import { ArtCard } from '../../components/ArtCard';
import { ArtistCard } from '../../components/ArtistCard';
import { MetaplexMasonry } from '../../components/MetaplexMasonry';
import { useCreatorArts } from '../../hooks';
import { Providers } from '../../providers';
import { AppProps } from '../_app';

export default function ArtistView({ storefront }: AppProps) {
  console.log('entering creator page', {
    storefront,
  });
  const router = useRouter();
  const creator = router.query.creator as string;
  // const { creator } = useParams<{ creator: string }>();
  const { whitelistedCreatorsByCreator, patchState } = useMeta();
  const [loadingArt, setLoadingArt] = useState(true);
  const artwork = useCreatorArts(creator);
  const connection = useConnection();
  const creators = Object.values(whitelistedCreatorsByCreator);

  useEffect(() => {
    console.log('entering creator page effect', {
      storefront,
    });
    if (!creator) {
      return;
    }

    (async () => {
      setLoadingArt(true);
      const active = whitelistedCreatorsByCreator[creator];

      const artistMetadataState = await loadMetadataForCreator(
        connection,
        active,
      );

      patchState(artistMetadataState);
      setLoadingArt(false);
    })();
  }, [connection, creator]);

  return (
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

      <Row>
        <Col span={24}>
          <h2>Creators Nextjs</h2>
          <MetaplexMasonry>
            {creators.map((m, idx) => {
              const current = m.info.address;
              return (
                <Link href={`/creators/${current}`} key={idx} passHref>
                  <a>
                    <ArtistCard
                      key={current}
                      active={current === creator}
                      artist={{
                        address: current,
                        name: m.info.name || '',
                        image: m.info.image || '',
                        link: m.info.twitter || '',
                      }}
                    />
                  </a>
                </Link>
              );
            })}
          </MetaplexMasonry>
        </Col>
        <Col span={24}>
          <Divider />
          {loadingArt ? (
            <div className="app-section--loading">
              <Spin indicator={<LoadingOutlined />} />
            </div>
          ) : (
            <MetaplexMasonry>
              {artwork.map((m, idx) => {
                const id = m.pubkey;
                return (
                  <Link
                    href={`/creators/${creator}/nfts/${id}`}
                    key={idx}
                    passHref
                  >
                    <a>
                      <ArtCard key={id} pubkey={m.pubkey} preview={false} />
                    </a>
                  </Link>
                );
              })}
            </MetaplexMasonry>
          )}
        </Col>
      </Row>
    </>
  );
}
