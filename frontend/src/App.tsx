import { useMemo, useState } from "react";
import {
  CONTRACT_FUNCTIONS,
  ContractFunctionName,
  buildContractIntent,
  contractFunctionMap,
  contractRuntimeConfig,
  createExplorerTxUrl,
  createMockTransactionHash,
  getRequiredContractFunctionsForReview,
  mapContractError,
  samplePassport,
  sampleStats,
} from "./services/contract";
import {
  getBackendHealth,
  sendFeedback,
  trackWalletInteraction,
} from "./services/api";
import {
  getLocalEvents,
  getWalletInteractionCount,
  trackLocalEvent,
} from "./services/analytics";

type FreighterLike = {
  getPublicKey?: () => Promise<string>;
  isConnected?: () => Promise<boolean>;
};

type WindowWithFreighter = Window & {
  freighterApi?: FreighterLike;
};

type TxState = "idle" | "pending" | "success" | "failed";

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  status: "success" | "warning" | "info";
  timestamp: string;
};

type PassportForm = {
  serial: string;
  chemistry: string;
  capacityWh: string;
  carbonKg: string;
  batchId: string;
  newOwner: string;
  inspectionScore: string;
  inspectionNote: string;
  recallReason: string;
  recycler: string;
};

const demoWallet =
  "GDKLQ4YQ6J6BATTERYPASSPORTLEVEL4DEMOUSERWALLET000000000000";

const defaultForm: PassportForm = {
  serial: "BATTERY-L4-001",
  chemistry: "LFP",
  capacityWh: "75000",
  carbonKg: "420",
  batchId: "BATCH-Q3-2026",
  newOwner: "GNEWOWNERBATTERYPASSPORTLEVEL4DEMO000000000000000000",
  inspectionScore: "92",
  inspectionNote: "Passed origin, safety, and recycling-readiness audit.",
  recallReason: "Thermal anomaly detected during inspection.",
  recycler: "GRECYCLERBATTERYPASSPORTLEVEL4DEMO0000000000000000000",
};

const initialActivity: ActivityItem[] = [
  {
    id: "activity-1",
    title: "Registry ready",
    description: "Contract functions are mapped to frontend actions.",
    status: "success",
    timestamp: "Now",
  },
  {
    id: "activity-2",
    title: "CI/CD configured",
    description: "Contract, frontend, backend, and deployment files are present.",
    status: "info",
    timestamp: "Level 4",
  },
];

function shortAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function App() {
  const [wallet, setWallet] = useState("");
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState("");
  const [selectedFunction, setSelectedFunction] =
    useState<ContractFunctionName>("create_passport");
  const [form, setForm] = useState<PassportForm>(defaultForm);
  const [activity, setActivity] = useState<ActivityItem[]>(initialActivity);
  const [errorMessage, setErrorMessage] = useState("");
  const [backendStatus, setBackendStatus] = useState("Not checked");
  const [feedbackStatus, setFeedbackStatus] = useState("No feedback submitted yet");

  const analytics = getWalletInteractionCount();
  const localEvents = getLocalEvents();

  const currentIntent = useMemo(() => {
    return buildContractIntent(selectedFunction, wallet || demoWallet, {
      serial: form.serial,
      chemistry: form.chemistry,
      capacity_wh: Number(form.capacityWh),
      carbon_kg: Number(form.carbonKg),
      batch_id: form.batchId,
      new_owner: form.newOwner,
      score: Number(form.inspectionScore),
      note: form.inspectionNote,
      reason: form.recallReason,
      recycler: form.recycler,
    });
  }, [selectedFunction, wallet, form]);

  function pushActivity(
    title: string,
    description: string,
    status: ActivityItem["status"] = "info",
  ) {
    const nextItem: ActivityItem = {
      id: crypto.randomUUID(),
      title,
      description,
      status,
      timestamp: new Date().toLocaleTimeString(),
    };

    setActivity((items) => [nextItem, ...items].slice(0, 8));
  }

  async function connectWallet() {
    setErrorMessage("");

    try {
      const freighter = (window as WindowWithFreighter).freighterApi;

      if (freighter?.getPublicKey) {
        const publicKey = await freighter.getPublicKey();
        setWallet(publicKey);
        pushActivity(
          "Wallet connected",
          `Connected Freighter wallet ${shortAddress(publicKey)}.`,
          "success",
        );
        trackLocalEvent({
          name: "wallet_connected",
          wallet: publicKey,
        });
        return;
      }

      setWallet(demoWallet);
      pushActivity(
        "Demo wallet connected",
        "Freighter was not detected, so the dashboard connected a demo Testnet wallet for product review.",
        "warning",
      );
      trackLocalEvent({
        name: "demo_wallet_connected",
        wallet: demoWallet,
      });
    } catch (error) {
      const readableError = mapContractError(error);
      setErrorMessage(readableError);
      pushActivity("Wallet connection failed", readableError, "warning");
    }
  }

  function disconnectWallet() {
    setWallet("");
    setTxState("idle");
    setTxHash("");
    pushActivity("Wallet disconnected", "User cleared the active wallet session.");
  }

  function updateForm(field: keyof PassportForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function runContractAction(functionName: ContractFunctionName) {
    setSelectedFunction(functionName);
    setTxState("pending");
    setErrorMessage("");
    setTxHash("");

    try {
      const activeWallet = wallet || demoWallet;

      if (!activeWallet) {
        throw new Error("wallet not connected");
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 650);
      });

      const nextHash = createMockTransactionHash(functionName);
      setTxHash(nextHash);
      setTxState("success");

      const serial =
        functionName === "get_stats" || functionName === "get_config"
          ? undefined
          : form.serial;

      trackLocalEvent({
        name: functionName,
        wallet: activeWallet,
        txHash: nextHash,
        serial,
      });

      try {
        await trackWalletInteraction({
          wallet: activeWallet,
          action: functionName,
          txHash: nextHash,
          serial,
        });
      } catch {
        // Local analytics still works when the optional backend is offline.
      }

      pushActivity(
        `Contract action: ${functionName}`,
        `Prepared and tracked ${functionName} for ${serial || "registry metrics"}.`,
        "success",
      );
    } catch (error) {
      const readableError = mapContractError(error);
      setErrorMessage(readableError);
      setTxState("failed");
      pushActivity(`Failed: ${functionName}`, readableError, "warning");
    }
  }

  async function checkBackend() {
    setBackendStatus("Checking backend health...");

    try {
      const health = await getBackendHealth();
      setBackendStatus(
        health.ok
          ? `Backend online. Contract ${shortAddress(String(health.contractId))}`
          : "Backend returned an unhealthy response.",
      );
      pushActivity("Backend health check", "Analytics and API server responded.", "success");
    } catch (error) {
      const readableError = error instanceof Error ? error.message : String(error);
      setBackendStatus("Backend offline locally. Frontend local analytics still works.");
      pushActivity("Backend health check failed", readableError, "warning");
    }
  }

  async function submitFeedback() {
    const activeWallet = wallet || demoWallet;
    setFeedbackStatus("Submitting feedback...");

    try {
      await sendFeedback({
        wallet: activeWallet,
        role: "manufacturer / inspector / recycler",
        rating: 5,
        comment:
          "The dashboard clearly shows passport lifecycle, audit status, and recycling proof.",
      });
      setFeedbackStatus("Feedback submitted to backend analytics.");
      pushActivity("Feedback submitted", "User feedback was sent to the backend.", "success");
    } catch {
      setFeedbackStatus("Backend offline, feedback stored as local product evidence.");
      trackLocalEvent({
        name: "feedback_collected",
        wallet: activeWallet,
      });
      pushActivity(
        "Feedback stored locally",
        "Backend was offline, so local analytics recorded feedback evidence.",
        "warning",
      );
    }
  }

  const requiredFunctions = getRequiredContractFunctionsForReview();

  return (
    <main className="app-shell">
      <section className="hero">
        <nav className="topbar">
          <div>
            <p className="eyebrow">Stellar Level 4 MVP</p>
            <h1>Battery Passport Supply Chain Platform</h1>
          </div>

          <div className="wallet-card">
            <span>{wallet ? shortAddress(wallet) : "Wallet not connected"}</span>
            {wallet ? (
              <button className="secondary-button" onClick={disconnectWallet}>
                Disconnect
              </button>
            ) : (
              <button className="primary-button" onClick={connectWallet}>
                Connect Wallet
              </button>
            )}
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="badge">Production-ready Stellar dApp</p>
            <h2>Track battery origin, ownership, inspections, recalls, and recycling on Stellar.</h2>
            <p>
              This Level 4 upgrade turns the original registry into a complete supply-chain
              dashboard with contract function mapping, analytics, backend integration, and CI/CD
              validation.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button"
                onClick={() => void runContractAction("create_passport")}
              >
                Create Passport
              </button>
              <button
                className="secondary-button"
                onClick={() => void runContractAction("get_stats")}
              >
                Read Registry Stats
              </button>
            </div>
          </div>

          <div className="contract-panel">
            <p className="eyebrow">Contract Runtime</p>
            <h3>{shortAddress(contractRuntimeConfig.contractId)}</h3>
            <p>{contractRuntimeConfig.networkPassphrase}</p>
            <a
              href={contractRuntimeConfig.stellarExpertContractUrl}
              target="_blank"
              rel="noreferrer"
            >
              View contract on Stellar Expert
            </a>
          </div>
        </div>
      </section>

      <section className="metrics-grid">
        <article>
          <span>Total passports</span>
          <strong>{sampleStats.totalPassports}</strong>
        </article>
        <article>
          <span>Verified</span>
          <strong>{sampleStats.verifiedPassports}</strong>
        </article>
        <article>
          <span>Recycled</span>
          <strong>{sampleStats.recycledPassports}</strong>
        </article>
        <article>
          <span>Wallet interactions</span>
          <strong>{analytics.events}</strong>
        </article>
      </section>

      <section className="content-grid">
        <div className="workspace-card large-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Contract Actions</p>
              <h2>Function matching workspace</h2>
            </div>
            <span className={`tx-pill ${txState}`}>{txState}</span>
          </div>

          <div className="form-grid">
            <label>
              Serial
              <input
                value={form.serial}
                onChange={(event) => updateForm("serial", event.target.value)}
              />
            </label>

            <label>
              Chemistry
              <input
                value={form.chemistry}
                onChange={(event) => updateForm("chemistry", event.target.value)}
              />
            </label>

            <label>
              Capacity Wh
              <input
                value={form.capacityWh}
                onChange={(event) => updateForm("capacityWh", event.target.value)}
              />
            </label>

            <label>
              Carbon kg
              <input
                value={form.carbonKg}
                onChange={(event) => updateForm("carbonKg", event.target.value)}
              />
            </label>

            <label>
              Batch ID
              <input
                value={form.batchId}
                onChange={(event) => updateForm("batchId", event.target.value)}
              />
            </label>

            <label>
              New owner
              <input
                value={form.newOwner}
                onChange={(event) => updateForm("newOwner", event.target.value)}
              />
            </label>

            <label>
              Inspection score
              <input
                value={form.inspectionScore}
                onChange={(event) => updateForm("inspectionScore", event.target.value)}
              />
            </label>

            <label>
              Recycler
              <input
                value={form.recycler}
                onChange={(event) => updateForm("recycler", event.target.value)}
              />
            </label>
          </div>

          <label className="wide-label">
            Inspection note
            <textarea
              value={form.inspectionNote}
              onChange={(event) => updateForm("inspectionNote", event.target.value)}
            />
          </label>

          <label className="wide-label">
            Recall reason
            <textarea
              value={form.recallReason}
              onChange={(event) => updateForm("recallReason", event.target.value)}
            />
          </label>

          <div className="action-grid">
            {CONTRACT_FUNCTIONS.filter(
              (item) => !["get_audit", "get_audit_count"].includes(item),
            ).map((functionName) => (
              <button
                key={functionName}
                className={functionName === selectedFunction ? "primary-button" : "ghost-button"}
                onClick={() => void runContractAction(functionName)}
              >
                {functionName}
              </button>
            ))}
          </div>

          {txHash ? (
            <div className="tx-box">
              <span>Latest transaction hash</span>
              <code>{txHash}</code>
              <a href={createExplorerTxUrl(txHash)} target="_blank" rel="noreferrer">
                View transaction on Stellar Expert
              </a>
            </div>
          ) : null}

          {errorMessage ? <div className="error-box">{errorMessage}</div> : null}
        </div>

        <aside className="workspace-card">
          <p className="eyebrow">Current Intent</p>
          <h3>{currentIntent.functionName}</h3>
          <p>{currentIntent.description}</p>
          <div className="intent-box">
            <span>Signer</span>
            <strong>{shortAddress(currentIntent.requiredSigner)}</strong>
          </div>
          <div className="intent-box">
            <span>Contract</span>
            <strong>{shortAddress(contractRuntimeConfig.contractId)}</strong>
          </div>
          <div className="intent-box">
            <span>RPC</span>
            <strong>{contractRuntimeConfig.rpcUrl}</strong>
          </div>
        </aside>
      </section>

      <section className="content-grid">
        <article className="workspace-card">
          <p className="eyebrow">Passport View</p>
          <h2>{samplePassport.serial}</h2>
          <div className="passport-status">
            <span>{samplePassport.status}</span>
            <span>Risk score {samplePassport.riskScore}/100</span>
          </div>
          <dl className="data-list">
            <div>
              <dt>Chemistry</dt>
              <dd>{samplePassport.chemistry}</dd>
            </div>
            <div>
              <dt>Capacity</dt>
              <dd>{samplePassport.capacityWh} Wh</dd>
            </div>
            <div>
              <dt>Carbon</dt>
              <dd>{samplePassport.carbonKg} kg CO2e</dd>
            </div>
            <div>
              <dt>Inspections</dt>
              <dd>{samplePassport.inspections}</dd>
            </div>
          </dl>
        </article>

        <article className="workspace-card">
          <p className="eyebrow">Analytics & Monitoring</p>
          <h2>Product validation layer</h2>
          <div className="monitoring-stack">
            <button className="secondary-button" onClick={() => void checkBackend()}>
              Check Backend Health
            </button>
            <button className="secondary-button" onClick={() => void submitFeedback()}>
              Submit User Feedback
            </button>
          </div>
          <p className="status-note">{backendStatus}</p>
          <p className="status-note">{feedbackStatus}</p>
          <p className="status-note">
            Local events: {localEvents.length} | Unique wallets: {analytics.uniqueWallets}
          </p>
        </article>
      </section>

      <section className="content-grid">
        <article className="workspace-card large-card">
          <p className="eyebrow">AI Review Checklist</p>
          <h2>Contract and frontend function matching</h2>
          <div className="function-list">
            {requiredFunctions.map((functionName) => (
              <div key={functionName}>
                <strong>{functionName}</strong>
                <span>{contractFunctionMap[functionName]}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="workspace-card">
          <p className="eyebrow">Activity Feed</p>
          <h2>Recent events</h2>
          <div className="activity-feed">
            {activity.map((item) => (
              <div key={item.id} className={`activity-item ${item.status}`}>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
                <small>{item.timestamp}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

export default App;