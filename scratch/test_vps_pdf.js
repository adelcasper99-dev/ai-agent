const puppeteer = require('puppeteer-core');

async function main() {
  console.log('Launching Chrome from /usr/bin/google-chrome ...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
    ],
  });
  console.log('Chrome launched successfully!');
  const page = await browser.newPage();
  await page.setContent('<h1>Test PDF Generation</h1><p>Alumital Quotation Verified</p>');
  const buf = await page.pdf({ format: 'A4' });
  console.log('PDF BUFFER GENERATED! Length:', buf.length);
  await browser.close();
  console.log('DONE!');
}

main().catch(console.error);
