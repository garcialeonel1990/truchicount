// Optional browser regression check; uses the real HTML, CSS and render functions
// with local fixtures, without signing in or contacting Firebase.
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { chromium } = await import(process.env.TRUCHICOUNT_PLAYWRIGHT_PATH || 'playwright');
const baseline = process.argv.includes('--baseline');
const css = baseline ? execFileSync('git', ['show', 'HEAD:styles.css'], { cwd: root, encoding: 'utf8' }) : await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const html = (await readFile(new URL('../index.html', import.meta.url), 'utf8'))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  .replace(/<link\b[^>]*>/g, '');
const app = await readFile(new URL('../app-main.js', import.meta.url), 'utf8');
const summary = (await readFile(new URL('../summary.js', import.meta.url), 'utf8')).replaceAll('export function', 'function');
const functions = ['moneySummary', 'moneyBalanceSummary', 'moneyGroups', 'renderSummary', 'renderExpenses', 'expenseDetailItems', 'renderExpenseDetail', 'renderPayerAllocations']
  .map(name => {
    const fn = app.match(new RegExp(`function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(fn, name);
    return fn;
  }).join('\n');
const closeFunctions = ['closeExpenseDialog', 'cleanupExpenseDialog'].map(name => app.match(new RegExp(`function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`))[0]).join('\n');
const closeStart = app.indexOf('document.querySelectorAll("[data-close]")');
const closeHandlers = app.slice(closeStart, app.indexOf('document.querySelectorAll("[data-tab]")', closeStart));
assert.ok(closeHandlers.includes('on(dialog, "close", cleanupExpenseDialog)'));
const fixture = `
const $ = s => document.querySelector(s);
const DEFAULT_CURRENCY = 'ARS';
const longName = 'Participante con nombre largo '.repeat(3).slice(0,80);
const state = { user: { uid: 'u' }, count: { primaryCurrency: 'ARS', name: 'Viaje compartido' },
  members: [{id:'a',userId:'u',type:'registered',active:true},{id:'b',active:true}],
  expenses: Array.from({length:20}, (_,i) => ({id:String(i), status:'active', title:'Cena y compras para el viaje '.repeat(3),
    categoryId:'food', categoryNameSnapshot:'Comidas y compras compartidas', currency:'ARS', amountMinor:123456789012,
    payerMemberId:'a', payerShares:{a:123456789012}, participantMemberIds:['a','b'],
    participantShares:{a:61728394506,b:61728394506}, expenseDate:'2026-10-23', notes:'Notas extensas '.repeat(30)})) };
const esc = v => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const nameOf = id => id === 'a' ? longName : 'María';
const memberName = m => nameOf(m.id);
const activeExpenses = () => state.expenses;
const activeMembers = () => state.members;
const categoryDisplay = () => ({name:'Comidas y compras compartidas '.repeat(3),emoji:'🧾'});
const formatMoney = (n,c) => new Intl.NumberFormat('es-AR',{style:'currency',currency:c}).format(n/100);
const formatMoneyPlain = n => String(n/100);
const expensePaidAmount = (e,id) => e.payerShares[id] || 0;
const expensePayerNames = () => longName;
const totals = items => ({ARS:items.reduce((sum,e)=>sum+e.amountMinor,0)});
const dateISO = v => v;
const prettyDate = () => '23 de octubre de 2026';
const on = (el,event,fn) => el.addEventListener(event,fn);
const dialogs = Object.fromEntries([...document.querySelectorAll('dialog')].map(d=>[d.id,d]));
const closeMenus = () => document.querySelectorAll('.menu-popover').forEach(m=>m.remove());
const openExpenseDetail = () => {};
const updatePayerAllocationTotal = () => {};
${summary}
${functions}
document.querySelectorAll('.login-screen').forEach(el => el.hidden = true);
$('#appShell').hidden = false;
$('#homeScreen').hidden = true;
$('#detailScreen').hidden = false;
$('#countTitle').textContent = 'Viaje compartido con amigos';
$('#memberSummary').textContent = '2 integrantes';
renderSummary(); renderExpenses(); renderExpenseDetail(state.expenses[0]);
$('#participantChecks').innerHTML = state.members.map(m => '<label class="participant-row"><input type="checkbox" name="participant" value="'+m.id+'" checked><span>'+esc(memberName(m))+'</span><span class="checkmark">✓</span></label>').join('');
$('#multiplePayersToggle').checked = true;
renderPayerAllocations(state.members, state.expenses[0]);
$('#payerButton').textContent = longName;
$('#expenseForm').elements.expenseDate.value = '2026-10-23';
$('#draftMemberList').innerHTML = '<article class="member-row"><span class="member-avatar">P</span><span><strong>'+esc(longName)+'</strong><small>Manual</small></span><span class="draft-member-actions"><button type="button">Editar</button><button class="draft-remove-button" type="button">Quitar</button></span></article>';
${closeFunctions}
${closeHandlers}
dialogs.nicknameModal.addEventListener('cancel',event=>event.preventDefault());
$('#countCloseButton').addEventListener('click',()=>$('#countModal').close());
`;
const output = '/tmp/truchicount-css-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const failures = [];
let checks = 0;
try {
  for (const width of [320,375,390,393,402,430,640,900]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.route('**/*', route => route.abort());
    await page.setContent(html);
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: fixture });
    const check = (ok, message) => { checks++; if (!ok) failures.push(`${width}: ${message}`); };
    const overflow = async label => {
      const bad = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width && r.height && (r.left < -1 || r.right > innerWidth+1);
      }).map(el => `${el.tagName}.${el.className}`).slice(0,8));
      check(!bad.length, `${label}: horizontal overflow ${bad.join(', ')}`);
    };
    await page.evaluate(() => {
      document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('is-active',p.id==='summaryPanel'));
      document.querySelectorAll('.tab').forEach(t=>{ const selected=t.id==='summaryTab'; t.classList.toggle('is-selected',selected); t.setAttribute('aria-selected',String(selected)); });
    });
    const people = page.locator('.summary-people').first();
    check(!await people.isVisible(), 'category content must stay hidden when closed');
    await page.locator('.category-summary > summary').first().click();
    check(await people.isVisible(), 'category opens with native summary click');
    await overflow('summary');
    if ([375,430].includes(width)) await page.screenshot({ path:`${output}/${baseline?'before':'after'}-summary-${width}.png` });
    await page.locator('.category-summary > summary').first().focus();
    await page.keyboard.press('Enter');
    check(!await people.isVisible(), 'category closes with keyboard');
    await page.evaluate(() => {
      document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('is-active',p.id==='expensesPanel'));
      document.querySelectorAll('.tab').forEach(t=>{ const selected=t.id==='expensesTab'; t.classList.toggle('is-selected',selected); t.setAttribute('aria-selected',String(selected)); });
    });
    await overflow('expenses');
    const cta = await page.locator('#addExpenseButton').boundingBox();
    check(cta.y >= 0 && cta.y+cta.height <=844, 'expense CTA visible with a long list');
    for (const id of await page.locator('dialog').evaluateAll(ds=>ds.map(d=>d.id))) {
      await page.evaluate(id=>document.getElementById(id).showModal(),id);
      await overflow(id);
      const close = page.locator(`#${id} .close-button, #${id} .expense-close-button`).first();
      if (await close.count()) {
        const box = await close.boundingBox();
        const card = await page.locator(`#${id} .modal-card`).boundingBox();
        check(box.width>=44 && box.height>=44, `${id}: close target >=44`);
        check(box.x > card.x+card.width/2, `${id}: close aligned to right`);
        await close.click();
      } else {
        await page.keyboard.press('Escape');
        if (id==='nicknameModal') {
          check(await page.locator('#nicknameModal[open]').count()===1,'required nickname dialog resists Escape');
          await page.evaluate(()=>document.getElementById('nicknameModal').close());
        }
      }
      check(await page.locator('dialog[open]').count()===0,`${id}: closed without leftover dialog`);
    }
    await page.evaluate(()=>document.getElementById('expenseModal').showModal());
    if ([375,430].includes(width)) await page.screenshot({ path:`${output}/${baseline?'before':'after'}-expense-initial-${width}.png` });
    for (const height of [844,420]) {
      await page.setViewportSize({width,height});
      const footer = await page.locator('.expense-form-footer').boundingBox();
      const header = await page.locator('.expense-form-header').boundingBox();
      check(footer.y>=0 && footer.y+footer.height<=height+1,`expense footer visible at height ${height}`);
      check(header.y>=0,`expense header visible at height ${height}`);
      await page.locator('.expense-form-body').evaluate(el=>el.scrollTop=el.scrollHeight);
      const scrolled = await page.locator('.expense-form-footer').boundingBox();
      check(Math.abs(scrolled.y-footer.y)<1,`expense footer stable while body scrolls at height ${height}`);
    }
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.locator('#amountOperators').evaluate(el=>el.hidden=false);
    await page.locator('.expense-form-body').evaluate(el=>el.scrollTop=0);
    await overflow('expense with operators');
    check(await page.locator('#expenseModal .expense-form-footer').innerText()==='Guardar gasto','expense footer has save action');
    const toggle = page.locator('#participantChecks input').first();
    await toggle.uncheck();
    check(await toggle.evaluate(el=>getComputedStyle(el.parentElement.querySelector('.checkmark')).visibility)==='hidden','unchecked participant hides checkmark');
    await toggle.check();
    const titleBox = await page.locator('#expenseModalTitle').boundingBox();
    const headerBox = await page.locator('.expense-form-header').boundingBox();
    check(titleBox.width>0 && titleBox.y>=headerBox.y && titleBox.y+titleBox.height<=headerBox.y+headerBox.height,'expense title stays inside header');
    if ([375,430].includes(width)) await page.screenshot({ path:`${output}/${baseline?'before':'after'}-expense-${width}.png` });
    await page.locator('#expenseModal [data-close]').click();
    await page.evaluate(()=>document.getElementById('categoryModal').showModal());
    if ([375,430].includes(width)) await page.screenshot({ path:`${output}/${baseline?'before':'after'}-close-${width}.png` });
    await page.locator('#categoryModal [data-close]').first().click();
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ baseline, checks, failures, screenshots: output },null,2));
if (failures.length) process.exitCode=1;
