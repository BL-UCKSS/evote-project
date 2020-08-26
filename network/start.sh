./evotenetwork.sh generate
./evotenetwork.sh up -s couchdb
cd ../server/
node enrollAdmin.js