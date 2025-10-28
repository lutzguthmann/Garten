import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';

const API_KEY = process.env.API_KEY;

// --- TYPE DEFINITIONS ---
interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    plantName?: string;
    imageUrl?: string;
    additionalText?: string;
    careGuide?: string;
    isGeneratingMore?: boolean;
    isGeneratingCareGuide?: boolean;
    isGeneratingImage?: boolean;
    source?: 'custom' | 'janasGarten' | null;
}

interface BasePlant {
    name: string;
    pruningTime: string;
    description: string;
    imageUrl?: string;
    isLoadingImage?: boolean;
    additionalDescription?: string;
    careGuide?: string;
    isGeneratingDetails?: boolean;
    isGeneratingCareGuide?: boolean;
}

interface CustomPlant extends BasePlant {
    type: 'custom';
    id: string;
}

interface JanasGartenPlant extends BasePlant {
    type: 'janasGarten';
}

interface CatalogPlant {
    type: 'catalog';
    name: string;
}

type Plant = CustomPlant | JanasGartenPlant | CatalogPlant;
type FontSize = 'small' | 'medium' | 'large';
type Theme = 'light' | 'dark';
type View = 'main' | 'recommendations' | 'explanation';
type ModalType = 'plantDetails' | 'plantForm';
type LiveConnectionState = 'idle' | 'connecting' | 'listening' | 'error';
interface LiveTranscriptEntry {
    speaker: 'user' | 'model';
    text: string;
    isFinal: boolean;
}
type PlantListView = 'meine' | 'janas' | 'alle';


// --- INITIAL DATA & CONSTANTS ---
const PLANT_CATALOG: { [category: string]: string[] } = {
    'Obst & Beeren': ['Apfelbaum', 'Apfelbeere (Aronia)', 'Aprikosenbaum', 'Birnbaum', 'Boysenbeere', 'Brombeere', 'Cranberry', 'Erdbeere', 'Goji-Beere', 'Heidelbeere', 'Himbeere', 'Honigbeere (Maibeere)', 'Japanische Weinbeere', 'Jochelbeere', 'Johannisbeere', 'Jostabeere', 'Kirschbaum', 'Maulbeere', 'Mirabelle', 'Nektarine', 'Pfirsichbaum', 'Pflaumenbaum', 'Preiselbeere', 'Quitte', 'Sanddorn', 'Sauerkirsche', 'Stachelbeere', 'Süßkirsche', 'Taybeere', 'Weichselkirsche', 'Weinrebe'],
    'Ziersträucher': ['Amberbaum', 'Bartblume', 'Berberitze', 'Blut-Johannisbeere', 'Buchsbaum', 'Deutzie', 'Fasanenspiere', 'Felsenbirne', 'Fingerstrauch', 'Flieder', 'Forsythie', 'Ginster', 'Glanzmispel', 'Hartriegel', 'Haselnuss', 'Hibiskus', 'Holunder', 'Hortensie', 'Jasmin', 'Kamelie', 'Kirschlorbeer', 'Kolkwitzie (Perlmuttstrauch)', 'Korkenzieherhasel', 'Kornelkirsche', 'Lavendel', 'Lorbeerrose (Kalmie)', 'Magnolie', 'Mahonie', 'Pfeifenstrauch (Falscher Jasmin)', 'Pfingstrose', 'Ranunkelstrauch', 'Rhododendron', 'Rose', 'Scheinhasel', 'Schneeball', 'Seidelbast', 'Skimmie', 'Sommerflieder', 'Spierstrauch', 'Spindelstrauch', 'Strauchpappel', 'Tamariske', 'Viburnum', 'Weigelie', 'Winterblüte', 'Zaubernuss', 'Zierapfel', 'Zierjohannisbeere'],
    'Stauden & Blumen': ['Akelei', 'Anemone', 'Astilbe', 'Aster', 'Bergenie', 'Christrose', 'Chrysantheme', 'Coreopsis (Mädchenauge)', 'Cosmea', 'Dahlie', 'Edelweiß', 'Eisenhut', 'Fetthenne (Sedum)', 'Fingerhut', 'Frauenmantel', 'Funkie', 'Gaura (Prachtkerze)', 'Geranie', 'Gladiole', 'Glockenblume', 'Heidekraut', 'Helenium (Sonnenbraut)', 'Iris', 'Katzenminze', 'Kornblume', 'Lampionblume', 'Lavatera (Strauchmalve)', 'Liatris (Prachtscharte)', 'Lilie', 'Löwenmäulchen', 'Lupine', 'Margerite', 'Mohn', 'Montbretie', 'Narzisse', 'Nelke', 'Petunie', 'Phlox', 'Primel', 'Ringelblume', 'Rittersporn', 'Salvie', 'Schafgarbe', 'Schleierkraut', 'Sonnenauge', 'Sonnenblume', 'Sonnenhut', 'Steinkraut', 'Stiefmütterchen', 'Stockrose', 'Storchschnabel', 'Taglilie', 'Tränendes Herz', 'Tulpe', 'Verbene', 'Vergissmeinnicht', 'Veilchen', 'Zinnie'],
    'Kräuter': ['Anis', 'Basilikum', 'Bohnenkraut', 'Borretsch', 'Brunnenkresse', 'Dill', 'Estragon', 'Kamille', 'Kerbel', 'Knoblauchsrauke', 'Koriander', 'Kümmel', 'Liebstöckel', 'Lorbeer', 'Majoran', 'Minze', 'Oregano', 'Petersilie', 'Pimpinelle', 'Rosmarin', 'Salbei', 'Sauerampfer', 'Schnittlauch', 'Thymian', 'Waldmeister', 'Ysop', 'Zitronenmelisse'],
    'Kletterpflanzen': ['Akebie', 'Blauregen', 'Clematis', 'Efeu', 'Geißblatt', 'Hopfen', 'Jelängerjelieber', 'Kletterhortensie', 'Kletterrose', 'Klettertrompete', 'Passionsblume', 'Prunkwinde', 'Schwarzäugige Susanne', 'Sternjasmin', 'Wilder Wein'],
    'Hecken & Nadelgehölze': ['Bambus', 'Berberitze', 'Eibe', 'Fichte', 'Feuerdorn', 'Glanzmispel', 'Hainbuche', 'Ilex (Stechpalme)', 'Kiefer', 'Lebensbaum', 'Leyland-Zypresse', 'Liguster', 'Rotbuche', 'Scheinzypresse', 'Tanne', 'Thuja', 'Wacholder', 'Weißdorn', 'Zeder'],
    'Gemüse': ['Aubergine', 'Blumenkohl', 'Bohne', 'Brokkoli', 'Chili', 'Erbse', 'Fenchel', 'Gurke', 'Karotte', 'Kartoffel', 'Knoblauch', 'Kohlrabi', 'Kürbis', 'Lauch', 'Mangold', 'Paprika', 'Pastinak', 'Radieschen', 'Rettich', 'Rosenkohl', 'Rote Bete', 'Salat', 'Sellerie', 'Spargel', 'Spinat', 'Süßkartoffel', 'Tomate', 'Topinambur', 'Zucchini', 'Zwiebel'],
    'Gräser & Farne': ['Bärenfellgras', 'Blauschwingel', 'Chinaschilf', 'Federgras', 'Hirschzungenfarn', 'Japan-Segge', 'Lampenputzergras', 'Pampasgras', 'Rotschwingel', 'Schildfarn', 'Straußenfarn', 'Wurmfarn'],
};
const INITIAL_JANAS_GARTEN_PLANTS: JanasGartenPlant[] = [
    { name: 'Alpenveilchen-Narzisse (\'Tête à tête\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Beliebte, kleinwüchsige Narzisse, ideal für Töpfe und Steingärten.', type: 'janasGarten' },
    { name: 'Amberbaum (\'Worplesdon\')', pruningTime: 'Winter (Februar) – nur bei Bedarf', description: 'Beeindruckt mit einer spektakulären, sternförmigen Blattform und leuchtenden Herbstfarben.', type: 'janasGarten' },
    { name: 'Atlantisches Hasenglöckchen', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Verwildert leicht und bildet dichte, blaue Blütenteppiche im lichten Schatten.', type: 'janasGarten' },
    { name: 'Ausdauerndes Silberblatt (Mondviole)', pruningTime: 'Spätsommer (nach Samenreife)', description: 'Bekannt für seine dekorativen, silbernen Samenschoten, die in Trockensträußen beliebt sind.', type: 'janasGarten' },
    { name: 'Balkan-Krokus (\'Cream Beauty\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Ein zarter, cremeweißer Frühlingsbote, der sich gut für Rasenflächen eignet.', type: 'janasGarten' },
    { name: 'Balkan-Storchschnabel (\'Bevan\')', pruningTime: 'Sommer (Juni, nach Blüte)', description: 'Robuster, aromatischer Bodendecker mit leuchtend magentafarbenen Blüten.', type: 'janasGarten' },
    { name: 'Balkan-Storchschnabel, wintergrün (\'Czakor\')', pruningTime: 'Sommer (Juni, nach Blüte)', description: 'Dichter, wintergrüner Bodendecker, der Unkraut effektiv unterdrückt.', type: 'janasGarten' },
    { name: 'Bärlauch', pruningTime: 'Kein Rückschnitt nötig', description: 'Aromatisches Wildkraut mit intensivem Knoblauchduft, ideal für Pesto und Salate.', type: 'janasGarten' },
    { name: 'Bärentatze (\'Mornings Candle\')', pruningTime: 'Frühjahr (März)', description: 'Architektonische Staude mit imposanten, distelartigen Blütenständen.', type: 'janasGarten' },
    { name: 'Beetrose (\'Planten un Blomen\')', pruningTime: 'Frühjahr (März)', description: 'Eine öfterblühende Rose mit nostalgischem Charme und guter Blattgesundheit.', type: 'janasGarten' },
    { name: 'Berberitze (\'Aurea\')', pruningTime: 'Sommer (Juli)', description: 'Leuchtend gelblaubiger Strauch, der als Farbtupfer im Garten dient.', type: 'janasGarten' },
    { name: 'Bergenie (\'Flirt\')', pruningTime: 'Frühjahr (März)', description: 'Kompakte Sorte mit glänzendem, wintergrünem Laub und früher Blüte.', type: 'janasGarten' },
    { name: 'Bergenie (\'Silberlicht\')', pruningTime: 'Frühjahr (März, nach Winter)', description: 'Blüht in zartem Weiß und Rosa; das Laub färbt sich im Winter rötlich.', type: 'janasGarten' },
    { name: 'Bodendeckerrose (\'Jazz\')', pruningTime: 'Frühjahr (März)', description: 'Sehr robuste und pflegeleichte Rose mit farbwechselnden Blüten.', type: 'janasGarten' },
    { name: 'Bodendeckerrose (\'Topolina\')', pruningTime: 'Frühjahr (März)', description: 'Winzige, aber zahlreiche Blüten machen sie zu einem charmanten Bodendecker.', type: 'janasGarten' },
    { name: 'Brombeere, aufrecht (\'Navaho\')', pruningTime: 'Spätherbst (nach Ernte) & Frühjahr', description: 'Stachellose Sorte mit aufrechtem Wuchs, erleichtert die Ernte.', type: 'janasGarten' },
    { name: 'Buschwindröschen', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Einheimischer Waldbewohner, der im Frühling weiße Blütenteppiche bildet.', type: 'janasGarten' },
    { name: 'Chinaschilf (\'Kaskade\')', pruningTime: 'Spätwinter (Februar)', description: 'Elegantes Ziergras mit überhängenden, federartigen Blütenwedeln.', type: 'janasGarten' },
    { name: 'Dalmatiner-Krokus (\'Roseus\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Zarter Krokus in einem ungewöhnlichen Rosaton.', type: 'janasGarten' },
    { name: 'Dreiblattspiere', pruningTime: 'Spätherbst (Oktober)', description: 'Fein strukturierter Bodendecker für schattige Bereiche, breitet sich langsam aus.', type: 'janasGarten' },
    { name: 'Echte Felsenbirne', pruningTime: 'Winterende (Februar)', description: 'Wertvolles Wildobstgehölz mit essbaren Früchten und toller Herbstfärbung.', type: 'janasGarten' },
    { name: 'Edelflieder/Herbstflieder (\'Dark Purple\')', pruningTime: 'Frühsommer (Mai, nach erster Blüte)', description: 'Blüht im Frühjahr und oft ein zweites Mal im Herbst mit intensivem Duft.', type: 'janasGarten' },
    { name: 'Elfenblume (\'Blütentanz\')', pruningTime: 'Spätwinter (Februar)', description: 'Anspruchsloser Bodendecker für Schatten, mit zierlichen, zweifarbigen Blüten.', type: 'janasGarten' },
    { name: 'Elfenblume (\'Cupreum\')', pruningTime: 'Spätwinter (Februar)', description: 'Das junge Laub im Frühling hat eine attraktive rötliche Färbung.', type: 'janasGarten' },
    { name: 'Elfenblume (\'Frohnleiten\')', pruningTime: 'Spätwinter (Februar)', description: 'Sehr wüchsige und robuste Sorte mit leuchtend gelben Blüten.', type: 'janasGarten' },
    { name: 'Elfenblume (\'Galadriel\')', pruningTime: 'Spätwinter (Februar)', description: 'Bildet dichte Teppiche und zeigt im Herbst eine schöne Laubfärbung.', type: 'janasGarten' },
    { name: 'Fasanenspiere, dunkelrot (\'Midnight\')', pruningTime: 'Frühjahr (März)', description: 'Besonders dunkellaubiger Strauch, der einen starken Kontrast im Beet setzt.', type: 'janasGarten' },
    { name: 'Französischer Estragon', pruningTime: 'Spätherbst (Oktober)', description: 'Das "echte" Estragon mit feinem, anishaltigem Aroma für die Gourmetküche.', type: 'janasGarten' },
    { name: 'Frühlings-Garten-Alpenveilchen', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Hardy Cyclamen, das im späten Winter oder frühen Frühling blüht.', type: 'janasGarten' },
    { name: 'Frühlings-Krokus (\'Flower Record\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Klassischer, großblumiger Krokus in einem tiefen Violett.', type: 'janasGarten' },
    { name: 'Funkie (\'Ann Kulpa\')', pruningTime: 'Spätherbst (nach Frost)', description: 'Mittelgroße Hosta mit einem auffälligen, cremeweißen Zentrum und grünem Rand.', type: 'janasGarten' },
    { name: 'Funkie (\'Blue Mouse Ears\')', pruningTime: 'Spätherbst (nach Frost)', description: 'Miniatur-Hosta mit dicken, blaugrünen Blättern, die an Mauseohren erinnern.', type: 'janasGarten' },
    { name: 'Funkie (\'Cherry Berry\')', pruningTime: 'Spätherbst (nach Frost)', description: 'Besitzt schmale Blätter mit cremefarbenem Zentrum und rote Blattstiele.', type: 'janasGarten' },
    { name: 'Funkie (\'Dream Weaver\')', pruningTime: 'Spätherbst (nach Frost)', description: 'Große Hosta mit breitem, blaugrünem Rand und einem cremeweißen Herzen.', type: 'janasGarten' },
    { name: 'Funkie (\'Green Acres\')', pruningTime: 'Spätherbst (nach ersten Frösten)', description: 'Eine riesige, einfarbig grüne Hosta, die einen beeindruckenden Solitär bildet.', type: 'janasGarten' },
    { name: 'Funkie (\'Pauls Glory\')', pruningTime: 'Spätherbst (nach Frost)', description: 'Die Blattmitte färbt sich im Laufe des Sommers von Chartreuse zu Goldgelb.', type: 'janasGarten' },
    { name: 'Garten Aster (\'Prince\')', pruningTime: 'Frühjahr (März)', description: 'Kompakte Aster mit leuchtend violetten Blüten im Spätsommer.', type: 'janasGarten' },
    { name: 'Gelber Hundszahn (\'Pagoda\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Elegante Zwiebelpflanze mit zurückgebogenen, gelben Blütenblättern.', type: 'janasGarten' },
    { name: 'Gelber Krokus', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Leuchtend gelber Krokus, einer der ersten Farbtupfer im Jahr.', type: 'janasGarten' },
    { name: 'Glanzmispel (\'Devil\'s Dream\')', pruningTime: 'Frühjahr (April, nach dem Neuaustrieb)', description: 'Der rote Blattaustrieb ist besonders intensiv und leuchtend.', type: 'janasGarten' },
    { name: 'Goldliguster (\'Aureum\')', pruningTime: 'Sommer (Juni) und Spätsommer (August)', description: 'Immergrüner Strauch mit gelbgerandeten Blättern, ideal für helle Hecken.', type: 'janasGarten' },
    { name: 'Großblütige Taubnessel', pruningTime: 'Spätherbst (Oktober)', description: 'Effektiver Bodendecker für schattige Plätze mit silbrig gefleckten Blättern.', type: 'janasGarten' },
    { name: 'Großblütiges Schneeglöckchen', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Besonders große und stattliche Sorte des beliebten Frühlingsboten.', type: 'janasGarten' },
    { name: 'Große Blaublatt-Funkie (\'Elegans\')', pruningTime: 'Spätherbst (nach Frost)', description: 'Imposante Hosta mit riesigen, blau bereiften und gewellten Blättern.', type: 'janasGarten' },
    { name: 'Herbstanemone (\'Prinz Heinrich\')', pruningTime: 'Spätwinter (Ende Feb./Anfang März)', description: 'Blüht spät im Jahr mit halbgefüllten, intensiv pinken Blüten.', type: 'janasGarten' },
    { name: 'Herbstfetthenne, rot (\'Matrona\')', pruningTime: 'Frühjahr (März)', description: 'Stattliche Staude mit rötlichen Stielen und rosa Blütendolden, die Bienen anlocken.', type: 'janasGarten' },
    { name: 'Herbsthimbeere (\'Aroma Queen\')', pruningTime: 'Winter (Februar)', description: 'Trägt Früchte an den diesjährigen Ruten und hat ein ausgezeichnetes Aroma.', type: 'janasGarten' },
    { name: 'Herbsthimbeere (\'Autum Bliss\')', pruningTime: 'Winter (Februar)', description: 'Eine robuste und ertragreiche Sorte für die späte Ernte.', type: 'janasGarten' },
    { name: 'Hohes Eisenkraut', pruningTime: 'Frühjahr (April)', description: 'Luftige, hohe Staude mit violetten Blüten, die zwischen anderen Pflanzen zu schweben scheinen.', type: 'janasGarten' },
    { name: 'Jakobsleiter (\'Hopleys\')', pruningTime: 'Sommer (Juni/Juli, nach Blüte)', description: 'Besitzt attraktiv gefiederte Blätter und himmelblaue Blüten.', type: 'janasGarten' },
    { name: 'Japanwaldgras', pruningTime: 'Spätwinter (Februar)', description: 'Malerisch überhängendes Gras, das an einen Bambus erinnert und sich im Herbst gelb färbt.', type: 'janasGarten' },
    { name: 'Jochelbeere (\'Jostabeere\')', pruningTime: 'Sommer (Juli/August, direkt nach Ernte)', description: 'Kreuzung aus Johannisbeere und Stachelbeere mit großen, aromatischen Früchten.', type: 'janasGarten' },
    { name: 'Kaiserkrone, gelb', pruningTime: 'Sommer (Juni, nach Einziehen)', description: 'Imposante Zwiebelpflanze mit einem Kranz aus glockenförmigen Blüten.', type: 'janasGarten' },
    { name: 'Karpatenglockenblume, blau-weiß (\'Samantha\')', pruningTime: 'Sommer (Juli, nach erster Blüte)', description: 'Eine flach wachsende Glockenblume, die reich und lange blüht.', type: 'janasGarten' },
    { name: 'Karpatenglockenblume, weiß (\'Weiße Clips\')', pruningTime: 'Sommer (Juli, nach Blüte)', description: 'Bildet dichte Polster mit unzähligen weißen, schalenförmigen Blüten.', type: 'janasGarten' },
    { name: 'Kaukasus Vergissmeinnicht (\'Jack Frost\')', pruningTime: 'Spätsommer (August)', description: 'Besitzt wunderschöne, silbrig überhauchte Blätter mit grünen Adern.', type: 'janasGarten' },
    { name: 'Kissenastern (\'Herbstgruß vom Bresserhof\')', pruningTime: 'Frühjahr (März)', description: 'Bildet dichte, blütenreiche Kissen im Herbstgarten.', type: 'janasGarten' },
    { name: 'Kissenastern (\'Prof. Anton Kippenberg\')', pruningTime: 'Frühes Frühjahr (März)', description: 'Eine bewährte Sorte mit halbgefüllten, lavendelblauen Blüten.', type: 'janasGarten' },
    { name: 'Kleine Netzblatt-Iris, blau (\'Harmony\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Blüht sehr früh im Jahr mit intensiv blauen, orchideenartigen Blüten.', type: 'janasGarten' },
    { name: 'Kleine Traubenhyazinthe, blau (\'Superstar\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Klassische, leuchtend blaue Zwiebelblume für den Frühlingsgarten.', type: 'janasGarten' },
    { name: 'Kleines Schneeglöckchen', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Der Inbegriff des Vorfrühlings, oft schon im Schnee blühend.', type: 'janasGarten' },
    { name: 'Kleinblumige Taglilie, rosa (\'Janice Brown\')', pruningTime: 'Herbst (Oktober)', description: 'Besonders reizvolle Blüte mit einem rosa Rand und grünem Schlund.', type: 'janasGarten' },
    { name: 'Kopfgras', pruningTime: 'Frühjahr (März)', description: 'Ein immergrünes Gras, das ordentliche, halbkugelige Horste bildet.', type: 'janasGarten' },
    { name: 'Krauser Wurmfarn (\'Crispa Cristata\')', pruningTime: 'Spätwinter (Februar)', description: 'Ein wintergrüner Farn mit interessant gekrausten und an den Spitzen gekämmten Wedeln.', type: 'janasGarten' },
    { name: 'Kugel-Blumenesche (\'Meczek\')', pruningTime: 'Winter (Jan/Feb)', description: 'Kleinbleibender Baum mit einer von Natur aus dichten, kugeligen Krone.', type: 'janasGarten' },
    { name: 'Kuhschelle', pruningTime: 'Sommer (Juni, nach Samenreife)', description: 'Frühe Frühlingsblume mit behaarten Knospen und dekorativen, fedrigen Samenständen.', type: 'janasGarten' },
    { name: 'Kuhschelle (\'Alba\')', pruningTime: 'Sommer (Juni)', description: 'Eine weiße Variante der bezaubernden, heimischen Wildstaude.', type: 'janasGarten' },
    { name: 'Lampenputzergras (\'Hameln\')', pruningTime: 'Spätwinter (Februar)', description: 'Kompaktes Ziergras mit flauschigen, bürstenartigen Blütenständen im Spätsommer.', type: 'janasGarten' },
    { name: 'Lenzrose', pruningTime: 'Spätwinter (Februar)', description: 'Blüht zuverlässig im späten Winter und ist eine wertvolle erste Nahrungsquelle für Bienen.', type: 'janasGarten' },
    { name: 'Liebstöckel', pruningTime: 'Herbst (Oktober, nach dem Abwelken)', description: 'Auch als Maggikraut bekannt, ein kräftiges Würzkraut für Suppen und Eintöpfe.', type: 'janasGarten' },
    { name: 'Lilienblütige Tulpe, rosa (\'Mariette\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Elegante Tulpe mit spitzen, nach außen gebogenen Blütenblättern.', type: 'janasGarten' },
    { name: 'Lilienblütige Tulpe, tiefrot (\'Pieter de Leur\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Eine dramatische, dunkelrote Tulpe mit einer sehr eleganten Form.', type: 'janasGarten' },
    { name: 'Lilientraube (\'Big Blue\')', pruningTime: 'Frühjahr (März)', description: 'Spätblühende, grasartige Staude mit ährenförmigen, violetten Blüten.', type: 'janasGarten' },
    { name: 'Middendorffs Taglilie', pruningTime: 'Herbst (Oktober)', description: 'Eine früh blühende, robuste Wildart mit leuchtend gelben Blüten.', type: 'janasGarten' },
    { name: 'Nelkenwurz (\'Flames of Passion\')', pruningTime: 'Sommer (Juni, nach Blüte)', description: 'Halbgefüllte, leuchtend rote Blüten an dunklen Stielen.', type: 'janasGarten' },
    { name: 'Nelkenwurz (\'Mai Tai\')', pruningTime: 'Sommer (Juni, nach erster Blüte)', description: 'Verzaubert mit einem Farbspiel von Apricot bis Rosa in ihren Blüten.', type: 'janasGarten' },
    { name: 'Oregano, Dost', pruningTime: 'Hochsommer (Juli, Vollblüte)', description: 'Heimisches Wildkraut, das nicht nur in der Küche, sondern auch bei Insekten sehr beliebt ist.', type: 'janasGarten' },
    { name: 'Osterschneeball', pruningTime: 'Frühling (April, direkt nach Blüte)', description: 'Duftet intensiv und blüht mit rosa Knospen, die sich weiß öffnen.', type: 'janasGarten' },
    { name: 'Perlkörbchen (\'Silberregen\')', pruningTime: 'Spätherbst (Nov)', description: 'Silberlaubige Staude mit kleinen, weißen Kugelblüten, die sich gut zum Trocknen eignen.', type: 'janasGarten' },
    { name: 'Pfauenaugen-Narzisse', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Spät blühende Dichternarzisse mit intensivem Duft und einem kleinen, rotgerandeten Auge.', type: 'janasGarten' },
    { name: 'Pilzkopf-Segge (\'The Beatles\')', pruningTime: 'Frühjahr (März)', description: 'Ein lustiges, immergrünes Gras mit überhängenden Halmen, das an eine Mähne erinnert.', type: 'janasGarten' },
    { name: 'Polsterglockenblume (\'Lisduggan\')', pruningTime: 'Sommer (Juni, direkt nach erster Blüte)', description: 'Eine wüchsige Polsterstaude mit sternförmigen, zartrosa Blüten.', type: 'janasGarten' },
    { name: 'Prager Schneeball', pruningTime: 'Spätfrühling (Mai/Juni, direkt nach Blüte)', description: 'Immergrüner Strauch mit glänzendem Laub und duftenden, weißen Blütendolden.', type: 'janasGarten' },
    { name: 'Purpurblauer Steinsame', pruningTime: 'Sommer (Juli, nach Blüte)', description: 'Kriechender Bodendecker mit intensiv enzianblauen Blüten im Frühling.', type: 'janasGarten' },
    { name: 'Rhabarber (\'Vierländer Blut\')', pruningTime: 'Spätherbst (Oktober, nach erstem Frost)', description: 'Eine rotstielige Sorte mit gutem Geschmack für Kuchen und Kompott.', type: 'janasGarten' },
    { name: 'Rosenwaldmeister', pruningTime: 'Herbst (nach Blüte) oder Frühjahr', description: 'Ein charmanter Bodendecker mit quirlständigen Blättern und rosa Blüten.', type: 'janasGarten' },
    { name: 'Salomonssiegel (Vielblütiges)', pruningTime: 'Spätherbst (nach Einziehen)', description: 'Elegante Schattenstaude mit gebogenen Stielen und hängenden, weißen Glöckchen.', type: 'janasGarten' },
    { name: 'Säuleneibe (\'Fastigiata Robusta\')', pruningTime: 'Spätsommer (August)', description: 'Eine sehr schlanke, aufrechte Form der Eibe für vertikale Akzente.', type: 'janasGarten' },
    { name: 'Säulenberberitze, gelb (\'Golden Rocket\')', pruningTime: 'Sommer (Juli)', description: 'Streng aufrecht wachsender Strauch mit leuchtend gelbem Laub.', type: 'janasGarten' },
    { name: 'Säulenholunder, rot (\'Black Tower\')', pruningTime: 'Spätwinter (Februar/März)', description: 'Schlank wachsender Holunder mit dunkelrotem Laub und rosa Blüten.', type: 'janasGarten' },
    { name: 'Schnittlauch', pruningTime: 'Ganzjährige Ernte; Rückschnitt nach Blüte', description: 'Unverzichtbares Küchenkraut, dessen lila Blüten ebenfalls essbar sind.', type: 'janasGarten' },
    { name: 'Schön-Aster (\'Alba\')', pruningTime: 'Frühjahr (März)', description: 'Eine Wildaster mit unzähligen kleinen, weißen Blüten, die eine Wolke bilden.', type: 'janasGarten' },
    { name: 'Schwertlilie (\'Wild Jasmine\')', pruningTime: 'Sommer (Juni, nach Blüte)', description: 'Eine Bart-Iris mit einer ungewöhnlichen, warmen gelb-creme Farbkombination.', type: 'janasGarten' },
    { name: 'Seerosen-Tulpe (\'Ice Stick\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Eine mehrblütige, botanische Tulpe, die ihre Blüten weit öffnet.', type: 'janasGarten' },
    { name: 'Seerosen-Tulpe (\'Showwinner\')', pruningTime: 'Frühling, nach Blüte', description: 'Sehr frühe, leuchtend rote Wildtulpe, die sich in der Sonne sternförmig öffnet.', type: 'janasGarten' },
    { name: 'Silberblatt-Ehrenpreis (\'Silberteppich\')', pruningTime: 'Frühjahr (März)', description: 'Ein flacher Bodendecker mit silbrigem Laub und blauen Blütenähren.', type: 'janasGarten' },
    { name: 'Spanischer Salbei', pruningTime: 'Sommer (Juli, nach Hauptblüte)', description: 'Eine Sorte des Lavendels mit großen, schmetterlingsartigen Hochblättern an den Blütenähren.', type: 'janasGarten' },
    { name: 'Sperrige Aster (\'Tradescant\')', pruningTime: 'Frühjahr (März)', description: 'Eine Wildaster mit steifen, dunklen Stielen und einer Masse an kleinen, weißen Blüten.', type: 'janasGarten' },
    { name: 'Stachelbeere, rot (\'Hinnonmäki rot\')', pruningTime: 'Hochsommer (August, nach der Ernte)', description: 'Robuste und mehltauresistente Sorte mit aromatischen, roten Früchten.', type: 'janasGarten' },
    { name: 'Steinquendel', pruningTime: 'Herbst (nach der langen Blüteperiode)', description: 'Dauerblüher für sonnige, trockene Standorte mit minzigem Duft.', type: 'janasGarten' },
    { name: 'Sternkugel-Lauch', pruningTime: 'Sommer (Juni, nach Blüte)', description: 'Bildet große, lockere Blütenbälle, die auch nach der Blüte noch dekorativ sind.', type: 'janasGarten' },
    { name: 'Stinkende Nieswurz', pruningTime: 'Frühjahr (März, nach Blüte)', description: 'Wintergrüne Staude mit ungewöhnlichen, glockenförmigen, grünen Blüten im Vorfrühling.', type: 'janasGarten' },
    { name: 'Storchschnabel (\'Sirak\')', pruningTime: 'Sommer (Juni, nach der Blüte)', description: 'Eine reichblühende Sorte mit großen, rosa Blüten und schöner Herbstfärbung.', type: 'janasGarten' },
    { name: 'Taglilien (\'Stella d Or\')', pruningTime: 'Herbst (Oktober)', description: 'Eine der bekanntesten Taglilien, die fast den ganzen Sommer über unermüdlich blüht.', type: 'janasGarten' },
    { name: 'Teppich-Myrten-Aster (\'Snowflurry\')', pruningTime: 'Frühjahr (März)', description: 'Kriechende Aster, die im Herbst vollständig von weißen Blüten bedeckt ist.', type: 'janasGarten' },
    { name: 'Teppichthymian (\'Compactus\')', pruningTime: 'Sommer (August, nach Blüte)', description: 'Trittfester Bodendecker, der beim Betreten einen aromatischen Duft verströmt.', type: 'janasGarten' },
    { name: 'Thüringer Strauchpappel', pruningTime: 'Spätwinter (Februar)', description: 'Blüht den ganzen Sommer über mit großen, malvenartigen, rosa Blüten.', type: 'janasGarten' },
    { name: 'Viridiflora-Tulpe, weiß/rot (\'Flaming Spring Green\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Besitzt eine grüne Zeichnung auf den Blütenblättern, was sie sehr besonders macht.', type: 'janasGarten' },
    { name: 'Waldmeister', pruningTime: 'Sommer (Mai/Juni, nach Blüte)', description: 'Bekanntes Würzkraut für die Maibowle, bildet dichte Teppiche im Schatten.', type: 'janasGarten' },
    { name: 'Waldsteinie', pruningTime: 'Frühjahr (März)', description: 'Robuster, immergrüner Bodendecker mit erdbeerähnlichen Blättern und gelben Blüten.', type: 'janasGarten' },
    { name: 'Warley-Garten-Elfenblume (\'Orangekönigin\')', pruningTime: 'Spätwinter (Februar bis März)', description: 'Eine Sorte mit auffälligen, orangefarbenen Blüten, die im Schattengarten leuchten.', type: 'janasGarten' },
    { name: 'Wein (\'Muscat Blue\')', pruningTime: 'Winter (Februar)', description: 'Eine pilzresistente Tafeltraube mit Muskat-Aroma, auch für weniger ideale Lagen geeignet.', type: 'janasGarten' },
    { name: 'Weiße Johannisbeere (\'Weiße Versailler\')', pruningTime: 'Sommer (Juli/August, nach Ernte)', description: 'Sorte mit milden, fast durchsichtigen Beeren an langen Trauben.', type: 'janasGarten' },
    { name: 'Weißbuntes Herz-Zittergras (\'Zitterzebra\')', pruningTime: 'Spätwinter (Februar)', description: 'Ein immergrünes Gras mit weiß gestreiften Blättern und zitternden Blütenähren.', type: 'janasGarten' },
    { name: 'Weißer Staudenlein (\'Album\')', pruningTime: 'Kein Schnitt erforderlich, Selbstaussaat fördern', description: 'Eine kurzlebige, aber versamungsfreudige Staude mit filigranen, weißen Blüten.', type: 'janasGarten' },
    { name: 'Weißrandige Graublatt Funkie (\'Francee\')', pruningTime: 'Spätherbst (nach Frost)', description: 'Eine klassische Hosta mit herzförmigen, grünen Blättern und einem schmalen, weißen Rand.', type: 'janasGarten' },
    { name: 'Wild-Krokus, weiß, lila (\'Bowles White\')', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Ein reinweißer Krokus, der sich gut zum Verwildern eignet.', type: 'janasGarten' },
    { name: 'Winteraster, violettrosa, gefüllt (\'Anastasia\')', pruningTime: 'Frühjahr (März)', description: 'Eine Chrysantheme, die spät im Jahr für Farbe im Beet sorgt.', type: 'janasGarten' },
    { name: 'Winterblüte', pruningTime: 'Spätwinter (Februar, nach Blüte)', description: 'Blüht mitten im Winter an kahlen Zweigen mit stark duftenden, gelben Blüten.', type: 'janasGarten' },
    { name: 'Wintergrüner Gamander', pruningTime: 'Sommer (Juli, nach Blüte)', description: 'Immergrüner Halbstrauch für trockene Standorte mit ährenförmigen, rosa Blüten.', type: 'janasGarten' },
    { name: 'Winterling', pruningTime: 'Nach der Blüte, Laub stehen lassen bis es vergilbt', description: 'Einer der allerersten Frühlingsblüher, bildet leuchtend gelbe Teppiche unter Bäumen.', type: 'janasGarten' },
    { name: 'Zierapfel (\'Strawberry Parfait\')', pruningTime: 'Winter (Jan/Feb, bei Bedarf)', description: 'Bietet ein Vierfach-Erlebnis: reiche Blüte, schönes Laub, Zierfrüchte und Wuchsform.', type: 'janasGarten' },
    { name: 'Zierlauch (\'Summer Beauty\')', pruningTime: 'Sommer (Juli, nach Blüte)', description: 'Ein Allium, der erst im Sommer blüht und dessen Laub lange attraktiv bleibt.', type: 'janasGarten' },
    { name: 'Zierlicher Frauenmantel', pruningTime: 'Sommer (Juni, nach erster Blüte)', description: 'Bekannt für seine Blätter, an denen Wassertropfen wie Perlen abperlen.', type: 'janasGarten' },
    { name: 'Zitronenmelisse', pruningTime: 'Sommer (Juni, kurz vor Blüte)', description: 'Wüchsiges Küchenkraut mit intensivem Zitronenduft für Tees und Desserts.', type: 'janasGarten' },
    { name: 'Zitronige Katzenminze (\'Grog\')', pruningTime: 'Sommer (Juli, nach erster Blüte)', description: 'Eine Katzenminze mit starkem Zitronenduft, die sowohl Menschen als auch Katzen anzieht.', type: 'janasGarten' },
    { name: 'Zweiblättriger Blaustern (\'Alba\')', pruningTime: 'Frühling (nach Blüte)', description: 'Eine weiße Form des Blausterns, die zarte Blütenteppiche bildet.', type: 'janasGarten' },
    { name: 'Zwerg-Berg-Bohnenkraut', pruningTime: 'Sommer (August, nach Blüte)', description: 'Ein niedrig bleibendes, aromatisches Kraut für Steingärten und Einfassungen.', type: 'janasGarten' },
    { name: 'Zwerg-Lavendel (\'Peter Pan\')', pruningTime: 'Sommer (Juli, nach Blüte)', description: 'Eine sehr kompakte Lavendelsorte, ideal für kleine Gärten und Kübel.', type: 'janasGarten' },
    { name: 'Zwerg-Lavendel, rosa (\'Little Lottie\')', pruningTime: 'Sommer (Juli/August, nach Blüte)', description: 'Eine seltene, rosa blühende und kompakt wachsende Lavendelsorte.', type: 'janasGarten' },
    { name: 'Zwerg-Sonnenhut, gelb (\'Little Goldstar\')', pruningTime: 'Spätherbst (Nov) oder Frühjahr', description: 'Kompakte und extrem reichblühende Sorte des Sonnenhuts.', type: 'janasGarten' },
    { name: 'Zwerg-Ysop, Felsen-Ysop', pruningTime: 'Sommer (spätestens August, nach Blüte)', description: 'Ein kleiner Halbstrauch mit intensiv blauen Blüten, der Bienen anzieht.', type: 'janasGarten' },
    { name: 'Zwergspiere (\'Shirobana\')', pruningTime: 'Spätwinter (März)', description: 'Einzigartiger Spierstrauch, der gleichzeitig weiße und rosa Blüten an einer Pflanze trägt.', type: 'janasGarten' },
];

// --- LIVE API UTILITY FUNCTIONS ---
// Manual base64 encode function as per guidelines
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Manual base64 decode function as per guidelines
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

// --- TEXT CLEANING UTILITY ---
const stripHtmlAndMarkdown = (text: string): string => {
    if (!text) return '';

    // Create a temporary element to parse HTML
    // Replace <br> tags with a newline character for better sentence separation during speech.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text.replace(/<br\s*\/?>/gi, '\n');

    // Get the plain text content
    let plainText = tempDiv.textContent || tempDiv.innerText || '';

    // Remove markdown characters
    // Headers: #, ##, etc.
    plainText = plainText.replace(/#{1,6}\s/g, '');
    // Bold/Italic: **, __, *, _
    plainText = plainText.replace(/(\*\*|__|\*|_)/g, '');
    // Strikethrough: ~~
    plainText = plainText.replace(/~~/g, '');
    // Links: [text](url) -> text
    plainText = plainText.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    // Lists: *, -, 1.
    plainText = plainText.replace(/^\s*[\*\-]\s/gm, ''); // Unordered list items
    plainText = plainText.replace(/^\s*\d+\.\s/gm, ''); // Ordered list items
    
    // Replace multiple newlines/spaces with a single space.
    plainText = plainText.replace(/\s\s+/g, ' ').trim();

    return plainText;
};


// --- ERROR HANDLING ---
const getFriendlyErrorMessage = (error: any): string => {
    console.error("API Error:", error); // Log original error for debugging

    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Network errors
        if (message.includes('failed to fetch')) {
            return "Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.";
        }
        if (message.includes('notallowederror') || message.includes('permission denied')) {
            return "Kamerazugriff verweigert. Bitte erlauben Sie den Zugriff in Ihren Browsereinstellungen.";
        }

        // Gemini API specific errors
        if (message.includes('rate limit')) {
            return "Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut.";
        }
        if (message.includes('api key not valid')) {
            return "API-Schlüssel ungültig. Bitte überprüfen Sie Ihre Konfiguration.";
        }
        if (message.includes('response was blocked')) {
            return "Die Antwort wurde aufgrund von Sicherheitsrichtlinien blockiert.";
        }
        if (message.includes('json')) {
            return "Die KI hat in einem unerwarteten Format geantwortet. Bitte versuchen Sie es erneut.";
        }

        // Geolocation errors
        // Note: `error.code` might not be on the generic Error type, so we check it on `any`
        const errorCode = (error as any).code;
        if (errorCode === 1) {
            return "Standortzugriff verweigert. Empfehlung nicht möglich.";
        }
        if (errorCode === 2) {
             return "Standort konnte nicht ermittelt werden. Bitte versuchen Sie es später erneut.";
        }
        if (errorCode === 3) {
             return "Standortabfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.";
        }
    }

    // Generic fallback
    return "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.";
};


const App = () => {
    // --- STATE MANAGEMENT ---
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentTheme, setCurrentTheme] = useState<Theme>('light');
    const [currentFontSize, setCurrentFontSize] = useState<FontSize>('medium');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [activePlantListView, setActivePlantListView] = useState<PlantListView>('meine');
    const [modal, setModal] = useState<{ type: ModalType | null; plant?: Plant; isEdit?: boolean }>({ type: null });
    const [customPlants, setCustomPlants] = useState<CustomPlant[]>([]);
    const [janasGartenPlants, setJanasGartenPlants] = useState<JanasGartenPlant[]>([]);
    const [view, setView] = useState<View>('main');
    const [explanationData, setExplanationData] = useState<ChatMessage | null>(null);
    const [toastMessage, setToastMessage] = useState<string>('');
    
    // Live API State
    const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
    const [liveConnectionState, setLiveConnectionState] = useState<LiveConnectionState>('idle');
    const [liveTranscript, setLiveTranscript] = useState<LiveTranscriptEntry[]>([]);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioResourcesRef = useRef<{
        inputAudioContext?: AudioContext;
        outputAudioContext?: AudioContext;
        scriptProcessor?: ScriptProcessorNode;
        mediaStreamSource?: MediaStreamAudioSourceNode;
        mediaStream?: MediaStream;
        outputSources?: Set<AudioBufferSourceNode>;
        nextStartTime?: number;
    }>({});

    // Camera State
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    // Sorting and Filtering State
    const [customSort, setCustomSort] = useState('alpha');
    const [customFilter, setCustomFilter] = useState('all');

    const chatEndRef = useRef<HTMLDivElement>(null);
    const ai = useMemo(() => new GoogleGenAI({ apiKey: API_KEY }), []);

    // --- EFFECTS ---
    useEffect(() => {
        document.body.className = `${currentTheme}-mode font-${currentFontSize}`;
    }, [currentTheme, currentFontSize]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isLoading]);

    useEffect(() => {
        const savedCustomPlants = localStorage.getItem('customPlants');
        setCustomPlants(savedCustomPlants ? JSON.parse(savedCustomPlants) : []);

        const savedJanasGarten = localStorage.getItem('janasGartenPlants');
        let plantsToSet = savedJanasGarten ? JSON.parse(savedJanasGarten) : INITIAL_JANAS_GARTEN_PLANTS;
        
        // Robust data migration
        const needsMigration = plantsToSet.some((p: any) => typeof p.description === 'undefined' || typeof p.type === 'undefined');
        if (needsMigration) {
            const migratedPlants = plantsToSet.map((savedPlant: any) => {
                const initialPlantData = INITIAL_JANAS_GARTEN_PLANTS.find(p => p.name === savedPlant.name);
                return {
                    ...savedPlant,
                    description: savedPlant.description ?? initialPlantData?.description ?? '',
                    type: 'janasGarten' as const,
                };
            });
            plantsToSet = migratedPlants;
            localStorage.setItem('janasGartenPlants', JSON.stringify(migratedPlants));
        }
        setJanasGartenPlants(plantsToSet);

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) setCurrentTheme(savedTheme as Theme);

        // Cleanup live session on component unmount
        return () => {
            if (sessionPromiseRef.current) {
                stopLiveSession();
            }
        };
    }, []);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    // --- UTILITY & HELPER FUNCTIONS ---
    const getPruningWindow = (pruningTime: string): { start: Date, end: Date } | null => {
        const now = new Date();
        const year = now.getFullYear();
        const monthMap: { [key: string]: number } = {
            'januar': 0, 'jan': 0, 'februar': 1, 'feb': 1, 'märz': 2, 'mär': 2, 'april': 3, 'apr': 3,
            'mai': 4, 'juni': 5, 'jun': 5, 'juli': 6, 'jul': 6, 'august': 7, 'aug': 7,
            'september': 8, 'sep': 8, 'oktober': 9, 'okt': 9, 'november': 10, 'nov': 10, 'dezember': 11, 'dez': 11
        };

        const time = pruningTime.toLowerCase();

        if (time.includes('winter')) {
            const startMonth = time.includes('spät') ? 1 : 11;
            const endMonth = time.includes('spät') ? 2 : 1;
            const startDate = new Date(year, startMonth, 1);
            if(startMonth === 11) startDate.setFullYear(year - 1);
            const endDate = new Date(year, endMonth + 1, 0);
            return { start: startDate, end: endDate };
        }
        if (time.includes('frühjahr')) return { start: new Date(year, 2, 1), end: new Date(year, 5, 0) };
        if (time.includes('sommer')) return { start: new Date(year, 5, 1), end: new Date(year, 8, 0) };
        if (time.includes('herbst')) return { start: new Date(year, 8, 1), end: new Date(year, 11, 0) };

        const months = Object.keys(monthMap).filter(m => time.includes(m));
        if (months.length > 0) {
            const startMonth = monthMap[months[0]];
            const endMonth = months.length > 1 ? monthMap[months[1]] : startMonth;
            const startDate = new Date(year, startMonth, 1);
            const endDate = new Date(year, endMonth + 1, 0);
            return { start: startDate, end: endDate };
        }

        return null;
    };

    const getNextPruningDate = (pruningTime: string): Date | null => {
        const window = getPruningWindow(pruningTime);
        if (!window) return null;
        const now = new Date();
        if (now > window.end) window.start.setFullYear(now.getFullYear() + 1);
        return window.start;
    };

    const updatePlantInList = (plantToUpdate: Plant, updates: Partial<Plant>) => {
        if (plantToUpdate.type === 'catalog') return;
        
        const updater = (list: (CustomPlant | JanasGartenPlant)[]) => {
            const newList = list.map(p => p.name === plantToUpdate.name ? { ...p, ...updates } : p);
            localStorage.setItem(plantToUpdate.type === 'custom' ? 'customPlants' : 'janasGartenPlants', JSON.stringify(newList));
            return newList;
        };

        if (plantToUpdate.type === 'custom') {
            setCustomPlants(prev => updater(prev) as CustomPlant[]);
        } else {
            setJanasGartenPlants(prev => updater(prev) as JanasGartenPlant[]);
        }
    };

    // --- LIVE API HANDLERS ---
    const startLiveSession = async () => {
        setLiveTranscript([]);
        setIsLiveSessionActive(true);
        setLiveConnectionState('connecting');
    
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioResourcesRef.current.mediaStream = stream;
    
            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            audioResourcesRef.current.inputAudioContext = inputAudioContext;
            audioResourcesRef.current.outputAudioContext = outputAudioContext;
            audioResourcesRef.current.outputSources = new Set();
            audioResourcesRef.current.nextStartTime = 0;
    
            const session = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setLiveConnectionState('listening');
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        audioResourcesRef.current.mediaStreamSource = source;
                        audioResourcesRef.current.scriptProcessor = scriptProcessor;
    
                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                         // Handle transcription
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            setLiveTranscript(prev => {
                                const last = prev[prev.length - 1];
                                if (last?.speaker === 'user' && !last.isFinal) {
                                    const newTranscript = [...prev];
                                    newTranscript[newTranscript.length - 1] = { ...last, text: last.text + text };
                                    return newTranscript;
                                }
                                return [...prev, { speaker: 'user', text, isFinal: false }];
                            });
                        }
                         if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            setLiveTranscript(prev => {
                                const last = prev[prev.length - 1];
                                if (last?.speaker === 'model' && !last.isFinal) {
                                    const newTranscript = [...prev];
                                    newTranscript[newTranscript.length - 1] = { ...last, text: last.text + text };
                                    return newTranscript;
                                }
                                return [...prev, { speaker: 'model', text, isFinal: false }];
                            });
                        }
                        if (message.serverContent?.turnComplete) {
                            setLiveTranscript(prev => prev.map(entry => ({ ...entry, isFinal: true })));
                        }

                        // Handle audio playback
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            const { outputAudioContext: ctx, outputSources, nextStartTime = 0 } = audioResourcesRef.current;
                            if (ctx && outputSources) {
                                const newNextStartTime = Math.max(nextStartTime, ctx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                                const source = ctx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(ctx.destination);
                                source.addEventListener('ended', () => outputSources.delete(source));
                                source.start(newNextStartTime);
                                audioResourcesRef.current.nextStartTime = newNextStartTime + audioBuffer.duration;
                                outputSources.add(source);
                            }
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setLiveConnectionState('error');
                        setToastMessage("Verbindung zur Sprach-Sitzung fehlgeschlagen.");
                        stopLiveSession();
                    },
                    onclose: () => {
                        stopLiveSession();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    systemInstruction: 'Du bist ein freundlicher und hilfsbereiter Gartenexperte namens Pflanzen-Helfer. Deine Hauptaufgabe ist es, Fragen zum Pflanzenschnitt und zur allgemeinen Pflanzenpflege auf Deutsch zu beantworten. Gib klare, prägnante Antworten.',
                },
            });
            sessionPromiseRef.current = session;
        } catch (err) {
            console.error('Failed to start live session:', err);
            setToastMessage("Mikrofonzugriff verweigert oder nicht möglich.");
            setLiveConnectionState('error');
            setIsLiveSessionActive(false);
        }
    };

    const stopLiveSession = () => {
        if (!sessionPromiseRef.current) return;

        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;

        const { mediaStream, scriptProcessor, mediaStreamSource, inputAudioContext, outputAudioContext, outputSources } = audioResourcesRef.current;
        mediaStream?.getTracks().forEach(track => track.stop());
        scriptProcessor?.disconnect();
        mediaStreamSource?.disconnect();
        inputAudioContext?.close();
        outputSources?.forEach(source => source.stop());
        outputAudioContext?.close();

        audioResourcesRef.current = {};
        setIsLiveSessionActive(false);
        setLiveConnectionState('idle');
    };

    // --- API & ASYNC HANDLERS ---
    const handleUserInput = async (prompt: string) => {
        if (!prompt.trim() || isLoading) return;
        setError(null);
        setIsLoading(true);
    
        const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: prompt };
        setChatHistory(prev => [...prev, userMessage]);
    
        try {
            // --- Text Generation First ---
            const fullPrompt = `Wann und wie schneide ich die Pflanze: ${prompt}? Gib eine präzise Anleitung.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: fullPrompt });
            const text = response.text;
            
            if (!text || text.trim() === '') {
                 throw new Error("Die KI hat eine leere Antwort zurückgegeben.");
            }
    
            const source = customPlants.some(p => p.name === prompt) ? 'custom' : janasGartenPlants.some(p => p.name === prompt) ? 'janasGarten' : null;
            const modelMessage: ChatMessage = {
                id: (Date.now() + 1).toString(), role: 'model', text, plantName: prompt, source, isGeneratingImage: true,
            };
            
            // --- Show Text Response Immediately ---
            setChatHistory(prev => [...prev, modelMessage]);
            setExplanationData(modelMessage);
            setView('explanation');
            setIsLoading(false); // Stop main loader
    
            // --- Image Generation in Background ---
            const generateImageInBackground = async () => {
                try {
                    const imagePrompt = `Eine botanisch korrekte Darstellung der Pflanze '${prompt}' auf einem einfachen, neutralen Hintergrund.`;
                    const imageResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: imagePrompt }] }, config: { responseModalities: [Modality.IMAGE] } });
                    
                    const firstPart = imageResponse.candidates?.[0]?.content?.parts[0];
                    if (firstPart && firstPart.inlineData) {
                        const imageUrl = `data:image/png;base64,${firstPart.inlineData.data}`;
                        const updateWithImage = (msg: ChatMessage) => ({ ...msg, imageUrl, isGeneratingImage: false });
                        
                        setChatHistory(prev => prev.map(msg => msg.id === modelMessage.id ? updateWithImage(msg) : msg));
                        setExplanationData(prev => (prev && prev.id === modelMessage.id) ? updateWithImage(prev) : prev);
                        
                        if (source) {
                            const plantToUpdate = (source === 'custom' ? customPlants : janasGartenPlants).find(p => p.name === prompt);
                            if (plantToUpdate) updatePlantInList(plantToUpdate, { imageUrl });
                        }
                    } else {
                        throw new Error("Keine Bilddaten von der API erhalten.");
                    }
                } catch (imgErr) {
                    console.error("Fehler beim Generieren des Bildes im Hintergrund:", imgErr);
                    const stopImageLoading = (msg: ChatMessage) => ({ ...msg, isGeneratingImage: false });
                    setChatHistory(prev => prev.map(msg => msg.id === modelMessage.id ? stopImageLoading(msg) : msg));
                    setExplanationData(prev => (prev && prev.id === modelMessage.id) ? stopImageLoading(prev) : prev);
                }
            };
    
            generateImageInBackground(); // Fire and forget
    
        } catch (err: any) {
            const friendlyError = getFriendlyErrorMessage(err);
            setError(friendlyError);
            setChatHistory(prev => prev.filter(msg => msg.id !== userMessage.id));
            setIsLoading(false);
        }
    };
    
    const handleGenerateMoreDetails = async () => {
        if (!explanationData || !explanationData.plantName || explanationData.isGeneratingMore) return;
    
        setExplanationData(prev => prev ? { ...prev, isGeneratingMore: true } : null);
    
        try {
            const { plantName, source, id: messageId } = explanationData;
            const textPrompt = `Gib mir eine detaillierte botanische Beschreibung für die Pflanze '${plantName}'. Konzentriere dich auf Herkunft, Wuchsform, Blüten und besondere Merkmale. Ignoriere den Pflanzenschnitt, da diese Information bereits vorhanden ist.`;
            
            // --- Get text first ---
            const textResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: textPrompt });
            const additionalText = textResponse.text;
            if(!additionalText) throw new Error("Empty response from AI for details.");
    
            // --- Update UI with text immediately ---
            setExplanationData(prev => {
                if (!prev) return null;
                const updated = { ...prev, additionalText, isGeneratingMore: false, isGeneratingImage: true };
                setChatHistory(prevChat => prevChat.map(msg => msg.id === updated.id ? updated : msg));
                if (source) {
                     const plantToUpdate = (source === 'custom' ? customPlants : janasGartenPlants).find(p => p.name === plantName);
                     if (plantToUpdate) updatePlantInList(plantToUpdate, { additionalDescription: additionalText });
                }
                return updated;
            });
    
            // --- Get image in background ---
            const generateImageInBackground = async () => {
                try {
                    const imagePrompt = `Ein alternatives, hochwertiges, botanisch korrektes Bild der Pflanze '${plantName}' auf einem einfachen, neutralen Hintergrund.`;
                    const imageResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: imagePrompt }] }, config: { responseModalities: [Modality.IMAGE] } });
                    const firstPart = imageResponse.candidates?.[0]?.content?.parts[0];
                    if (firstPart && firstPart.inlineData) {
                        const newImageUrl = `data:image/png;base64,${firstPart.inlineData.data}`;
                        const updateWithImage = (data: ChatMessage) => ({ ...data, imageUrl: newImageUrl, isGeneratingImage: false });
    
                        setExplanationData(prev => (prev && prev.id === messageId) ? updateWithImage(prev) : prev);
                        setChatHistory(prevChat => prevChat.map(msg => msg.id === messageId ? updateWithImage(msg) : msg));
                        
                        if (source) {
                            const plantToUpdate = (source === 'custom' ? customPlants : janasGartenPlants).find(p => p.name === plantName);
                            if (plantToUpdate) updatePlantInList(plantToUpdate, { imageUrl: newImageUrl });
                        }
                    } else {
                         setExplanationData(prev => prev ? { ...prev, isGeneratingImage: false } : null);
                    }
                } catch (imgErr) {
                    console.error("Fehler beim Generieren des alternativen Bildes:", imgErr);
                    setExplanationData(prev => (prev && prev.id === messageId) ? { ...prev, isGeneratingImage: false } : prev);
                }
            };
            generateImageInBackground();
    
        } catch (err: any) {
            const friendlyError = getFriendlyErrorMessage(err);
            setToastMessage(friendlyError);
            setExplanationData(prev => prev ? { ...prev, isGeneratingMore: false } : null);
        }
    };

    const handleGenerateCareGuide = async (plantOrData: Plant | ChatMessage) => {
        const plantName = 'name' in plantOrData ? plantOrData.name : plantOrData.plantName;
        if (!plantName) return;
    
        const updateLoadingState = (isLoading: boolean) => {
            if ('id' in plantOrData && 'role' in plantOrData) { // It's ChatMessage
                setExplanationData(prev => prev ? { ...prev, isGeneratingCareGuide: isLoading } : null);
            } else { // It's Plant
                updatePlantInList(plantOrData as Plant, { isGeneratingCareGuide: isLoading });
            }
        };
    
        updateLoadingState(true);
    
        try {
            const prompt = `Erstelle eine kurze, prägnante Pflegeanleitung für die Pflanze '${plantName}'. Gliedere die Antwort in die Abschnitte 'Standort', 'Bewässerung' und 'Düngung'.`;
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
            const careGuideText = response.text;
            if(!careGuideText) throw new Error("Empty response from AI for care guide.");
    
            if ('id' in plantOrData && 'role' in plantOrData) { // It's ChatMessage
                setExplanationData(prev => {
                    if (!prev) return null;
                    const updated = { ...prev, careGuide: careGuideText, isGeneratingCareGuide: false };
                    setChatHistory(prevChat => prevChat.map(msg => msg.id === updated.id ? updated : msg));
                    return updated;
                });
            }
            
            const source = 'role' in plantOrData ? plantOrData.source : plantOrData.type;
            if (source === 'custom' || source === 'janasGarten') {
                const plantToUpdate = (source === 'custom' ? customPlants : janasGartenPlants).find(p => p.name === plantName);
                if (plantToUpdate) {
                    updatePlantInList(plantToUpdate, { careGuide: careGuideText, isGeneratingCareGuide: false });
                }
            }
            setToastMessage("Pflegeanleitung generiert!");
    
        } catch (err: any) {
            const friendlyError = getFriendlyErrorMessage(err);
            setToastMessage(friendlyError);
            updateLoadingState(false);
        }
    };
    
    const handleGenerateImageForPlant = async (plantToUpdate: Plant) => {
        if (plantToUpdate.type === 'catalog' || !plantToUpdate || plantToUpdate.isLoadingImage) return;

        updatePlantInList(plantToUpdate, { isLoadingImage: true });
        
        try {
            const imagePrompt = `Eine botanisch korrekte Darstellung der Pflanze '${plantToUpdate.name}' auf einem einfachen, neutralen Hintergrund.`;
            const imageResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: imagePrompt }] }, config: { responseModalities: [Modality.IMAGE] } });
            const firstPart = imageResponse.candidates?.[0]?.content?.parts[0];
            
            if (firstPart && firstPart.inlineData) {
                const imageUrl = `data:image/png;base64,${firstPart.inlineData.data}`;
                updatePlantInList(plantToUpdate, { imageUrl, isLoadingImage: false });
            } else {
               throw new Error("Keine Bilddaten von der API erhalten.");
            }
        } catch (err: any) {
            const friendlyError = getFriendlyErrorMessage(err);
            setToastMessage(friendlyError);
            updatePlantInList(plantToUpdate, { isLoadingImage: false });
        }
    };
    
    const handleGenerateMoreDetailsForModal = async (plantToUpdate: Plant) => {
        if (plantToUpdate.type === 'catalog' || !plantToUpdate || plantToUpdate.isGeneratingDetails || plantToUpdate.isLoadingImage) return;
    
        updatePlantInList(plantToUpdate, { isGeneratingDetails: true });
        
        try {
            const textPrompt = `Gib mir eine detaillierte botanische Beschreibung für die Pflanze '${plantToUpdate.name}'. Konzentriere dich auf Herkunft, Wuchsform, Blüten und besondere Merkmale. Ignoriere den Pflanzenschnitt.`;
            
            // --- Text first ---
            const textResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: textPrompt });
            const additionalDescription = textResponse.text;
            if(!additionalDescription) throw new Error("Empty response from AI for modal details.");

            // --- Update with text and set image loading state ---
            updatePlantInList(plantToUpdate, {
                additionalDescription,
                isGeneratingDetails: false,
                isLoadingImage: true
            });
            setToastMessage("Text-Details aktualisiert! Bild wird geladen...");
    
            // --- Image in background ---
            const generateImageInBackground = async () => {
                try {
                    const imagePrompt = `Ein alternatives, hochwertiges, botanisch korrektes Bild der Pflanze '${plantToUpdate.name}' auf einem einfachen, neutralen Hintergrund.`;
                    const imageResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: imagePrompt }] }, config: { responseModalities: [Modality.IMAGE] } });
                    const firstPart = imageResponse.candidates?.[0]?.content?.parts[0];
                    
                    if (firstPart && firstPart.inlineData) {
                        const newImageUrl = `data:image/png;base64,${firstPart.inlineData.data}`;
                        updatePlantInList(plantToUpdate, { imageUrl: newImageUrl, isLoadingImage: false });
                        setToastMessage("Bild aktualisiert!");
                    } else {
                        throw new Error("Keine Bilddaten von der API erhalten.");
                    }
                } catch (imgErr) {
                    const friendlyError = getFriendlyErrorMessage(imgErr);
                    setToastMessage(friendlyError);
                    updatePlantInList(plantToUpdate, { isLoadingImage: false });
                }
            };
            generateImageInBackground();
    
        } catch (err: any) {
            const friendlyError = getFriendlyErrorMessage(err);
            setToastMessage(friendlyError);
            updatePlantInList(plantToUpdate, { isGeneratingDetails: false, isLoadingImage: false });
        }
    };

    const handleGenerateWeatherRecommendation = async (plantName: string): Promise<string> => {
        try {
            // 1. Get location from user
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            const { latitude, longitude } = position.coords;
    
            // 2. Ask AI to generate a weather forecast
            const forecastPrompt = `Erstelle eine realistische Wettervorhersage für die nächsten 3 Tage im JSON-Format für den Standort mit Breitengrad ${latitude} und Längengrad ${longitude}. Das JSON sollte ein Array von 3 Objekten sein, jedes mit 'tag' (z.B. 'Montag'), 'temp_max_c', 'temp_min_c', 'beschreibung' (z.B. 'Sonnig') und 'niederschlag_mm'. Gib nur das JSON zurück, ohne Markdown.`;
            const forecastResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: forecastPrompt });
            
            let forecastData;
            try {
                const forecastText = forecastResponse.text.replace(/```json|```/g, '').trim();
                if(!forecastText) throw new Error("Leere Wettervorhersage von KI erhalten");
                forecastData = JSON.parse(forecastText);
            } catch (jsonError) {
                throw new Error("JSON_PARSE_ERROR"); 
            }
    
            // 3. Ask AI for a recommendation based on the forecast
            const recommendationPrompt = `Gegeben ist die Pflanze '${plantName}' und die folgende Wettervorhersage für die nächsten 3 Tage: ${JSON.stringify(forecastData)}. Gib eine kurze, umsetzbare Empfehlung (maximal 2-3 Sätze), ob ich die Pflanze gießen oder vor Frost schützen sollte. Beginne direkt mit der Empfehlung.`;
            const recommendationResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: recommendationPrompt });
            
            if (!recommendationResponse.text) {
                throw new Error("Leere Empfehlung von KI erhalten");
            }
            return recommendationResponse.text;
    
        } catch (err: any) {
            if (err.message === "JSON_PARSE_ERROR") {
                 throw new Error("Die KI hat in einem ungültigen Format geantwortet. Bitte versuchen Sie es erneut.");
            }
            throw new Error(getFriendlyErrorMessage(err));
        }
    };
    
    const handleImageSubmission = async (imageDataUrl: string) => {
        setIsCameraOpen(false);
        if (!imageDataUrl || isLoading) return;
        setError(null);
        setIsLoading(true);

        const userMessage: ChatMessage = { 
            id: Date.now().toString(), 
            role: 'user', 
            text: 'Was ist das für eine Pflanze und wie schneide ich sie?', 
            imageUrl: imageDataUrl 
        };
        setChatHistory(prev => [...prev, userMessage]);

        try {
            const base64Data = imageDataUrl.split(',')[1];
            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: base64Data } };
            const textPart = { text: "Identifiziere diese Pflanze und gib einen detaillierten Schnitt-Tipp. Gib als erstes den Namen der Pflanze in einer H2-Überschrift an, gefolgt von der Anleitung." };
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
            });
            const text = response.text;
            
            if (!text || text.trim() === '') {
                 throw new Error("Die KI hat eine leere Antwort zurückgegeben.");
            }

            // Extract plant name from the response (assuming it's in an H2)
            const plantNameMatch = text.match(/<h2>(.*?)<\/h2>/);
            const plantName = plantNameMatch ? plantNameMatch[1] : "Unbekannte Pflanze";
            const cleanedText = text.replace(/<h2>.*?<\/h2>/, '').trim();

            const modelMessage: ChatMessage = {
                id: (Date.now() + 1).toString(), 
                role: 'model', 
                text: cleanedText,
                plantName: plantName,
            };
            
            setChatHistory(prev => [...prev, modelMessage]);

        } catch (err: any) {
            const friendlyError = getFriendlyErrorMessage(err);
            setError(friendlyError);
            setChatHistory(prev => prev.filter(msg => msg.id !== userMessage.id));
        } finally {
            setIsLoading(false);
        }
    };

    // --- UI HANDLERS ---
    const handleReadAloud = (text: string) => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }
        if ('speechSynthesis' in window) {
            const cleanedText = stripHtmlAndMarkdown(text);
            if (!cleanedText) {
                setToastMessage("Kein Text zum Vorlesen vorhanden.");
                return;
            }
            const utterance = new SpeechSynthesisUtterance(cleanedText);
            utterance.lang = 'de-DE';
            setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                setIsSpeaking(false);
                setToastMessage("Fehler bei der Sprachausgabe.");
            };
            window.speechSynthesis.speak(utterance);
        } else {
            setToastMessage('Sprachausgabe nicht unterstützt.');
        }
    };

    const handleShare = async (message: ChatMessage) => {
        const shareText = `Pflanzenschnitt-Tipp für ${message.plantName}:\n\n${message.text}`;
        try {
            if (navigator.share && message.imageUrl) {
                const response = await fetch(message.imageUrl);
                const blob = await response.blob();
                const file = new File([blob], `${message.plantName}.png`, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ title: `Tipp für ${message.plantName}`, text: shareText, files: [file] });
                    return;
                }
            }
            if (navigator.share) {
                await navigator.share({ title: `Tipp für ${message.plantName}`, text: shareText });
            } else {
                await navigator.clipboard.writeText(shareText);
                setToastMessage('Tipp in die Zwischenablage kopiert!');
            }
        } catch (error) {
            try {
                 await navigator.clipboard.writeText(shareText);
                 setToastMessage('Tipp in die Zwischenablage kopiert!');
            } catch (copyError) {
                console.error('Sharing and copying failed:', error, copyError);
                setToastMessage('Teilen und Kopieren fehlgeschlagen.');
            }
        }
    };
    
    const handleSavePlant = (formState: Omit<CustomPlant, 'id'> & { id?: string }) => {
        const newPlant: CustomPlant = {
            ...formState,
            type: 'custom',
            id: formState.id || Date.now().toString(),
        };
        const updated: CustomPlant[] = formState.id ? customPlants.map(p => p.id === formState.id ? newPlant : p) : [...customPlants, newPlant];
        // FIX: Explicitly typed the sort callback parameters 'a' and 'b' as CustomPlant to ensure correct type inference.
        updated.sort((a: CustomPlant, b: CustomPlant) => a.name.localeCompare(b.name, 'de'));
        setCustomPlants(updated);
        localStorage.setItem('customPlants', JSON.stringify(updated));
        
        setModal({ type: null });
    };

    const handleDeletePlant = (plantToDelete: Plant) => {
        if (plantToDelete.type !== 'custom') return;
        if (!window.confirm(`Sind Sie sicher, dass Sie "${plantToDelete.name}" löschen möchten?`)) return;
        
        const updated = customPlants.filter(p => p.id !== plantToDelete.id);
        setCustomPlants(updated);
        localStorage.setItem('customPlants', JSON.stringify(updated));
        setModal({ type: null });
    };

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!userInput.trim()) return;
        handleUserInput(userInput);
        setUserInput('');
    };

    // --- MEMOIZED DERIVED STATE ---
    const allPlantNames = useMemo(() => {
        const catalogNames = Object.values(PLANT_CATALOG).flat();
        const customNames = customPlants.map(p => p.name);
        const janasGartenNames = janasGartenPlants.map(p => p.name);
        return [...new Set([...catalogNames, ...customNames, ...janasGartenNames])].sort((a, b) => a.localeCompare(b, 'de'));
    }, [customPlants, janasGartenPlants]);

    const customUniquePruningTimes = useMemo(() => {
        return Array.from(new Set(customPlants.map(p => p.pruningTime))).sort((a,b) => a.localeCompare(b, 'de'));
    }, [customPlants]);

    const filteredAndSortedCustomPlants = useMemo(() => {
        let plants = customFilter !== 'all' ? customPlants.filter(p => p.pruningTime === customFilter) : [...customPlants];
        if (customSort === 'alpha') {
            plants.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        } else if (customSort === 'nextCut') {
            plants.sort((a, b) => {
                const dateA = getNextPruningDate(a.pruningTime);
                const dateB = getNextPruningDate(b.pruningTime);
                if (dateA && dateB) return dateA.getTime() - dateB.getTime();
                return dateA ? -1 : 1;
            });
        }
        return plants;
    }, [customPlants, customSort, customFilter]);
    
    const sortedJanasGartenPlants = useMemo(() => {
        return [...janasGartenPlants].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }, [janasGartenPlants]);

    const upcomingPruningDates = useMemo(() => {
        const allPlants = [
            ...customPlants.map(p => ({ ...p, source: 'Eigene Pflanzen' })),
            ...janasGartenPlants.map(p => ({ ...p, source: 'Janas Garten' }))
        ];
        const now = new Date();
        const next30Days = new Date();
        next30Days.setDate(now.getDate() + 30);

        return allPlants
            .map(plant => ({ name: plant.name, nextDate: getNextPruningDate(plant.pruningTime), source: plant.source }))
            .filter(p => p.nextDate && p.nextDate <= next30Days)
            .sort((a, b) => a.nextDate!.getTime() - b.nextDate!.getTime());
    }, [customPlants, janasGartenPlants]);

    // --- RENDER LOGIC & COMPONENTS ---
    const renderModalContent = () => {
        if (!modal.type || !modal.plant) return null;
        
        const list = modal.plant.type === 'custom' ? customPlants : modal.plant.type === 'janasGarten' ? janasGartenPlants : [];
        const freshPlant = list.find(p => p.name === modal.plant!.name) || modal.plant;

        switch (modal.type) {
            case 'plantDetails':
                return <PlantDetailsModal 
                            plant={freshPlant} 
                            onEdit={(plant) => setModal({ type: 'plantForm', plant, isEdit: true })} 
                            onClose={() => setModal({ type: null })} 
                            onGenerateMoreDetails={handleGenerateMoreDetailsForModal}
                            onGenerateCareGuide={handleGenerateCareGuide}
                            onGenerateWeatherRecommendation={handleGenerateWeatherRecommendation}
                            onRequestTip={(plantName) => {
                                handleUserInput(plantName);
                                setModal({type: null});
                            }}
                            isSpeaking={isSpeaking}
                            onReadAloud={handleReadAloud}
                        />;
            case 'plantForm':
                 if (modal.plant.type === 'custom') {
                    return <PlantFormModal plant={modal.plant} isEdit={modal.isEdit} onSave={handleSavePlant} onClose={() => setModal({ type: null })} />;
                 }
                 return null;
            default:
                return null;
        }
    }

    return (
        <div className="app-container">
            {toastMessage && <div className="toast">{toastMessage}</div>}
            <Header
                currentTheme={currentTheme}
                onThemeToggle={() => {
                    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                    setCurrentTheme(newTheme);
                    localStorage.setItem('theme', newTheme);
                }}
                currentFontSize={currentFontSize}
                onFontSizeChange={setCurrentFontSize}
                onShowRecommendations={() => setView('recommendations')}
                upcomingPruningCount={upcomingPruningDates.length}
            />

            {view === 'main' && (
                <MainView
                    chatHistory={chatHistory}
                    isLoading={isLoading}
                    error={error}
                    chatEndRef={chatEndRef}
                    activePlantListView={activePlantListView}
                    setActivePlantListView={setActivePlantListView}
                    customPlants={filteredAndSortedCustomPlants}
                    janasGartenPlants={sortedJanasGartenPlants}
                    onOpenModal={(type, plant) => setModal({ type, plant })}
                    onDeletePlant={handleDeletePlant}
                    onGenerateImage={handleGenerateImageForPlant}
                    allPlantNames={allPlantNames}
                    customSort={customSort}
                    setCustomSort={setCustomSort}
                    customFilter={customFilter}
                    setCustomFilter={setCustomFilter}
                    customUniquePruningTimes={customUniquePruningTimes}
                    userInput={userInput}
                    setUserInput={setUserInput}
                    onFormSubmit={handleFormSubmit}
                    isSpeaking={isSpeaking}
                    onReadAloud={() => handleReadAloud(chatHistory.filter(m => m.role === 'model').map(m => m.text + (m.additionalText ? '\n\n' + m.additionalText : '')).join('\n\n'))}
                    onPlantSelect={handleUserInput}
                    onToggleLiveSession={() => isLiveSessionActive ? stopLiveSession() : startLiveSession()}
                    isLiveSessionActive={isLiveSessionActive}
                    onOpenCamera={() => setIsCameraOpen(true)}
                />
            )}
            {view === 'recommendations' && (
                <RecommendationsView
                    onBack={() => setView('main')}
                    upcomingPruningDates={upcomingPruningDates}
                    onPlantSelect={handleUserInput}
                />
            )}
            {view === 'explanation' && explanationData && (
                <ExplanationView
                    data={explanationData}
                    onBack={() => { setView('main'); setExplanationData(null); }}
                    isSpeaking={isSpeaking}
                    onReadAloud={handleReadAloud}
                    onShare={handleShare}
                    onGenerateMoreDetails={handleGenerateMoreDetails}
                    onGenerateCareGuide={handleGenerateCareGuide}
                    onGenerateWeatherRecommendation={handleGenerateWeatherRecommendation}
                />
            )}
            
            {modal.type && createPortal(
                <div className="modal-overlay" onClick={() => setModal({ type: null })}>
                    <div onClick={(e) => e.stopPropagation()}>
                        {renderModalContent()}
                    </div>
                </div>,
                document.body
            )}
             {isLiveSessionActive && createPortal(
                <LiveConversationModal
                    transcript={liveTranscript}
                    connectionState={liveConnectionState}
                    onClose={stopLiveSession}
                />,
                document.body
            )}
            {isCameraOpen && createPortal(
                <CameraModal
                    onClose={() => setIsCameraOpen(false)}
                    onSubmit={handleImageSubmission}
                    onError={(err) => setToastMessage(getFriendlyErrorMessage(err))}
                />,
                document.body
            )}
        </div>
    );
};

// --- SUB-COMPONENTS ---

interface HeaderProps {
    currentTheme: Theme;
    onThemeToggle: () => void;
    currentFontSize: FontSize;
    onFontSizeChange: (size: FontSize) => void;
    onShowRecommendations: () => void;
    upcomingPruningCount: number;
}

const Header = ({ currentTheme, onThemeToggle, currentFontSize, onFontSizeChange, onShowRecommendations, upcomingPruningCount }: HeaderProps) => (
    <div className="header">
        <div>
            <h1>Pflanzen-Helfer</h1>
            <p>Ihr KI-Assistent für den perfekten Pflanzenschnitt</p>
        </div>
        <div className="header-controls">
            <button className="recommendations-link-btn" onClick={onShowRecommendations} aria-label={`Anstehende Schnitte: ${upcomingPruningCount}`}>
                <span>Empfehlungen</span>
                {upcomingPruningCount > 0 && <span className="badge">{upcomingPruningCount}</span>}
            </button>
            <div className="font-size-controls">
                <button className={`fs-small ${currentFontSize === 'small' ? 'active' : ''}`} onClick={() => onFontSizeChange('small')}>A</button>
                <button className={`fs-medium ${currentFontSize === 'medium' ? 'active' : ''}`} onClick={() => onFontSizeChange('medium')}>A</button>
                <button className={`fs-large ${currentFontSize === 'large' ? 'active' : ''}`} onClick={() => onFontSizeChange('large')}>A</button>
            </div>
            <button className="theme-toggle-btn" onClick={onThemeToggle} aria-label={`Wechsel zu ${currentTheme === 'light' ? 'Dunkel' : 'Hell'}`}>
                {currentTheme === 'light' ? '🌙' : '☀️'}
            </button>
        </div>
    </div>
);

interface MainViewProps {
    chatHistory: ChatMessage[];
    isLoading: boolean;
    error: string | null;
    chatEndRef: React.RefObject<HTMLDivElement>;
    activePlantListView: PlantListView;
    setActivePlantListView: React.Dispatch<React.SetStateAction<PlantListView>>;
    customPlants: CustomPlant[];
    janasGartenPlants: JanasGartenPlant[];
    onOpenModal: (type: ModalType, plant: Plant) => void;
    onDeletePlant: (plant: Plant) => void;
    onGenerateImage: (plant: Plant) => Promise<void>;
    allPlantNames: string[];
    customSort: string;
    setCustomSort: React.Dispatch<React.SetStateAction<string>>;
    customFilter: string;
    setCustomFilter: React.Dispatch<React.SetStateAction<string>>;
    customUniquePruningTimes: string[];
    userInput: string;
    setUserInput: React.Dispatch<React.SetStateAction<string>>;
    onFormSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    isSpeaking: boolean;
    onReadAloud: () => void;
    onPlantSelect: (plantName: string) => void;
    onToggleLiveSession: () => void;
    isLiveSessionActive: boolean;
    onOpenCamera: () => void;
}

const MainView = ({ chatHistory, isLoading, error, chatEndRef, activePlantListView, setActivePlantListView, customPlants, janasGartenPlants, onOpenModal, onDeletePlant, onGenerateImage, allPlantNames, customSort, setCustomSort, customFilter, setCustomFilter, customUniquePruningTimes, userInput, setUserInput, onFormSubmit, isSpeaking, onReadAloud, onPlantSelect, onToggleLiveSession, isLiveSessionActive, onOpenCamera }: MainViewProps) => (
    <>
        <div className="chat-history">
            {chatHistory.map(message => (
                <div key={message.id} className={`chat-message-container ${message.role}-message`}>
                    <div className="chat-message">
                        {message.imageUrl && message.role === 'user' && <img src={message.imageUrl} alt="Vom Benutzer aufgenommen" className="chat-image" />}
                        {message.text && <p dangerouslySetInnerHTML={{ __html: message.text.replace(/\n/g, '<br />') }}></p>}
                    </div>
                </div>
            ))}
            {isLoading && <div className="loader-container"><div className="loader"></div></div>}
            {error && <div className="error-message">{error}</div>}
            <div ref={chatEndRef} />
        </div>
        <div className="suggestions-container">
            <div className="category-filter-container">
                <button className={`category-btn ${activePlantListView === 'meine' ? 'active' : ''}`} onClick={() => setActivePlantListView('meine')}>Meine Pflanzen</button>
                <button className={`category-btn janas-btn ${activePlantListView === 'janas' ? 'active' : ''}`} onClick={() => setActivePlantListView('janas')}>Janas Garten</button>
                <button className={`compare-btn ${activePlantListView === 'alle' ? 'active' : ''}`} onClick={() => setActivePlantListView('alle')}>Alle durchsuchen</button>
            </div>
            
            {activePlantListView === 'meine' && (
                <div className="custom-plants-management">
                    <div className="plant-selection-header">
                        <h3>Meine Pflanzen verwalten</h3>
                        <button className="add-plant-btn" onClick={() => onOpenModal('plantForm', { type: 'custom', id: '', name: '', description: '', pruningTime: '' })}>+ Neue Pflanze</button>
                    </div>
                    <div className="plant-list-controls">
                        <div className="control-group">
                            <label htmlFor="custom-sort">Sortieren</label>
                            <select id="custom-sort" value={customSort} onChange={e => setCustomSort(e.target.value)}><option value="alpha">Alphabetisch</option><option value="nextCut">Nächster Schnitt</option></select>
                        </div>
                        <div className="control-group">
                            <label htmlFor="custom-filter">Filtern</label>
                            <select id="custom-filter" value={customFilter} onChange={e => setCustomFilter(e.target.value)}><option value="all">Alle</option>{customUniquePruningTimes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                        </div>
                    </div>
                    <PlantList plants={customPlants} onSelect={(plant) => onOpenModal('plantDetails', plant)} onEdit={(plant) => onOpenModal('plantForm', plant)} onDelete={onDeletePlant} onGenerateImage={onGenerateImage} />
                </div>
            )}

            {activePlantListView === 'janas' && (
                 <div className="custom-plants-management">
                    <div className="plant-selection-header" style={{marginTop: '0.5rem'}}>
                        <h3>Janas Garten</h3>
                    </div>
                    <PlantList plants={janasGartenPlants} onSelect={(plant) => onOpenModal('plantDetails', plant)} onGenerateImage={onGenerateImage} />
                </div>
            )}
            
            {activePlantListView === 'alle' && (
                 <div className="plant-select-wrapper">
                     <select className="plant-select-dropdown" value={""} onChange={e => { if (e.target.value) onPlantSelect(e.target.value); }} disabled={isLoading}>
                        <option value="">Alle Pflanzen durchsuchen...</option>
                        {allPlantNames.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                 </div>
             )}
        </div>
        <form className="input-form" onSubmit={onFormSubmit}>
             <div className="input-wrapper"><input type="text" value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="Pflanze eingeben..." disabled={isLoading}/></div>
            <button type="submit" disabled={isLoading || !userInput.trim()}>{isLoading ? '⏳' : '🌿'}</button>
             <button type="button" className={`live-mic-btn ${isLiveSessionActive ? 'active' : ''}`} onClick={onToggleLiveSession} aria-label={isLiveSessionActive ? "Sprach-Sitzung beenden" : "Sprach-Sitzung starten"}>
                {isLiveSessionActive ? '⏹️' : '🎤'}
            </button>
        </form>
        <button type="button" className={`read-aloud-fab-btn ${isSpeaking ? 'speaking' : ''}`} onClick={onReadAloud} disabled={!chatHistory.some(m => m.role === 'model')} aria-label={isSpeaking ? "Stopp" : "Vorlesen"}>
            {isSpeaking ? '🛑' : '🔊'}
        </button>
        <button type="button" className="camera-fab-btn" onClick={onOpenCamera} aria-label="Pflanze per Foto identifizieren">
            📷
        </button>
    </>
);

const PlantList = ({ plants, onSelect, onEdit = (_plant) => {}, onDelete = (_plant) => {}, onGenerateImage = async (_plant) => {} }) => (
    plants.length > 0 ? (
        <ul className="custom-plants-list">
            {plants.map(plant => (
                <li key={plant.type === 'custom' ? plant.id : plant.name} className="custom-plant-item janas-garten-item">
                    <div className="plant-item-image-container">
                        {plant.isLoadingImage ? <div className="loader small-loader"></div> : plant.imageUrl ? <img src={plant.imageUrl} alt={plant.name} className="plant-item-image" /> : (
                            <div className="plant-item-image-placeholder">
                                {onGenerateImage && <button className="generate-image-list-btn" onClick={(e) => { e.stopPropagation(); onGenerateImage(plant); }} aria-label={`Bild für ${plant.name} generieren`}>🖼️</button>}
                            </div>
                        )}
                    </div>
                    <div className="custom-plant-info" onClick={() => onSelect(plant)}>
                        <strong>{plant.name}</strong>
                        <p className="plant-item-description">{plant.description}</p>
                        <p className="plant-item-pruning-time">{plant.pruningTime}</p>
                    </div>
                    {plant.type === 'custom' && (
                        <div className="custom-plant-actions">
                            <button className="edit-btn" aria-label="Bearbeiten" onClick={() => onEdit(plant)}>✏️</button>
                            <button className="delete-btn" aria-label="Löschen" onClick={() => onDelete(plant)}>🗑️</button>
                        </div>
                    )}
                </li>
            ))}
        </ul>
    ) : <p className="no-custom-plants">Keine Pflanzen in dieser Liste.</p>
);

const RecommendationsView = ({ onBack, upcomingPruningDates, onPlantSelect }) => (
     <div className="recommendations-page">
        <div className="page-header"><button className="back-btn" onClick={onBack}>←</button><h2>Schnitt-Empfehlungen (30 Tage)</h2></div>
         <div className="page-content">
            {upcomingPruningDates.length > 0 ? (
                <>
                    <p>Basierend auf Ihren Listen sind dies die empfohlenen Schnittarbeiten für die kommenden Wochen.</p>
                    <ul className="recommendations-list-page">
                       {upcomingPruningDates.map((p, i) => (
                            <li key={i}><button onClick={() => onPlantSelect(p.name)}><strong>{p.name}</strong><br /><small>Fällig ab: {p.nextDate!.toLocaleDateString('de-DE')}</small><br/><small><em>(aus: {p.source})</em></small></button></li>
                       ))}
                    </ul>
                </>
            ) : <p>In den nächsten 30 Tagen stehen keine Schnittarbeiten für Ihre Pflanzen an.</p>}
         </div>
    </div>
);

const ExplanationView = ({ data, onBack, isSpeaking, onReadAloud, onShare, onGenerateMoreDetails, onGenerateCareGuide, onGenerateWeatherRecommendation }) => {
    const [activeTab, setActiveTab] = useState<'pruning' | 'care' | 'weather'>('pruning');
    const [weatherTip, setWeatherTip] = useState<{ text: string; error: string | null }>({ text: '', error: null });
    const [isGeneratingWeather, setIsGeneratingWeather] = useState(false);

    const pruningText = data.text + (data.additionalText ? `\n\nWeitere Details:\n` + data.additionalText : '');
    const textToRead = activeTab === 'pruning' ? pruningText : activeTab === 'care' ? data.careGuide || '' : weatherTip.text || '';

    const handleFetchWeather = async () => {
        if (!data.plantName) return;
        setIsGeneratingWeather(true);
        setWeatherTip({ text: '', error: null });
        try {
            const tip = await onGenerateWeatherRecommendation(data.plantName);
            setWeatherTip({ text: tip, error: null });
        } catch (err: any) {
            setWeatherTip({ text: '', error: err.message });
        } finally {
            setIsGeneratingWeather(false);
        }
    };

    return (
        <div className="explanation-page">
            <div className="page-header"><button className="back-btn" onClick={onBack}>←</button><h2>Tipp für: {data.plantName}</h2></div>
            <div className="page-content explanation-content">
                 <div className="explanation-image-container">
                    {data.isGeneratingImage ? <div className="loader modal-loader"></div> : 
                     data.imageUrl ? <img src={data.imageUrl} alt={data.plantName} className="explanation-image" /> :
                     <div className="image-placeholder"><span>Kein Bild</span></div>
                    }
                 </div>
                 <div className="tabs-container">
                     <button className={`tab-btn ${activeTab === 'pruning' ? 'active' : ''}`} onClick={() => setActiveTab('pruning')}>Schnitt-Tipp</button>
                     <button className={`tab-btn ${activeTab === 'care' ? 'active' : ''}`} onClick={() => setActiveTab('care')}>Pflegeanleitung</button>
                     <button className={`tab-btn ${activeTab === 'weather' ? 'active' : ''}`} onClick={() => setActiveTab('weather')}>Wetter-Tipp</button>
                 </div>
                 <div className="tab-content explanation-text">
                    {activeTab === 'pruning' && (
                        <>
                            <p dangerouslySetInnerHTML={{ __html: data.text.replace(/\n/g, '<br />') }}></p>
                            {data.additionalText && (
                            <>
                                <hr className="explanation-divider" />
                                <h3>Weitere Details</h3>
                                <p dangerouslySetInnerHTML={{ __html: data.additionalText.replace(/\n/g, '<br />') }}></p>
                            </>
                            )}
                        </>
                    )}
                    {activeTab === 'care' && (
                        <>
                            {data.isGeneratingCareGuide ? (
                                <div className="loader-container" style={{justifyContent: 'center'}}><div className="loader"></div></div>
                            ) : data.careGuide ? (
                                <p dangerouslySetInnerHTML={{ __html: data.careGuide.replace(/\n/g, '<br />') }}></p>
                            ) : (
                                <div className="centered-action">
                                     <p>Keine Pflegeanleitung vorhanden.</p>
                                     <button className="details-gen-btn" onClick={() => onGenerateCareGuide(data)}>Pflegeanleitung generieren</button>
                                </div>
                            )}
                        </>
                    )}
                    {activeTab === 'weather' && (
                        <>
                           {isGeneratingWeather ? (
                               <div className="loader-container" style={{justifyContent: 'center'}}><div className="loader"></div></div>
                           ) : weatherTip.error ? (
                               <div className="centered-action error-message" style={{margin: 0}}>
                                   <p>{weatherTip.error}</p>
                                   <button className="details-gen-btn" onClick={handleFetchWeather}>Erneut versuchen</button>
                               </div>
                           ) : weatherTip.text ? (
                               <p>{weatherTip.text}</p>
                           ) : (
                               <div className="centered-action">
                                   <p>Erhalten Sie standortbasierte Empfehlungen zum Gießen oder Frostschutz.</p>
                                   <button className="details-gen-btn" onClick={handleFetchWeather}>Wetter-Empfehlung anfordern</button>
                               </div>
                           )}
                        </>
                    )}
                 </div>
            </div>
            <div className="explanation-actions">
                 <div className="action-group">
                    <button className="share-btn" onClick={() => onShare(data)}>🔗 Teilen</button>
                    {activeTab === 'pruning' && (
                         <button className="details-gen-btn" onClick={onGenerateMoreDetails} disabled={data.isGeneratingMore || !!data.additionalText}>
                            {data.isGeneratingMore ? 'Lade...' : (data.additionalText ? 'Details vorhanden' : 'Mehr Details')}
                        </button>
                    )}
                 </div>
            </div>
             <button
                type="button"
                className={`read-aloud-fab-contextual ${isSpeaking ? 'speaking' : ''}`}
                onClick={() => onReadAloud(textToRead)}
                disabled={data.isGeneratingMore || data.isGeneratingCareGuide || isGeneratingWeather || !textToRead}
                aria-label={isSpeaking ? "Stopp" : "Vorlesen"}
            >
                {isSpeaking ? '🛑' : '🔊'}
            </button>
        </div>
    );
};

const PlantDetailsModal = ({ plant, onEdit, onClose, onGenerateMoreDetails, onGenerateCareGuide, onGenerateWeatherRecommendation, onRequestTip, isSpeaking, onReadAloud }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'care' | 'weather'>('details');
    const [weatherTip, setWeatherTip] = useState<{ text: string; error: string | null }>({ text: '', error: null });
    const [isGeneratingWeather, setIsGeneratingWeather] = useState(false);

    const handleFetchWeather = async () => {
        if (!plant.name) return;
        setIsGeneratingWeather(true);
        setWeatherTip({ text: '', error: null });
        try {
            const tip = await onGenerateWeatherRecommendation(plant.name);
            setWeatherTip({ text: tip, error: null });
        } catch (err: any) {
            setWeatherTip({ text: '', error: err.message });
        } finally {
            setIsGeneratingWeather(false);
        }
    };
    
    const detailsText = `${plant.description || ''}${plant.additionalDescription ? `\n\nWeitere Details:\n${plant.additionalDescription}` : ''}`;
    const textToRead = (
        activeTab === 'details' ? detailsText :
        activeTab === 'care' ? plant.careGuide || '' :
        weatherTip.text || ''
    ).trim();


    if (plant.type === 'catalog') {
        return (
            <div className="modal">
                <div className="modal-header">
                    <h2>Anfrage bestätigen</h2>
                    <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-content">
                    <p>Möchten Sie einen Schnitt-Tipp und ein Bild für <strong>{plant.name}</strong> von der KI anfordern?</p>
                </div>
                <div className="modal-actions">
                    <button type="button" className="cancel-btn" onClick={onClose}>Abbrechen</button>
                    <button type="button" className="save-btn" onClick={() => onRequestTip(plant.name)}>Anfordern</button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="modal plant-details-modal">
            <div className="modal-header"><h2>Pflanzendetails</h2><button className="modal-close-btn" onClick={onClose}>&times;</button></div>
            <div className="modal-content">
                 <div className="plant-image-modal-container">
                    {(plant.isGeneratingDetails || plant.isLoadingImage) ? <div className="loader modal-loader"></div> : plant.imageUrl ? <img src={plant.imageUrl} alt={plant.name} className="plant-image-modal"/> : (
                        <div className="image-placeholder">
                             <span>Kein Bild</span>
                        </div>
                    )}
                 </div>
                <h3>{plant.name}</h3>
                <div className="tabs-container">
                     <button className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Details & Schnitt</button>
                     <button className={`tab-btn ${activeTab === 'care' ? 'active' : ''}`} onClick={() => setActiveTab('care')}>Pflegeanleitung</button>
                     <button className={`tab-btn ${activeTab === 'weather' ? 'active' : ''}`} onClick={() => setActiveTab('weather')}>Wetter-Tipp</button>
                </div>
                <div className="tab-content">
                    {activeTab === 'details' && (
                        <div className="details-content">
                            {plant.description && <div className="detail-item"><strong>Beschreibung:</strong><p>{plant.description}</p></div>}
                            <div className="detail-item"><strong>Schnittzeit:</strong><p>{plant.pruningTime}</p></div>
                            {plant.additionalDescription && (
                                <>
                                    <hr className="details-divider" />
                                    <div className="detail-item">
                                        <strong>Weitere Details:</strong>
                                        <p dangerouslySetInnerHTML={{ __html: plant.additionalDescription.replace(/\n/g, '<br />') }}></p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {activeTab === 'care' && (
                         <div className="details-content">
                            {plant.isGeneratingCareGuide ? (
                                <div className="loader-container" style={{justifyContent: 'center'}}><div className="loader"></div></div>
                            ) : plant.careGuide ? (
                                <div className="detail-item">
                                    <p dangerouslySetInnerHTML={{ __html: plant.careGuide.replace(/\n/g, '<br />') }}></p>
                                </div>
                            ) : (
                                <div className="centered-action">
                                     <p>Keine Pflegeanleitung vorhanden.</p>
                                     <button className="details-gen-btn" onClick={() => onGenerateCareGuide(plant)}>Pflegeanleitung generieren</button>
                                </div>
                            )}
                         </div>
                    )}
                    {activeTab === 'weather' && (
                         <div className="details-content">
                            {isGeneratingWeather ? (
                                <div className="loader-container" style={{justifyContent: 'center'}}><div className="loader"></div></div>
                            ) : weatherTip.error ? (
                                <div className="centered-action error-message" style={{margin: 0}}>
                                    <p>{weatherTip.error}</p>
                                    <button className="details-gen-btn" onClick={handleFetchWeather}>Erneut versuchen</button>
                                </div>
                            ) : weatherTip.text ? (
                                <div className="detail-item"><p>{weatherTip.text}</p></div>
                            ) : (
                                <div className="centered-action">
                                     <p>Erhalten Sie standortbasierte Empfehlungen zum Gießen oder Frostschutz.</p>
                                     <button className="details-gen-btn" onClick={handleFetchWeather}>Wetter-Empfehlung anfordern</button>
                                </div>
                            )}
                         </div>
                    )}
                </div>
            </div>
            <div className="modal-actions">
                <button className="cancel-btn" onClick={onClose}>Schließen</button>
                {plant.type === 'custom' && activeTab === 'details' && <button className="edit-btn-modal" onClick={() => onEdit(plant)}>Bearbeiten</button>}
                {activeTab === 'details' && (
                    <button className="details-gen-btn" onClick={() => onGenerateMoreDetails(plant)} disabled={plant.isGeneratingDetails || !!plant.additionalDescription}>
                        {plant.isGeneratingDetails ? 'Lade...' : (plant.additionalDescription ? 'Details vorhanden' : 'Mehr Details generieren')}
                    </button>
                )}
            </div>
             <button
                type="button"
                className={`read-aloud-fab-contextual ${isSpeaking ? 'speaking' : ''}`}
                onClick={() => onReadAloud(textToRead)}
                disabled={!textToRead || plant.isGeneratingDetails || plant.isGeneratingCareGuide || isGeneratingWeather}
                aria-label={isSpeaking ? "Stopp" : "Vorlesen"}
            >
                {isSpeaking ? '🛑' : '🔊'}
            </button>
        </div>
    );
};

const PlantFormModal = ({ plant, isEdit, onSave, onClose }) => {
    const [formState, setFormState] = useState(plant || { type: 'custom', name: '', description: '', pruningTime: '' });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formState.name || !formState.pruningTime) {
            alert('Bitte Name und Schnittzeit angeben.');
            return;
        }
        onSave(formState);
    };

    return (
        <div className="modal">
            <form onSubmit={handleSubmit}>
                <div className="modal-header">
                    <h2>{isEdit ? 'Pflanze bearbeiten' : 'Neue Pflanze'}</h2>
                    <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-content">
                    <div className="modal-form">
                        <label htmlFor="plant-name">Name</label>
                        <input id="plant-name" type="text" value={formState.name} onChange={e => setFormState({...formState, name: e.target.value})} required />
                        <label htmlFor="plant-desc">Beschreibung</label>
                        <textarea id="plant-desc" value={formState.description} onChange={e => setFormState({...formState, description: e.target.value})}></textarea>
                        <label htmlFor="plant-pruning">Schnittzeit</label>
                        <input id="plant-pruning" type="text" value={formState.pruningTime} onChange={e => setFormState({...formState, pruningTime: e.target.value})} required />
                    </div>
                </div>
                <div className="modal-actions">
                    <button type="button" className="cancel-btn" onClick={onClose}>Abbrechen</button>
                    <button type="submit" className="save-btn">{isEdit ? 'Speichern' : 'Hinzufügen'}</button>
                </div>
            </form>
        </div>
    );
};

const LiveConversationModal = ({ transcript, connectionState, onClose }) => {
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    const getStatusMessage = () => {
        switch (connectionState) {
            case 'connecting': return 'Verbinde...';
            case 'listening': return 'Ich höre zu...';
            case 'error': return 'Verbindung fehlgeschlagen.';
            default: return 'Bitte sprechen Sie';
        }
    };

    return (
        <div className="live-modal-overlay">
            <div className="live-modal-content">
                <div className="live-modal-header">
                    <h2>Live-Gespräch</h2>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="transcript-container">
                    {transcript.length === 0 ? (
                        <p className="transcript-status">{getStatusMessage()}</p>
                    ) : (
                        transcript.map((entry, index) => (
                            <div key={index} className={`transcript-entry ${entry.speaker}`}>
                                <span className="speaker-label">{entry.speaker === 'user' ? 'Sie' : 'Helfer'}:</span>
                                <p>{entry.text}</p>
                            </div>
                        ))
                    )}
                    <div ref={transcriptEndRef} />
                </div>
                <div className="live-modal-footer">
                    <button className="end-session-btn" onClick={onClose}>Gespräch beenden</button>
                </div>
            </div>
        </div>
    );
};

const CameraModal = ({ onClose, onSubmit, onError }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: "environment" } 
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                onError(err);
                onClose();
            }
        };

        startCamera();

        return () => {
            // Cleanup: stop camera stream when component unmounts
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [onClose, onError]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                setCapturedImage(dataUrl);
            }
        }
    };

    return (
        <div className="camera-modal-overlay" onClick={onClose}>
            <div className="camera-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="camera-modal-header">
                    <h2>Pflanze fotografieren</h2>
                    <button className="modal-close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="camera-view-container">
                    {capturedImage ? (
                        <img src={capturedImage} alt="Aufgenommenes Bild" className="camera-preview" />
                    ) : (
                        <video ref={videoRef} autoPlay playsInline className="camera-feed"></video>
                    )}
                    <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                </div>
                <div className="camera-modal-actions">
                    {capturedImage ? (
                        <>
                            <button className="camera-action-btn retake-btn" onClick={() => setCapturedImage(null)}>Erneut</button>
                            <button className="camera-action-btn use-btn" onClick={() => onSubmit(capturedImage)}>Bild nutzen</button>
                        </>
                    ) : (
                        <button className="camera-action-btn capture-btn" onClick={handleCapture}>Foto aufnehmen</button>
                    )}
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);