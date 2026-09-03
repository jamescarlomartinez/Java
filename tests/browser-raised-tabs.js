// Local visual shell verification via playwright-cli run-code --filename.
// Does not authenticate, connect to a room, or write shared game state.
async (page) => {
  if (!page.url().startsWith('http://127.0.0.1:4173/')) throw new Error('Local preview only');
  await page.waitForFunction(() => typeof initSolo === 'function');
  await page.evaluate(() => initSolo());
  const check = (value, message) => { if (!value) throw new Error(message); };
  const results = [];
  for (const shared of [false, true]) {
    await page.evaluate(shared => {
      // Exercise all five tabs without opening a real shared subscription.
      roomId = shared ? 'local-layout-fixture' : null;
      subscribeToEvents = () => {};
      initAppTabs();
    }, shared);
    for (const [width, height] of [[320, 740], [375, 812], [428, 926], [640, 450], [812, 375], [1280, 900]]) {
      await page.setViewportSize({ width, height });
      for (const large of [false, true]) {
        await page.evaluate(large => document.documentElement.classList.toggle('large-text', large), large);
        const buttons = await page.getByRole('tab').all();
        check(buttons.length === (shared ? 5 : 4), 'Wrong visible tab count');
        for (const button of buttons) {
          await button.click();
          check(await button.getAttribute('aria-selected') === 'true', 'Selection failed');
          const metrics = await button.evaluate(el => {
            const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
            const label = el.lastElementChild.getBoundingClientRect();
            return { w:r.width, h:r.height, x:r.x, right:r.right, y:r.y, bottom:r.bottom,
              labelFits: label.left >= r.left && label.right <= r.right,
              shadow:s.boxShadow, bg:s.backgroundColor };
          });
          check(metrics.w >= 44 && metrics.h >= 44, 'Small target');
          check(metrics.x >= 0 && metrics.right <= width + 1, 'Tab outside viewport');
          check(metrics.y >= 0 && metrics.bottom <= height + 1, 'Tab obscured');
          check(metrics.labelFits, 'Label overflow');
          check(metrics.shadow !== 'none', 'Missing raised edge');
        }
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow');
        results.push({ shared, width, large, passed:true });
      }
    }
  }
  await page.setViewportSize({ width:1280, height:900 });
  await page.evaluate(() => document.documentElement.classList.remove('large-text'));
  await page.getByRole('tab', {name:'Game', exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  check(await page.getByRole('tab', {name:'Players', exact:true}).getAttribute('aria-selected') === 'true', 'Arrow navigation');
  check(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'), 'Focus outline missing');
  await page.keyboard.press('End');
  check(await page.getByRole('tab', {name:'Session', exact:true}).getAttribute('aria-selected') === 'true', 'End navigation');
  await page.keyboard.press('Home');
  check(await page.getByRole('tab', {name:'Game', exact:true}).getAttribute('aria-selected') === 'true', 'Home navigation');
  await page.getByRole('tab', {name:'Session', exact:true}).click();
  await page.screenshot({ path:'output/playwright/raised-tabs-desktop.png' });
  await page.setViewportSize({width:375, height:812});
  await page.screenshot({ path:'output/playwright/raised-tabs-mobile.png' });
  await page.emulateMedia({reducedMotion:'reduce'});
  check(await page.getByRole('tab', {name:'Game', exact:true}).evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) < .01), 'Reduced motion ignored');
  await page.emulateMedia({forcedColors:'active'});
  check(await page.getByRole('tab', {name:'Session', exact:true}).evaluate(el => getComputedStyle(el).borderTopWidth === '3px'), 'Forced-color selection missing');
  await page.emulateMedia({forcedColors:'none'});
  console.log(JSON.stringify({layoutCases:results.length, keyboard:true, reducedMotion:true, forcedColors:true}));
}
