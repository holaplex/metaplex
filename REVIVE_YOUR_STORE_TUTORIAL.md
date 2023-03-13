# Revive your OG Holaplex Storefront

## Steps

### Get private Solana RPC
* Use [Quicknode](https://www.quicknode.com/), for our purposes its free, quick and easy

### Setup your environment
* Install Node.js and npm
	* https://nodejs.org/en/download/
* Install Yarn 
  * https://classic.yarnpkg.com/lang/en/docs/install/
  * `npm install --global yarn`
* Install Node Version Manager (NVM) 
  * https://github.com/nvm-sh/nvm/blob/master/README.md#installing-and-updating
* Install node ver 16.14.0
  * https://github.com/nvm-sh/nvm/blob/master/README.md#usage
  * `nvm install 16.14.0 && nvm use 16.14.0`


### Setup & run storefront
* Clone the GitHub repo
	* https://github.com/holaplex/metaplex
	* `git clone https://github.com/holaplex/metaplex`
* Follow README.MD steps
```
$ cd metaplex/js
$ yarn install && yarn bootstrap && yarn build
$ docker-compose up -d
```
* Edit `metaplex/js/packages/common/src/contexts/connection.tsx` 
  * On Line 51, replace the URL with your RPC URL starting with `https://`
* Start the storefront from the `metaplex/js` folder
	* `SUBDOMAIN="YOUR-SUBDOMAIN" yarn start`
	* If you’re on windows first run 
		* `set SUBDOMAIN=YOUR-SUBDOMAIN`
		* then `yarn start`
* Visit the storefront at the following url http://localhost:3000
* To administer the storefront connect using Solflare wallet, I couldn’t get any other wallet provider to work.
