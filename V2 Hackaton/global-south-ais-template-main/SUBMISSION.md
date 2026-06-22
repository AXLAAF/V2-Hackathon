# Submission checklist — Global South AI Safety Hackathon 2026

**Deadline:** Sunday 21 June 2026, 23:59 AoE  
**Submit via:** [Hackathon page](https://apartresearch.com/sprints/global-south-ais-hackathon-2026-06-19-to-2026-06-21) → “Submit your project”

## What to upload

1. **PDF report** (4–8 pages) — compile from `report.tex`
2. **Title & abstract** (included in PDF)
3. **Author names & affiliations** (included in PDF)
4. **Track & sub-track** (included in PDF):
   - AI Security → Pipeline security (API, cloud)
   - Responsible AI → Hallucination mitigation & behavioral audit

## Compile PDF

Requires a LaTeX distribution (TeX Live, MiKTeX, or Tectonic).

```bash
cd "V2 Hackaton/global-south-ais-template-main"

# Generate figure PDFs if missing (needs rsvg-convert):
# rsvg-convert -f pdf -o ../evaluation/results/figures/fig1_fpr.pdf ../evaluation/results/figures/fig1_fpr.svg
# rsvg-convert -f pdf -o ../evaluation/results/figures/fig2_metrics.pdf ../evaluation/results/figures/fig2_metrics.svg

pdflatex report.tex
pdflatex report.tex   # second pass for references/figures
# Output: report.pdf
```

**Arch Linux / CachyOS:** `sudo pacman -S texlive-basic texlive-latex texlive-latexrecommended texlive-fontsrecommended`

## Report structure (matches official Word template)

| Section | In `report.tex` |
|---|---|
| Title, authors, affiliations, “With Apart Research” | Title block |
| Abstract (~150 words) | Yes |
| 1. Introduction + contributions | Yes |
| 2. Related Work | Yes |
| 3. Methods | Yes |
| 4. Results (tables + 2 figures) | Yes |
| 5. Discussion and Limitations (+ dual use) | Yes |
| 6. Conclusion | Yes |
| Code and Data | Yes |
| Author Contributions | Yes |
| References | Yes |
| LLM Usage Statement | Yes |

## Submission links to include (already in report)

- Repo: https://github.com/AXLAAF/V2-Hackathon
- Demo: https://hackaton.xooktech.com/

## Support

- Discord: @Kamil Alaa — https://discord.gg/GW5ZSRt75d
- Email: sprints@apartresearch.com / kamil@apartresearch.com
