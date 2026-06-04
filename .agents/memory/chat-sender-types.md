---
name: Chat message sender types
description: What the three client_messages.sender_type values mean for "team replied" logic
---

# client_messages.sender_type semantics

The `client_messages` table has three sender types: `client`, `retoucher`, `system`.

- `client` — the customer.
- `retoucher` — a human team member's reply (any team role posting in the chat).
- `system` — auto-generated/automated messages (auto-responders, status notices).

**Rule:** when determining whether the team has actually replied to a client
(e.g. "messages awaiting a reply" counts), anchor only on `sender_type = 'retoucher'`.
Do NOT use `sender_type <> 'client'` — that wrongly treats automated `system`
messages as a human reply, so a conversation would falsely look "answered".

**Why:** an auto-reply or status message going out after a client message is not
a real response; treating it as one hides genuinely unanswered clients.
