const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const electronBinary = require('electron');
  const uniqueSuffix = Date.now();
  const recipientName = `QA Destinatario ${uniqueSuffix}`;
  const recipientPhone = `664${String(uniqueSuffix).slice(-7)}`;
  const ruleName = `QA Regla ${uniqueSuffix}`;

  async function launchElectronAndConnect(remoteDebuggingPort) {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;

    const child = spawn(electronBinary, ['.', `--remote-debugging-port=${remoteDebuggingPort}`], {
      cwd: projectRoot,
      env,
      stdio: 'ignore',
    });

    let browser = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${remoteDebuggingPort}`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!browser) {
      try {
        process.kill(child.pid);
      } catch {
        // noop
      }
      throw new Error('No se pudo conectar a la ventana de Electron por CDP.');
    }

    const context = browser.contexts()[0];
    const page = context.pages()[0];
    await page.waitForLoadState('domcontentloaded');

    return {
      browser,
      child,
      page,
      async close() {
        await browser.close().catch(() => undefined);
        try {
          if (process.platform === 'win32') {
            execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
          } else {
            process.kill(child.pid, 'SIGKILL');
          }
        } catch {
          // noop
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      },
    };
  }

  const firstRun = await launchElectronAndConnect(9222);
  try {
    const window = firstRun.page;

    await window.getByText('SQLite listo').waitFor({ timeout: 15000 });

    await window.getByRole('button', { name: 'Destinatarios', exact: true }).click();
    await window.getByLabel('Nombre').fill(recipientName);
    await window.getByLabel('Telefono').fill(recipientPhone);
    await window.getByLabel('Etiquetas internas').fill('qa,validacion');
    await window.getByRole('button', { name: 'Registrar destinatario' }).click();
    await window.getByText(recipientName).waitFor({ timeout: 10000 });
    await window.getByText(recipientPhone).waitFor({ timeout: 10000 });

    await window.getByRole('button', { name: 'Reglas de envio', exact: true }).click();
    await window.getByLabel('Nombre de la regla').fill(ruleName);
    await window.getByLabel('Tipo de evento').selectOption('SYSTEM_ALERT');
    await window
      .getByLabel('Mensaje base')
      .fill('Alerta de prueba {{title}} {{messageText}}');
    await window
      .locator('.checkbox-item')
      .filter({ hasText: recipientName })
      .locator('input')
      .check();
    await window.getByRole('button', { name: 'Registrar regla' }).click();
    const createdRule = window.locator('.config-item').filter({ hasText: ruleName });
    await createdRule.waitFor({ timeout: 10000 });
    await createdRule.getByText('SYSTEM_ALERT').waitFor({ timeout: 10000 });
  } finally {
    await firstRun.close();
  }

  const secondRun = await launchElectronAndConnect(9223);
  try {
    const window = secondRun.page;
    await window.getByText('SQLite listo').waitFor({ timeout: 15000 });

    await window.getByRole('button', { name: 'Destinatarios', exact: true }).click();
    await window.getByText(recipientName).waitFor({ timeout: 10000 });

    await window.getByRole('button', { name: 'Reglas de envio', exact: true }).click();
    await window.locator('.config-item').filter({ hasText: ruleName }).waitFor({ timeout: 10000 });
  } finally {
    await secondRun.close();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sqliteStatus: 'SQLite listo',
        recipient: {
          name: recipientName,
          phone: recipientPhone,
        },
        rule: {
          name: ruleName,
          eventType: 'SYSTEM_ALERT',
        },
        persistenceValidated: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
