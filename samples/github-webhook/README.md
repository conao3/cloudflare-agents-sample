# github-webhook

The dashboard forwards `POST /webhooks/github` to this Worker. The Worker verifies `X-Hub-Signature-256` (HMAC-SHA256 with WebCrypto, compared with `crypto.subtle.timingSafeEqual`), answers 401 for a wrong signature and 500 when `GITHUB_WEBHOOK_SECRET` is not set, then picks the agent for the repository with `getAgentByName(env.RepoAgent, "<owner>-<repo>")` in lower case and calls its `receive` method over RPC.

`RepoAgent` keeps the newest 100 events in `this.sql` and puts the repository stats (stars, forks, open issues) and the last update in state, so the dashboard page at `#/github-webhook` updates as events arrive. It summarizes `ping`, `push`, `pull_request`, `issues`, `issue_comment`, `star`, `fork`, `release`, and `watch`; other events are stored with their name and action.

Secret: `GITHUB_WEBHOOK_SECRET`, any random string (`openssl rand -hex 32`). Put it in `samples/github-webhook/.dev.vars` as `GITHUB_WEBHOOK_SECRET=...`, and for a deploy run `wrangler secret put GITHUB_WEBHOOK_SECRET -c samples/github-webhook/wrangler.jsonc`. In the repository's Settings → Webhooks, set the payload URL to `https://<dashboard>/webhooks/github`, the content type to `application/json`, and the same secret.

GitHub cannot reach `localhost`, so try it locally with a signed sample:

```sh
body='{"zen":"Keep it simple.","hook_id":1,"repository":{"full_name":"conao3/cloudflare-agents-sample","html_url":"https://github.com/conao3/cloudflare-agents-sample","stargazers_count":3,"forks_count":1,"open_issues_count":2},"sender":{"login":"octocat"}}'
sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "$GITHUB_WEBHOOK_SECRET" -r | cut -d' ' -f1)
curl -X POST http://localhost:8790/webhooks/github \
  -H 'content-type: application/json' -H 'x-github-event: ping' \
  -H "x-hub-signature-256: sha256=$sig" --data "$body"
```
