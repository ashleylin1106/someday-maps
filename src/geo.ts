// Rule-based country / city detection from free text.
// Not exhaustive — a curated list of popular travel destinations, with
// local-language aliases for common East-Asian cities.

interface CityDef {
  aliases: string[]; // things that might appear in text (incl. local names)
  city: string; // canonical English city name
  country: string; // canonical English country name
}

// Curated popular destinations. Add more here anytime.
const CITY_DEFS: CityDef[] = [
  // Japan
  { aliases: ['tokyo', '東京', '东京'], city: 'Tokyo', country: 'Japan' },
  { aliases: ['osaka', '大阪'], city: 'Osaka', country: 'Japan' },
  { aliases: ['kyoto', '京都'], city: 'Kyoto', country: 'Japan' },
  { aliases: ['nara', '奈良'], city: 'Nara', country: 'Japan' },
  { aliases: ['sapporo', '札幌'], city: 'Sapporo', country: 'Japan' },
  { aliases: ['fukuoka', '福岡', '福冈'], city: 'Fukuoka', country: 'Japan' },
  { aliases: ['nagoya', '名古屋'], city: 'Nagoya', country: 'Japan' },
  { aliases: ['okinawa', '沖繩', '冲绳'], city: 'Okinawa', country: 'Japan' },
  { aliases: ['hokkaido', '北海道'], city: 'Hokkaido', country: 'Japan' },
  { aliases: ['kobe', '神戶', '神户'], city: 'Kobe', country: 'Japan' },
  { aliases: ['yokohama', '橫濱', '横滨'], city: 'Yokohama', country: 'Japan' },
  { aliases: ['kanazawa', '金澤', '金泽'], city: 'Kanazawa', country: 'Japan' },
  { aliases: ['hakone', '箱根'], city: 'Hakone', country: 'Japan' },
  // South Korea
  { aliases: ['seoul', '首爾', '首尔', '서울'], city: 'Seoul', country: 'South Korea' },
  { aliases: ['busan', '釜山', '부산'], city: 'Busan', country: 'South Korea' },
  { aliases: ['jeju', '濟州', '济州', '제주'], city: 'Jeju', country: 'South Korea' },
  { aliases: ['incheon', '仁川'], city: 'Incheon', country: 'South Korea' },
  // Taiwan
  { aliases: ['taipei', '台北', '臺北'], city: 'Taipei', country: 'Taiwan' },
  { aliases: ['taichung', '台中', '臺中'], city: 'Taichung', country: 'Taiwan' },
  { aliases: ['tainan', '台南', '臺南'], city: 'Tainan', country: 'Taiwan' },
  { aliases: ['kaohsiung', '高雄'], city: 'Kaohsiung', country: 'Taiwan' },
  { aliases: ['hualien', '花蓮', '花莲'], city: 'Hualien', country: 'Taiwan' },
  // Hong Kong / Macau
  { aliases: ['hong kong', 'hongkong', '香港'], city: 'Hong Kong', country: 'Hong Kong' },
  { aliases: ['macau', 'macao', '澳門', '澳门'], city: 'Macau', country: 'Macau' },
  // China
  { aliases: ['shanghai', '上海'], city: 'Shanghai', country: 'China' },
  { aliases: ['beijing', 'peking', '北京'], city: 'Beijing', country: 'China' },
  { aliases: ['chengdu', '成都'], city: 'Chengdu', country: 'China' },
  { aliases: ['guangzhou', '廣州', '广州'], city: 'Guangzhou', country: 'China' },
  { aliases: ['shenzhen', '深圳'], city: 'Shenzhen', country: 'China' },
  { aliases: ['xian', "xi'an", '西安'], city: "Xi'an", country: 'China' },
  // Thailand
  { aliases: ['bangkok', '曼谷'], city: 'Bangkok', country: 'Thailand' },
  { aliases: ['chiang mai', 'chiangmai', '清邁', '清迈'], city: 'Chiang Mai', country: 'Thailand' },
  { aliases: ['phuket', '普吉'], city: 'Phuket', country: 'Thailand' },
  { aliases: ['pattaya', '芭達雅', '芭提雅'], city: 'Pattaya', country: 'Thailand' },
  // Vietnam
  { aliases: ['hanoi', '河內', '河内'], city: 'Hanoi', country: 'Vietnam' },
  { aliases: ['ho chi minh', 'saigon', '胡志明', '西貢', '西贡'], city: 'Ho Chi Minh City', country: 'Vietnam' },
  { aliases: ['da nang', 'danang', '峴港', '岘港'], city: 'Da Nang', country: 'Vietnam' },
  { aliases: ['hoi an', 'hoian', '會安', '会安'], city: 'Hoi An', country: 'Vietnam' },
  // SE Asia
  { aliases: ['singapore', '新加坡'], city: 'Singapore', country: 'Singapore' },
  { aliases: ['kuala lumpur', 'kl ', '吉隆坡'], city: 'Kuala Lumpur', country: 'Malaysia' },
  { aliases: ['penang', '檳城', '槟城'], city: 'Penang', country: 'Malaysia' },
  { aliases: ['bali', '峇里', '巴厘'], city: 'Bali', country: 'Indonesia' },
  { aliases: ['jakarta', '雅加達', '雅加达'], city: 'Jakarta', country: 'Indonesia' },
  { aliases: ['manila', '馬尼拉', '马尼拉'], city: 'Manila', country: 'Philippines' },
  { aliases: ['cebu', '宿霧', '宿务'], city: 'Cebu', country: 'Philippines' },
  { aliases: ['siem reap', 'siemreap', '暹粒'], city: 'Siem Reap', country: 'Cambodia' },
  // Europe
  { aliases: ['paris', '巴黎'], city: 'Paris', country: 'France' },
  { aliases: ['nice, france', 'nice france'], city: 'Nice', country: 'France' },
  { aliases: ['lyon', '里昂'], city: 'Lyon', country: 'France' },
  { aliases: ['london', '倫敦', '伦敦'], city: 'London', country: 'United Kingdom' },
  { aliases: ['edinburgh', '愛丁堡', '爱丁堡'], city: 'Edinburgh', country: 'United Kingdom' },
  { aliases: ['rome', 'roma', '羅馬', '罗马'], city: 'Rome', country: 'Italy' },
  { aliases: ['milan', 'milano', '米蘭', '米兰'], city: 'Milan', country: 'Italy' },
  { aliases: ['florence', 'firenze', '佛羅倫斯', '佛罗伦萨'], city: 'Florence', country: 'Italy' },
  { aliases: ['venice', 'venezia', '威尼斯'], city: 'Venice', country: 'Italy' },
  { aliases: ['barcelona', '巴塞隆納', '巴塞罗那'], city: 'Barcelona', country: 'Spain' },
  { aliases: ['madrid', '馬德里', '马德里'], city: 'Madrid', country: 'Spain' },
  { aliases: ['lisbon', 'lisboa', '里斯本'], city: 'Lisbon', country: 'Portugal' },
  { aliases: ['porto', '波多', '波爾圖'], city: 'Porto', country: 'Portugal' },
  { aliases: ['amsterdam', '阿姆斯特丹'], city: 'Amsterdam', country: 'Netherlands' },
  { aliases: ['berlin', '柏林'], city: 'Berlin', country: 'Germany' },
  { aliases: ['munich', 'münchen', '慕尼黑'], city: 'Munich', country: 'Germany' },
  { aliases: ['vienna', 'wien', '維也納', '维也纳'], city: 'Vienna', country: 'Austria' },
  { aliases: ['prague', 'praha', '布拉格'], city: 'Prague', country: 'Czechia' },
  { aliases: ['zurich', '蘇黎世', '苏黎世'], city: 'Zurich', country: 'Switzerland' },
  { aliases: ['santorini', '聖托里尼', '圣托里尼'], city: 'Santorini', country: 'Greece' },
  { aliases: ['athens', '雅典'], city: 'Athens', country: 'Greece' },
  { aliases: ['istanbul', '伊斯坦堡', '伊斯坦布尔'], city: 'Istanbul', country: 'Turkey' },
  // Americas
  { aliases: ['new york', 'nyc', '紐約', '纽约'], city: 'New York', country: 'United States' },
  { aliases: ['los angeles', ' la,', '洛杉磯', '洛杉矶'], city: 'Los Angeles', country: 'United States' },
  { aliases: ['san francisco', '舊金山', '旧金山'], city: 'San Francisco', country: 'United States' },
  { aliases: ['las vegas', '拉斯維加斯', '拉斯维加斯'], city: 'Las Vegas', country: 'United States' },
  { aliases: ['seattle', '西雅圖', '西雅图'], city: 'Seattle', country: 'United States' },
  { aliases: ['chicago', '芝加哥'], city: 'Chicago', country: 'United States' },
  { aliases: ['hawaii', 'honolulu', '夏威夷'], city: 'Honolulu', country: 'United States' },
  { aliases: ['vancouver', '溫哥華', '温哥华'], city: 'Vancouver', country: 'Canada' },
  { aliases: ['toronto', '多倫多', '多伦多'], city: 'Toronto', country: 'Canada' },
  { aliases: ['mexico city', 'cdmx', '墨西哥城'], city: 'Mexico City', country: 'Mexico' },
  // Oceania
  { aliases: ['sydney', '雪梨', '悉尼'], city: 'Sydney', country: 'Australia' },
  { aliases: ['melbourne', '墨爾本', '墨尔本'], city: 'Melbourne', country: 'Australia' },
  { aliases: ['auckland', '奧克蘭', '奥克兰'], city: 'Auckland', country: 'New Zealand' },
  // Middle East
  { aliases: ['dubai', '杜拜', '迪拜'], city: 'Dubai', country: 'United Arab Emirates' },
];

interface CountryDef {
  aliases: string[];
  country: string;
}

const COUNTRY_DEFS: CountryDef[] = [
  { aliases: ['japan', '日本'], country: 'Japan' },
  { aliases: ['korea', 'south korea', '韓國', '韩国'], country: 'South Korea' },
  { aliases: ['taiwan', '台灣', '臺灣', '台湾'], country: 'Taiwan' },
  { aliases: ['thailand', '泰國', '泰国'], country: 'Thailand' },
  { aliases: ['vietnam', '越南'], country: 'Vietnam' },
  { aliases: ['singapore', '新加坡'], country: 'Singapore' },
  { aliases: ['malaysia', '馬來西亞', '马来西亚'], country: 'Malaysia' },
  { aliases: ['indonesia', '印尼', '印度尼西亞'], country: 'Indonesia' },
  { aliases: ['philippines', '菲律賓', '菲律宾'], country: 'Philippines' },
  { aliases: ['cambodia', '柬埔寨'], country: 'Cambodia' },
  { aliases: ['china', '中國', '中国'], country: 'China' },
  { aliases: ['france', '法國', '法国'], country: 'France' },
  { aliases: ['italy', 'italia', '義大利', '意大利'], country: 'Italy' },
  { aliases: ['spain', 'españa', '西班牙'], country: 'Spain' },
  { aliases: ['portugal', '葡萄牙'], country: 'Portugal' },
  { aliases: ['germany', '德國', '德国'], country: 'Germany' },
  { aliases: ['netherlands', 'holland', '荷蘭', '荷兰'], country: 'Netherlands' },
  { aliases: ['switzerland', '瑞士'], country: 'Switzerland' },
  { aliases: ['austria', '奧地利', '奥地利'], country: 'Austria' },
  { aliases: ['greece', '希臘', '希腊'], country: 'Greece' },
  { aliases: ['turkey', 'türkiye', '土耳其'], country: 'Turkey' },
  { aliases: ['united kingdom', 'england', 'britain', '英國', '英国'], country: 'United Kingdom' },
  { aliases: ['united states', ' usa', ' u.s.', 'america', '美國', '美国'], country: 'United States' },
  { aliases: ['canada', '加拿大'], country: 'Canada' },
  { aliases: ['mexico', '墨西哥'], country: 'Mexico' },
  { aliases: ['australia', '澳洲', '澳大利亚'], country: 'Australia' },
  { aliases: ['new zealand', '紐西蘭', '新西兰'], country: 'New Zealand' },
];

export interface DetectedLocation {
  city: string;
  country: string;
}

// Flatten + sort aliases longest-first so "new york" wins over "york".
const CITY_INDEX: { alias: string; city: string; country: string }[] = CITY_DEFS.flatMap((d) =>
  d.aliases.map((a) => ({ alias: a.toLowerCase(), city: d.city, country: d.country }))
).sort((a, b) => b.alias.length - a.alias.length);

const COUNTRY_INDEX: { alias: string; country: string }[] = COUNTRY_DEFS.flatMap((d) =>
  d.aliases.map((a) => ({ alias: a.toLowerCase(), country: d.country }))
).sort((a, b) => b.alias.length - a.alias.length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ASCII aliases match on word boundaries; non-ASCII (CJK) use substring.
function matches(text: string, alias: string): boolean {
  if (/^[\x00-\x7f]+$/.test(alias)) {
    const re = new RegExp(`(^|[^a-z])${escapeRegExp(alias.trim())}([^a-z]|$)`, 'i');
    return re.test(text);
  }
  return text.includes(alias);
}

// Country (canonical English) → continent, for the top grouping level.
// Comprehensive country → continent, built from per-continent lists so any
// country a user adds gets grouped correctly (not dumped into "Other").
const CONTINENT_COUNTRIES: Record<string, string[]> = {
  Asia: [
    'Japan', 'South Korea', 'North Korea', 'Taiwan', 'Hong Kong', 'Macau', 'China', 'Mongolia',
    'Thailand', 'Vietnam', 'Singapore', 'Malaysia', 'Indonesia', 'Philippines', 'Cambodia',
    'Laos', 'Myanmar', 'Brunei', 'Timor-Leste', 'India', 'Pakistan', 'Bangladesh', 'Sri Lanka',
    'Nepal', 'Bhutan', 'Maldives', 'Afghanistan', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan',
    'Kyrgyzstan', 'Tajikistan', 'Iran', 'Iraq', 'Israel', 'Palestine', 'Jordan', 'Lebanon',
    'Syria', 'Saudi Arabia', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Kuwait', 'Oman',
    'Yemen', 'Georgia', 'Armenia', 'Azerbaijan', 'Cyprus',
  ],
  Europe: [
    'United Kingdom', 'Ireland', 'France', 'Germany', 'Italy', 'Spain', 'Portugal', 'Netherlands',
    'Belgium', 'Luxembourg', 'Switzerland', 'Austria', 'Denmark', 'Sweden', 'Norway', 'Finland',
    'Iceland', 'Greece', 'Turkey', 'Czechia', 'Poland', 'Hungary', 'Slovakia', 'Slovenia',
    'Croatia', 'Bosnia and Herzegovina', 'Serbia', 'Montenegro', 'North Macedonia', 'Albania',
    'Kosovo', 'Bulgaria', 'Romania', 'Moldova', 'Ukraine', 'Belarus', 'Russia', 'Estonia',
    'Latvia', 'Lithuania', 'Malta', 'Monaco', 'Andorra', 'Liechtenstein', 'San Marino',
    'Vatican City', 'Luxembourg',
  ],
  'North America': [
    'United States', 'Canada', 'Mexico', 'Guatemala', 'Belize', 'Honduras', 'El Salvador',
    'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Jamaica', 'Bahamas', 'Dominican Republic',
    'Haiti', 'Puerto Rico', 'Trinidad and Tobago', 'Barbados',
  ],
  'South America': [
    'Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia', 'Ecuador', 'Bolivia', 'Paraguay',
    'Uruguay', 'Venezuela', 'Guyana', 'Suriname',
  ],
  Oceania: [
    'Australia', 'New Zealand', 'Fiji', 'Papua New Guinea', 'Samoa', 'Tonga', 'Vanuatu',
    'Solomon Islands', 'French Polynesia',
  ],
  Africa: [
    'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'South Africa', 'Kenya', 'Tanzania', 'Uganda',
    'Rwanda', 'Ethiopia', 'Ghana', 'Nigeria', 'Senegal', 'Ivory Coast', 'Cameroon', 'Botswana',
    'Namibia', 'Zimbabwe', 'Zambia', 'Mozambique', 'Mauritius', 'Seychelles', 'Madagascar',
    'Malawi', 'Angola', 'Cape Verde',
  ],
};

const COUNTRY_CONTINENT: Record<string, string> = {};
for (const [continent, list] of Object.entries(CONTINENT_COUNTRIES)) {
  for (const country of list) COUNTRY_CONTINENT[country] = continent;
}

// Common short forms Gemini / users might use → canonical name in the map above.
const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'United Kingdom',
  'u.k.': 'United Kingdom',
  england: 'United Kingdom',
  britain: 'United Kingdom',
  'great britain': 'United Kingdom',
  scotland: 'United Kingdom',
  usa: 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  us: 'United States',
  america: 'United States',
  uae: 'United Arab Emirates',
  korea: 'South Korea',
  'republic of korea': 'South Korea',
  czech: 'Czechia',
  'czech republic': 'Czechia',
  holland: 'Netherlands',
};

export function continentOf(country: string): string {
  if (!country) return 'Other';
  const key = country.trim();
  const canonical = COUNTRY_ALIASES[key.toLowerCase()] || key;
  return COUNTRY_CONTINENT[canonical] || 'Other';
}

export function detectLocation(text: string): DetectedLocation {
  const lower = text.toLowerCase();
  for (const c of CITY_INDEX) {
    if (matches(lower, c.alias)) return { city: c.city, country: c.country };
  }
  for (const c of COUNTRY_INDEX) {
    if (matches(lower, c.alias)) return { city: '', country: c.country };
  }
  return { city: '', country: '' };
}
