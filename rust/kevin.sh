rm -rf ./dist/metaplex/metaplex-keypair.json
rm -rf metaplex.so
cargo build-bpf --manifest-path=./metaplex/program/Cargo.toml --bpf-out-dir=./dist/metaplex
solana airdrop 5 && solana program deploy ./dist/metaplex/metaplex.so --program-id ./dist/metaplex/hkevC3CDmdphvvg1zgxfBA8Z18zWXH4g34cSp1zX6dc.json