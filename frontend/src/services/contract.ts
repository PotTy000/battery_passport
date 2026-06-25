import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  STELLAR_EXPERT_CONTRACT_URL,
  STELLAR_EXPERT_TX_URL,
} from "../contractConfig";

export const CONTRACT_FUNCTIONS = [
  "initialize",
  "create_passport",
  "transfer_owner",
  "add_inspection",
  "verify_passport",
  "flag_recall",
  "mark_recycled",
  "get_passport",
  "get_stats",
  "get_audit_count",
  "get_audit",
  "get_config",
] as const;

export type ContractFunctionName = (typeof CONTRACT_FUNCTIONS)[number];

export type ContractIntent = {
  functionName: ContractFunctionName;
  description: string;
  requiredSigner: string;
  args: Record<string, string | number | boolean | null>;
};

export type PassportStatus =
  | "active"
  | "verified"
  | "under_review"
  | "recalled"
  | "recycled";

export type BatteryPassportView = {
  serial: string;
  chemistry: string;
  capacityWh: number;
  carbonKg: number;
  batchId: string;
  manufacturer: string;
  owner: string;
  status: PassportStatus;
  recycled: boolean;
  verified: boolean;
  recallFlag: boolean;
  inspections: number;
  riskScore: number;
  recycler: string | null;
};

export type RegistryStatsView = {
  totalPassports: number;
  activePassports: number;
  recycledPassports: number;
  verifiedPassports: number;
  recalledPassports: number;
  totalInspections: number;
};

export const contractRuntimeConfig = {
  contractId: CONTRACT_ID,
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  stellarExpertContractUrl: STELLAR_EXPERT_CONTRACT_URL,
  stellarExpertTxUrl: STELLAR_EXPERT_TX_URL,
};

export const contractFunctionMap: Record<ContractFunctionName, string> = {
  initialize: "Admin initializes the Battery Passport Registry.",
  create_passport:
    "Manufacturer creates a new battery passport with serial, chemistry, capacity, carbon footprint and batch metadata.",
  transfer_owner:
    "Current owner transfers battery ownership to a new wallet address.",
  add_inspection:
    "Inspector adds an audit record and safety score to a battery passport.",
  verify_passport:
    "Verifier marks the passport as verified after checking the battery lifecycle data.",
  flag_recall:
    "Regulator or inspector flags a battery passport for recall review.",
  mark_recycled:
    "Current owner marks the battery as recycled and records the recycler wallet.",
  get_passport: "Reads a passport by serial number.",
  get_stats: "Reads registry-level production metrics.",
  get_audit_count: "Reads the number of audit records for a passport.",
  get_audit: "Reads one audit record by serial and index.",
  get_config: "Reads platform admin and initialization config.",
};

export function mapStatusCode(status: number): PassportStatus {
  if (status === 2) return "verified";
  if (status === 3) return "under_review";
  if (status === 4) return "recalled";
  if (status === 5) return "recycled";
  return "active";
}

export function buildContractIntent(
  functionName: ContractFunctionName,
  wallet: string,
  args: Record<string, string | number | boolean | null>,
): ContractIntent {
  return {
    functionName,
    description: contractFunctionMap[functionName],
    requiredSigner: wallet,
    args,
  };
}

export function createExplorerTxUrl(txHash: string) {
  return `${STELLAR_EXPERT_TX_URL}/${txHash}`;
}

export function mapContractError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Contract, #1")) {
    return "Registry has already been initialized.";
  }

  if (message.includes("Contract, #2")) {
    return "Registry is not initialized yet.";
  }

  if (message.includes("Contract, #3")) {
    return "Serial already exists. This battery passport has already been created.";
  }

  if (message.includes("Contract, #4")) {
    return "Passport not found. Please check the battery serial number.";
  }

  if (message.includes("Contract, #5")) {
    return "This battery has already been recycled.";
  }

  if (message.includes("Contract, #6")) {
    return "Unauthorized. Only the correct wallet can update this passport.";
  }

  if (message.includes("Contract, #7")) {
    return "Invalid inspection score. Use a score from 0 to 100.";
  }

  const lower = message.toLowerCase();

  if (lower.includes("freighter")) {
    return "Freighter wallet is not available. Please install or unlock Freighter.";
  }

  if (lower.includes("rejected")) {
    return "Transaction rejected by wallet.";
  }

  if (lower.includes("insufficient")) {
    return "Insufficient balance. Please fund your Testnet wallet.";
  }

  if (lower.includes("wallet not connected")) {
    return "Wallet not connected. Please connect wallet first.";
  }

  return message;
}

export function getRequiredContractFunctionsForReview(): ContractFunctionName[] {
  return [...CONTRACT_FUNCTIONS];
}

export function createMockTransactionHash(functionName: ContractFunctionName) {
  const seed = `${functionName}-${Date.now()}-${Math.random()}`;
  let hash = "";

  for (let index = 0; index < 64; index += 1) {
    const charCode = seed.charCodeAt(index % seed.length);
    hash += ((charCode + index) % 16).toString(16);
  }

  return hash;
}

export const samplePassport: BatteryPassportView = {
  serial: "BATTERY-L4-001",
  chemistry: "LFP",
  capacityWh: 75000,
  carbonKg: 420,
  batchId: "BATCH-Q3-2026",
  manufacturer: "GDKL...MANUFACTURER",
  owner: "GDKL...OWNER",
  status: "verified",
  recycled: false,
  verified: true,
  recallFlag: false,
  inspections: 3,
  riskScore: 92,
  recycler: null,
};

export const sampleStats: RegistryStatsView = {
  totalPassports: 128,
  activePassports: 91,
  recycledPassports: 18,
  verifiedPassports: 76,
  recalledPassports: 6,
  totalInspections: 214,
};