# Revive your old Holaplex Storefront

## Prerequisites:
* NodeJS 16.14.0 (use nvm for this)
* Docker-compose 
* Yarn
* Solana RPC (with WS support) 
	* Use [Quicknode](https://www.quicknode.com/), for our purposes its free, quick and easy


## Steps:
* Clone the GitHub repo
	* https://github.com/holaplex/metaplex
* Follow README.MD steps
```
$ cd metaplex/js
$ yarn install && yarn bootstrap && yarn build
$ docker-compose up -d
```
* Edit `metaplex/js/packages/common/src/contexts/connection.tsx` on Line 51, replace the URL with your RPC URL starting with `https://`
* Start the storefront from the `metaplex/js` folder
	* `SUBDOMAIN="YOUR-SUBDOMAIN" yarn start`
	* If you’re on windows first run 
		* `set SUBDOMAIN=YOUR-SUBDOMAIN`
		* then `yarn start`
* Visit the storefront at the following url http://localhost:3000
* To administer the storefront connect using Solflare wallet, I couldn’t get any other wallet provider to work.
