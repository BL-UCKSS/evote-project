mkdir -p crypto-config
mkdir -p channel-artifacts
./evotenetwork.sh generate
./evotenetwork.sh up -s couchdb
cd ../server/
node enrollAdmin.js