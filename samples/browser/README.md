# browser

`BrowserAgent` calls Browser Run quick actions from `agents/browser`: `browserMarkdown`, `browserLinks`, `browserScreenshot`. `ask` gives a model `createQuickActionTools` so it can read the page itself before answering.

The free plan allows 10 browser minutes a day and a few quick actions a minute (over that, Browser Run answers 429). The `BROWSER` binding is remote, so `wrangler dev` needs `wrangler login`. Try it from the dashboard at `#/browser`.
