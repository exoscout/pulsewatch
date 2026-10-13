const dns = require("node:dns/promises");
const net = require("node:net");

function isPrivateIPv4(ip) {
  const p = ip.split(".").map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) || p[0] >= 224;
}
function isPrivateIPv6(ip) {
  const x = ip.toLowerCase();
  return x === "::1" || x === "::" || x.startsWith("fc") ||
    x.startsWith("fd") || x.startsWith("fe80:") || x.startsWith("::ffff:127.");
}

async function validatePublicHttpUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error("A valid URL is required"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported");
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed");
  if (!url.hostname) throw new Error("URL hostname is required");

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Local hostnames are not allowed");
  }
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4 && isPrivateIPv4(hostname)) throw new Error("Private IP targets are not allowed");
  if (ipVersion === 6 && isPrivateIPv6(hostname)) throw new Error("Private IP targets are not allowed");

  if (!ipVersion) {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length) throw new Error("Hostname did not resolve");
    for (const record of records) {
      if ((record.family === 4 && isPrivateIPv4(record.address)) ||
          (record.family === 6 && isPrivateIPv6(record.address))) {
        throw new Error("Host resolves to a private IP address");
      }
    }
  }
  return url.toString();
}

module.exports = { validatePublicHttpUrl, isPrivateIPv4, isPrivateIPv6 };
