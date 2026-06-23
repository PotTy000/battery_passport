import { useEffect, useMemo, useState } from "react";
import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import "./App.css";
import { CONTRACT_ID } from "./contractConfig";

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

type TxStatus = "Idle" | "Pending" | "Success" | "Failed";

type Passport = {
  serial?: string;
  chemistry?: string;
  capacity_wh?: number;
  carbon_kg?: number;
  manufacturer?: string;
  owner?: string;
  recycled?: boolean;
  recycler?: string | null;
};

function mapContractError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Contract, #1")) {
    return "Serial already exists. This battery passport has already been created.";
  }

  if (message.includes("Contract, #2")) {
    return "Passport not found. Please check the battery serial number.";
  }

  if (message.includes("Contract, #3")) {
    return "This battery has already been recycled.";
  }

  if (message.includes("Contract, #4")) {
    return "Unauthorized. Only the current owner can update this battery passport.";
  }

  if (message.toLowerCase().includes("rejected")) {
    return "Transaction rejected by wallet.";
  }

  if (message.toLowerCase().includes("insufficient")) {
    return "Insufficient balance. Please fund your Testnet wallet.";
  }

  if (message.toLowerCase().includes("wallet not connected")) {
    return "Wallet not connected. Please connect wallet first.";
  }

  return message;
}

function shortenAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function normalizePassport(value: unknown): Passport {
  if (!value || typeof value !== "object") return {};

  const record = value as Record<string, unknown>;

  return {
    serial: String(record.serial ?? ""),
    chemistry: String(record.chemistry ?? ""),
    capacity_wh: Number(record.capacity_wh ?? 0),
    carbon_kg: Number(record.carbon_kg ?? 0),
    manufacturer: String(record.manufacturer ?? ""),
    owner: String(record.owner ?? ""),
    recycled: Boolean(record.recycled ?? false),
    recycler: record.recycler ? String(record.recycler) : null,
  };
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState<TxStatus>("Idle");
  const [message, setMessage] = useState("Ready.");
  const [txHash, setTxHash] = useState("");
  const [passport, setPassport] = useState<Passport | null>(null);
  const [activityFeed, setActivityFeed] = useState<string[]>([]);

  const [serial, setSerial] = useState("BATTERY-FRONTEND-002");
  const [chemistry, setChemistry] = useState("LFP");
  const [capacityWh, setCapacityWh] = useState("75000");
  const [carbonKg, setCarbonKg] = useState("420");
  const [manufacturer, setManufacturer] = useState("VinFast Battery Lab");
  const [searchSerial, setSearchSerial] = useState("BATTERY-FRONTEND-002");

  const server = useMemo(() => new rpc.Server(RPC_URL), []);
  const contract = useMemo(() => new Contract(CONTRACT_ID), []);

  useEffect(() => {
    StellarWalletsKit.init({
      modules: defaultModules(),
    });
  }, []);

  function addActivity(text: string) {
    setActivityFeed((current) => [text, ...current].slice(0, 8));
  }

  async function connectWallet() {
    try {
      setStatus("Pending");
      setMessage("Opening wallet options...");

      const { address } = await StellarWalletsKit.authModal();

      setWalletAddress(address);
      setStatus("Success");
      setMessage(`Wallet connected: ${shortenAddress(address)}`);
      addActivity(`Wallet connected: ${shortenAddress(address)}`);
    } catch (error) {
      setStatus("Failed");
      setMessage(mapContractError(error));
      addActivity(`Wallet connection failed: ${mapContractError(error)}`);
    }
  }

  async function loadConnectedWallet() {
    try {
      setStatus("Pending");
      setMessage("Reading connected wallet...");

      const { address } = await StellarWalletsKit.getAddress();

      setWalletAddress(address);
      setStatus("Success");
      setMessage(`Wallet connected: ${shortenAddress(address)}`);
      addActivity(`Wallet connected: ${shortenAddress(address)}`);
    } catch (error) {
      setStatus("Failed");
      setMessage("Please connect a wallet first.");
      addActivity(`Load wallet failed: ${mapContractError(error)}`);
    }
  }

  function disconnectWalletLocally() {
    setWalletAddress("");
    setStatus("Idle");
    setMessage("Wallet disconnected locally.");
    setTxHash("");
    addActivity("Wallet disconnected locally.");
  }

  async function requireWallet() {
    if (walletAddress) return walletAddress;

    try {
      const { address } = await StellarWalletsKit.getAddress();
      setWalletAddress(address);
      return address;
    } catch {
      throw new Error("Wallet not connected. Please connect wallet first.");
    }
  }

  async function submitContractCall(
    method: string,
    args: ReturnType<typeof nativeToScVal>[]
  ) {
    const publicKey = await requireWallet();

    setStatus("Pending");
    setMessage(`Submitting ${method} transaction...`);
    setTxHash("");

    const sourceAccount = await server.getAccount(publicKey);

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(60)
      .build();

    const preparedTransaction = await server.prepareTransaction(transaction);

    const { signedTxXdr } = await StellarWalletsKit.signTransaction(
      preparedTransaction.toXDR(),
      {
        address: publicKey,
        networkPassphrase: NETWORK_PASSPHRASE,
      }
    );

    const signedTransaction = TransactionBuilder.fromXDR(
      signedTxXdr,
      NETWORK_PASSPHRASE
    ) as Transaction;

    const sendResponse = await server.sendTransaction(signedTransaction);

    if (sendResponse.status === "ERROR") {
      throw new Error(JSON.stringify(sendResponse.errorResult));
    }

    const hash = sendResponse.hash;
    setTxHash(hash);
    setMessage(`Transaction submitted: ${hash}`);

    for (let index = 0; index < 20; index += 1) {
      const response = await server.getTransaction(hash);

      if (response.status === "SUCCESS") {
        setStatus("Success");
        setMessage(`${method} success. Transaction confirmed on Stellar Testnet.`);
        return hash;
      }

      if (response.status === "FAILED") {
        throw new Error("Transaction failed on Stellar Testnet.");
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    setStatus("Success");
    setMessage(`${method} submitted. Confirmation is still pending.`);
    return hash;
  }

  async function simulateContractCall(
    method: string,
    args: ReturnType<typeof nativeToScVal>[]
  ) {
    const publicKey = await requireWallet();

    const sourceAccount = await server.getAccount(publicKey);

    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(60)
      .build();

    const simulation = await server.simulateTransaction(transaction);
    const simulationResult = simulation as any;

    if (simulationResult.error) {
      throw new Error(simulationResult.error);
    }

    if (!simulationResult.result?.retval) {
      throw new Error("No data returned from contract.");
    }

    return scValToNative(simulationResult.result.retval);
  }

  async function createPassport() {
    try {
      const owner = await requireWallet();

      const hash = await submitContractCall("create_passport", [
        new Address(owner).toScVal(),
        nativeToScVal(serial, { type: "string" }),
        nativeToScVal(chemistry, { type: "string" }),
        nativeToScVal(Number(capacityWh), { type: "u32" }),
        nativeToScVal(Number(carbonKg), { type: "u32" }),
        nativeToScVal(manufacturer, { type: "string" }),
      ]);

      setTxHash(hash);
      setSearchSerial(serial);
      setPassport(null);

      setStatus("Success");
      setMessage(
        `create_passport success. Transaction confirmed on Stellar Testnet.`
      );

      addActivity(`Passport created for ${serial}`);
    } catch (error) {
      setStatus("Failed");
      setMessage(mapContractError(error));
      addActivity(`Create passport failed: ${mapContractError(error)}`);
    }
  }

  async function readPassport(serialToRead = searchSerial) {
    try {
      setStatus("Pending");
      setMessage(`Reading passport ${serialToRead}...`);

      const result = await simulateContractCall("get_passport", [
        nativeToScVal(serialToRead, { type: "string" }),
      ]);

      const normalized = normalizePassport(result);
      setPassport(normalized);
      setStatus("Success");
      setMessage(`Passport found: ${serialToRead}`);
      addActivity(`Passport read: ${serialToRead}`);
    } catch (error) {
      setPassport(null);
      setStatus("Failed");
      setMessage(mapContractError(error));
      addActivity(`Read passport failed: ${mapContractError(error)}`);
    }
  }

  async function markRecycled() {
    try {
      const owner = await requireWallet();

      const hash = await submitContractCall("mark_recycled", [
        new Address(owner).toScVal(),
        nativeToScVal(searchSerial, { type: "string" }),
        new Address(owner).toScVal(),
      ]);

      setTxHash(hash);
      setStatus("Success");
      setMessage(
        `mark_recycled success. Transaction confirmed on Stellar Testnet.`
      );

      addActivity(`Battery recycled: ${searchSerial}`);
    } catch (error) {
      setStatus("Failed");
      setMessage(mapContractError(error));
      addActivity(`Recycle failed: ${mapContractError(error)}`);
    }
  }

  async function triggerNotFoundError() {
    setSearchSerial("UNKNOWN-BATTERY");
    await readPassport("UNKNOWN-BATTERY");
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Stellar Level 2 dApp</p>
          <h1>Battery Passport Registry</h1>
          <p className="subtitle">
            Create tamper-proof digital passports for EV and consumer-electronics
            batteries on Stellar Testnet.
          </p>
        </div>

        <div className="wallet-card">
          <p className="label">Wallet</p>

          <button onClick={connectWallet}>Connect Wallet / Show Wallet Options</button>

          <button className="secondary" onClick={loadConnectedWallet}>
            Load Connected Wallet
          </button>

          {walletAddress ? (
            <>
              <strong>{shortenAddress(walletAddress)}</strong>
              <button className="secondary" onClick={disconnectWalletLocally}>
                Disconnect Locally
              </button>
            </>
          ) : (
            <small>
              Click Connect Wallet to open wallet options. Use Freighter on
              Stellar Testnet.
            </small>
          )}
        </div>
      </section>

      <section className={`status ${status.toLowerCase()}`}>
        <div>
          <p className="label">Transaction Status</p>
          <strong>{status}</strong>
        </div>

        <p>{message}</p>

        {txHash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction on Stellar Expert
          </a>
        )}
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Create Battery Passport</h2>

          <label>
            Serial number
            <input
              value={serial}
              onChange={(event) => setSerial(event.target.value)}
            />
          </label>

          <label>
            Chemistry
            <input
              value={chemistry}
              onChange={(event) => setChemistry(event.target.value)}
            />
          </label>

          <label>
            Capacity Wh
            <input
              value={capacityWh}
              onChange={(event) => setCapacityWh(event.target.value)}
            />
          </label>

          <label>
            Carbon footprint kgCO2e
            <input
              value={carbonKg}
              onChange={(event) => setCarbonKg(event.target.value)}
            />
          </label>

          <label>
            Manufacturer
            <input
              value={manufacturer}
              onChange={(event) => setManufacturer(event.target.value)}
            />
          </label>

          <button onClick={createPassport}>Create Passport</button>

          <button className="danger" onClick={createPassport}>
            Trigger Duplicate Serial Error
          </button>
        </div>

        <div className="panel">
          <h2>Read / Recycle Passport</h2>

          <label>
            Serial to read or recycle
            <input
              value={searchSerial}
              onChange={(event) => setSearchSerial(event.target.value)}
            />
          </label>

          <div className="button-row">
            <button onClick={() => readPassport()}>Read Passport</button>
            <button onClick={markRecycled}>Mark Recycled</button>
          </div>

          <div className="button-row">
            <button className="danger" onClick={triggerNotFoundError}>
              Trigger Not Found Error
            </button>
            <button className="danger" onClick={markRecycled}>
              Trigger Already Recycled Error
            </button>
          </div>

          {passport && (
            <div className="passport">
              <h3>Passport Data</h3>
              <p>
                <span>Serial:</span> {passport.serial}
              </p>
              <p>
                <span>Chemistry:</span> {passport.chemistry}
              </p>
              <p>
                <span>Capacity:</span> {passport.capacity_wh} Wh
              </p>
              <p>
                <span>Carbon:</span> {passport.carbon_kg} kgCO2e
              </p>
              <p>
                <span>Manufacturer:</span> {passport.manufacturer}
              </p>
              <p>
                <span>Owner:</span> {passport.owner}
              </p>
              <p>
                <span>Recycled:</span> {passport.recycled ? "Yes" : "No"}
              </p>
              <p>
                <span>Recycler:</span> {passport.recycler ?? "None"}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Contract Info</h2>
        <p>
          <span className="label">Contract ID:</span> {CONTRACT_ID}
        </p>
        <p>
          <span className="label">Network:</span> Stellar Testnet
        </p>
      </section>

      <section className="panel">
        <h2>Activity Feed</h2>
        {activityFeed.length === 0 ? (
          <p>No activity yet.</p>
        ) : (
          <ul>
            {activityFeed.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}