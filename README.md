# Tijdreis

Tijdreis toont één plek in Nederland door de jaren heen. Historische topografische kaarten en luchtfoto’s worden achter elkaar gezet, zodat de plek als een film afspeelt.

## Wat je ermee doet

Open de pagina in een browser. Zonder bewaarde plek gebruikt de pagina je huidige locatie op zoom 10. Lukt dat niet, of ligt die locatie buiten Nederland, dan opent een vast punt op zoom 11.

Sleep de kaart en zoom met het scrollwiel of met een knijpbeweging. Kies het jaar en het bereik van Van tot Tot. **Laden** vergrendelt dat beeld en haalt de jaren op.

Daarna blijft links de gekozen laag staan: satelliet als dat vakje aan staat, anders de kaart. Rechts staat de andere laag. De verticale scheiding is te verslepen. De tijdbalk loopt door de jaren; beide lagen blijven zichtbaar volgens die scheiding. Ontbreekt een beeld, dan blijft het vorige staan. Is er nog niets eerder, dan verschijnt een doorkruist pictogram.

**Verplaatsen** maakt de kaart weer vrij. De volgende verschuiving of zoom wist de opgeslagen tegels.

**Afspelen** loopt door de jaren. Zonder lineaire tijd krijgt een nieuw beeld de volle duur en een herhaling een kwart. Met lineaire tijd duurt elk jaar even lang.

**WebM** neemt die film op. In satellietstand begint de opname bij het eerste jaar met een luchtfoto, niet bij de lege jaren ervoor. **Zip** bewaart de kant-en-klare beelden plus één HTML-pagina. Na het uitpakken opent `index.html` zonder internet: afspelen, de tijdbalk en de scheiding werken, de losse tegels zitten er niet in.

## Hoe het werkt

De pagina is één `index.html` met `app.js`. Er is geen eigen server. De browser vraagt de kaartlagen op, haalt de tegels voor het gekozen beeld op en tekent ze op een vlak van 1280×720. Gelijk ogende bladen worden niet opnieuw opgehaald.

Het jaar en de bronregel worden pas bij het tonen op het beeld gezet. Ze zitten niet in het bewaarde JPEG-bestand.

Een geladen film, de plek en de laatste instellingen blijven in deze browser: de film in IndexedDB, de instellingen in `localStorage`, de tegels in de Cache API. **Vergeet opgeslagen tegels** in het hulpscherm leegt alleen die tegelvoorraad.

Op een telefoon schaalt de pagina mee met staand en liggend beeld. Na het laden verdwijnen de zoekvelden en blijft één regel over met het jaarbereik, Verplaatsen, lineaire tijd en satelliet.

## Welke data

De kaarttegels komen van de tiled services van Esri Nederland:

`https://tiles.arcgis.com/tiles/nSZVuSZjHpEZZbRo/arcgis/rest/services`

- Historische kaarten: lagen `Historische_tijdreis_*`, vanaf het begin van de reeks (rond 1815) tot het nieuwste jaar dat de dienst aanbiedt. Bron: Kadaster, Topotijdreis.
- Luchtfoto’s: vanaf 2006, onder meer `Luchtfoto_*`, de 50cm-lagen rond 2012–2015, en `HR_Luchtfoto_*` voor de recente jaren. Bron: Beeldmateriaal.nl, Kadaster.

Zoeken naar een plaats gaat via de PDOK Locatieserver (CC0). Levert die niets op, dan volgt een zoekactie bij Nominatim (OpenStreetMap), beperkt tot Nederland. Een geplakte Topotijdreis-link of RD-coördinaten worden ook herkend.

De diensten zelf blijven bij Esri en het Kadaster. Deze pagina bewaart alleen wat de browser voor dit beeld heeft opgehaald, en vermeldt de bron op de beelden en in de zip-viewer.
