import React, { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  const [notificationContainerClass, setNotificationContainerClass] =
    useState('notificationsContainer');
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

  useLayoutEffect(() => {
    const updateSize = () => {
      if (notificationsContainer.current) {
        const containerWidth = notificationsContainer.current.offsetWidth;
        const widthClass =
          containerWidth <= 400
            ? 'ant-card-body notificationsContainerSm'
            : containerWidth <= 680
            ? 'ant-card-body notificationsContainerMd'
            : containerWidth <= 1100
            ? 'ant-card-body notificationsContainerLg'
            : 'ant-card-body';
        setNotificationContainerClass(widthClass);
      }
    };

    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const doWork = async () => {
      try {
        console.log(isAuthenticated());
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
    console.log('a:' + actualState);
    console.log('r: ' + requestedState);
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

  const toggleAlerts = (e: React.FormEvent<HTMLInputElement>) => {
    if (requestedState != actualState) {
      return;
    }

    setAlertCardActive(e.currentTarget.checked);

    if (e.currentTarget.checked) {
      setRequestedState(InternalState.SyncedData);
    } else {
      if (alertId) {
        deleteAlert({ alertId });
        setAlertId('');
      }

      setRequestedState(InternalState.Uninitialized);
    }
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
    <div className={notificationContainerClass} ref={notificationsContainer}>
      <div className="getAlertsContainer">
        <div className="getAlertsToggleContainer">
          <span className="ant-card-head-title">Get Auction and Bid Alerts</span>

          <div className="getAlertsToggle">
            <label className="getAlertsSwitch">
              <input
                disabled={!props.isWalletConnected}
                type="checkbox"
                checked={alertCardActive && props.isWalletConnected}
                onChange={toggleAlerts}
              />
              <span className="getAlertsSwitchSlider" />
            </label>
          </div>

          {showSubscribeAlertMessage && alertId && (
            <div className="subscribedAlert">
              <img alt="check" src="/img/check-icon.png" />
              <span>You’re subscribed for alerts </span>
            </div>
          )}
        </div>

        <div className="getAlertsPoweredBy">
          <span className="getAlertsPoweredByText">Powered by</span>
          <img alt="Powered by Logo" src="/img/logo.png" />
        </div>
      </div>

      {alertCardActive && props.isWalletConnected && (
        <div className="subscribeContainer">
          <div className="subscribeInput">
            <div className="subscribeInputContainer">
              <img alt="email" src="/img/email-logo.png" />
              <input
                onChange={onEmailAddressChange}
                type="email"
                placeholder="Email address"
                value={emailAddress}
                className={!isEditing ? 'subscribedInput' : ''}
                readOnly={!isEditing}
              />
            </div>
          </div>

          <div className="subscribeInput">
            <div className="subscribeInputContainer">
              <img
                alt="phone"
                src="/img/mobile-logo.png"
                title="US phone numbers only. eg: +15551112222"
              />
              <input
                onChange={onPhoneNumberChange}
                type="tel"
                pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
                placeholder="Phone number"
                title="US phone numbers only. eg: +15551112222"
                value={phoneNumber}
                className={!isEditing ? 'subscribedInput' : ''}
                readOnly={!isEditing}
              />
            </div>
          </div>

          {(!alertId || isEditing) && (
            <div className="subscribeButton">
              <button onClick={subscribe}>Subscribe</button>
            </div>
          )}

          {alertId && !isEditing && (
            <div className="editButton">
              <button type="submit" onClick={editInfo}>
                Edit Info
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuctionAlertSetup;
