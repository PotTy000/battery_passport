import { Contract, Networks, rpc } from "@stellar/stellar-sdk";

export const CONTRACT_ID =
  process.env.CONTRACT_ID || "CAWYCZ5VD2OTDLLXTQVWGT662LXKIVCCV2BWNS4Z46GNVZRIL4CN23AA";

export const RPC_URL =
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";

export const NETWORK_PASSPHRASE = Networks.TESTNET;

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

export function getContractRuntime() {
  return {
    contractId: CONTRACT_ID,
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    stellarExpertContractUrl: `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
    functions: CONTRACT_FUNCTIONS,
  };
}

export function createContractClient() {
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);

  return {
    server,
    contract,
    runtime: getContractRuntime(),
  };
}

export function isValidStellarContractId(contractId: string) {
  return /^C[A-Z0-9]{55}$/.test(contractId);
}