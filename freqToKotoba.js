const fs = require('fs').promises;
const JSZip = require('jszip');
const outputFolder = 'output';

const {
  getReadingsAndDefinitions,
  isInDaijirin,
  getDaijirinWords,
} = require('./util/getJMDictInfo.js');
const { containsKanji } = require('./util/japaneseUtils.js');

const metaBankRegex = /term_meta_bank_\d+\.json/;
const MAX_COMMENT_LENGTH = 100;

(async function () {
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.log(
      'Usage: node freqToKotoba.js <input frequency dict> <term length limit> <readings count limit> <array of frequency intervals to generate csvs for>'
    );
    return;
  }
  const inputFreqDict = args[0];
  const termLengthLimit = args[1];
  const readingsCountLimit = args[2];
  const intervals = args.slice(3).map((interval) => parseInt(interval));
  if (intervals.length < 2) {
    console.log('Please provide at least two intervals');
    return;
  }

  // check if intervals are in ascending order
  for (let i = 0; i < intervals.length - 1; i++) {
    if (intervals[i] >= intervals[i + 1]) {
      console.log('Please provide intervals in ascending order');
      return;
    }
  }

  console.log(`Intervals: ${intervals}`);

  const data = await fs.readFile(inputFreqDict);
  const zip = await JSZip.loadAsync(data);
  const metaBanks = Object.keys(zip.files).filter((fileName) => {
    return metaBankRegex.test(fileName);
  });

  const index = JSON.parse(await zip.file('index.json').async('string'));
  const title = index.title;

  const intervalsObj = [];
  for (let i = 0; i < intervals.length - 1; i++) {
    let min = intervals[i] + 1;
    let max = intervals[i + 1];
    intervalsObj.push({
      fileName: `${title}_${min}-${max}.csv`,
      min,
      max,
      outputCsv: 'Question,Answers,Comment,Instructions,Render as\n',
      length: 0,
    });
  }
  intervalsObj.push({
    fileName: `${title}_memes.csv`,
    outputCsv: 'Question,Answers,Comment,Instructions,Render as\n',
    length: 0,
  });

  console.log(intervalsObj);

  const allTermsFrequencies = {};
  for (const fileName of metaBanks) {
    const metaBank = await zip.files[fileName].async('string');
    const data = JSON.parse(metaBank);
    for (const entry of data) {
      const term = entry[0];
      let freq;
      if (typeof entry[2] === 'object') {
        if (typeof entry[2]?.frequency === 'object') {
          freq = entry[2]?.frequency?.value;
        } else {
          freq = entry[2]?.value;
        }
      } else {
        freq = entry[2];
      }
      if (!freq) throw new Error(`No frequency for ${term}`);
      if (typeof freq !== 'number') throw new Error(`Frequency is not a number for ${term}`);

      // kana only frequency from jpdb
      if (entry[2].frequency?.displayValue?.endsWith('???')) continue;
      // shows 0 times in corpus
      if (entry[2].frequency?.displayValue?.endsWith('???')) continue;
      if (!allTermsFrequencies[term]) allTermsFrequencies[term] = freq;
    }
  }

  const daijirinWordsObj = await getDaijirinWords();
  // use all daijirin words,
  const allTermsArr = [...daijirinWordsObj];
  // const allTermsSet = Object.keys(allTermsFrequencies).filter((term) => daijirinWordsObj.has(term));
  allTermsArr.sort((a, b) => {
    const freqA = allTermsFrequencies[a] || Number.MAX_SAFE_INTEGER;
    const freqB = allTermsFrequencies[b] || Number.MAX_SAFE_INTEGER;
    return freqA - freqB;
  });
  console.log(`Total terms in ?????????: ${allTermsArr.length}`);
  // const allTermsArr = [...allTermsSet];
  // assign frequency to each in ascending order
  for (let i = 0; i < allTermsArr.length; i++) {
    const term = allTermsArr[i];
    if (!containsKanji(term)) continue;
    if (term.length > termLengthLimit) continue;
    const freq = i + 1;

    // find interval with this term
    let thisInterval;
    thisInterval = intervalsObj.find((interval) => freq >= interval.min && freq < interval.max);
    if (!thisInterval) continue;

    // memes (no freq)
    if (!allTermsFrequencies[term]) {
      thisInterval = intervalsObj[intervalsObj.length - 1];
    }

    try {
      const { readings, definitions } = await getReadingsAndDefinitions(term);
      if (readings.length > readingsCountLimit) continue;
      const readingsString = readings.join(',').replace(/"/g, `'`);
      const definitionsString = definitions
        .join(', ')
        .replace(/"/g, `'`)
        .substring(0, MAX_COMMENT_LENGTH);
      thisInterval.outputCsv += `${term},"${readingsString}","${definitionsString}",Type the reading,Image\n`;
      thisInterval.length++;
    } catch (error) {
      thisInterval.outputCsv += `${term},,,,,Image\n`;
      // console.log(`No JMDict entry for ${term}`);
      continue;
    }
  }

  await fs.mkdir(outputFolder, { recursive: true });

  for (const interval of intervalsObj) {
    await fs.writeFile(`${outputFolder}/${interval.fileName}`, interval.outputCsv);
    console.log(`Wrote ${interval.length} terms to ${interval.fileName}`);
  }
})();
