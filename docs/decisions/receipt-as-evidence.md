# 001 — Receipt-as-evidence, not escrow

## Decision
The platform takes custody of receipt screenshots, not funds. Users 
transfer money directly bank-to-bank; öz stores the timestamped 
evidence of the transfer in a non-skippable upload sheet after the 
sender taps "Я отправил деньги."

## Why
- Avoids FETA registration requirements (Korea) — we never hold funds
- Avoids equivalent NBK exposure (Kazakhstan)
- Solves the *первая не отправлю* standstill that drives 3-hour chat 
  waits — receipt visible to counterparty resolves trust in seconds
- Produces structured transaction data (Phase 3 escrow training set) 
  as a side effect

## Alternatives considered
- Real escrow with custodial accounts → requires MSB licensing in 
  both jurisdictions, $100K+ compliance cost, kills MVP
- No platform-side trust mechanic → reproduces the chat, no reason 
  for users to switch
- Voluntary receipt upload → users will skip, mechanic dies

## When to revisit
- Phase 3 when Kaspi partnership unlocks licensed escrow
- If fraud rates >2% suggest receipt-evidence isn't strong enough