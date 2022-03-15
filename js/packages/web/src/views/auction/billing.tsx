import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Row, Col, Layout, Spin, Button, Table, Typography, Space } from 'antd';
import {
  useArt,
  useAuction,
  AuctionView,
  useBidsForAuction,
  useUserBalance,
} from '../../hooks';
import { ArtContent } from '../../components/ArtContent';
import {
  useConnection,
  BidderMetadata,
  ParsedAccount,
  cache,
  BidderPot,
  fromLamports,
  useMint,
  getBidderPotKey,
  programIds,
  Bid,
  useUserAccounts,
  StringPublicKey,
  toPublicKey,
  WalletSigner,
  loadPayoutTickets,
  getBidderKeys,
  getPayoutTicket,
  NonWinningConstraint,
  PayoutTicket,
  WinningConstraint,
  METAPLEX_ID,
  processMetaplexAccounts,
  subscribeProgramChanges,
  AuctionState,
  notify,
} from '@oyster/common';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMeta } from '../../contexts';
import { Connection, Keypair, TransactionInstruction } from '@solana/web3.js';
import {
  claimSpecificBid,
  emptyPaymentAccountForAllTokens,
  settle,
} from '../../actions/settle';
import { MintInfo } from '@solana/spl-token';
import { LoadingOutlined } from '@ant-design/icons';
import { setupPlaceBid } from '../../actions/sendPlaceBid';
import {
  FailureCb,
  ProgressCb,
  SmartInstructionSender,
  SmartInstructionSenderConfiguration,
} from '@holaplex/solana-web3-tools';
const { Content } = Layout;
const { Text } = Typography;

export const BillingView = () => {
  const { id } = useParams<{ id: string }>();

  if (!id?.length) {
    return <></>;
  }

  const { auction, loading } = useAuction(id);
  const connection = useConnection();
  const wallet = useWallet();
  const { patchState } = useMeta();
  const [loadingBilling, setLoadingBilling] = useState<boolean>(true);
  const mint = useMint(auction?.auction.info.tokenMint);

  useEffect(() => {
    (async () => {
      const billingState = await loadPayoutTickets(connection);

      patchState(billingState);
      setLoadingBilling(false);
    })();
  }, [loadingBilling]);

  useEffect(() => {
    return subscribeProgramChanges(connection, patchState, {
      programId: METAPLEX_ID,
      processAccount: processMetaplexAccounts,
    });
  }, [connection]);

  return loading ||
    loadingBilling ||
    !auction ||
    !wallet ||
    !connection ||
    !mint ? (
    <div className="app-section--loading">
      <Spin indicator={<LoadingOutlined />} />
    </div>
  ) : (
    <InnerBillingView
      auctionView={auction}
      connection={connection}
      wallet={wallet}
      mint={mint}
    />
  );
};

function getLosingParticipationPrice(
  el: ParsedAccount<BidderMetadata>,
  auctionView: AuctionView,
) {
  const nonWinnerConstraint =
    auctionView.auctionManager.participationConfig?.nonWinningConstraint;

  if (nonWinnerConstraint === NonWinningConstraint.GivenForFixedPrice)
    return (
      auctionView.auctionManager.participationConfig?.fixedPrice?.toNumber() ||
      0
    );
  else if (nonWinnerConstraint === NonWinningConstraint.GivenForBidPrice)
    return el.info.lastBid.toNumber() || 0;
  else return 0;
}

function useWinnerPotsByBidderKey(
  auctionView: AuctionView,
): Record<string, ParsedAccount<BidderPot>> {
  const [pots, setPots] = useState<Record<string, ParsedAccount<BidderPot>>>(
    {},
  );
  const PROGRAM_IDS = programIds();

  const winnersLength = auctionView.auctionManager.numWinners.toNumber();
  const auction = auctionView.auction;
  const winners = auction.info.bidState.bids;
  const truWinners = useMemo(() => {
    return [...winners].reverse().slice(0, winnersLength);
  }, [winners, winnersLength]);

  useEffect(() => {
    (async () => {
      const promises: Promise<{ winner: Bid; key: StringPublicKey }>[] =
        truWinners.map(winner =>
          getBidderPotKey({
            auctionProgramId: PROGRAM_IDS.auction,
            auctionKey: auction.pubkey,
            bidderPubkey: winner.key,
          }).then(key => ({
            key,
            winner,
          })),
        );
      const values = await Promise.all(promises);

      const newPots = values.reduce((agg, value) => {
        const el = cache.get(value.key) as ParsedAccount<BidderPot>;
        if (el) {
          agg[value.winner.key] = el;
        }

        return agg;
      }, {} as Record<string, ParsedAccount<BidderPot>>);

      setPots(newPots);
    })();
  }, [truWinners, setPots]);
  return pots;
}

function usePayoutTickets(auctionView: AuctionView): {
  payoutTickets: Record<
    string,
    { tickets: ParsedAccount<PayoutTicket>[]; sum: number }
  >;
  loading: boolean;
} {
  const { payoutTickets } = useMeta();
  const [foundPayoutTickets, setFoundPayoutTickets] = useState<
    Record<string, ParsedAccount<PayoutTicket>>
  >({});

  const [loadingPayoutTickets, setLoadingPayoutTickets] =
    useState<boolean>(true);

  useEffect(() => {
    (async () => {
      if (
        auctionView.items
          .flat()
          .map(i => i.metadata)
          .filter(i => !i).length
      ) {
        return;
      }
      const currFound = { ...foundPayoutTickets };
      // items are in exact order of winningConfigs + order of bid winners
      // when we moved to tiered auctions items will be array of arrays, remember this...
      // this becomes triple loop
      const prizeArrays = [
        ...auctionView.items,
        ...(auctionView.participationItem
          ? [[auctionView.participationItem]]
          : []),
      ];
      const payoutPromises: {
        key: string;
        promise: Promise<StringPublicKey>;
      }[] = [];
      for (let i = 0; i < prizeArrays.length; i++) {
        const items = prizeArrays[i];
        for (let j = 0; j < items.length; j++) {
          const item = items[j];
          const creators = item.metadata?.info?.data?.creators || [];
          const recipientAddresses = creators
            ? creators
                .map(c => c.address)
                .concat([auctionView.auctionManager.authority])
            : [auctionView.auctionManager.authority];

          for (let k = 0; k < recipientAddresses.length; k++) {
            // Ensure no clashes with tickets from other safety deposits in other winning configs even if from same creator by making long keys
            const key = `${auctionView.auctionManager.pubkey}-${i}-${j}-${item.safetyDeposit.pubkey}-${recipientAddresses[k]}-${k}`;

            if (!currFound[key]) {
              payoutPromises.push({
                key,
                promise: getPayoutTicket(
                  auctionView.auctionManager.pubkey,
                  item === auctionView.participationItem ? null : i,
                  item === auctionView.participationItem ? null : j,
                  k < recipientAddresses.length - 1 ? k : null,
                  item.safetyDeposit.pubkey,
                  recipientAddresses[k],
                ),
              });
            }
          }
        }
      }
      await Promise.all(payoutPromises.map(p => p.promise)).then(
        (payoutKeys: StringPublicKey[]) => {
          payoutKeys.forEach((payoutKey: StringPublicKey, i: number) => {
            if (payoutTickets[payoutKey])
              currFound[payoutPromises[i].key] = payoutTickets[payoutKey];
          });

          setFoundPayoutTickets(pt => ({ ...pt, ...currFound }));
        },
      );

      setLoadingPayoutTickets(false);
    })();
  }, [
    Object.values(payoutTickets).length,
    auctionView.items
      .flat()
      .map(i => i.metadata)
      .filter(i => !!i).length,
  ]);

  return {
    payoutTickets: Object.values(foundPayoutTickets).reduce(
      (
        acc: Record<
          string,
          { tickets: ParsedAccount<PayoutTicket>[]; sum: number }
        >,
        el: ParsedAccount<PayoutTicket>,
      ) => {
        if (!acc[el.info.recipient]) {
          acc[el.info.recipient] = {
            sum: 0,
            tickets: [],
          };
        }
        acc[el.info.recipient].tickets.push(el);
        acc[el.info.recipient].sum += el.info.amountPaid.toNumber();
        return acc;
      },
      {},
    ),
    loading: loadingPayoutTickets,
  };
}

export function useBillingInfo({ auctionView }: { auctionView: AuctionView }) {
  const { bidRedemptions, bidderMetadataByAuctionAndBidder } = useMeta();
  const auctionKey = auctionView.auction.pubkey;

  const [participationBidRedemptionKeys, setParticipationBidRedemptionKeys] =
    useState<Record<string, StringPublicKey>>({});

  const bids = useBidsForAuction(auctionView.auction.pubkey);

  const { loading, payoutTickets } = usePayoutTickets(auctionView);
  const winners = [...auctionView.auction.info.bidState.bids]
    .reverse()
    .slice(0, auctionView.auctionManager.numWinners.toNumber());
  const winnerPotsByBidderKey = useWinnerPotsByBidderKey(auctionView);

  // Uncancelled bids or bids that were cancelled for refunds but only after redeemed
  // for participation
  const usableBids = bids.filter(
    b =>
      !b.info.cancelled ||
      bidRedemptions[
        participationBidRedemptionKeys[b.pubkey]
      ]?.info.getBidRedeemed(
        auctionView.participationItem?.safetyDeposit.info.order || 0,
      ),
  );

  const hasParticipation =
    auctionView.auctionManager.participationConfig !== undefined &&
    auctionView.auctionManager.participationConfig !== null;
  let participationEligible = hasParticipation ? usableBids : [];

  useMemo(async () => {
    const newKeys: Record<string, StringPublicKey> = {};

    for (let i = 0; i < bids.length; i++) {
      const o = bids[i];
      if (!participationBidRedemptionKeys[o.pubkey]) {
        newKeys[o.pubkey] = (
          await getBidderKeys(auctionView.auction.pubkey, o.info.bidderPubkey)
        ).bidRedemption;
      }
    }

    setParticipationBidRedemptionKeys({
      ...participationBidRedemptionKeys,
      ...newKeys,
    });
  }, [bids.length]);

  if (
    auctionView.auctionManager.participationConfig?.winnerConstraint ===
    WinningConstraint.NoParticipationPrize
  )
    // Filter winners out of the open edition eligible
    participationEligible = participationEligible.filter(
      // winners are stored by pot key, not bidder key, so we translate
      b => !winnerPotsByBidderKey[b.info.bidderPubkey],
    );

  const nonWinnerConstraint =
    auctionView.auctionManager.participationConfig?.nonWinningConstraint;

  const participationEligibleUnredeemable: ParsedAccount<BidderMetadata>[] = [];

  participationEligible.forEach(o => {
    const isWinner = winnerPotsByBidderKey[o.info.bidderPubkey];
    // Winners automatically pay nothing for open editions, and are getting claimed anyway right now
    // so no need to add them to list
    if (isWinner) {
      return;
    }

    if (
      nonWinnerConstraint === NonWinningConstraint.GivenForFixedPrice ||
      nonWinnerConstraint === NonWinningConstraint.GivenForBidPrice
    ) {
      const key = participationBidRedemptionKeys[o.pubkey];
      if (key) {
        const redemption = bidRedemptions[key];
        if (
          !redemption ||
          !redemption.info.getBidRedeemed(
            auctionView.participationItem?.safetyDeposit.info.order || 0,
          )
        )
          participationEligibleUnredeemable.push(o);
      } else participationEligibleUnredeemable.push(o);
    }
  });

  const participationUnredeemedTotal = participationEligibleUnredeemable.reduce(
    (acc, el) => (acc += getLosingParticipationPrice(el, auctionView)),
    0,
  );

  // Winners always get it for free so pay zero for them - figure out among all
  // eligible open edition winners what is the total possible for display.
  const participationPossibleTotal = participationEligible.reduce((acc, el) => {
    const isWinner = winnerPotsByBidderKey[el.info.bidderPubkey];
    let price = 0;
    if (!isWinner) price = getLosingParticipationPrice(el, auctionView);

    return (acc += price);
  }, 0);

  const totalWinnerPayments = winners.reduce(
    (acc, w) => (acc += w.amount.toNumber()),
    0,
  );

  const winnersThatCanBeEmptied = Object.values(winnerPotsByBidderKey).filter(
    p => !p.info.emptied,
  );

  const otherBidsToClaim = [
    ...Object.values(winnerPotsByBidderKey).map(pot => ({
      metadata:
        bidderMetadataByAuctionAndBidder[`${auctionKey}-${pot.info.bidderAct}`],
      pot,
    })),
  ];

  const bidsToClaim: {
    metadata: ParsedAccount<BidderMetadata>;
    pot: ParsedAccount<BidderPot>;
  }[] = [
    ...winnersThatCanBeEmptied.map(pot => ({
      metadata:
        bidderMetadataByAuctionAndBidder[`${auctionKey}-${pot.info.bidderAct}`],
      pot,
    })),
  ];

  return {
    bidsToClaim,
    otherBidsToClaim,
    totalWinnerPayments,
    payoutTickets,
    participationEligible,
    participationPossibleTotal,
    participationUnredeemedTotal,
    hasParticipation,
    loading,
  };
}

export const InnerBillingView = ({
  auctionView,
  wallet,
  connection,
  mint,
}: {
  auctionView: AuctionView;
  wallet: WalletSigner;
  connection: Connection;
  mint: MintInfo;
}) => {
  const id = auctionView.thumbnail.metadata.pubkey;
  const art = useArt(id);
  const [settleErrorMessage, setSettleErrorMessage] = useState<string>();
  const balance = useUserBalance(auctionView.auction.info.tokenMint);
  const [escrowBalance, setEscrowBalance] = useState<number | undefined>();
  const { whitelistedCreatorsByCreator } = useMeta();
  const [escrowBalanceRefreshCounter, setEscrowBalanceRefreshCounter] =
    useState(0);
  const [hiddenOptionsCounter, setHiddenOptionsCounter] = useState(0);

  useEffect(() => {
    connection
      .getTokenAccountBalance(
        toPublicKey(auctionView.auctionManager.acceptPayment),
      )
      .then(resp => {
        if (resp.value.uiAmount !== undefined && resp.value.uiAmount !== null)
          setEscrowBalance(resp.value.uiAmount);
      });
  }, [escrowBalanceRefreshCounter]);

  const myPayingAccount = balance.accounts[0];

  const { accountByMint } = useUserAccounts();

  const {
    bidsToClaim,
    otherBidsToClaim,
    totalWinnerPayments,
    payoutTickets,
    participationPossibleTotal,
    participationUnredeemedTotal,
    hasParticipation,
    loading,
  } = useBillingInfo({
    auctionView,
  });

  const setUpBids = useCallback(async () => {
    const config: SmartInstructionSenderConfiguration = {
      abortOnFailure: true,
      maxSigningAttempts: 3,
      commitment: 'finalized',
    };

    const handleSuccess: ProgressCb = (id, txid) => {
      notify({
        type: 'success',
        txid,
        message: `${id}/${id} - TX sent: ${txid}`,
      });
    };

    const handleFailure: FailureCb = err => {
      notify({
        type: 'error',
        message: err.message,
      });
    };

    const signers: Keypair[][] = [];
    const instructions: TransactionInstruction[][] = [];
    await setupPlaceBid(
      connection,
      wallet,
      myPayingAccount.pubkey,
      auctionView,
      accountByMint,
      0,
      instructions,
      signers,
    );

    notify({
      type: 'info',
      message: 'Setting up bids...',
    });

    await SmartInstructionSender.build(wallet, connection)
      .config(config)
      .withInstructionSets(
        instructions.map((ixs, i) => ({
          instructions: ixs,
          signers: signers[i],
        })),
      )
      .onProgress(handleSuccess)
      .onFailure(handleFailure)
      .send();
  }, []);

  const disburseFunds = useCallback(async () => {
    const handleSuccess: ProgressCb = (id, txid) => {
      notify({
        type: 'success',
        txid,
        message: `${id}/${id} - TX sent: ${txid}`,
      });
    };

    const handleFailure: FailureCb = err => {
      notify({
        type: 'error',
        message: err.message,
      });
    };

    notify({
      type: 'info',
      message: 'Disbursing funds for all tokens...',
    });
    await emptyPaymentAccountForAllTokens(connection, wallet, auctionView, {
      onProgress: handleSuccess,
      onFailure: handleFailure,
    });
  }, []);

  return (
    <Content>
      <Col>
        <Row className="metaplex-margin-x-8 metaplex-text-align-left">
          <Col span={12}>
            <ArtContent
              pubkey={id}
              backdrop="dark"
              allowMeshRender
              square={false}
            />
          </Col>
          <Col span={12}>
            <h1
              style={{
                cursor: 'pointer',
              }}
              onClick={() => {
                notify({
                  type: 'info',
                  message: `You're ${hiddenOptionsCounter}/7 clicks away from showing disbursing helpers.`,
                });
                setHiddenOptionsCounter(v => v + 1);
              }}
            >
              {art.title}
            </h1>
            <br />
            <div className="info-header">TOTAL AUCTION VALUE</div>
            <div className="escrow">
              ◎
              {fromLamports(
                totalWinnerPayments + participationPossibleTotal,
                mint,
              )}
            </div>
            <br />
            <div className="info-header">TOTAL AUCTION REDEEMED VALUE</div>
            <div className="escrow">
              ◎
              {fromLamports(
                totalWinnerPayments +
                  participationPossibleTotal -
                  participationUnredeemedTotal,
                mint,
              )}
            </div>
            <br />
            <div className="info-header">
              TOTAL COLLECTED BY ARTISTS AND AUCTIONEER
            </div>
            <div className="escrow">
              ◎
              {fromLamports(
                Object.values(payoutTickets).reduce(
                  (acc, el) => (acc += el.sum),
                  0,
                ),
                mint,
              )}
            </div>
            <br />
            <div className="info-header">TOTAL UNSETTLED</div>
            <div className="escrow">
              ◎
              {fromLamports(
                bidsToClaim.reduce(
                  (acc, el) => (acc += el.metadata.info.lastBid.toNumber()),
                  0,
                ),
                mint,
              )}
            </div>
            <br />
            <div className="info-header">TOTAL IN ESCROW</div>
            <div className="escrow">
              {escrowBalance !== undefined ? (
                `◎${escrowBalance}`
              ) : (
                <Spin indicator={<LoadingOutlined />} />
              )}
            </div>
            <br />
            {hasParticipation && (
              <>
                <div className="info-header">
                  TOTAL UNREDEEMED PARTICIPATION FEES OUTSTANDING
                </div>
                <div className="outstanding-open-editions">
                  ◎{fromLamports(participationUnredeemedTotal, mint)}
                </div>
                <br />
              </>
            )}
            <br />
            <Button
              type="primary"
              size="large"
              className="action-btn"
              onClick={async () => {
                try {
                  await settle(
                    connection,
                    wallet,
                    auctionView,
                    bidsToClaim.map(b => b.pot),
                    myPayingAccount.pubkey,
                    accountByMint,
                  );
                  setEscrowBalanceRefreshCounter(ctr => ctr + 1);
                  setSettleErrorMessage(undefined);
                } catch (e: any) {
                  setSettleErrorMessage(e.message);
                }
              }}
            >
              SETTLE OUTSTANDING
            </Button>
            {settleErrorMessage && (
              <Space direction="horizontal" size="small">
                <Text type="danger">***</Text>
                <Text>{settleErrorMessage}</Text>
              </Space>
            )}
          </Col>
        </Row>
        <Row>
          <Col span={24}>
            <Table
              loading={{
                spinning: loading,
                indicator: <LoadingOutlined />,
              }}
              columns={[
                {
                  title: 'Name',
                  dataIndex: 'name',
                  key: 'name',
                },
                {
                  title: 'Address',
                  dataIndex: 'address',
                  key: 'address',
                },
                {
                  title: 'Amount Paid',
                  dataIndex: 'amountPaid',
                  render: (val: number) => (
                    <span>◎{fromLamports(val, mint)}</span>
                  ),
                  key: 'amountPaid',
                },
              ]}
              dataSource={Object.keys(payoutTickets).map(t => ({
                key: t,
                name: whitelistedCreatorsByCreator[t]?.info?.name || 'N/A',
                address: t,
                amountPaid: payoutTickets[t].sum,
              }))}
            />
          </Col>
        </Row>
        {hiddenOptionsCounter < 8 ? null : (
          <div style={{ marginTop: '1em' }}>
            <Row>
              <Col span={24}>
                <Button
                  type="primary"
                  size="large"
                  className="action-btn"
                  onClick={setUpBids}
                >
                  Set up bids
                </Button>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <Table
                  loading={{
                    spinning: loading,
                    indicator: <LoadingOutlined />,
                  }}
                  columns={[
                    {
                      title: 'Bidder',
                      dataIndex: 'bidder',
                      key: 'bidder',
                    },
                    {
                      title: 'Bidder pot key',
                      dataIndex: 'bidToClaim',
                      key: 'bidToClaim',
                    },
                    {
                      title: 'Action',
                      dataIndex: 'action',
                      key: 'action',
                      render: (pot: ParsedAccount<BidderPot>) => (
                        <Button
                          type="primary"
                          size="large"
                          className="action-btn"
                          onClick={async () => {
                            notify({
                              type: 'info',
                              message: 'Claiming bid...',
                            });

                            const handleSuccess: ProgressCb = (id, txid) => {
                              notify({
                                type: 'success',
                                txid,
                                message: `${id}/${id} - TX sent: ${txid}`,
                              });
                            };

                            const handleFailure: FailureCb = err => {
                              notify({
                                type: 'error',
                                message: err.message,
                              });
                            };

                            await claimSpecificBid(
                              connection,
                              wallet,
                              auctionView,
                              pot,
                              {
                                onProgress: handleSuccess,
                                onFailure: handleFailure,
                              },
                            );
                          }}
                        >
                          SETTLE
                        </Button>
                      ),
                    },
                  ]}
                  dataSource={otherBidsToClaim.map(b => ({
                    key: b.metadata.info.bidderPubkey,
                    bidder: b.metadata.info.bidderPubkey,
                    bidToClaim: b.pot.pubkey,
                    action: b.pot,
                  }))}
                />
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <Button
                  type="primary"
                  size="large"
                  className="action-btn"
                  onClick={disburseFunds}
                >
                  Disburse funds
                </Button>
              </Col>
            </Row>
          </div>
        )}
      </Col>
    </Content>
  );
};
