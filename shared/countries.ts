/** Where a competition is, as Add a competition asks it: ISO 3166-1 codes, with the UK's four nations as choices of their own. */

// Every ISO 3166-1 code, for "Another country". GB is there as the UK, for anyone who'd rather not say which nation.
export const ISO_COUNTRIES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF YE YT ZA ZM ZW'.split(
    ' ',
  );

/** A UK nation is stored as the UK's code with the nation as its region, as the venue search would put it. */
export const UK_NATIONS: Record<string, string> = {
  'GB-SCT': 'Scotland',
  'GB-ENG': 'England',
  'GB-WLS': 'Wales',
  'GB-NIR': 'Northern Ireland',
};

/** A country choice (`CA`, `GB-SCT`) as a competition stores it: its country code, and its region when it is a UK nation. */
export function storedCountry(code: string): { iso: string; region: string | null } | null {
  if (UK_NATIONS[code]) return { iso: 'GB', region: UK_NATIONS[code] };
  return ISO_COUNTRIES.includes(code) ? { iso: code, region: null } : null;
}
