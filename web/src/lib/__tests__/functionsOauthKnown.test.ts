// @vitest-environment node
import assert from 'node:assert/strict'
import { test } from 'vitest'
import { isKnownClient } from '../../../../functions/src/oauth/known'

test('known: the assistant companies’ own hosts and their subdomains', () => {
  for (const id of [
    'https://claude.ai/oauth/metadata',
    'https://claude.com/.well-known/client.json',
    'https://anthropic.com/c',
    'https://chatgpt.com/oauth/x',
    'https://openai.com/c',
    'https://mcp.claude.ai/client.json',
    'https://a.b.openai.com/c',
    'https://CLAUDE.AI/c',
    'https://claude.ai:8443/c',
  ])
    assert.equal(isKnownClient(id), true, id)
})

test('not known: look-alikes, other hosts, and anything that is not an address', () => {
  for (const id of [
    'https://example.com/c',
    'https://claude.ai.example.com/c',
    'https://notclaude.ai/c',
    'https://claude-ai.com/c',
    'https://evilclaude.ai/c',
    'https://claude.ai.evil.com/c',
    'https://example.com/claude.ai',
    'https://example.com/c?host=claude.ai',
    'https://u:claude.ai@example.com/c',
    'https://claude.ai@example.com/c',
    'https://claude.ai.evil:443/c',
    'https://xn--claude-9ea.ai/c',
    'http://127.0.0.1:4000/client',
    'claude.ai',
    'not a url',
    '',
  ])
    assert.equal(isKnownClient(id), false, id)
})
