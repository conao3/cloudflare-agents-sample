# email

`EmailAgent` handles mail in `onEmail`: it parses the message with `postal-mime`, records it, and answers with `replyToEmail`. The Worker's `email()` handler routes real mail from Email Routing with `routeAgentEmail` to the `inbox` instance.

The dashboard at `#/email` delivers simulated mail: `simulate` builds an `AgentEmail` and passes it through the same `onEmail`. Real delivery needs Email Routing on a zone whose MX points to Cloudflare.
