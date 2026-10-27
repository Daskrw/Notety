import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const OUT_DIR = path.join(projectRoot, 'src', 'data');
const OUT_FILE = path.join(OUT_DIR, 'thai-names.json');
const ATTRIBUTION_FILE = path.join(OUT_DIR, 'thai-names-sources.json');

const KORKEATW_BASE = 'https://raw.githubusercontent.com/korkeatw/thai-names-corpus/master/';
const ORST_URL = 'https://orst.gdcatalog.go.th/dataset/ee5755e9-9647-4d85-87bf-d9865bd693d0/resource/ca3b74de-2689-401a-860e-c2118568c5e3/download/orst_0301.csv';

async function fetchText(url) {
  console.log(`Fetching ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // 1. Fetch Source A: korkeatw/thai-names-corpus
  console.log('Downloading Source A (korkeatw/thai-names-corpus)...');
  const [maleText, femaleText, familyText] = await Promise.all([
    fetchText(KORKEATW_BASE + 'male_names_th.txt'),
    fetchText(KORKEATW_BASE + 'female_names_th.txt'),
    fetchText(KORKEATW_BASE + 'family_names_th.txt'),
  ]);

  // 2. Fetch Source B: ORST (Royal Society Person Names with meanings)
  console.log('Downloading Source B (ORST data.go.th orst_0301)...');
  let orstText = '';
  try {
    orstText = await fetchText(ORST_URL);
  } catch (err) {
    console.warn('Warning: Could not fetch ORST live directly:', err.message);
  }

  // Map for deduplicating by exact Thai spelling
  // key: exact name
  const nameMap = new Map();

  function addName(name, category, source) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!nameMap.has(trimmed)) {
      nameMap.set(trimmed, {
        name: trimmed,
        categories: new Set(),
        sources: new Set(),
        meaning: undefined,
      });
    }
    const entry = nameMap.get(trimmed);
    if (category) entry.categories.add(category);
    if (source) entry.sources.add(source);
  }

  // Parse Source A files
  let maleRawCount = 0;
  for (const line of maleText.split('\n')) {
    const n = line.trim();
    if (n) {
      maleRawCount++;
      addName(n, 'male', 'korkeatw/thai-names-corpus');
    }
  }

  let femaleRawCount = 0;
  for (const line of femaleText.split('\n')) {
    const n = line.trim();
    if (n) {
      femaleRawCount++;
      addName(n, 'female', 'korkeatw/thai-names-corpus');
    }
  }

  let familyRawCount = 0;
  for (const line of familyText.split('\n')) {
    const n = line.trim();
    if (n) {
      familyRawCount++;
      addName(n, 'surname', 'korkeatw/thai-names-corpus');
    }
  }

  // Parse Source B (ORST)
  let orstRawCount = 0;
  let orstMeaningCount = 0;
  if (orstText) {
    // CSV with lines: วันที่บันทึก,ชื่อ,ความหมาย
    const lines = orstText.split(/\r?\n/);
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      // Handle simple CSV parsing: date, name, meaning (which may be quoted)
      const commaIdx1 = line.indexOf(',');
      if (commaIdx1 === -1) continue;
      const rest1 = line.slice(commaIdx1 + 1);
      const commaIdx2 = rest1.indexOf(',');
      if (commaIdx2 === -1) continue;
      const name = rest1.slice(0, commaIdx2).trim();
      let meaning = rest1.slice(commaIdx2 + 1).trim();
      if (meaning.startsWith('"') && meaning.endsWith('"')) {
        meaning = meaning.slice(1, -1).trim();
      }
      if (name) {
        orstRawCount++;
        addName(name, 'first_name', 'orst_0301');
        const entry = nameMap.get(name);
        if (meaning) {
          entry.meaning = meaning;
          orstMeaningCount++;
        }
      }
    }
  }

  console.log(`Source A raw lines: Male=${maleRawCount}, Female=${femaleRawCount}, Family=${familyRawCount}`);
  console.log(`Source B raw lines: ORST=${orstRawCount}, with meanings=${orstMeaningCount}`);
  console.log(`Total unique Thai names deduplicated: ${nameMap.size}`);

  // Sort names deterministically (Thai collation)
  const collator = new Intl.Collator('th-TH');
  const sortedNames = Array.from(nameMap.values()).sort((a, b) => collator.compare(a.name, b.name));

  // Compact entry representation:
  // n: name (string)
  // c: categories array (e.g. ['male'], ['female'], ['surname'], ['male','female'], ['first_name'])
  // s: sources array (e.g. ['corpus'], ['orst'], or IDs)
  // m?: meaning
  const entries = sortedNames.map(entry => {
    const obj = {
      n: entry.name,
      c: Array.from(entry.categories),
      s: Array.from(entry.sources).map(src => src === 'korkeatw/thai-names-corpus' ? 'corpus' : 'orst'),
    };
    if (entry.meaning) {
      obj.m = entry.meaning;
    }
    return obj;
  });

  const dataset = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalCount: entries.length,
    sources: [
      {
        id: 'corpus',
        name: 'Thai Male, Female, and Family Name Corpus',
        authors: ['Korkeat Wannapat', 'Arthit Suriyawongkul'],
        license: 'Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        url: 'https://github.com/korkeatw/thai-names-corpus',
        counts: {
          male: maleRawCount,
          female: femaleRawCount,
          family: familyRawCount,
        }
      },
      {
        id: 'orst',
        name: 'ชื่อบุคคลพร้อมความหมาย (Person names and meanings)',
        agency: 'สำนักงานราชบัณฑิตยสภา (Office of the Royal Society, Thailand)',
        division: 'กองศิลปกรรม (Arts Division)',
        license: 'Open Data Common',
        url: 'https://data.go.th/dataset/orst_0301',
        counts: {
          total: orstRawCount,
          meanings: orstMeaningCount
        }
      }
    ],
    names: entries,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(dataset));
  console.log(`Saved dataset to ${OUT_FILE} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB)`);

  const TS_FILE = path.join(OUT_DIR, 'thai-names-data.ts');
  fs.writeFileSync(TS_FILE, 'export const thaiNamesDataset = ' + JSON.stringify(dataset) + ' as const;\n');
  console.log(`Saved TypeScript dataset to ${TS_FILE} (${(fs.statSync(TS_FILE).size / 1024).toFixed(1)} KB)`);

  const attributionInfo = {
    title: 'Thai Name Library Data Sources and Attributions',
    description: 'This dataset is compiled from verified open-source and open-government datasets of Thai names.',
    sources: dataset.sources,
    notes: [
      'Original spellings are strictly preserved from each source.',
      'Deduplicated without merging distinct spellings.',
      'No personal records, private information, or sensitive identity data is collected or stored.'
    ]
  };
  fs.writeFileSync(ATTRIBUTION_FILE, JSON.stringify(attributionInfo, null, 2));
  console.log(`Saved attribution to ${ATTRIBUTION_FILE}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
