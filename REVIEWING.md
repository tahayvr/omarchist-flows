# Reviewing a flow

A merge here puts commands on other people's computers. Read every step. When in doubt, ask the author or say no.

Open the pull request's **Check flows** run and read its summary: it lists each changed flow's steps as Omarchist shows them, the programs it needs, and what the checks flagged. Then read the file itself; the summary is a convenience, the file is what ships.

## The checklist

- [ ] **The check passed.** It verifies the file's format, the gallery's rules, that the author is the account that opened the pull request, and that the version went up.
- [ ] **I understand every step.** If a command is too clever to follow, it does not go in. Ask for a simpler one.
- [ ] **It does what its name and description say, and nothing else.**
- [ ] **Nothing is hidden.** No encoded text that gets decoded and run, no script fetched from the web and run, no `eval` or `sh -c` on a variable.
- [ ] **Every flag in the summary has a good reason**, and the flow asks first (a Confirm step) before anything that cannot be undone.
- [ ] **Network steps go where the flow says they go**, to a well-known server, and send only what the flow is about.
- [ ] **It does not read what is not its business**: keys, passwords, browser profiles, other apps' data.
- [ ] **It is not tied to the author's machine**: no hard-coded home folder, user name, or private host.
- [ ] **It is new here.** Not a copy of an existing flow under another name.
- [ ] **For a new version:** I compared it with the previous one (the pull request's diff) and the change is what the author says it is.

## Merging

Squash and merge. The publish workflow builds and signs the index and uploads it; the flow is live a minute or two later. Check the **Publish catalog** run went green.

## Pulling a flow

When a published flow turns out to be harmful or broken:

1. Add it to `yanked.toml` with a reason people will read, and merge. Leave its file in `flows/`.

   ```toml
   [the-flows-slug]
   reason = "Deletes more than it says. Do not run it."
   ```

2. Omarchist stops offering it and tells everyone who installed it, with your reason.
3. If it was malicious, block the account and look at the author's other flows.

## Featured and verified

- `featured.txt` lists the flows the Gallery shows first. Keep it short and rotate it.
- `verified.txt` lists authors whose flows have been reviewed several times without trouble. It is earned by a history here and never given on request.
