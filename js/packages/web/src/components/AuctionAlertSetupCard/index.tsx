import React, {FC, useEffect, useLayoutEffect, useRef, useState} from 'react';
import styles from './AuctionAlertSetupCard.module.css'
import {
  BlockchainEnvironment,
  useNotifiClient,
} from '@notifi-network/notifi-react-hooks'

interface AuctionAlertSetupProps {
  env: BlockchainEnvironment,
  isWalletConnected: boolean,
  dappId: string,
  userWalletAddress: string | undefined,
  storeName: string,
  auctionWebUrl: string,
  auctionAddress: string,
  signerCallback: (message: Uint8Array) => Promise<Uint8Array>
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

  const [alerts, setAlerts] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showSubscribeAlertMessage, setShowSubscribeAlertMessage] = useState(false);
  const [notificationContainerClass, setNotificationContainerClass] = useState(styles.notificationsContainer);
  const notificationsContainer = useRef<HTMLDivElement>(null);
  const [requestedState, setRequestedState] = useState<InternalState>(InternalState.Uninitialized)
  const [actualState, setActualState] = useState<InternalState>(InternalState.Uninitialized)
  const [sourceId, setSourceId] = useState<string>('');
  const [filterId, setFilterId] = useState<string>('');
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [telegramId, setTelegramId] = useState<string>('');
  const [alertId, setAlertId] = useState<string>('');

  useLayoutEffect(() => {
      const updateSize = () => {
          if (notificationsContainer.current) {
              const containerWidth = notificationsContainer.current.offsetWidth;
              const widthClass = containerWidth <= 400 ? styles.notificationsContainer + ' ' + styles.notificationsContainerSm
                  : containerWidth <= 680 ? styles.notificationsContainer + ' ' + styles.notificationsContainerMd
                      : containerWidth <= 1100 ? styles.notificationsContainer + ' ' + styles.notificationsContainerLg
                          : styles.notificationsContainer;
              setNotificationContainerClass(widthClass);
          }
      }

      window.addEventListener('resize', updateSize);
      updateSize();
      return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const doWork = async() => {
      await advanceToNextActualState()
    };

    doWork();
  }, [requestedState, actualState]);

  const { fetchData, logIn, isAuthenticated, createAlert, deleteAlert } =
  useNotifiClient({
    dappAddress: props.dappId,
    walletPublicKey: props.userWalletAddress ? props.userWalletAddress : '',
    env: props.env,
  });

  const advanceToNextActualState = async function () {
    switch (actualState) {
      case InternalState.Uninitialized:
        if (requestedState > actualState) {
          setActualState(InternalState.Initialized);
          console.log("Uninitialized");
        }
        break;
      case InternalState.Initialized:
        console.log("Initialized");
        if (requestedState > actualState) {
          setActualState(InternalState.SigningInToNotifi);
          console.log("SigningInToNotifi");
        }
       break;
      case InternalState.SigningInToNotifi:
        if (!isAuthenticated()) {
          await logIn({signMessage: props.signerCallback});
        }
        setActualState(InternalState.SignedInToNotifi);
       break;
      case InternalState.SignedInToNotifi: {
        const {alerts, sources, targetGroups} = await fetchData();
        
        if (requestedState > InternalState.SignedInToNotifi) {
          const s = sources.find((it) => {
            return it.type == "SOLANA_METAPLEX_AUCTION";
          });
          
          if (!s) {
            throw "Failed to find appropriate Source";
          }

          setSourceId(s.id!);
          const filter = s.applicableFilters.find((it) => {
            return it.filterType == 'SOLANA_METAPLEX_AUCTION';
          });

          if (!filter) {
            throw "Failed to find appropriate Filter";
          }

          setFilterId(filter.id!);
          
          if (alerts) {
            const alert = alerts.find((it) => {
              return it.name === props.auctionAddress;
            });

            if (alert) {
              setAlertId(alert.id!);
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

              if (tg.telegramTargets && tg.telegramTargets.length > 0) {
                setTelegramId(tg.telegramTargets[0].telegramId!);
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
          const res = await createAlert({
            filterId: filterId,
            sourceId: sourceId,
            groupName: props.storeName,
            name: `Auction: ${props.auctionAddress}`,
            emailAddress: emailAddress === '' ? null : emailAddress,
            phoneNumber: phoneNumber.length < 12 ? null : phoneNumber,
            telegramId: telegramId,
            filterOptions: {},
          });

          if (!res) {
            // TODO: Set error state
            throw "Failed to create Alert";
          }

          setActualState(InternalState.UpdatedData);
        }
       break;
      case InternalState.UpdatedData:
        // TODO: Add eventing or other possible notifications here.
        // Reset back to idle state
        setRequestedState(InternalState.SyncedData);
        break;
      default:
        break;
    }
  }

  const toggleAlerts = (e: React.FormEvent<HTMLInputElement>) => {
      if (requestedState != actualState) {
        return;
      }

      setAlerts(e.currentTarget.checked);
      setIsSubscribed(false);
      
      if (e.currentTarget.checked) {
        setRequestedState(InternalState.SyncedData);
      } else {
        if (alertId) {
          deleteAlert({alertId});
        }
      }

      setRequestedState(InternalState.SyncedData);
  };

  const subscribe = () => {
      setIsSubscribed(true);
      setShowSubscribeAlertMessage(true);
      setTimeout(() => {
          setShowSubscribeAlertMessage(false)
      }, 5000);
  };

  const editInfo = () => {
      setIsSubscribed(false);
      setShowSubscribeAlertMessage(false);
  };

  return (
      <div className={notificationContainerClass} ref={notificationsContainer}>
          <div className={styles.getAlertsContainer}>
              <div className={styles.getAlertsToogleContainer}>
                  <span className={styles.getAlertsToogleText}>Get Auction and Bid Alerts</span>

                  <div className={styles.getAlertsToogle}>
                      <label className={styles.getAlertsSwitch}>
                          <input disabled={!props.isWalletConnected} type="checkbox" onChange={toggleAlerts}/>
                          <span className={styles.getAlertsSwitchSlider}/>
                      </label>
                  </div>

                  {isSubscribed && <div className={styles.subscribedSettings}>
                      <div className={styles.subscribedSettingsButton}>
                          <img alt="settings" src="/img/settings.png" />
                      </div>
                  </div>}
                  {(showSubscribeAlertMessage && isSubscribed) && <div className={styles.subscribedAlert}>
                      <img alt="check" src="/img/check-icon.png" />
                      <span>You’re subscribed for alerts </span>
                  </div>}
              </div>

              <div className={styles.getAlertsPoweredBy}>
                  <span className={styles.getAlertsPoweredByText}>Powered by</span>
                  <img alt="Powered by Logo" src="/img/logo.png"/>
              </div>
          </div>

          {alerts && <div className={styles.subscribeContainer}>
              <div className={styles.subscribeInput}>
                  <div className={styles.subscribeInputContainer}>
                      <img alt="email" src="/img/email-logo.png"/>
                      <input type="email" placeholder="Email address" className={isSubscribed ? styles.subscribedInput : ''} readOnly={isSubscribed}/>
                  </div>
              </div>

              <div className={styles.subscribeInput}>
                  <div className={styles.subscribeInputContainer}>
                      <img alt="phone" src="/img/mobile-logo.png"/>
                      <input type="tel" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" placeholder="Phone number" className={isSubscribed ? styles.subscribedInput : ''} readOnly={isSubscribed}/>
                  </div>
              </div>

              <div className={styles.subscribeInput}>
                  <div className={styles.subscribeInputContainer}>
                      <img alt="telegram" src="/img/telegram-logo.png"/>
                      <input type="text" placeholder="Telegram" className={isSubscribed ? styles.subscribedInput : ''} readOnly={isSubscribed}/>
                  </div>
              </div>

              {!isSubscribed && <div className={styles.subscribeButton}>
                  <button onClick={subscribe}>Subscribe</button>
              </div>}

              {isSubscribed && <div className={styles.editButton}>
                  <button type="submit" onClick={editInfo}>Edit Info</button>
              </div>}
          </div>}

      </div>
  )
};

export default AuctionAlertSetup;
