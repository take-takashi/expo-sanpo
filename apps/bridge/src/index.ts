import { serve } from "@hono/node-server";

import { createApp } from "./app.js";
import { createPromptRunnerFromEnv } from "./prompt-runner-factory.js";
import { SessionStore } from "./session-store.js";
import { getBridgeServerUrls } from "./server-url.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const app = createApp(new SessionStore(createPromptRunnerFromEnv()));

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log("Bridge server listening on:");

    for (const url of getBridgeServerUrls(info.port)) {
      console.log(`  ${url}`);
    }
  },
);
