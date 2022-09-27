const fs = require('fs');
const jszip = require('jszip');

const jmdictPath = './util/jmdict_english.zip';
const termBankRegex = /term_bank_\d+\.json/;

let JMDictData;
let JMDictKeys;

let daijirinWords;

/**
 * Reads a Yomichan dictionary zip file.
 * @param {string} filePath
 * @returns array of dictionary entries
 */
async function readDictionary(filePath) {
  const allEntries = [];

  const jmdictZip = await fs.promises.readFile(filePath);
  const jmdict = await jszip.loadAsync(jmdictZip);
  let fileCount = 0;
  for (const fileName of Object.keys(jmdict.files)) {
    if (termBankRegex.test(fileName)) {
      const termBank = await jmdict.files[fileName].async('string');
      const data = JSON.parse(termBank);
      allEntries.push(...data);
      fileCount++;
    }
  }
  console.log(`Read ${fileCount} term banks with ${allEntries.length} entries from ${filePath}.`);
  return allEntries;
}

/**
 * Gets JMDict data from cache or reads the zip.
 * @returns {Promise<{[key: string]: JMDictEntry}>} JMDict
 */
async function getJMDictData() {
  if (JMDictData) return JMDictData;

  const allEntries = await readDictionary(jmdictPath);

  JMDictData = {};
  JMDictKeys = {};
  for (const entry of allEntries) {
    const [term, reading, tags, deinflectors, popularity, definitions, sequence, bigTags] = entry;
    if (!JMDictData[[term, reading]]) JMDictData[[term, reading]] = [];
    JMDictData[[term, reading]].push({
      reading,
      tags,
      deinflectors,
      popularity,
      definitions,
      sequence,
      bigTags,
    });
    if (!JMDictKeys[term]) JMDictKeys[term] = [];
    if (!JMDictKeys[term].includes(reading)) JMDictKeys[term].push(reading);
  }
  return JMDictData;
}

/**
 * Gets a given JMDict entry.
 * @param {string} term
 * @param {string} reading
 * @returns {object} JMDict entry
 */
async function getJMDictEntry(term, reading) {
  const jmdict = await getJMDictData();
  const entry = jmdict[[term, reading]];
  if (entry) return entry;
  const readingEntry = jmdict[[reading, '']];
  if (readingEntry) return readingEntry;
  throw new Error(`No JMDict entry for ${term} ${reading}`);
}

/**
 * Gets deinflectors from JMDict.
 * @param {string} term
 * @param {string} reading
 * @returns {string} deinflectors
 */
async function getDeinflectors(term, reading) {
  try {
    const entry = await getJMDictEntry(term, reading);
    return entry.deinflectors;
  } catch (error) {
    console.error(error);
    return '';
  }
}

/**
 * Given a kanji string, returns the valid readings and definitions from JMDict.
 * @param {string} kanjiTerm
 */
async function getReadingsAndDefinitions(kanjiTerm) {
  const jmdict = await getJMDictData();
  const readings = JMDictKeys[kanjiTerm];
  if (!readings) throw new Error(`No JMDict entry for ${kanjiTerm}`);

  const definitions = new Set();
  for (const reading of readings) {
    const entries = jmdict[[kanjiTerm, reading]];
    for (const entry of entries) {
      for (const definition of entry.definitions) {
        definitions.add(definition);
      }
    }
  }
  return { readings, definitions: [...definitions] };
}

/**
 * Whether a term is in Daijisen.
 * @param {string} term
 * @returns {boolean} whether the term is in Daijisen
 */
async function isInDaijirin(term) {
  if (!daijirinWords) {
    const daijisen = await readDictionary('./util/[Monolingual] 大辞林 第三版.zip');
    daijirinWords = new Set();
    for (const entry of daijisen) {
      // term is first element of array
      const [dictTerm] = entry;
      daijirinWords.add(dictTerm);
    }
  }
  return daijirinWords.has(term);
}

/**
 * Gets set of terms in daijirin
 * @returns Set of terms in daijirin
 */
async function getDaijirinWords() {
  if (!daijirinWords) {
    const daijisen = await readDictionary('./util/[Monolingual] 大辞林 第三版.zip');
    daijirinWords = new Set();
    for (const entry of daijisen) {
      // term is first element of array
      const [dictTerm] = entry;
      daijirinWords.add(dictTerm);
    }
  }
  return daijirinWords;
}

/**
 * Gets the on and kun readings of a kanji from KANJIDIC
 * @param {string} kanji
 */
async function getKanjiReadings(kanji) {}

module.exports = {
  readDictionary,
  getDeinflectors,
  getKanjiReadings,
  getReadingsAndDefinitions,
  isInDaijirin,
  getDaijirinWords,
};
