window.ox.install(({ action }) => {
const log = (...args) => console.log(...args);
  const cities = ['武汉','上海','沈阳','北京','广州'];
  const text = el => (el?.innerText || '').trim();
  const buttons = () => Array.from(document.querySelectorAll('button'));
  const button = label => buttons().find(el => text(el) === label);
  const pause = () => new Promise(resolve => setTimeout(resolve, 250));
  function cityContainers() {
    return Array.from(document.querySelectorAll('div.rounded-xl.border.bg-card.overflow-hidden')).filter(el => {
      const b = el.firstElementChild;
      return b?.tagName === 'BUTTON' && cities.includes(text(b).split('\n')[0].trim());
    });
  }
  function ready() { return cityContainers().length > 0; }
  async function pageReady() {
    const end = Date.now() + 12000;
    while (Date.now() < end) {
      if (location.hostname !== 'qmq.app') throw new Error('QMQ page is not on the expected host');
      if (button('查看可预约面签位') || button('重新验证并刷新') || ready()) return;
      await pause();
    }
    throw new Error('QMQ availability controls did not load');
  }
  async function unlock() {
    await pageReady();
    const b = button('查看可预约面签位');
    if (b && !b.disabled) b.click();
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      if (ready()) return true;
      const cn = buttons().find(el => /^中国\s*\d+城市$/.test(text(el)));
      if (cn && !cn.disabled) cn.click();
      await pause();
    }
    return false;
  }
  action('getAvailability', {
    async invoke(args) {
      const visa = (args.visaType || 'H-1B').trim().toUpperCase();
      const ok = await unlock(false);
      const base = {checkedAt:new Date().toISOString(),sourceUrl:'https://qmq.app/',note:'Third-party reported status, not guaranteed bookable inventory. checkedAt is the read time, not a source update timestamp. Exact dates require separate verification and are not retrieved. Missing categories mean not listed, not unavailable.'};
      if (!ok) return {...base,state:'verificationRequired',items:[]};
      const cn = buttons().find(el => /^中国\s*\d+城市$/.test(text(el)));
      if (cn) cn.click();
      await pause();
      let groups = cityContainers();
      if (groups.length === 0) throw new Error('QMQ China city table is missing');
      const out = [];
      for (const group of groups) {
        const city = text(group.firstElementChild).split('\n')[0].trim();
        if (args.city && args.city !== city) continue;
        let cards = Array.from(group.querySelectorAll('div.px-5.py-4'));
        if (!cards.length) {
          group.firstElementChild.click();
          const end = Date.now() + 3000;
          while (!cards.length && Date.now() < end) { await pause(); cards = Array.from(group.querySelectorAll('div.px-5.py-4')); }
        }
        if (!cards.length) throw new Error('QMQ city cards could not be read: ' + city);
        for (const card of cards) {
          const spans = Array.from(card.firstElementChild?.querySelectorAll('span') || []);
          const code = text(spans[0]);
          if (code.toUpperCase() !== visa) continue;
          const category = text(spans[1]);
          const label = text(spans[2]);
          const status = {'有位':'available','紧缺':'limited'}[label];
          if (!category || !status) throw new Error('Unrecognized QMQ availability card');
          out.push({city,visaType:code,category,status,datesState:'notRetrieved'});
        }
      }
      log('getAvailability ready rows=' + out.length);
      return {...base,state:'ready',items:out};
    }
  });
  action('getBotControlUrl', {async invoke() { return {url:'https://qmq.app/'}; }});
  action('getBotControlState', {async invoke(args) {
    const url = new URL(args.pageUrl);
    if (url.hostname !== 'qmq.app') return {ok:false};
    return {ok:await unlock(false)};
  }});
});
