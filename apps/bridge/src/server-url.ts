import { networkInterfaces } from "node:os";

export function getBridgeServerUrls(port: number) {
  return [getLocalhostUrl(port), ...getNetworkUrls(port)];
}

function getLocalhostUrl(port: number) {
  return `http://localhost:${port}`;
}

function getNetworkUrls(port: number) {
  return Object.values(networkInterfaces())
    .flatMap((networkInterface) => networkInterface ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => `http://${address.address}:${port}`)
    .sort();
}
