# Sharing a flow

Thank you for sharing. A flow in the Catalog is something other people will run on their own computers, so the bar is: useful, readable, and safe.

## How to publish

1. Build and test the flow in Omarchist.
2. In its editor, open the menu and choose **Publish to the catalog…**. Enter your GitHub user name, pick a category, add up to five tags, and agree to release the flow under CC0.
3. Your browser opens this repository with the file filled in. Press **Commit changes**, then **Create pull request**.
4. A check lists what your flow does and flags anything a reviewer should look at. A reviewer reads it. You may be asked to change something.
5. Once merged, the flow is in everyone's Catalog within minutes.

To publish a new version, change the flow in Omarchist and publish it again. Omarchist raises the version and opens the file for editing; replace its text with what Omarchist copied to your clipboard. A published version is never rewritten, so a change without a higher `meta.version` fails the check.

You can also add or edit a file under `flows/` by hand. Run `omarchist flow check --catalog flows/<your-file>.flow.toml` first.

## What makes a good flow

- **It does one thing people want.** "Save the link I copied to my reading list" is a flow. "My whole morning setup with my folders and my apps" is yours alone; keep it.
- **It works on a stock Omarchy.** Prefer the ready-made actions and Omarchy's own commands. If it needs a program that is not installed by default, that is fine: Omarchist shows people what is missing.
- **Its name says what it does** in a few words, and its description says the rest in one sentence. No emoji, no "best", no version numbers in the name.
- **It asks before it does something that cannot be undone**, with a Confirm step.
- **It uses variables, not your details.** Ask for a folder or a name instead of writing yours into a command.
- **Settings are set, not flipped.** "Turn the night light on", not "toggle the night light", so running it twice is harmless.

## What is refused

- Anything that hides what it does: encoded or minified commands, a step that downloads a script and runs it, `eval` on a variable.
- Commands that run as administrator, delete folders, or write to disks, unless the flow is plainly about that and asks first.
- Flows that read private keys, passwords, browser data, or anything else that is not theirs to read.
- Flows that send what you copied, selected or typed to a server, unless that is the flow's stated purpose and the server is a well-known one.
- Ads, referral links, trackers, crypto miners, and anything that phones home.
- Flows that only work for their author (hard-coded home folders, private servers).
- Copies of a flow that is already here. Improve the original instead; its author can publish a new version.

## The rules a file must meet

The check enforces these, and Omarchist applies them before it lets you publish:

| | |
| --- | --- |
| File name | `flows/<slug>.flow.toml`, where the slug is lowercase letters, digits and hyphens. Omarchist names it from the flow's name. |
| `name` | 3 to 48 characters. |
| `description` | 10 to 160 characters. |
| `icon` | One of the icons the editor offers. |
| `meta.author` | Your GitHub user name. It must be the account that opens the pull request. |
| `meta.version` | A whole number: `"1"`, then `"2"`, and so on. |
| `meta.category` | Productivity, Focus, Media, Capture, Text, Web, Files, Windows, or System. |
| `meta.tags` | Up to five, lowercase letters, digits and hyphens. |
| `meta.license` | `"CC0-1.0"`. |
| Steps | At least one that is switched on, at most 100. No step that runs another flow. |
| Not allowed | An `id`, `[triggers]`, or `meta.source`: those belong to a machine, not to a shared flow. |

Only you can change or remove your flows. If you want yours taken down, open a pull request that deletes the file, or an issue.

## License

By opening a pull request you release your flow under [CC0 1.0](LICENSE): anyone may use, change and share it, for any purpose, without asking. Share only what you wrote or have the right to release this way.
