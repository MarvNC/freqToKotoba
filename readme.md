# Yomichan Frequency Dict to Kotoba

Converts a Yomichan frequency .zip file to a [kotoba](https://kotobaweb.com/) deck, excluding kana-only terms.

Usage: `Usage: node freqToKotoba.js <input frequency dict> <term length limit> <readings count limit> <array of frequency intervals to generate csvs for>`

Example: `node .\freqToKotoba.js '.\[Freq] JPDB_2022-05-10T03_27_02.930Z.zip' 4 3 0 1000 2500 5000 10000 15000 20000 25000 30000 35000 40000 50000 60000 70000 80000 90000`
