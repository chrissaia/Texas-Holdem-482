#!/usr/bin/env python3
"""Create a pasteable Overleaf draft and a complete upload ZIP from the reviewed report.

Only reported facts and measured evidence are copied. Unknown actual hours remain pending.
The source compiles without external assets, displaying explicit upload placeholders.
The ZIP includes all images and the full gameplay diagram for the submission version.
"""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "docs/report"

DIAGRAM_FALLBACK = r"""
\begin{landscape}
\begin{center}
\textbf{Proposed multiplayer gameplay sequence}\\[6pt]
{\small Model only: the game service and Channels are planned.}\\[8pt]
\begin{tikzpicture}[x=1cm,y=1cm,>=stealth,font=\scriptsize]
\foreach \x/\name in {0/UI,3/API,6/Game service,9/Progression,12/PostgreSQL,15/Channels}{
  \node[draw,rounded corners,fill=blue!7,minimum width=2.6cm,minimum height=.6cm] at (\x,0) {\name};
  \draw[dashed,gray] (\x,-.35)--(\x,-10.8);
}
\draw[->] (0,-1)--node[above]{Action + session + CSRF}(3,-1);
\draw[->] (3,-1.9)--node[above]{Authorize and apply}(6,-1.9);
\draw[->] (6,-2.8)--node[above]{Begin; lock hand and read current state}(12,-2.8);
\node[draw,fill=red!5,text width=9cm,align=center] at (7.5,-3.7){Validate turn, move and chips. Invalid action: rollback, return error, no XP.};
\draw[->] (6,-4.7)--node[above]{Valid action: persist and advance phase}(12,-4.7);
\node[align=center,text width=8cm] at (8.5,-5.6){If the hand completes: evaluate winners and split pots; persist results and payouts.};
\draw[->] (6,-6.6)--node[above]{Stable result event}(9,-6.6);
\draw[->] (9,-7.5)--node[above]{Lock user; save XP}(12,-7.5);
\draw[->] (6,-8.4)--node[above]{Commit action, results and rewards}(12,-8.4);
\draw[->] (6,-9.3)--node[above]{After commit: recipient-filtered publication}(15,-9.3);
\draw[->,dashed] (15,-10.2)--node[above]{Public state and only this player's private cards}(0,-10.2);
\end{tikzpicture}
\end{center}
\end{landscape}
"""


def main():
    source = (REPORT / "iteration-report.tex").read_text()
    coverage = (REPORT / "coverage-data.tex").read_text()
    source = source.replace(r"\usepackage{xcolor}", r"\usepackage{xcolor,tikz,pdflscape}")
    source = source.replace(r"\input{coverage-data.tex}", coverage)
    original = r"\includepdf[pages=1,fitpaper=true,pagecommand={}]{../diagrams/multiplayer-sequence.pdf}"
    replacement = r"\IfFileExists{multiplayer-sequence.pdf}{\includepdf[pages=1,fitpaper=true,pagecommand={}]{multiplayer-sequence.pdf}}{" + DIAGRAM_FALLBACK + "}"
    assert original in source
    source = source.replace(original, replacement)
    for side in ("backend", "frontend"):
        old = r"\includegraphics[width=\textwidth,height=.83\textheight,keepaspectratio]{../quality/evidence/" + side + "-coverage.png}"
        new = r"\IfFileExists{" + side + r"-coverage.png}{\includegraphics[width=\textwidth,height=.83\textheight,keepaspectratio]{" + side + r"-coverage.png}}{\fbox{\parbox{.88\textwidth}{Upload " + side + r"-coverage.png from the Overleaf ZIP here before submission. This placeholder is not coverage evidence.}}}"
        assert old in source
        source = source.replace(old, new)
    out = REPORT / "overleaf-draft.tex"
    out.write_text("% Paste into main.tex in Overleaf. Actual hours are intentionally not invented.\n" + source)
    assets = {"backend-coverage.png": ROOT / "docs/quality/evidence/backend-coverage.png",
              "frontend-coverage.png": ROOT / "docs/quality/evidence/frontend-coverage.png",
              "multiplayer-sequence.pdf": ROOT / "docs/diagrams/multiplayer-sequence.pdf"}
    with zipfile.ZipFile(REPORT / "overleaf-project.zip", "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("main.tex", out.read_text())
        for name, path in assets.items():
            archive.write(path, name)
        archive.writestr("README.txt", "Upload this ZIP as a new Overleaf project, or paste main.tex and upload the three assets. Compile with pdfLaTeX. Actual hours remain pending; enter only your real records. The planning email sent time is user-reported.\n")
    print(out)
    print(REPORT / "overleaf-project.zip")


if __name__ == "__main__":main()
