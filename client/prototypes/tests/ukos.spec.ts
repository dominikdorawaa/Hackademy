import { test, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const terminal = (page: Page) => page.locator('textarea.xterm-helper-textarea');
const progress = (page: Page) =>
  page.getByRole('progressbar', { name: 'Zaliczone kroki' });

async function boot(page: Page, url = '/prototypes/ukos.html') {
  await page.goto(url);
  await page.getByRole('button', { name: 'Uruchom warsztat' }).click();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Linux gotowy',
    { timeout: 45000 }
  );
}

async function command(page: Page, text: string) {
  await terminal(page).fill(text);
  await terminal(page).press('Enter');
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator('.ukos-debug pre').textContent()) || '{}'
        ).command
    )
    .toBe(text);
}

test('real Linux, automatic grading, Unicode nano, persistence, isolation and responsiveness', async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  const firstBootMetrics = await page.locator('.ukos-diagnostics').innerText();
  expect(requests.some((url) => url.endsWith('/boot-state.bin.zst'))).toBe(
    true
  );
  expect(requests.some((url) => url.endsWith('/kernel.bin'))).toBe(false);
  expect(requests.some((url) => url.endsWith('/initrd.gz'))).toBe(false);
  await command(page, 'echo pwd');
  await expect(progress(page)).toHaveAttribute('value', '0');
  await command(page, 'PWD');
  await expect(progress(page)).toHaveAttribute('value', '0');
  await command(page, 'pwd');
  await expect(progress(page)).toHaveAttribute('value', '1');
  await command(page, 'ls missing; true');
  await expect(progress(page)).toHaveAttribute('value', '1');
  await command(page, 'ls -la');
  await expect(progress(page)).toHaveAttribute('value', '2');
  await command(page, 'mkdir -p ~/archiwum/raporty');
  await expect(progress(page)).toHaveAttribute('value', '3');
  await terminal(page).fill('nano ~/archiwum/notatka.txt');
  await terminal(page).press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText('GNU nano');
  await terminal(page).evaluate((element, text) => {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    );
  }, 'Gotowy do pracy\nZażółć gęślą jaźń');
  await terminal(page).press('Control+o');
  await expect(page.locator('.xterm-rows')).toContainText(
    /File Name to Write|Write to File/
  );
  await terminal(page).press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText('Wrote');
  await terminal(page).press('Control+x');
  await expect(progress(page)).toHaveAttribute('value', '4');
  await command(page, 'cat ~/archiwum/notatka.txt');
  await expect(page.locator('.xterm-rows')).toContainText('Zażółć gęślą jaźń');
  await command(
    page,
    'cp ~/archiwum/raport.txt ~/archiwum/raporty/raport.txt'
  );
  await expect(progress(page)).toHaveAttribute('value', '5');
  await command(
    page,
    'mv ~/archiwum/notatka.txt ~/archiwum/raporty/notatka.txt'
  );
  await expect(progress(page)).toHaveAttribute('value', '6');
  await command(page, 'rm ~/archiwum/raport.txt');
  await page.getByRole('button', { name: 'Zapisz teraz' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Pliki zapisane lokalnie' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Zatrzymaj' }).click();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Warsztat zatrzymany'
  );
  await page.reload();
  await page.getByRole('button', { name: 'Uruchom warsztat' }).click();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Linux gotowy',
    { timeout: 45000 }
  );
  await expect(progress(page)).toHaveAttribute('value', '6');
  await expect(page.locator('.ukos-diagnostics')).toContainText('tak');
  await command(page, 'cat ~/archiwum/raporty/notatka.txt');
  await expect(page.locator('.xterm-rows')).toContainText('Zażółć gęślą jaźń');
  await command(
    page,
    'test ! -e ~/archiwum/raport.txt && echo deletion-preserved'
  );
  await expect(page.locator('.xterm-rows')).toContainText('deletion-preserved');
  const other = await context.newPage();
  await other.goto('/prototypes/ukos.html');
  await other.getByRole('button', { name: 'Uruchom warsztat' }).click();
  await expect(other.getByRole('alert')).toContainText('innej karcie');
  await other.close();
  await page.bringToFront();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Linux gotowy'
  );
  await page.getByRole('button', { name: 'Pauza', exact: true }).click();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Emulator wstrzymany'
  );
  await page.getByRole('button', { name: 'Wznów' }).click();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Linux gotowy'
  );
  await terminal(page).fill('while true; do :; done');
  await terminal(page).press('Enter');
  for (let count = 1; count <= 5; count++) {
    await page
      .getByRole('button', {
        name: `Sprawdź reakcję strony: ${count - 1}`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole('button', {
        name: `Sprawdź reakcję strony: ${count}`,
        exact: true,
      })
    ).toBeVisible();
  }
  const responsiveness = await page.evaluate(
    () =>
      new Promise<{ max: number; p95: number }>((resolve) => {
        let previous = performance.now();
        const gaps: number[] = [];
        const frame = (now: number) => {
          gaps.push(now - previous);
          previous = now;
          if (gaps.length < 120) requestAnimationFrame(frame);
          else {
            gaps.sort((a, b) => a - b);
            resolve({
              max: gaps.at(-1) || 0,
              p95: gaps[Math.floor(gaps.length * 0.95)],
            });
          }
        };
        requestAnimationFrame(frame);
      })
  );
  expect(responsiveness.p95).toBeLessThan(50);
  await terminal(page).press('Control+c');
  await command(page, 'echo recovered');
  await command(page, 'seq 1 10000');
  await page
    .getByRole('button', { name: 'Sprawdź reakcję strony: 5', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Sprawdź reakcję strony: 6', exact: true })
  ).toBeVisible();
  await command(page, 'echo output-recovered');
  await terminal(page).fill('cat ~/arch');
  await terminal(page).press('Tab');
  await expect(page.locator('.xterm-rows')).toContainText('cat ~/archiwum/');
  await terminal(page).press('Control+c');
  await command(page, 'echo history-ok');
  await terminal(page).press('ArrowUp');
  await terminal(page).press('Enter');
  await expect(page.locator('.xterm-rows')).toContainText('history-ok');
  await page.screenshot({
    path: 'test-results/ukos-prototype.png',
    fullPage: true,
  });
  const metrics = await page.locator('.ukos-diagnostics').innerText();
  const measurement = JSON.stringify(
    {
      firstBootMetrics,
      metrics,
      responsiveness,
      browser: await page.context().browser()?.version(),
    },
    null,
    2
  );
  await writeFile('test-results/ukos-metrics.json', measurement);
  await test.info().attach('runtime-metrics', {
    body: measurement,
    contentType: 'application/json',
  });
  await page.getByRole('button', { name: 'Zatrzymaj' }).click();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Warsztat zatrzymany'
  );
  expect(errors).toEqual([]);
});

test('cold boot remains available for comparison and requests no startup snapshot', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await boot(page, '/prototypes/ukos.html?cold');
  expect(requests.some((url) => url.endsWith('/kernel.bin'))).toBe(true);
  expect(requests.some((url) => url.endsWith('/boot-state.bin.zst'))).toBe(
    false
  );
  await command(page, 'pwd');
  await expect(progress(page)).toHaveAttribute('value', '1');
  await writeFile(
    'test-results/ukos-cold-metrics.json',
    JSON.stringify(
      { metrics: await page.locator('.ukos-diagnostics').innerText() },
      null,
      2
    )
  );
  await page.getByRole('button', { name: 'Zatrzymaj' }).click();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Warsztat zatrzymany'
  );
});

test('reset restores current step without losing progress and releases the tab lock', async ({
  page,
  context,
}) => {
  await boot(page);
  await command(page, 'pwd');
  await expect(progress(page)).toHaveAttribute('value', '1');
  await command(page, 'ls');
  await expect(progress(page)).toHaveAttribute('value', '2');
  await command(page, 'mkdir -p ~/archiwum/raporty');
  await expect(progress(page)).toHaveAttribute('value', '3');
  await command(page, 'touch ~/moj-plik');
  await page.getByRole('button', { name: 'Resetuj pliki warsztatu' }).click();
  await page.getByRole('button', { name: 'Tak, resetuj pliki' }).click();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Uruchamianie Linuksa'
  );
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Linux gotowy',
    { timeout: 45000 }
  );
  await expect(progress(page)).toHaveAttribute('value', '3');
  await command(
    page,
    'test -d ~/archiwum/raporty && test ! -e ~/moj-plik && echo checkpoint-ok'
  );
  await expect(page.locator('.xterm-rows')).toContainText('checkpoint-ok');
  await page.getByRole('button', { name: 'Zatrzymaj' }).click();
  await expect(page.locator('.ukos-terminal-bar')).toContainText(
    'Warsztat zatrzymany'
  );
  const other = await context.newPage();
  await boot(other);
  await expect(progress(other)).toHaveAttribute('value', '3');
  await other.getByRole('button', { name: 'Zatrzymaj' }).click();
  await expect(other.locator('.ukos-terminal-bar')).toContainText(
    'Warsztat zatrzymany'
  );
});
