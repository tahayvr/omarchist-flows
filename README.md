# Omarchist Flows

The flows in [Omarchist](https://omarchist.com)'s **Catalog**: small automations for [Omarchy](https://omarchy.org) that people made and shared. Every flow here was read by a reviewer before it was listed, and all of them are free for anyone to use and change ([CC0](LICENSE)).

You do not browse or install from this page. Open **Flows → Catalog** in Omarchist: it lists these flows, shows what each one does step by step, and installs one in two clicks. See the [Catalog guide](https://omarchist.com/flows/catalog).

## Share a flow

Build your flow in Omarchist, then choose **Publish to the catalog…** from the editor's menu. Omarchist prepares the file and opens this repository in your browser with the file filled in; you press **Commit changes** and **Create pull request**. [CONTRIBUTING.md](CONTRIBUTING.md) says what makes a good flow and what is refused.

## Report a flow

Use **Report** on the flow in the Catalog, or [open an issue](../../issues/new) with the flow's name. For something that should not be discussed in public, see [SECURITY.md](SECURITY.md).

## How it works

```
flows/<slug>.flow.toml      one file per flow, its newest version
        │  pull request: checked by Omarchist's own code, read by a reviewer
        ▼
     main  ──►  publish workflow: build the index, sign it, upload to R2
                                                    │
        Omarchist  ◄──  flows.omarchist.com (Worker)  ◄──┘
        checks the signature and every file's hash
```

- **This repository is the source of truth.** A flow, a new version of it, and its removal are all pull requests, so everything has a history and a reviewer.
- **A published version never changes.** A change is a new version (`meta.version` goes up), and people who installed the flow see what changes before they take it.
- **The index is signed.** CI signs the list of flows with a key only CI has. Omarchist carries the public key, refuses a list that does not verify, and checks each flow file against the hash in the list. The server only hands out files; it cannot add or alter a flow.
- **Installing never runs anything.** Omarchist shows a flow from the Catalog in full, every command included, and saves it only when its new owner presses Install.

| Path | What it is |
| --- | --- |
| `flows/` | The flows. |
| `featured.txt` | The flows the Catalog shows first. |
| `verified.txt` | Authors with a history of reviewed flows; they get a badge. |
| `yanked.toml` | Flows pulled from the Catalog, with the reason people see. |
| `maintainers.txt` | Who may change any flow. Everyone else may only change their own. |
| `tools/` | The scripts the checks run. |
| `worker/` | The Cloudflare Worker behind `flows.omarchist.com`. |
| `.github/workflows/` | `check` (pull requests), `publish` (after a merge), `worker` (tests and deploys the Worker). |

Maintainers: [REVIEWING.md](REVIEWING.md) is the review checklist, and [SETUP.md](SETUP.md) is how the repository, the bucket and the Worker are set up.
