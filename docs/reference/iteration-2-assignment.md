# Iteration 2 assignment — user-provided transcription

Provided in chat on November 3, 2026. This is a structured transcription of the assignment text supplied by Chris, not an independently verified Moodle copy. The original text says **November 5, 2026**, asks students to double-check Moodle, and mentions a Sunday-night grace period. Do not plan around the grace period or treat the demo as the deadline.

## Planning and scope

Plan before building. Choose original-backlog stories, name the teammate responsible for each, and email the plan to the professor by 11:59 PM on the Tuesday following assignment release. The release date and planning-email evidence have not been supplied. Late planning email is penalized cumulatively by 0.5 per day. Additional or changed stories must be based on the original stories and estimated with the professor. Slice large stories into linked tasks; preserve story IDs and updated records.

Per-member story-point targets: D = 1, C = 2, B = 3, A = 4. Complexity/work effort and committed LOC inform contribution assessment; do not pad code or inflate estimates.

## Testing

All team-produced code must have automated framework/tool tests. Average code coverage: at least 60% for C, greater than 70% for B, greater than 80% for A. Average branch coverage must exceed 50%. Favor unit tests; integration and snapshot tests are allowed. Commit a tool-generated coverage report and a screenshot/print of it as an image; include the image and an honest discussion of gaps/improvements in the documentation. Falsification incurs a heavy penalty.

## Git and traceability

Commit and push all software artifacts, including documentation. Branch work is allowed, but main must contain the deliverable by the iteration cutoff. Later activity does not count for that iteration. Fewer than 100 committed LOC per person is treated as non-contribution. Story/task IDs on the board must match the workbook. Commits must identify actual issues with `#x`, linking tasks to their parent story. Individual contribution and authorship must remain truthful.

## Board and acceptance

Use GitHub Projects. Backlog/To Do must be first, Acceptance Test must be immediately before the final column, and only professor/CTO-approved items may reach that final column. Live demos are required; explain the implemented requirements and code. Approved stories move to Done; rejected work returns to Backlog. Unexplained absence incurs a penalty. The professor may inspect velocity, cycle time, coverage scope, missing Git activity, and story-to-commit traceability.

## Documentation and modelling

Update the LaTeX document and commit a PDF. Include planning and execution: planned stories/points/total, completed and partial stories, actual contributors, actual work hours per story, total completed points, testing report and coverage image, evaluation of gaps/improvements, and retrospective. Update the main Iteration Planning table. Add a sequence diagram for a main gameplay scenario (solo, multiplayer, or bots) under **System Design / Diagrams**. A proposed diagram must not be represented as implemented gameplay.

## Optional work, not automatically claimed

- Example password hashing, DbConnection, Server and dotenv may be reused. Reusing/refactoring the example CRUD user needs professor discussion and an estimated task; small/medium/complex changes are suggested at 1/2/4 points.
- Planned refactoring: one 1-point task for one team member only; must be substantive, not renaming. Explain the extraction/refactoring in its commit message.
- Spikes acquire knowledge and are committed but are not release functionality. The new suggested 2-point spike is a server-side turn timer/AFK mechanism surviving disconnects.
- The new suggested 2-point technical task is dealing/flipping card rendering and animation. New technical-task estimates require professor agreement. Previously completed optional work cannot be counted again.

## Delivery

No Moodle upload is required. The professor inspects the repository after the iteration (usually Monday morning). The assignment explicitly says Monday is already grace and Tuesday's demo is not a delivery extension. Verify actual dates/cutoff/demo time on Moodle/course schedule. No planning email, professor acceptance, attendance, hours or deadlines are manufactured by this remediation.
