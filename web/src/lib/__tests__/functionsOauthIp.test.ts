// @vitest-environment node
import assert from 'node:assert/strict'
import { test } from 'vitest'
import { isPublicAddress } from '../../../../functions/src/oauth/ip'

const no = [
  // IPv4: this network, loopback, private, CGNAT, link-local (incl. the metadata server), special
  '0.0.0.0', '0.1.2.3', '127.0.0.1', '127.255.255.254', '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.255',
  '192.168.0.1', '192.168.255.255', '100.64.0.1', '100.127.255.255', '169.254.169.254', '169.254.0.1',
  '192.0.0.1', '192.0.2.1', '192.88.99.1', '198.18.0.1', '198.19.255.255', '198.51.100.1', '203.0.113.1',
  '224.0.0.1', '239.255.255.255', '240.0.0.1', '255.255.255.255',
  // IPv6: unspecified, loopback, unique-local, link-local, multicast, documentation, Teredo, 6to4, NAT64
  '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'febf::1', 'ff02::1', '2001:db8::1', '2001::1', '2001:1::1',
  '2002:c0a8:0101::1', '64:ff9b::808:808', '3fff::1', '100::1',
  // IPv4-mapped forms of the above, dotted and hex
  '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:192.168.1.1', '::ffff:169.254.169.254', '::ffff:7f00:1',
  '::ffff:a9fe:a9fe', '0:0:0:0:0:ffff:100.64.0.1', '::FFFF:10.1.2.3',
  // Not addresses at all
  '', 'localhost', 'example.com', '1.2.3', '1.2.3.4.5', '256.1.1.1', '1.2.3.256', '01.2.3.4', '::g', ':::', 'fe80::1%eth0',
  '1::2::3', '[::1]', '0x7f.0.0.1', '2130706433', ' 8.8.8.8',
]
const yes = [
  '8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.255.255', '172.32.0.0', '100.63.255.255', '100.128.0.0', '169.253.1.1',
  '192.167.1.1', '198.17.0.1', '198.20.0.1', '11.0.0.1', '223.255.255.255',
  '2606:4700:4700::1111', '2a00:1450:4001:81b::200e', '2001:4860:4860::8888', '2600::1', '2001:200::1',
  '::ffff:8.8.8.8', '::ffff:0808:0808', '2001:0db9::1',
]

test('addresses that must never be fetched', () => {
  for (const ip of no) assert.equal(isPublicAddress(ip), false, ip)
})

test('addresses on the open internet', () => {
  for (const ip of yes) assert.equal(isPublicAddress(ip), true, ip)
})
