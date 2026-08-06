export type ConnectionState = "checking" | "online" | "offline";

export function connectionStateLabel(state: ConnectionState) {
  switch (state) {
    case "online":
      return "Connection available";
    case "offline":
      return "Connection unavailable";
    default:
      return "Checking connection";
  }
}

export function connectionStateDescription(state: ConnectionState) {
  switch (state) {
    case "online":
      return "Current data can be requested from the event service.";
    case "offline":
      return "Already-loaded information may remain visible, but changes cannot be saved or queued.";
    default:
      return "Checking whether the event service can be reached.";
  }
}
