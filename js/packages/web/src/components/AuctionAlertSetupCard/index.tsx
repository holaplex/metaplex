import React, { FC, useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { BlockchainEnvironment, useNotifiClient } from '@notifi-network/notifi-react-hooks';

interface AuctionAlertSetupProps {
  env: BlockchainEnvironment;
  isWalletConnected: boolean;
  dappId: string;
  userWalletAddress: string | undefined;
  storeName: string;
  auctionWebUrl: string;
  auctionAddress: string;
  signerCallback: (message: Uint8Array) => Promise<Uint8Array>;
}

const NotifyEnums = {
  0: 'Uninitialized',
  1: 'Initialized',
  2: 'SigningInToNotifi',
  3: 'SignedInToNotifi',
  4: 'SyncedData',
  5: 'UpdatedData',
};

const AuctionAlertSetup: FC<AuctionAlertSetupProps> = (props: AuctionAlertSetupProps) => {
  enum InternalState {
    Uninitialized,
    Initialized,
    SigningInToNotifi,
    SignedInToNotifi,
    SyncedData,
    UpdatedData,
  }

  const [alertCardActive, setAlertCardActive] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [showSubscribeAlertMessage, setShowSubscribeAlertMessage] = useState(false);

  const notificationsContainer = useRef<HTMLDivElement>(null);
  const [requestedState, setRequestedState] = useState<InternalState>(InternalState.Uninitialized);
  const [actualState, setActualState] = useState<InternalState>(InternalState.Uninitialized);
  const [sourceId, setSourceId] = useState<string>('');
  const [filterId, setFilterId] = useState<string>('');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [alertId, setAlertId] = useState<string>('');
  const [stateInAwait, setStateInAwait] = useState(false);

  const {
    fetchData,
    logIn,
    loading,
    isAuthenticated,
    createAlert,
    deleteAlert,
    createMetaplexAuctionSource,
  } = useNotifiClient({
    dappAddress: props.dappId,
    walletPublicKey: props.userWalletAddress ? props.userWalletAddress : '',
    env: props.env,
  });

  useEffect(() => {
    const doWork = async () => {
      try {
        console.log('notify isAuthenticated', isAuthenticated());
        if (
          requestedState == actualState &&
          requestedState == InternalState.Uninitialized &&
          !loading
        ) {
          if (isAuthenticated()) {
            setRequestedState(InternalState.SyncedData);
          }
        }
        await advanceToNextActualState();
      } catch (error) {
        console.log('Exception caught: ' + error);
        setRequestedState(InternalState.Uninitialized);
        setActualState(InternalState.Uninitialized);
      }
    };

    doWork();
  }, [requestedState, setRequestedState, actualState, setActualState, loading]);

  const advanceToNextActualState = async function () {
    console.log('a:' + NotifyEnums[actualState]);
    console.log('r: ' + NotifyEnums[requestedState]);
    if (actualState == requestedState || stateInAwait) {
      return;
    }

    switch (actualState) {
      case InternalState.Uninitialized:
        if (requestedState > actualState) {
          setActualState(InternalState.Initialized);
        }
        break;
      case InternalState.Initialized:
        if (requestedState > actualState) {
          setActualState(InternalState.SigningInToNotifi);
        }
        break;
      case InternalState.SigningInToNotifi:
        if (!isAuthenticated()) {
          setStateInAwait(true);
          await logIn({ signMessage: props.signerCallback });
          setStateInAwait(false);
        }
        setActualState(InternalState.SignedInToNotifi);
        break;
      case InternalState.SignedInToNotifi: {
        setStateInAwait(true);
        const { alerts, targetGroups } = await fetchData();
        setStateInAwait(false);

        if (requestedState > InternalState.SignedInToNotifi) {
          setStateInAwait(true);
          const s = await createMetaplexAuctionSource({
            auctionAddressBase58: props.auctionAddress,
            auctionWebUrl: props.auctionWebUrl,
          });
          setStateInAwait(false);

          setSourceId(s.id!);
          const filter = s.applicableFilters.find((it) => {
            console.log(it.filterType);
            return it.filterType == 'NFT_AUCTIONS';
          });

          if (!filter) {
            setRequestedState(InternalState.Uninitialized);
            setActualState(InternalState.Uninitialized);
            throw 'Failed to find appropriate Filter';
          }

          setFilterId(filter.id!);

          if (alerts) {
            const alert = alerts.find((it) => {
              return it.name === `Auction: ${props.auctionAddress}`;
            });

            if (alert) {
              console.log('Found alertId: ' + alert.id!);
              setAlertId(alert.id!);
              setIsEditing(false);
              setAlertCardActive(true);
            }

            // If there's an alert for this auction, pull out the relevant data
            let tg = alert?.targetGroup;
            if (!tg) {
              // No previously set alert. Attempt to populate from old data on first targetGroup
              tg = targetGroups && targetGroups.length > 0 ? targetGroups[0] : undefined;
            }

            if (tg) {
              if (tg.emailTargets && tg.emailTargets.length > 0) {
                setEmailAddress(tg.emailTargets[0].emailAddress!);
              }

              if (tg.smsTargets && tg.smsTargets.length > 0) {
                setPhoneNumber(tg.smsTargets[0].phoneNumber!);
              }
            }
          }

          setActualState(InternalState.SyncedData);
        }
        break;
      }
      case InternalState.SyncedData:
        if (requestedState < actualState) {
          setActualState(requestedState);
        }

        if (requestedState == InternalState.UpdatedData) {
          if (alertId) {
            setStateInAwait(true);
            await deleteAlert({ alertId });
            setStateInAwait(false);
            setAlertId('');
          }

          setStateInAwait(true);
          console.log('Creating Notifi Alert');
          const res = await createAlert({
            filterId: filterId,
            sourceId: sourceId,
            groupName: props.storeName,
            name: `Auction: ${props.auctionAddress}`,
            emailAddress: emailAddress === '' ? null : emailAddress,
            phoneNumber: phoneNumber.length < 12 ? null : phoneNumber,
            telegramId: null,
            filterOptions: {},
          });
          setStateInAwait(false);

          if (!res) {
            // TODO: Set error state
            setRequestedState(InternalState.Uninitialized);
            setActualState(InternalState.Uninitialized);
            throw 'Failed to create Alert';
          } else {
            setAlertId(res.id!);
          }

          setActualState(InternalState.UpdatedData);
        }
        break;
      case InternalState.UpdatedData:
        // TODO: Add eventing or other possible notifications here.
        // Reset back to idle state
        setRequestedState(InternalState.SyncedData);
        setActualState(InternalState.SyncedData);
        break;
      default:
        break;
    }
  };

  const enableAlertsForm = () => {
    if (requestedState != actualState) {
      return;
    }

    setRequestedState(InternalState.SyncedData);
    setAlertCardActive(true);
  };

  const disableAlerts = () => {
    if (requestedState != actualState) {
      return;
    }

    setAlertCardActive(false);

    if (alertId) {
      deleteAlert({ alertId });
      setAlertId('');
    }
    setRequestedState(InternalState.Uninitialized);
  };

  const subscribe = () => {
    setIsEditing(false);
    setRequestedState(InternalState.UpdatedData);
    setShowSubscribeAlertMessage(true);
    setTimeout(() => {
      setShowSubscribeAlertMessage(false);
    }, 5000);
  };

  const editInfo = () => {
    setIsEditing(true);
    setShowSubscribeAlertMessage(false);
  };

  const onEmailAddressChange = (e: React.FormEvent<HTMLInputElement>) => {
    setEmailAddress(e.currentTarget.value);
  };

  const onPhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.length > 1) {
      val = val.substring(2);
    }

    const re = /^[0-9\b]+$/;
    if (val === '' || (re.test(val) && val.length <= 10)) {
      setPhoneNumber('+1' + val);
    }
  };

  return (
    <div className={''} ref={notificationsContainer}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {!alertCardActive || !props.isWalletConnected ? (
            <Button
              type="default"
              onClick={() => enableAlertsForm()}
              disabled={!props.isWalletConnected}
            >
              {!props.isWalletConnected ? 'Connect to get ' : 'Get '} Auction and Bid Alerts
            </Button>
          ) : (
            <Button
              type="link"
              onClick={() => disableAlerts()}
              className="!p-0"
              disabled={!props.isWalletConnected || !alertId}
            >
              Cancel alerts
            </Button>
          )}
        </div>
        {showSubscribeAlertMessage && alertId && (
          <div className="flex items-center font-theme-text text-2xl font-medium text-primary">
            <span>You&apos;re subscribed for alerts!</span>
          </div>
        )}

        <a href="https://www.notifi.network/" target={'_blank'} rel="noreferrer">
          <div className="flex items-center ">
            <span className="getAlertsPoweredByText">Powered by</span>
            <img alt="Powered by Notify" src="/img/notifyLogo.png" />
          </div>
        </a>
      </div>

      {alertCardActive && props.isWalletConnected && (
        <div className="">
          <div className="flex w-full flex-wrap items-center justify-between font-theme-title">
            <div className="mt-4 w-full lg:max-w-xs">
              <div className="flex justify-between ">
                <label
                  htmlFor="email"
                  className="block font-theme-title text-sm font-medium text-primary"
                >
                  Email
                </label>
              </div>
              <div className="mt-1">
                <input
                  type="email"
                  name="email"
                  id="email"
                  onChange={onEmailAddressChange}
                  value={emailAddress}
                  className="block w-full rounded-md border-color-text bg-transparent text-color-text shadow-sm placeholder:text-color-text placeholder:opacity-50 focus:border-primary focus:ring-primary sm:text-sm"
                  placeholder="you@example.com"
                  aria-describedby="email"
                />
              </div>
            </div>
            <div className="mt-4 w-full lg:max-w-xs">
              <div className="flex justify-between">
                <label htmlFor="phone" className="block text-sm font-medium text-primary">
                  Phone number
                </label>
                <span className="text-sm text-color-text" id="phone">
                  Optional
                </span>
              </div>
              <div className="mt-1 font-theme-text ">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={onPhoneNumberChange}
                  name="phone"
                  id="phone"
                  className="block w-full rounded-md border-color-text bg-transparent  text-color-text shadow-sm placeholder:text-color-text placeholder:opacity-50 focus:border-primary focus:ring-primary sm:text-sm"
                  placeholder="+15551112222"
                  aria-describedby="phone"
                />
              </div>
            </div>
          </div>
          <div>
            {(!alertId || isEditing) && alertCardActive && (
              <Button
                type="primary"
                htmlType="submit"
                disabled={(!emailAddress && !phoneNumber) || loading}
                className="mt-8 w-full"
                onClick={() => subscribe()}
              >
                Subscribe
              </Button>
            )}
          </div>
        </div>
      )}
      {alertId && !isEditing && props.isWalletConnected && (
        <Button type="primary" htmlType="submit" className="mt-8 w-full" onClick={editInfo}>
          Edit Info
        </Button>
      )}
    </div>
  );
};

export default AuctionAlertSetup;
