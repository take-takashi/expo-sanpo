import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { getBridgeServerUrls } from "./server-url.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);

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
