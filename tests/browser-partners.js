// Run with playwright-cli run-code --filename=tests/browser-partners.js after seeding.
async (page) => {
  const browser = page.context().browser();
  const contexts = [];
  const errors = [];
  async function open(mode) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    contexts.push(context);
    await context.addInitScript(() => {
      localStorage.setItem('pickleballController_partner-browser', 'Test Controller');
      localStorage.setItem('pickleballControllerParticipation_partner-browser', 'controller_only');
      ['player', 'controller', 'viewer'].forEach(role => localStorage.setItem('pickleballHelpSeen_v11_' + role, '1'));
    });
    await context.route('**/app.js', async route => {
      const response = await route.fetch();
      let source = await response.text();
      source = source.replace("projectId: 'pickleball-rotation'", "projectId: 'demo-pickleball-partners'");
      source = source.replace('var FieldValue = firebase.firestore.FieldValue;', "fbAuth.useEmulator('http://127.0.0.1:9099', {disableWarnings:true}); fbDb.useEmulator('127.0.0.1',8080); var FieldValue = firebase.firestore.FieldValue;");
      await route.fulfill({ response, body: source });
    });
    const p = await context.newPage();
    p.on('pageerror', error => errors.push(error.message));
    await p.goto('http://127.0.0.1:4173/?room=partner-browser&mode=' + mode);
    return p;
  }
  async function live(p) { await p.waitForFunction(() => appInitialised && roomSync && roomSync.getState().canMutate, null, { timeout: 20000 }); }
  function check(value, message) { if (!value) throw new Error(message); }
  try {
    const controller = await open('controller'); await live(controller);
    const player = await open('player');
    await player.getByRole('button', { name: 'Player 0', exact: false }).click();
    await player.getByRole('button', { name: 'Check In', exact: true }).click();
    await live(player); await live(controller);
    const viewer = await open('view'); await live(viewer);
    await player.getByRole('tab', { name: 'Players', exact: true }).click();
    await player.getByRole('button', { name: 'My Partner', exact: false }).click();
    await player.getByRole('dialog').getByRole('searchbox').fill('missing');
    check((await player.getByRole('dialog').innerText()).includes('No unpaired players match'), 'Missing empty state');
    await player.getByRole('button', { name: 'Clear player search', exact: true }).click();
    await player.getByRole('button', { name: 'Player 1 · Non-Beginner · 0 games', exact: true }).click();
    await controller.waitForFunction(() => S.partnerRequests.length === 1);
    await controller.getByRole('tab', { name: 'Players', exact: true }).click();
    await controller.getByRole('button', { name: 'Approve', exact: true }).click();
    await controller.getByRole('button', { name: 'Approve Partners', exact: true }).click();
    await player.waitForFunction(() => S.partnerships.length === 1);
    await viewer.waitForFunction(() => S.partnerships.length === 1);
    await live(controller); await live(player);
    await viewer.getByRole('tab', { name: 'Players', exact: true }).click();
    check(await viewer.getByRole('button', { name: 'Set Partners', exact: true }).count() === 0, 'Viewer has controls');
    check(await player.getByRole('button', { name: 'Set Partners', exact: true }).count() === 0, 'Player has controller controls');
    await controller.getByRole('tab', { name: 'Game', exact: true }).click();
    await controller.getByRole('button', { name: 'Build Next Manually', exact: false }).click();
    await controller.getByRole('combobox', { name: 'Team A Player 1', exact: true }).selectOption('p0');
    check(await controller.getByRole('combobox', { name: 'Team A Player 2', exact: true }).inputValue() === 'p1', 'Partner not auto-selected');
    await controller.getByRole('combobox', { name: 'Team B Player 1', exact: true }).selectOption('p2');
    await controller.getByRole('combobox', { name: 'Team B Player 2', exact: true }).selectOption('p3');
    await controller.getByRole('button', { name: 'Prepare Up Next', exact: true }).click();
    await player.waitForFunction(() => S.courtStates[0].nextGame && S.courtStates[0].nextGame.teamA.includes('p0'));
    await player.getByRole('button', { name: 'My Partner', exact: false }).click();
    check((await player.getByRole('dialog').innerText()).includes('remove Up Next'), 'Assigned pairing not protected');
    check(await player.getByRole('button', { name: 'End Partnership', exact: true }).count() === 0, 'Assigned partnership can end');
    await player.keyboard.press('Escape');
    await live(controller);
    await controller.getByRole('button', { name: 'Start Game', exact: false }).click();
    await viewer.waitForFunction(() => S.courtStates[0].status === 'playing');
    await live(controller);
    await controller.getByRole('button', { name: 'Team A Won', exact: false }).click();
    await player.waitForFunction(() => S.history.length === 1);
    await viewer.waitForFunction(() => S.history.length === 1);
    check(await player.evaluate(() => Engine.validatePartnerState(S).valid), 'Winner transition splits partners');
    await live(player);
    await player.getByRole('button', { name: 'Take a Break', exact: false }).click();
    await controller.waitForFunction(() => S.players[0].notAvailable);
    check(await controller.evaluate(() => !Engine.availableIds(S).includes('p1')), 'Partner did not wait');
    await live(player);
    await player.getByRole('button', { name: 'I’m Ready', exact: false }).click();
    await live(player);
    await player.getByRole('button', { name: 'My Partner', exact: false }).click();
    await player.getByRole('button', { name: 'End Partnership', exact: true }).click();
    await player.getByRole('button', { name: 'End Partnership', exact: true }).click();
    await controller.waitForFunction(() => S.partnerships.length === 0);
    await live(player);
    await player.getByRole('button', { name: 'My Partner', exact: false }).click();
    await player.getByRole('button', { name: 'Player 1 · Non-Beginner · 1 game', exact: true }).click();
    await live(player);
    await player.getByRole('button', { name: 'My Partner', exact: false }).click();
    await player.getByRole('button', { name: 'Cancel Request', exact: true }).click();
    await player.getByRole('button', { name: 'Cancel Request', exact: true }).click();
    await controller.waitForFunction(() => S.partnerRequests.length === 0);
    await player.context().setOffline(true);
    await player.waitForFunction(() => !navigator.onLine);
    await live(controller);
    await controller.evaluate(() => runAction('session_info_changed', state => { state.sessionAnnouncement = 'Reconnect verified'; return { changed: true, summary: 'Browser reconnect test' }; }));
    await player.context().setOffline(false);
    await player.waitForFunction(() => S.sessionAnnouncement === 'Reconnect verified' && roomSync.getState().canMutate, null, { timeout: 20000 });
    await player.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); });
    await live(player);
    await controller.getByRole('tab', { name: 'Players', exact: true }).click();
    for (const width of [320, 375, 428, 812]) {
      await controller.setViewportSize({ width, height: width === 812 ? 375 : 812 });
      check(await controller.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow at ' + width);
    }
    await controller.getByRole('button', { name: 'Set Partners', exact: true }).click();
    for (const width of [320, 375, 428, 812]) {
      await controller.setViewportSize({ width, height: width === 812 ? 375 : 812 });
      check(await controller.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Modal overflow at ' + width);
      const box = await controller.getByRole('dialog').boundingBox();
      check(box && box.x >= 0 && box.width <= width, 'Modal outside viewport');
    }
    await controller.setViewportSize({ width: 1280, height: 900 });
    await controller.evaluate(() => { document.documentElement.style.zoom = '2'; });
    check(await controller.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow at 200% CSS zoom');
    await controller.evaluate(() => { document.documentElement.style.zoom = ''; });
    await controller.keyboard.press('Escape');
    check(await controller.evaluate(() => document.activeElement.id === 'setPartnersBtn'), 'Modal focus was not restored');
    await controller.setViewportSize({ width: 375, height: 812 });
    await controller.screenshot({ path: 'output/playwright/partners-shared-controller.png' });
    await player.screenshot({ path: 'output/playwright/partners-shared-player.png' });
    check(errors.length === 0, errors.join('\n'));
    return { passed: true, scenarios: ['request', 'approve', 'three isolated devices', 'read-only roles', 'manual autofill', 'reservations', 'start', 'winner', 'break and return', 'opt-out', 'cancel', 'live sync', 'offline reconnect', 'resume', 'responsive', '200% CSS zoom', 'focus restoration'] };
  } catch (error) {
    const details = [];
    for (const context of contexts) for (const p of context.pages()) {
      details.push(await p.evaluate(() => ({ mode: accessMode, linked: linkedPlayerId, uid: currentUser && currentUser.uid, sync: syncStatus, players: S.players.map(p => ({id:p.id, owner:p.checkedInUid})), dialog: document.getElementById('modalTitle').textContent, tools: document.getElementById('playerToolsSection').innerText })).catch(() => ({})));
    }
    throw new Error(error.message + '\nBrowser state: ' + JSON.stringify(details));
  } finally {
    for (const context of contexts) await context.close();
  }
}
