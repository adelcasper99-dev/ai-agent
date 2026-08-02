const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('casper-voice-web/dev.db');

db.get("SELECT keyString FROM ApiKeyPool WHERE isExhausted = 0 LIMIT 1", (err, row) => {
  if (err || !row) { 
    console.error('No key found', err); 
    return; 
  }
  fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + row.keyString)
    .then(r => r.json())
    .then(d => {
      if (d.models) {
        console.log('Supported models:');
        d.models.filter(m => m.supportedGenerationMethods.includes('generateContent')).forEach(m => console.log(m.name));
      } else {
        console.log(d);
      }
    }).catch(console.error);
});
