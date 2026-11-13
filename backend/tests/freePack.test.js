const fs = require('fs');
const path = require('path');

describe("Free Baker's Pack Assets & Routing Tests", () => {
  const rootDir = path.resolve(__dirname, '..', '..');

  test('1. Original master PDF exists in backend/pdfFiles/ and is valid non-empty PDF', () => {
    const pdfPath = path.join(rootDir, 'backend', 'pdfFiles', 'The_Psychology_of_a_Baker_Complete_Free_Pack.pdf');
    expect(fs.existsSync(pdfPath)).toBe(true);
    const stats = fs.statSync(pdfPath);
    expect(stats.size).toBeGreaterThan(1000000); // ~11MB
  });

  test('2. Downloadable PDF exists in client/public/ and backend/public/ with correct names', () => {
    const clientPdf = path.join(rootDir, 'client', 'public', 'the-bakers-free-pack.pdf');
    const backendPdf = path.join(rootDir, 'backend', 'public', 'the-bakers-free-pack.pdf');

    expect(fs.existsSync(clientPdf)).toBe(true);
    expect(fs.existsSync(backendPdf)).toBe(true);
    expect(fs.statSync(clientPdf).size).toBe(fs.statSync(backendPdf).size);
  });

  test('3. Free Pack static HTML landing page exists and contains required elements', () => {
    const htmlPath = path.join(rootDir, 'client', 'public', 'free-pack.html');
    expect(fs.existsSync(htmlPath)).toBe(true);

    const content = fs.readFileSync(htmlPath, 'utf8');
    expect(content).toContain("Your Free Baker's Pack");
    expect(content).toContain("The Psychology of a Baker");
    expect(content).toContain("The Cake Covering Chart");
    expect(content).toContain('href="/the-bakers-free-pack.pdf"');
    expect(content).toContain('download');
    expect(content).toContain('https://selar.com/cakecostingsystem');
  });

  test('4. _redirects configuration routes /free-pack and /bakers-free-pack to /free-pack.html', () => {
    const redirectsPath = path.join(rootDir, 'client', 'public', '_redirects');
    expect(fs.existsSync(redirectsPath)).toBe(true);

    const redirects = fs.readFileSync(redirectsPath, 'utf8');
    expect(redirects).toContain('/free-pack               /free-pack.html');
    expect(redirects).toContain('/bakers-free-pack        /free-pack.html');
  });
});
