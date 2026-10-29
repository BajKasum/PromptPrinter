# PromptPrinter, Logo

Das Original-Finn (`public/mascot/dolphin.png`, nur der transparente Rand abgeschnitten, sonst
unverändert) links, daneben der Schriftzug `promptprinter` in Kleinbuchstaben: "prompt" in Blau,
"printer" in Schwarz, auf weißem Grund.

## Dateien

| Datei | Wofür |
|---|---|
| `promptprinter-logo.pdf` | 400 mm breit, weißer Grund, Schriftzug als Vektor, Finn in voller Auflösung. **Für den Druck und die Wand** |
| `promptprinter-logo.png` | 4800 px breit, weißer Grund. Für Dokumente und kleine Drucke |
| `promptprinter-logo-transparent.png` | 4800 px breit, transparent |
| `promptprinter-logo.svg` | Schriftzug als Vektor, Finn als eingebettetes Bild (3,4 MB), transparent |
| `promptprinter-finn.png` | Finn allein, 1434 x 1450 px, transparent |
| `promptprinter-pp-logo.png` | Das Logo mit `/pp` in Blau hinter dem Schriftzug, 5737 px breit, weißer Grund. Für den Skill `/pp` (README von `promptprinter-pp`) und Dokumente |
| `promptprinter-pp-logo-transparent.png` | dasselbe, 5737 px breit, transparent |
| `promptprinter-pp-logo.svg` | dasselbe als SVG: Schriftzug und `/pp` als Vektor, Finn als eingebettetes Bild (3,4 MB), transparent |

Der Schriftzug ist in Kurven umgewandelt: keine Schrift nötig, nichts verschiebt sich beim Öffnen auf
einem fremden Rechner oder in der Druckerei. Finn ist ein Bild, kein Vektor: bei sehr großen Drucken
(Logo breiter als rund 1,5 m) wird er weich.

## Farben des Schriftzugs

Exakt die Token aus `src/app/globals.css` (hell), als Hex gerechnet.

| Hex | Token | Wo |
|---|---|---|
| `#15679d` | `--accent-text` | "prompt" |
| `#0c0f13` | `--foreground`, `--primary` | "printer" |

## Regeln

- **Schutzraum:** rundherum mindestens so viel Platz wie die Höhe des Buchstabens "o".
- **Mindestgröße:** Logo 120 px oder 30 mm breit.
- **Hintergrund:** weiß oder sehr hell. Das schwarze "printer" verschwindet auf dunklem Grund.
- **Nicht:** Farben tauschen, Finn spiegeln oder verzerren, den Schriftzug in einer anderen Schrift
  setzen, "prompt" und "printer" durch ein Leerzeichen trennen.

## Schriftzug

Geist SemiBold (Gewicht 600) wie in der App, Buchstabenabstand `-0.02em`, an der Naht zwischen den
beiden Wörtern etwas mehr Luft.

## Die Fassung mit `/pp`

Finn und der Schriftzug `promptprinter` sind unverändert: das SVG ist das SVG oben, nur mit einer
Gruppe `pp` hinter dem Schriftzug (Finn und beide Pfade Zeichen für Zeichen gleich, geprüft). Rechts
steht `/pp` in dem Blau von "prompt" (`#15679d`), in derselben Schrift, Größe und mit demselben
Buchstabenabstand, ohne Extra-Luft vor dem Schrägstrich. Die zwei `p` sind der Pfad des `p` aus
"prompt", der Schrägstrich ein Parallelogramm, an der Geist-Schrift gemessen (Schrägstrich 25,2
Einheiten dick, von 22 Einheiten unter bis 150 über der Grundlinie). Pixel je Einheit wie beim Logo
oben, das Bild ist also nur länger, Finn und die Buchstaben sind gleich groß. Schutzraum, Mindestgröße
(hier 145 px oder 36 mm breit) und die übrigen Regeln gelten wie oben.
