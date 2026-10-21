import type { Hub } from "./hub";

export interface Env {
  CONNECTOR_SECRET: string;
  HUB: DurableObjectNamespace<Hub>;
}

export const hub = (env: Env) => env.HUB.get(env.HUB.idFromName("main"));
