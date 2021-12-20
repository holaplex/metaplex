import {
  MAX_AUCTION_DATA_EXTENDED_SIZE,
  MAX_EXTERNAL_ACCOUNT_SIZE,
  MAX_VAULT_SIZE,
} from '@oyster/common';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Button, Col, Divider, Row, Space, Statistic } from 'antd';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import { AuctionCategory, AuctionState } from '.';
import { AmountLabel } from '../../components/AmountLabel';
import { ArtCard } from '../../components/ArtCard';

// TODO: Move to common
const BASE_SAFETY_CONFIG_SIZE =
  1 + // Key
  32 + // auction manager lookup
  8 + // order
  1 + // winning config type
  1 + // amount tuple type
  1 + // length tuple type
  4 + // u32 for amount range vec
  1 + // participation config option
  1 + // winning constraint
  1 + // non winning constraint
  9 + // fixed price + option of it
  1 + // participation state option
  8 + // collected to accept payment
  20; // padding

const calculateAuctionCreationCost = async (connection: Connection) => {
  const maxVaultSize =
    connection.getMinimumBalanceForRentExemption(MAX_VAULT_SIZE);
  const maxExternalAccountSize = connection.getMinimumBalanceForRentExemption(
    MAX_EXTERNAL_ACCOUNT_SIZE,
  );
  const auctionCosts = connection.getMinimumBalanceForRentExemption(
    MAX_AUCTION_DATA_EXTENDED_SIZE,
  );
  // SAFETY DEPOSIT BOX COSTS
  const safetyDepositBoxCosts = connection.getMinimumBalanceForRentExemption(
    BASE_SAFETY_CONFIG_SIZE,
  );
  // There are probably a few more costs to account for, but this is a good start
  const allValues = await Promise.all([
    maxVaultSize,
    maxExternalAccountSize,
    auctionCosts,
    safetyDepositBoxCosts,
  ]);
  return allValues.reduce((acc, curr) => acc + curr, 0);
};

export const ReviewStep = (props: {
  confirm: () => void;
  attributes: AuctionState;
  setAttributes: Function;
  connection: Connection;
}) => {
  const [cost, setCost] = useState(0);
  const item = props.attributes.items?.[0];

  useEffect(() => {
    if (!item) {
      return;
    }
    (async () => {
      const accountStorageCosts = await calculateAuctionCreationCost(
        props.connection,
      );
      // Ideally get filteredSigners, but from my testing they're usually 11 for this use case.
      const recentBlockhash = await props.connection.getRecentBlockhash();
      const signatureCost =
        recentBlockhash.feeCalculator.lamportsPerSignature *
        /* Sorry about the magic number, but got it from testing */ 11;
      setCost((accountStorageCosts + signatureCost) / LAMPORTS_PER_SOL);
    })();
  }, []);

  return (
    <Space className="metaplex-fullwidth" direction="vertical">
      <h2>Review and list</h2>
      <p>Review your listing before publishing.</p>
      <Row justify="space-around">
        <Col span={6}>
          {item?.metadata.info && (
            <ArtCard
              pubkey={item.metadata.pubkey}
              small={true}
              hoverable={false}
            />
          )}
        </Col>
        <Col span={8}>
          <Statistic
            title="Copies"
            value={
              props.attributes.editions === undefined
                ? 'Unique'
                : props.attributes.editions
            }
          />
          <Divider />
          <AmountLabel
            title={
              props.attributes.category === AuctionCategory.InstantSale
                ? 'Cost to Sell'
                : 'Cost to Create Auction'
            }
            amount={cost}
          />
        </Col>
      </Row>
      <div>
        <Divider />
        <Statistic
          title="Start date"
          value={
            props.attributes.startSaleTS
              ? moment
                  .unix(props.attributes.startSaleTS)
                  .format('dddd, MMMM Do YYYY, h:mm a')
              : 'Right after successfully published'
          }
        />
        <br />
        {props.attributes.startListTS && (
          <Statistic
            title="Listing go live date"
            value={moment
              .unix(props.attributes.startListTS)
              .format('dddd, MMMM Do YYYY, h:mm a')}
          />
        )}
        <Divider />
        <Statistic
          title="Sale ends"
          value={
            props.attributes.endTS
              ? moment
                  .unix(props.attributes.endTS)
                  .format('dddd, MMMM Do YYYY, h:mm a')
              : 'Until sold'
          }
        />
      </div>
      <Button
        className="metaplex-fullwidth"
        type="primary"
        size="large"
        onClick={() => {
          props.setAttributes({
            ...props.attributes,
            startListTS: props.attributes.startListTS || moment().unix(),
            startSaleTS: props.attributes.startSaleTS || moment().unix(),
          });
          props.confirm();
        }}
      >
        {props.attributes.category === AuctionCategory.InstantSale
          ? 'List for Sale'
          : 'Publish Auction'}
      </Button>
    </Space>
  );
};
