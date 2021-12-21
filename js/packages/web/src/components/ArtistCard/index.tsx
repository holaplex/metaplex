import React from 'react';
import { Card } from 'antd';

import { Artist } from '../../types';

import { shortenAddress } from '@oyster/common';
import { MetaAvatar } from '../MetaAvatar';

export const ArtistCard = ({
  artist,
}: /* active, */
{
  artist: Artist;
  active: boolean;
}) => {
  return (
    <Card
      hoverable
      cover={
        <div className="metaplex-artist-card-cover">
          {artist.background ? (
            <img
              className="metaplex-artist-card-background"
              src={artist.background}
            />
          ) : null}
        </div>
      }
      bordered={false}
    >
      <div className="content-wrapper">
        <MetaAvatar creators={[artist]} size={64} />
        {artist.name || shortenAddress(artist.address || '')}
      </div>
      {artist.about ||
        (true && (
          <div className="about">Testing artist about{artist.about}</div>
        ))}
    </Card>
  );
};
