# RIVR reusable agents

These version-controlled Markdown role briefs work as instructions for a coding assistant. Each teammate can use them in their own clone and conversation. They are not running processes or application-specific agent registrations.

| Brief | Teammate | Focus |
| --- | --- | --- |
| [chris-tables.md](chris-tables.md) | Chris | S13 public creation and S10 lobby |
| [finn-accounts.md](finn-accounts.md) | Finn | S2 registration, S1 login/logout, S4 guests |
| [kelechi-themes-admin.md](kelechi-themes-admin.md) | Kelechi | S35 themes and S23 cleanup |
| [royal-profile-rewards.md](royal-profile-rewards.md) | Royal | S5 avatar upload, S14 starting chips, S29 daily chips |
| [integration-review.md](integration-review.md) | Anyone | Integration, test coverage, and handoff review |

## Usage

Open the repository in your coding assistant and send a request such as:

```text
Read AGENTS.md, .agents/shared.md, and .agents/finn-accounts.md.
Use that role to help me implement S2 registration one milestone at a time.
Inspect the existing code first and explain the next milestone before editing.
```

Replace the role and story with your own. For a review:

```text
Read AGENTS.md, .agents/shared.md, and .agents/integration-review.md.
Review my branch's registration-to-starting-chips integration.
Report findings and run relevant tests; do not change files yet.
```

Create your feature branch using `instructions.md`. Give the assistant a specific outcome, any permitted files, and whether you want analysis, implementation, or review. A role brief alone does not request implementation of every listed story.

If explicitly requesting parallel agents, assign separate files and serialize shared model/migration changes. The repository's root `AGENTS.md` points assistants to these briefs; other tools may require you to attach or mention the files manually.
