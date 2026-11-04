#!/usr/bin/env python3
"""Render the repository's proposed gameplay sequence to a vector PDF.

Small renderer for this checked-in Mermaid sequence subset. No actual game is run.
Requires ReportLab in a documentation virtual environment, not in the app runtime.
"""
from pathlib import Path
import re
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/diagrams/multiplayer-sequence.mmd"
OUTPUT = SOURCE.with_suffix(".pdf")


def main():
    lines = [line.strip() for line in SOURCE.read_text().splitlines() if line.strip()]
    actors, events = [], []
    for line in lines[1:]:
        match = re.fullmatch(r"participant (\w+) as (.+)", line)
        if match:
            actors.append(match.groups())
        else:
            events.append(line)
    width, height = landscape(A4)
    c = canvas.Canvas(str(OUTPUT), pagesize=(width, height))
    c.setTitle("Proposed multiplayer gameplay sequence — RIVR")
    c.setFont("Helvetica-Bold", 15)
    c.drawString(25, height - 30, "RIVR: proposed multiplayer action and hand completion")
    c.setFont("Helvetica", 9)
    c.drawString(25, height - 46, "Design model only. Game endpoints and Channels are not implemented; progression hooks exist.")
    positions = {key: 75 + i * (width - 150) / (len(actors) - 1) for i, (key, _) in enumerate(actors)}
    top = height - 95
    spacing = (top - 60) / len(events)
    for key, label in actors:
        x = positions[key]
        c.setFillColor(HexColor("#edf2ff"))
        c.setStrokeColor(HexColor("#4169ff"))
        c.roundRect(x - 61, top + 6, 122, 26, 4, fill=1)
        c.setFillColor(HexColor("#172438")); c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(x, top + 16, label)
        c.setDash(3, 3); c.setStrokeColor(HexColor("#a0aec0"))
        c.line(x, top + 6, x, 50); c.setDash()
    groups = []
    for index, line in enumerate(events):
        y = top - (index + 1) * spacing
        if line.startswith(("alt ", "opt ")):
            groups.append((y + 8, len(groups)))
            c.setFillColor(HexColor("#e5eaff")); c.rect(25 + 5 * len(groups), y - 2, width - 50 - 10 * len(groups), 13, stroke=0, fill=1)
            c.setFillColor(HexColor("#172438")); c.setFont("Helvetica-Bold", 8); c.drawString(34 + 5 * len(groups), y + 2, line)
            continue
        if line == "end":
            start, depth = groups.pop()
            c.setStrokeColor(HexColor("#8090ad")); c.rect(30 + depth * 5, y - 4, width - 60 - depth * 10, start - y + 4, stroke=1, fill=0)
            continue
        if line.startswith("else "):
            c.setFont("Helvetica-Bold", 8); c.setFillColor(HexColor("#172438")); c.drawString(36, y + 1, line)
            c.setDash(3, 3); c.line(30, y - 4, width - 30, y - 4); c.setDash()
            continue
        match = re.fullmatch(r"(\w+)(-->>|->>)(\w+): (.+)", line)
        if not match:
            raise ValueError("Unsupported diagram statement: " + line)
        sender, arrow, receiver, label = match.groups()
        x1, x2 = positions[sender], positions[receiver]
        c.setStrokeColor(HexColor("#172438")); c.setFillColor(HexColor("#172438")); c.setFont("Helvetica", 7.6)
        text_x = min(x1, x2) + 4
        text_x = min(text_x, width - 24 - c.stringWidth(label, "Helvetica", 7.6))
        c.drawString(text_x, y + 4, label)
        if arrow == "-->>":c.setDash(3, 2)
        if x1 == x2:
            c.lines([(x1, y, x1 + 24, y), (x1 + 24, y, x1 + 24, y - 5), (x1 + 24, y - 5, x1, y - 5)])
            head_x, head_y, direction = x1, y - 5, -1
        else:
            c.line(x1, y, x2, y); head_x, head_y, direction = x2, y, 1 if x2 > x1 else -1
        c.setDash(); c.line(head_x, head_y, head_x - direction * 5, head_y + 2.5); c.line(head_x, head_y, head_x - direction * 5, head_y - 2.5)
    c.setFont("Helvetica", 8); c.drawString(25, 22, "Invalid actions never award XP. Shared pots are not wins. Broadcast only after commit; private cards remain private.")
    c.save()
    print(OUTPUT)


if __name__ == "__main__":main()
