# Kakhielotheek

Maak je eigen kakhiel: een stockfoto met tekstballonnen erop, in de stijl van [Kakhiel](https://www.kakhiel.nl).

Fan-speeltje, niet van Kakhiel zelf.

## Wat kan het

- **Foto kiezen**: upload er zelf een (ook slepen of plakken met Ctrl/Cmd+V), of druk op **Shuffle stockfoto**.
  - Zonder zoekwoord: willekeurige foto van [Lorem Picsum](https://picsum.photos) (Unsplash-foto's).
  - Met zoekwoord: willekeurige foto uit [Openverse](https://openverse.org) (Creative Commons / publiek domein). Engelse zoekwoorden werken het best.
  - Naam van de fotograaf en licentie staan onder de foto.
- **Formaat**: origineel, vierkant 1:1, staand 4:5 of liggend 16:9 (wordt in het midden bijgesneden).
- **Ballonnen**: witte ballon met zwarte tekst of zwarte ballon met witte tekst, in Arial Black, de letter die Kakhiel zelf gebruikt.
  - Slepen om te verplaatsen, aan de hoekjes trekken om te schalen (Shift = verhouding vast), roze bolletje = staartje.
  - Dubbeltik op een ballon om de tekst te bewerken. Enter maakt een nieuwe regel.
  - Ovaal of blok, staartje en randje aan/uit, lettergrootte automatisch of handmatig.
  - Kopie, naar voren, verwijderen, ongedaan maken (Ctrl/Cmd+Z), pijltjestoetsen om te schuiven.
- **Wissel van foto, houd je grap**: ballonnen blijven staan als je een nieuwe foto shufflet.
- **Download** als JPG, of **Delen** op je telefoon.

## Lettertype

Kakhiel gebruikt Arial Black. Op Windows, macOS en iOS is die er standaard. Op Android en Linux valt de app terug op [Archivo Black](https://fonts.google.com/specimen/Archivo+Black) (Google Fonts), die er vrijwel hetzelfde uitziet.

## Lokaal draaien

Geen build-stap, gewoon statische bestanden:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Online zetten met GitHub Pages

Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
GitHub Pages werkt gratis voor publieke repo's; voor een privé-repo heb je GitHub Pro nodig.

## Bestanden

- `index.html`: opmaak van de pagina
- `style.css`: Kakhiel-achtige stijl (felroze, zwart, wit, dikke randen)
- `app.js`: canvas-editor, foto's ophalen en exporteren
