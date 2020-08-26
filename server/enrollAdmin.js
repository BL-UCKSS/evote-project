/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const FabricCAServices = require('fabric-ca-client');
const { FileSystemWallet, X509WalletMixin } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// capture network variables from config.json
const configPath = path.join(process.cwd(), './config.json');
const configJSON = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configJSON);

// let connection_file = config.connection_file;
let appAdmin = config.appAdmin;
let appAdminSecret = config.appAdminSecret;
let orgMSPID = config.orgMSPID;
let caName = config.caName;

const ccpPath = path.join(process.cwd(), '/../network/', config.connection_file);
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

async function main() {
  try {

    // Create a new CA client for interacting with the CA.
    const caURL = caName;
    const caInfo = ccp.certificateAuthorities[caURL];
    const caTLSCACerts = caInfo.tlsCACerts.pem;
    const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);
    //const ca = new FabricCAServices(caURL);

    // Create a new file system based wallet for managing identities.
    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = new FileSystemWallet(walletPath);
    console.log(`Wallet path: ${walletPath}`);

    // Check to see if we've already enrolled the admin user.
    const adminExists = await wallet.exists(appAdmin);
    if (adminExists) {
      console.log('An identity for the admin user "admin" already exists in the wallet');
      return;
    }

    // Enroll the admin user, and import the new identity into the wallet.
    const enrollment = await ca.enroll({ enrollmentID: appAdmin, enrollmentSecret: appAdminSecret });

    //////////////
    /*const fixtures = path.resolve('C:\\Users\\WhiteHat\\fabric-samples\\network\\');
    const credPath = path.join(fixtures, '/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com');
    const cert = fs.readFileSync(path.join(credPath, '/msp/signcerts/Admin@org1.example.com-cert.pem')).toString();
    const key = fs.readFileSync(path.join(credPath, '/msp/keystore/7869beb411910e4e1fed8096f2717d66ed7debb1eb0dacef470aba1d0a88ea6c_sk')).toString();

    // Load credentials into wallet
    const identityLabel = 'Admin@org1.example.com';
    const identity = X509WalletMixin.createIdentity('Org1MSP', cert, key);

    await wallet.import(identityLabel, identity);*/
    //////////////

    const identity = X509WalletMixin.createIdentity(orgMSPID, enrollment.certificate, enrollment.key.toBytes());
    wallet.import(appAdmin, identity);
    console.log('msg: Successfully enrolled admin user ' + appAdmin + ' and imported it into the wallet');

  } catch (error) {
    console.error(`Failed to enroll admin user ' + ${appAdmin} + : ${error}`);
    process.exit(1);
  }
}

main();