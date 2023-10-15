import React, { useState, useCallback, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useWallet, WalletProvider, ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { Adapter } from '@solana/wallet-adapter-base';
import type { SolanaSignInInput, SolanaSignInOutput } from '@solana/wallet-standard-features';
import { verifySignIn } from '@solana/wallet-standard-util';
import { Transaction, SystemProgram, PublicKey, TransactionInstruction, Connection } from '@solana/web3.js';

import {
  createSignInData,
  createSignInErrorData,
} from './utils';

import { TLog } from './types';

import { Logs, Sidebar, AutoConnectProvider } from './components';
import * as buffer from "buffer";
window.Buffer = buffer.Buffer;
// =============================================================================
// Styled Components
// =============================================================================

const StyledApp = styled.div`
  display: flex;
  flex-direction: row;
  height: 100vh;
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

// =============================================================================
// Constants
// =============================================================================

const message = 'To avoid digital dognappers, sign below to authenticate with CryptoCorgis.';

// =============================================================================
// Typedefs
// =============================================================================

export type ConnectedMethods =
  | {
    name: string;
    onClick: () => Promise<string>;
  }
  | {
    name: string;
    onClick: () => Promise<void>;
  };


const StatelessApp = () => {
  const { wallet, publicKey, connect, disconnect, signMessage, signIn } = useWallet();
  const [logs, setLogs] = useState<TLog[]>([]);

  const createLog = useCallback(
    (log: TLog) => {
      return setLogs((logs) => [...logs, log]);
    },
    [setLogs]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, [setLogs]);

  useEffect(() => {
    if (!publicKey || !wallet) return;

    createLog({
      status: 'success',
      method: 'connect',
      message: `Connected to account ${publicKey.toBase58()}`,
    });
  }, [createLog, publicKey, wallet]);

  /** SignMessage */
  const handleSignMessage = useCallback(async () => {
    if (!publicKey || !wallet) return;

    try {
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);

      createLog({
        status: 'success',
        method: 'signMessage',
        message: `Message signed with signature: ${JSON.stringify(signature)}`,
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signMessage',
        message: error.message,
      });
    }
  }, [createLog, publicKey, signMessage, wallet]);


  /** SignIn */
  const handleSignIn = useCallback(async () => {
    if (!publicKey || !wallet) return;
    const signInData = await createSignInData();

    try {
      const {account, signedMessage, signature} = await signIn(signInData);

      const eventDetail = {
        account: account.address,
        signedMessage: signedMessage.toString(),
        signature: signature.toString(),
      };

      // Create the custom event
      const signedInEvent = new CustomEvent('signedIn', { detail: eventDetail });

      window.dispatchEvent(signedInEvent);
      createLog({
        status: 'success',
        method: 'signIn',
        message: `Signed in by ${account.address}`,
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signIn',
        message: error.message,
      });
    }
  }, [createLog, publicKey, signIn, wallet]);

  const handleTestMint = useCallback(async () => {
    const connection = new Connection(`https://api.devnet.solana.com`);
    if (!publicKey || !wallet) return;
    const lamportsToSend = 1000000000;    // 1 Sol
    const destinationPublicKey = new PublicKey('C6Poayig1gzHsgEwXZhJJKJG1VHHWQBqKc32mw5TasFj');
    let transaction = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: destinationPublicKey,
            lamports: lamportsToSend,
        })
    );
    const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    const memoInstruction = new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from('{"index": "db25f1c8abe44f57ce60bcb248f533ec", "recommender" :"76CSouD3eC8PRMXXj9u2Es5DYngLyChH3PNcbmEQHSSM" }'),
    });
    transaction.add(memoInstruction);
    try {
      let { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
    
      if (wallet) { // && wallet.readyState === WalletReadyState.CONNECTED) {
        const signedTransaction = await wallet.adapter.sendTransaction(transaction, connection);
        // let txId = await connection.sendRawTransaction(signedTransaction.serialize());
        createLog({
          status: 'success',
          method: 'signMessage',
          message: `Transaction was sent with ID: ${signedTransaction}`,
        });
      } else {
        throw new Error('Wallet is not connected');
      }
  } catch (err) {
    createLog({
      status: 'error',
      method: 'signMessage',
      message: `Error sending transaction: ${err}`,
    });
    console.error("Error sending transaction:", err);
  }

  }, [createLog, publicKey, signIn, wallet]);

  /** SignInError */
  const handleSignInError = useCallback(async () => {
    if (!publicKey || !wallet) return;
    const signInData = await createSignInErrorData();

    try {
      const {account, signedMessage, signature} = await signIn(signInData);
      createLog({
        status: 'success',
        method: 'signMessage',
        message: `Message signed: ${JSON.stringify(signedMessage)} by ${account.address} with signature ${JSON.stringify(signature)}`,
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'signIn',
        message: error.message,
      });
    }
  }, [createLog, publicKey, signIn, wallet]);

  /** Connect */
  const handleConnect = useCallback(async () => {
    if (!publicKey || !wallet) return;

    try {
      await connect();
    } catch (error) {
      createLog({
        status: 'error',
        method: 'connect',
        message: error.message,
      });
    }
  }, [connect, createLog, publicKey, wallet]);

  /** Disconnect */
  const handleDisconnect = useCallback(async () => {
    if (!publicKey || !wallet) return;

    try {
      await disconnect();
      createLog({
        status: 'warning',
        method: 'disconnect',
        message: '👋',
      });
    } catch (error) {
      createLog({
        status: 'error',
        method: 'disconnect',
        message: error.message,
      });
    }
  }, [createLog, disconnect, publicKey, wallet]);

  const connectedMethods = useMemo(() => {
    return [
      {
        name: 'Sign In To Extension',
        onClick: handleSignIn,
      },
      {
        name: 'Disconnect',
        onClick: handleDisconnect,
      },
      {
        name: 'Test Purchase cNFT',
        onClick: handleTestMint,
      },
    ];
  }, [
    handleSignMessage,
    handleSignIn,
    handleSignInError,
    handleDisconnect,
  ]);

  return (
    <StyledApp>
      <Sidebar publicKey={publicKey} connectedMethods={connectedMethods} connect={handleConnect} />
      {/* <Logs publicKey={publicKey} logs={logs} clearLogs={clearLogs} /> */}
    </StyledApp>
  );
};

// =============================================================================
// Main Component
// =============================================================================
const App = () => {
  const network = WalletAdapterNetwork.Devnet;

  const endpoint = `https://api.devnet.solana.com`;
  const wallets = useMemo(
    () => [], // confirmed also with `() => []` for wallet-standard only
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network]
  );

  const autoSignIn = useCallback(async (adapter: Adapter) => {
    if (!('signIn' in adapter)) return true;

    // Fetch the signInInput from the backend
    /*
    const createResponse = await fetch("/backend/createSignInData");
    const input: SolanaSignInInput = await createResponse.json();
    */
    const input: SolanaSignInInput = await createSignInData();

    // Send the signInInput to the wallet and trigger a sign-in request
    const output = await adapter.signIn(input);
    const constructPayload = JSON.stringify({input, output});

    // Verify the sign-in output against the generated input server-side
    /*
    const verifyResponse = await fetch("/backend/verifySIWS", {
      method: "POST",
      body: strPayload,
    });
    const success = await verifyResponse.json();
    */

    /* ------------------------------------ BACKEND ------------------------------------ */
    // "/backend/verifySIWS" endpoint, `constructPayload` receieved
    const deconstructPayload: { input: SolanaSignInInput; output: SolanaSignInOutput } = JSON.parse(constructPayload);
    const backendInput = deconstructPayload.input;
    const backendOutput: SolanaSignInOutput = {
      account: {
        publicKey: new Uint8Array(output.account.publicKey),
        ...output.account
      },
      signature: new Uint8Array(output.signature),
      signedMessage: new Uint8Array(output.signedMessage),
    };

    if (!verifySignIn(backendInput, backendOutput)) {
      console.error('Sign In verification failed!')
      throw new Error('Sign In verification failed!');
    }
    /* ------------------------------------ BACKEND ------------------------------------ */

    return false;
  }, []);

  const autoConnect = useCallback(async (adapter: Adapter) => {
    adapter.autoConnect().catch((e) => {
      return autoSignIn(adapter);
    });
    return false;
  }, [autoSignIn]);

  return (
    <AutoConnectProvider>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect={autoConnect}>
          <WalletModalProvider>
            <StatelessApp />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </AutoConnectProvider>
  );
};

export default App;
