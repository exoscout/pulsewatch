const test = require("node:test");
const assert = require("node:assert/strict");
const { isPrivateIPv4, isPrivateIPv6 } = require("../src/url-safety");

test("detects common private IPv4 ranges", () => {
  for (const ip of ["10.0.0.1", "127.0.0.1", "192.168.1.10", "172.20.0.5", "169.254.1.2"]) {
    assert.equal(isPrivateIPv4(ip), true, `${ip} should be private`);
  }
  assert.equal(isPrivateIPv4("8.8.8.8"), false);
});

test("detects common local IPv6 addresses", () => {
  assert.equal(isPrivateIPv6("::1"), true);
  assert.equal(isPrivateIPv6("fe80::1"), true);
  assert.equal(isPrivateIPv6("2001:4860:4860::8888"), false);
});
