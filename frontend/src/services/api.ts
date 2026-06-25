export type FeedbackPayload = {
  wallet: string;
  role: string;
  rating: number;
  comment: string;
};

export type WalletInteractionPayload = {
  wallet: string;
  action: string;
  txHash?: string;
  serial?: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

export async function sendFeedback(payload: FeedbackPayload) {
  const response = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Could not send feedback to analytics server.");
  }

  return response.json();
}

export async function trackWalletInteraction(payload: WalletInteractionPayload) {
  const response = await fetch(`${API_BASE_URL}/api/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Could not track wallet interaction.");
  }

  return response.json();
}

export async function getBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error("Backend health check failed.");
  }

  return response.json();
}