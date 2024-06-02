import React, { useState, useEffect, Fragment } from 'react';
import { Typography, Button, Alert, Tooltip } from 'antd';
import { TwitterOutlined } from '@ant-design/icons';
import { StorefrontSocialInfo } from '@oyster/common';
import { useWallet, useMeta } from '@oyster/common';
const { Text } = Typography;
import { Link } from 'react-router-dom';

import { Identicon, shortenAddress, getTwitterHandle, useConnection } from '@oyster/common';

import { Popover, Transition, Dialog } from '@headlessui/react';
import { CheckIcon, DuplicateIcon, XIcon } from '@heroicons/react/outline';
import classNames from 'classnames';
import gql from 'graphql-tag';
import { useGQLQuery } from './UseGQLQuery';




const GET_PROFILEPIC = gql `
query walletProfile($handle: String!) {
  profile(handle: $handle) {
    handle
    profileImageUrlLowres
    profileImageUrlHighres
    bannerImageUrl
  }
}
`


export const Banner = ({
  src,
  headingText,
  subHeadingText,
  logo,
  twitterVerification,
  ownerAddress,
}: {
  src?: string;
  headingText: string;
  subHeadingText?: string;
  logo: string;
  twitterVerification?: string;
  social?: StorefrontSocialInfo;
  ownerAddress?: string;
}) => {
  const wallet = useWallet();
  const { whitelistedCreatorsByCreator } = useMeta();
  const creators = Object.values(whitelistedCreatorsByCreator);

  const connection = useConnection();
  const [isOpen, setIsOpen] = useState(false);
  // const [isShowing, setIsShowing] = useState(false)
  function closeModal() {
    setIsOpen(false);
  }

  function openModal() {
    setIsOpen(true);
  }

  const FollowButton = () => (
    <button className="flex   items-center justify-center transition-all rounded-full !bg-primary !px-6 !py-2 !text-base !font-medium  !text-gray-900  hover:!bg-primary-hover !text-color-text-accent !font-theme-title">
      Follow
    </button>
  );

  const TwitPic = ({ twh }: { twh?: string }) => {
    
  const { data, isLoading, error } = useGQLQuery('handle', GET_PROFILEPIC, {
    handle: twh
  })
  if (isLoading) console.log('Loading...');
  if (error) console.log('Error');
  
 const imgurl = `${data?.profile?.profileImageUrlHighres}`
  
 return (
   <div className='rounded-full overflow-hidden'> <img src={imgurl} alt="" /> </div> 
 )

 }

  

  

  const CreatedByAvatars = ({ className }: { className?: string }) => (
    <div onClick={openModal} className={'flex cursor-pointer items-center ' + className}>
      
      <div> Created by </div>

      <div className="flex -space-x-2 overflow-hidden pl-2">
        {creators.map((m) => {
          const creatorAddress = m.info.address;
          const [creatorTwitterHandle, setCreatorTwitterHandle] = useState('');
          useEffect(() => {
            getTwitterHandle(connection, creatorAddress).then(
              (tw) => tw && setCreatorTwitterHandle(tw)
            );
          }, []);

          const [pOpen, setPOpen] = useState(false);

          const [copied, setCopeied] = useState(false);
          const copyPubKey = async () => {
            if (creatorAddress) {
              await navigator.clipboard.writeText(creatorAddress);
              setCopeied(true);
              setTimeout(() => setCopeied(false), 2000);
            }
          };

          return (
            // <a
            //   href={`https://www.holaplex.com/profiles/${creatorAddress}`}
            //   key={creatorAddress}
            //   target="_blank"
            //   rel="noreferrer"
            // >
            <Tooltip
              key={creatorAddress}
              title={creatorTwitterHandle || shortenAddress(creatorAddress)}
              mouseEnterDelay={0.09}
              overlayStyle={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'white',
              }}
            >
              <Popover>
                {() => (
                  <div>
                    <Popover.Button
                      onClick={() => setPOpen(!pOpen)}
                      onMouseEnter={() => setPOpen(true)}
                      className={classNames('flex items-center', pOpen && 'z-50')}

                      // onMouseLeave={() => setPOpen(false)}
                    > 
                    
                      
                    {
                       (creatorTwitterHandle!=undefined && creatorTwitterHandle!=null)? 
                        <TwitPic twh={creatorTwitterHandle} /> 
                       : 
                       <Identicon size={22} address={creatorAddress} />
                    }
                    
                    </Popover.Button>

                    <Transition
                      enter="transition duration-300 ease-out"
                      enterFrom="transform scale-0 opacity-0"
                      enterTo="transform scale-100 opacity-100"
                      leave="transition duration-300 ease-out"
                      leaveFrom="transform scale-100 opacity-100"
                      leaveTo="transform scale-0 opacity-0"
                    >
                      {false && (
                        <Popover.Panel
                          static
                          className=" absolute z-50 w-full max-w-xs translate-x-3 overflow-y-auto  "
                        >
                          <div className="mb-3 w-full flex-row">
                            <div className=" relative w-full flex-col rounded-md border border-white/50 bg-gray-900 p-3 pl-4">
                              <div className="flex items-center justify-between">
                                <Identicon size={40} address={creatorAddress} />

                                <a
                                  href={`https://www.holaplex.com/profiles/${creatorAddress}?action=follow`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <FollowButton />
                                </a>
                              </div>
                              <div className="mt-4 flex items-center">
                                <a
                                  href={`https://www.holaplex.com/profiles/${creatorAddress}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <div
                                    className={classNames(
                                      'text-2xl',
                                      creatorTwitterHandle ? 'font-sans' : 'font-mono'
                                    )}
                                  >
                                    {creatorTwitterHandle
                                      ? `@${creatorTwitterHandle}`
                                      : shortenAddress(creatorAddress)}
                                  </div>
                                </a>
                                {copied ? (
                                  <CheckIcon className="ml-4 h-7 w-7  hover:text-gray-300" />
                                ) : (
                                  <DuplicateIcon
                                    className="ml-4 h-7 w-7 cursor-pointer  hover:text-gray-300"
                                    onClick={copyPubKey}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </Popover.Panel>
                      )}
                    </Transition>
                  </div>
                )}
              </Popover>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div id="metaplex-banner">
        {src ? (
          <img id="metaplex-banner-backdrop" src={src} />
        ) : (
          <div className="metaplex-margin-top-12"></div>
        )}
        <div className="logo-wrapper">
          <Link to="/" id="metaplex-header-logo">
            <img src={logo || ''} />
          </Link>
        </div>
        <div id="metaplex-banner-hero">
          <h1>{headingText}</h1>
          {subHeadingText && <Text>{subHeadingText}</Text>}
          {!twitterVerification &&
            wallet.connected &&
            ownerAddress === wallet.publicKey?.toBase58() && (
              <div className="metaplex-margin-top-8">
                <Alert
                  className="metaplex-flex-align-items-center metaplex-align-left"
                  message="Connect your Twitter account"
                  description={
                    <>
                      Help protect collectors by connecting your store to a Twitter page on{' '}
                      <a
                        href="https://naming.bonfida.org/#/twitter-registration"
                        rel="noreferrer"
                        target="_blank"
                      >
                        Bonfida
                      </a>
                    </>
                  }
                  icon={<TwitterOutlined />}
                  showIcon
                />
              </div>
            )}
          {!twitterVerification ? (
            <div className="mt-4 flex justify-center">
              <CreatedByAvatars />
            </div>
          ) : (
            <div className="flex flex-wrap justify-between pt-4 ">
              <div className=" flex justify-end sm:w-2/5">
                <a
                  href={'https://twitter.com/' + twitterVerification}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-gray-300"
                >
                  <Button
                    type="text"
                    block
                    className="!flex !items-center !p-0 "
                    shape="round"
                    icon={
                      <TwitterOutlined style={{ fontSize: '18px', verticalAlign: 'text-top' }} />
                    }
                  >
                    @{twitterVerification}
                  </Button>
                </a>
              </div>

              <div className="hidden items-center justify-center sm:flex sm:w-1/5 ">
                <h3 className="text-primary">|</h3>
              </div>

              <CreatedByAvatars className="justify-start sm:w-2/5" />
            </div>
          )}
        </div>

        <Transition appear show={isOpen} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 z-10 overflow-y-auto"
            open={isOpen}
            onClose={closeModal}
          >
            <div className="min-h-screen px-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Dialog.Overlay className="fixed inset-0 bg-gray-800 bg-opacity-40 backdrop-blur-lg" />
              </Transition.Child>
              {/* This element is to trick the browser into centering the modal contents. */}
              <span className="inline-block h-screen align-middle" aria-hidden="true">
                &#8203;
              </span>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <div className="inline-block w-full max-w-md relative pt-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-base shadow-xl rounded-2xl ">
                  <XIcon
                    className="absolute top-4 right-4 h-6 w-6 cursor-pointer text-white hover:text-gray-100"
                    onClick={closeModal}
                    aria-hidden="true"
                  />
                  <Dialog.Title
                    as="h3"
                    className="border-b-2 pb-4 text-center  font-medium text-white"
                  >
                    Creators
                  </Dialog.Title>
                  <div
                    className={classNames(
                      'h-96 space-y-6 p-6 ',
                      // could be some Windows funk, but without this the scrollbar was always present
                      creators.length > 6 && 'overflow-y-scroll'
                    )}
                  >
                    {creators.map((m) => {
                      const creatorAddress = m.info.address;
                      const [creatorTwitterHandle, setCreatorTwitterHandle] = useState('');
                      useEffect(() => {
                        getTwitterHandle(connection, creatorAddress).then(
                          (tw) => tw && setCreatorTwitterHandle(tw)
                        );
                      }, []);

                      return (
                        <a
                          key={creatorAddress}
                          href={`https://www.holaplex.com/profiles/${creatorAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className=" flex w-full items-center"
                        >
                          <Identicon size={40} address={creatorAddress} />

                          <div
                            className={classNames(
                              'ml-3 mr-auto',
                              creatorTwitterHandle ? 'font-sans' : 'font-mono'
                            )}
                          >
                            {creatorTwitterHandle
                              ? `@${creatorTwitterHandle}`
                              : shortenAddress(creatorAddress)}
                          </div>

                          {/* <Button className="!rounded-full !text-color-text-accent !font-theme-title !bg-white mt-3 right-4 sm:flex items-center ml-auto "> */}
                          <FollowButton />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
};
