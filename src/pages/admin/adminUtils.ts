export function getHttpStatus(cause: unknown) {
  if (!cause || typeof cause !== "object") {
    return undefined;
  }

  return (cause as { response?: { status?: number } }).response?.status;
}

export function getServerMessage(cause: unknown) {
  if (!cause || typeof cause !== "object") {
    return undefined;
  }

  return (cause as { response?: { data?: { message?: string } } }).response?.data?.message;
}

export function buildAdminError(cause: unknown, fallback: string) {
  const status = getHttpStatus(cause);
  const serverMessage = getServerMessage(cause);

  if (status === 401 || status === 403) {
    return "관리자 로그인이 필요합니다. 관리자 계정으로 다시 로그인해주세요.";
  }

  if (serverMessage) {
    return serverMessage;
  }

  if (cause instanceof Error && cause.message) {
    return cause.message;
  }

  return fallback;
}

export function isAuthError(message: string) {
  return message.includes("관리자 로그인이 필요합니다");
}

export function formatCount(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }

  return value.toLocaleString("ko-KR");
}

export function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function shortId(value: unknown, size = 8) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return String(value).slice(0, size);
}

export function stringValue(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

export function formatWei(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  try {
    const wei = BigInt(String(value));
    const eth = Number(wei) / 1_000_000_000_000_000_000;
    if (!Number.isFinite(eth)) {
      return `${String(value)} wei`;
    }

    return `${eth.toLocaleString("ko-KR", { maximumFractionDigits: 4 })} KAIA`;
  } catch {
    return String(value);
  }
}
