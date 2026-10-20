/**
 * Country codes for SIBA.
 *
 * SIBA does NOT take plain ISO 3166-1: it takes its own "Tabela ICAO" (ICAO
 * Doc 9303 codes), and the technical FAQ is explicit — "Não serão aceites
 * outras tabelas de códigos de país" (P14, siba.ssi.gov.pt/ajuda/perguntas-tecnicas).
 * The table is published at https://siba.ssi.gov.pt/s/documentacao/DocPaisesNH.aspx
 * (copy in ./reference/tabela-icao-siba.xml.txt, fetched 2026-10-20). It is
 * ISO alpha-3 for every listed country except:
 *   - Germany is "D" (ICAO 9303), not "DEU" — verified on the test webservice
 *     2026-10-20: "D" accepted, "DEU" rejected with code 12 ("Nacionalidade
 *     'DEU' que é Inválida");
 *   - Kosovo is "RKS" (ISO has no official code; "XKX" is the common user-assigned one);
 *   - 42 dependent territories (Gibraltar, Aruba, Guadeloupe, Jersey…) are absent.
 *
 * The PMS stores ISO alpha-3 (see SibaBulletin in ./types.ts); this module
 * turns it into the SIBA code at the moment the bulletin is written.
 */

export type IsoCountry = { alpha2: string; alpha3: string; namePt: string };

/** ISO 3166-1 (249 officially assigned codes), with pt-PT names. */
const ISO_TABLE = `
AD AND Andorra
AE ARE Emirados Árabes Unidos
AF AFG Afeganistão
AG ATG Antígua e Barbuda
AI AIA Anguila
AL ALB Albânia
AM ARM Arménia
AO AGO Angola
AQ ATA Antártida
AR ARG Argentina
AS ASM Samoa Americana
AT AUT Áustria
AU AUS Austrália
AW ABW Aruba
AX ALA Ilhas Åland
AZ AZE Azerbaijão
BA BIH Bósnia e Herzegovina
BB BRB Barbados
BD BGD Bangladesh
BE BEL Bélgica
BF BFA Burkina Faso
BG BGR Bulgária
BH BHR Barém
BI BDI Burundi
BJ BEN Benim
BL BLM São Bartolomeu
BM BMU Bermudas
BN BRN Brunei
BO BOL Bolívia
BQ BES Bonaire, Santo Eustáquio e Saba
BR BRA Brasil
BS BHS Baamas
BT BTN Butão
BV BVT Ilha Bouvet
BW BWA Botsuana
BY BLR Bielorrússia
BZ BLZ Belize
CA CAN Canadá
CC CCK Ilhas Cocos (Keeling)
CD COD República Democrática do Congo
CF CAF República Centro-Africana
CG COG Congo
CH CHE Suíça
CI CIV Costa do Marfim
CK COK Ilhas Cook
CL CHL Chile
CM CMR Camarões
CN CHN China
CO COL Colômbia
CR CRI Costa Rica
CU CUB Cuba
CV CPV Cabo Verde
CW CUW Curaçau
CX CXR Ilha do Natal
CY CYP Chipre
CZ CZE Chéquia
DE DEU Alemanha
DJ DJI Jibuti
DK DNK Dinamarca
DM DMA Dominica
DO DOM República Dominicana
DZ DZA Argélia
EC ECU Equador
EE EST Estónia
EG EGY Egito
EH ESH Sara Ocidental
ER ERI Eritreia
ES ESP Espanha
ET ETH Etiópia
FI FIN Finlândia
FJ FJI Fiji
FK FLK Ilhas Falkland (Malvinas)
FM FSM Micronésia
FO FRO Ilhas Faroé
FR FRA França
GA GAB Gabão
GB GBR Reino Unido
GD GRD Granada
GE GEO Geórgia
GF GUF Guiana Francesa
GG GGY Guernsey
GH GHA Gana
GI GIB Gibraltar
GL GRL Gronelândia
GM GMB Gâmbia
GN GIN Guiné
GP GLP Guadalupe
GQ GNQ Guiné Equatorial
GR GRC Grécia
GS SGS Ilhas Geórgia do Sul e Sandwich do Sul
GT GTM Guatemala
GU GUM Guame
GW GNB Guiné-Bissau
GY GUY Guiana
HK HKG Hong Kong
HM HMD Ilhas Heard e McDonald
HN HND Honduras
HR HRV Croácia
HT HTI Haiti
HU HUN Hungria
ID IDN Indonésia
IE IRL Irlanda
IL ISR Israel
IM IMN Ilha de Man
IN IND Índia
IO IOT Território Britânico do Oceano Índico
IQ IRQ Iraque
IR IRN Irão
IS ISL Islândia
IT ITA Itália
JE JEY Jersey
JM JAM Jamaica
JO JOR Jordânia
JP JPN Japão
KE KEN Quénia
KG KGZ Quirguistão
KH KHM Camboja
KI KIR Quiribáti
KM COM Comores
KN KNA São Cristóvão e Neves
KP PRK Coreia do Norte
KR KOR Coreia do Sul
KW KWT Kuwait
KY CYM Ilhas Caimão
KZ KAZ Cazaquistão
LA LAO Laos
LB LBN Líbano
LC LCA Santa Lúcia
LI LIE Listenstaine
LK LKA Sri Lanca
LR LBR Libéria
LS LSO Lesoto
LT LTU Lituânia
LU LUX Luxemburgo
LV LVA Letónia
LY LBY Líbia
MA MAR Marrocos
MC MCO Mónaco
MD MDA Moldávia
ME MNE Montenegro
MF MAF São Martinho (parte francesa)
MG MDG Madagáscar
MH MHL Ilhas Marshall
MK MKD Macedónia do Norte
ML MLI Mali
MM MMR Myanmar
MN MNG Mongólia
MO MAC Macau
MP MNP Ilhas Marianas do Norte
MQ MTQ Martinica
MR MRT Mauritânia
MS MSR Monserrate
MT MLT Malta
MU MUS Maurícia
MV MDV Maldivas
MW MWI Maláui
MX MEX México
MY MYS Malásia
MZ MOZ Moçambique
NA NAM Namíbia
NC NCL Nova Caledónia
NE NER Níger
NF NFK Ilha Norfolk
NG NGA Nigéria
NI NIC Nicarágua
NL NLD Países Baixos
NO NOR Noruega
NP NPL Nepal
NR NRU Nauru
NU NIU Niue
NZ NZL Nova Zelândia
OM OMN Omã
PA PAN Panamá
PE PER Peru
PF PYF Polinésia Francesa
PG PNG Papua-Nova Guiné
PH PHL Filipinas
PK PAK Paquistão
PL POL Polónia
PM SPM São Pedro e Miquelão
PN PCN Ilhas Pitcairn
PR PRI Porto Rico
PS PSE Palestina
PT PRT Portugal
PW PLW Palau
PY PRY Paraguai
QA QAT Catar
RE REU Reunião
RO ROU Roménia
RS SRB Sérvia
RU RUS Rússia
RW RWA Ruanda
SA SAU Arábia Saudita
SB SLB Ilhas Salomão
SC SYC Seicheles
SD SDN Sudão
SE SWE Suécia
SG SGP Singapura
SH SHN Santa Helena, Ascensão e Tristão da Cunha
SI SVN Eslovénia
SJ SJM Svalbard e Jan Mayen
SK SVK Eslováquia
SL SLE Serra Leoa
SM SMR São Marinho
SN SEN Senegal
SO SOM Somália
SR SUR Suriname
SS SSD Sudão do Sul
ST STP São Tomé e Príncipe
SV SLV El Salvador
SX SXM São Martinho (parte neerlandesa)
SY SYR Síria
SZ SWZ Essuatíni
TC TCA Ilhas Turcas e Caicos
TD TCD Chade
TF ATF Terras Austrais e Antárticas Francesas
TG TGO Togo
TH THA Tailândia
TJ TJK Tajiquistão
TK TKL Toquelau
TL TLS Timor-Leste
TM TKM Turquemenistão
TN TUN Tunísia
TO TON Tonga
TR TUR Turquia
TT TTO Trindade e Tobago
TV TUV Tuvalu
TW TWN Taiwan
TZ TZA Tanzânia
UA UKR Ucrânia
UG UGA Uganda
UM UMI Ilhas Menores Afastadas dos Estados Unidos
US USA Estados Unidos
UY URY Uruguai
UZ UZB Usbequistão
VA VAT Santa Sé
VC VCT São Vicente e Granadinas
VE VEN Venezuela
VG VGB Ilhas Virgens Britânicas
VI VIR Ilhas Virgens Americanas
VN VNM Vietname
VU VUT Vanuatu
WF WLF Wallis e Futuna
WS WSM Samoa
YE YEM Iémen
YT MYT Maiote
ZA ZAF África do Sul
ZM ZMB Zâmbia
ZW ZWE Zimbabué
`;

export const ISO_COUNTRIES: readonly IsoCountry[] = ISO_TABLE.trim()
  .split("\n")
  .map((line) => {
    const [alpha2, alpha3, ...name] = line.split(" ");
    return { alpha2, alpha3, namePt: name.join(" ") };
  });

/** Kosovo is not in ISO 3166-1; "XK"/"XKX" are the user-assigned codes everyone uses. */
export const KOSOVO: IsoCountry = { alpha2: "XK", alpha3: "XKX", namePt: "Kosovo" };

const byAlpha2 = new Map<string, IsoCountry>();
const byAlpha3 = new Map<string, IsoCountry>();
for (const c of [...ISO_COUNTRIES, KOSOVO]) {
  byAlpha2.set(c.alpha2, c);
  byAlpha3.set(c.alpha3, c);
}

/** True for an ISO 3166-1 alpha-3 code (or XKX, Kosovo). Case-insensitive. */
export function isAlpha3(code: string): boolean {
  return byAlpha3.has(code.trim().toUpperCase());
}

/** "FR" → "FRA". Undefined when the alpha-2 code is unknown. */
export function alpha2ToAlpha3(code: string): string | undefined {
  return byAlpha2.get(code.trim().toUpperCase())?.alpha3;
}

/** "FRA" → "FR". Undefined when the alpha-3 code is unknown. */
export function alpha3ToAlpha2(code: string): string | undefined {
  return byAlpha3.get(code.trim().toUpperCase())?.alpha2;
}

/** Portuguese name of an ISO alpha-3 code, or undefined. */
export function countryNamePt(alpha3: string): string | undefined {
  return byAlpha3.get(alpha3.trim().toUpperCase())?.namePt;
}

export type SibaCountry = { code: string; namePt: string };

/** SIBA's ICAO table, verbatim (code and "Designacao"), sorted by code. */
const SIBA_TABLE = `
AFG Afeganistão
AGO Angola
ALB Albânia
AND Andorra
ARE Emiratos Árabes Unidos
ARG Argentina
ARM Arménia
ATG Antígua e Barbuda
AUS Austrália
AUT Áustria
AZE República Azerbaijão
BDI Burundi
BEL Bélgica
BEN Benim
BFA Burkina Faso
BGD Bangladesh
BGR Bulgaria
BHR Barém
BHS Bahamas
BIH Bósnia Herzegovina
BLR República Bielorrússia
BLZ Belize
BMU Bermudas
BOL Bolívia
BRA Brasil
BRB Barbados
BRN Brunei Darussalam
BTN Butão
BWA Botswana
CAF República Centro Africana
CAN Canadá
CHE Suíça
CHL Chile
CHN China
CIV Costa do Marfim
CMR Camarões
COD Rep. Democ. Congo (Zaire)
COG Congo
COK Ilhas Cook
COL Colômbia
COM União das Comores
CPV Cabo Verde
CRI Costa Rica
CUB Cuba
CYP Chipre
CZE República Checa
D Alemanha
DJI Jibuti
DMA Dominica
DNK Dinamarca
DOM República Dominicana
DZA Argélia
ECU Equador
EGY Egipto
ERI Eritreia
ESP Espanha
EST Estónia
ETH Etiópia
FIN Finlândia
FJI Ilhas Fiji
FRA França
FSM Micronésia, Estados Federados da
GAB Gabão
GBR Reino Unido
GEO Geórgia
GHA Gana
GIN Guiné Conacri
GMB Gâmbia
GNB Guiné-Bissau
GNQ Guiné Equatorial
GRC Grécia
GRD Granada
GTM Guatemala
GUM Guam
GUY Guiana
HKG Hong-Kong
HND Honduras
HRV Croácia
HTI Haiti
HUN Hungria
IDN Indonésia
IND Índia
IRL Irlanda
IRN Irão, República Islâmica
IRQ Iraque
ISL Islândia
ISR Israel
ITA Itália
JAM Jamaica
JOR Jordânia
JPN Japão
KAZ República do Cazaquistão
KEN Quénia
KGZ Quirguizistão
KHM Camboja
KIR Kiribati
KNA São Cristóvão e Nevis
KOR República da Coreia
KWT Kuwait
LAO Laos, República Popular Democrática
LBN Líbano
LBR Libéria
LBY Líbia
LCA Santa Lúcia
LIE Liechtenstein
LKA Sri Lanka
LSO Lesoto
LTU Lituânia
LUX Luxemburgo
LVA Letónia
MAC Macau
MAR Marrocos
MCO Mónaco
MDA República Moldávia
MDG Madagáscar
MDV Maldivas
MEX México
MHL Ilhas Marshall
MKD República da Macedónia do Norte
MLI Mali
MLT Malta
MMR Myanmar (Birmânia)
MNE Montenegro, República de
MNG Mongólia
MOZ Moçambique
MRT Mauritânia
MSR Monserrate
MUS Ilhas Maurícias
MWI Malawi
MYS Malásia
MYT Mayotte
NAM Namíbia
NCL Nova Caledónia
NER Níger
NGA Nigéria
NIC Nicarágua
NIU Niue
NLD Países Baixos
NOR Noruega
NPL Nepal
NRU Nauru
NZL Nova Zelândia
OMN Oman
PAK Paquistão
PAN Panamá
PER Peru
PHL Filipinas
PLW PALAU
PNG Papuásia Nova Guiné
POL Polónia
PRI Porto Rico
PRK Coreia
PRT Portugal
PRY Paraguai
PSE Palestina
QAT Quatar
REU Reunião
RKS Kosovo, República do
ROU Roménia
RUS Rússia, Federação
RWA Ruanda
SAU Arábia Saudita
SDN Sudão
SEN Senegal
SGP Singapura
SLB Ilhas Salomão
SLE Serra Leoa
SLV El Salvador
SMR São Marino
SOM Somália
SRB Sérvia, República da
SSD República do Sudão do Sul
STP São Tomé e Príncipe
SUR Suriname
SVK República Eslovaca
SVN Eslovénia
SWE Suécia
SWZ Suazilândia
SYC Seychelles
SYR Síria, República Árabe da
TCD Chade
TGO Togo
THA Tailândia
TJK Tajiquistão
TKM Turquemenistão
TLS Timor-Leste
TON Tonga
TTO Trindade e Tobago
TUN Tunísia
TUR Turquia
TUV Tuvalu
TWN Taiwan
TZA Tanzânia, República da
UGA Uganda
UKR República Ucrânia
URY Uruguai
USA Estados Unidos da América
UZB Usbequistão
VAT Santa Sé (Cidade Estado do Vaticano)
VCT São Vicente e Grenadinas
VEN Venezuela
VNM Vietname
VUT Vanuatu
WSM Samoa
YEM Republica Árabe do Iémen
ZAF África do Sul
ZMB Zâmbia
ZWE Zimbabwe
`;

export const SIBA_COUNTRIES: readonly SibaCountry[] = SIBA_TABLE.trim()
  .split("\n")
  .map((line) => {
    const i = line.indexOf(" ");
    return { code: line.slice(0, i), namePt: line.slice(i + 1) };
  });

const sibaCodes = new Set(SIBA_COUNTRIES.map((c) => c.code));

/** ISO alpha-3 codes whose SIBA (ICAO) code is different. */
const ISO_TO_SIBA: Record<string, string> = { DEU: "D", XKX: "RKS" };

/**
 * Territories missing from SIBA's table, with the sovereign country to use
 * instead — offered to the desk as a suggestion, never applied silently
 * (null: no sensible suggestion).
 */
export const TERRITORY_SOVEREIGN: Record<string, string | null> = {
  ABW: "NLD", AIA: "GBR", ALA: "FIN", ASM: "USA", ATA: null, ATF: "FRA",
  BES: "NLD", BLM: "FRA", BVT: "NOR", CCK: "AUS", CUW: "NLD", CXR: "AUS",
  CYM: "GBR", ESH: null, FLK: "GBR", FRO: "DNK", GGY: "GBR", GIB: "GBR",
  GLP: "FRA", GRL: "DNK", GUF: "FRA", HMD: "AUS", IMN: "GBR", IOT: "GBR",
  JEY: "GBR", MAF: "FRA", MNP: "USA", MTQ: "FRA", NFK: "AUS", PCN: "GBR",
  PYF: "FRA", SGS: "GBR", SHN: "GBR", SJM: "NOR", SPM: "FRA", SXM: "NLD",
  TCA: "GBR", TKL: "NZL", UMI: "USA", VGB: "GBR", VIR: "USA", WLF: "FRA",
};

/**
 * The code SIBA accepts for an ISO alpha-3 country ("DEU" → "D"), or null
 * when the country is not in SIBA's table. A code that is already a SIBA
 * code ("D", "RKS") is returned as is.
 */
export function toSibaCountryCode(alpha3: string): string | null {
  const code = alpha3.trim().toUpperCase();
  if (ISO_TO_SIBA[code]) return ISO_TO_SIBA[code];
  return sibaCodes.has(code) ? code : null;
}

/** Bulletins are for foreigners only. */
const PORTUGAL = "PRT";

/**
 * Whether a guest of this nationality must be reported to SIBA.
 *
 * Only Portuguese citizens are exempt: the obligation covers every foreign
 * citizen — EU/EEA included — of any age (Lei n.º 23/2007, art. 15.º e 16.º;
 * SIBA FAQ: "Deve ser comunicado o alojamento de cidadãos estrangeiros, por tal
 * se entendendo todos aqueles que não têm nacionalidade portuguesa" and
 * "Deve ser comunicado o alojamento de qualquer cidadão estrangeiro […]
 * independentemente da idade", https://siba.ssi.gov.pt/ajuda/perguntas-frequentes/).
 * An unknown or empty nationality returns true: when in doubt the desk must
 * ask, not skip.
 */
export function requiresBulletin(nationalityAlpha3: string): boolean {
  return nationalityAlpha3.trim().toUpperCase() !== PORTUGAL;
}

export type SibaDocumentType = { code: "P" | "B" | "O"; labelPt: string };

/** Tipo_Documento codes, from siba.ssi.gov.pt/ajuda/modos-de-envio/. */
export const SIBA_DOCUMENT_TYPES: readonly SibaDocumentType[] = [
  { code: "P", labelPt: "Passaporte" },
  { code: "B", labelPt: "Bilhete de identidade / cartão de cidadão" },
  { code: "O", labelPt: "Outro documento de identificação" },
];

export function isSibaDocumentType(code: string): code is SibaDocumentType["code"] {
  return SIBA_DOCUMENT_TYPES.some((t) => t.code === code);
}
