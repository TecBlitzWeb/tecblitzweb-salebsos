const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const style = src.slice(src.indexOf('<style>'), src.indexOf('</style>') + '</style>'.length);

const callSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" fill="currentColor"/></svg>';
const waSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 4.99L2 22l5.2-1.36a9.94 9.94 0 004.84 1.24h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2z"/></svg>';

// Faithful reproduction of the _prospectCardHtml phone-entry template
function chip(e){
  const bg = e.isWhatsApp ? 'background:rgba(37,211,102,0.12);border-radius:6px;padding:2px 6px;' : '';
  const label = e.label ? `<span style="font-size:10px;opacity:0.65;">${e.label}${e.isWhatsApp ? ' \u2713' : ''}</span>` : '';
  const waBtn = e.showWhatsAppBtn ? `<button type="button" class="btn btn-outline btn-sm prospect-wa-btn" title="WhatsApp" style="display:inline-flex;align-items:center;justify-content:center;padding:4px 6px;border-color:${e.isWhatsApp ? '#25D366' : 'rgba(37,211,102,0.4)'};color:#25D366;${e.isWhatsApp ? 'box-shadow:0 0 0 1px #25D366;' : ''}">${waSvg}</button>` : '';
  return `<span class="prospect-phone-entry" style="display:inline-flex;align-items:center;gap:4px;${bg}">`
    + `<span style="font-weight:600;">${e.number}</span>${label}`
    + `<button type="button" class="btn btn-outline btn-sm prospect-call-btn" title="Call" style="display:inline-flex;align-items:center;justify-content:center;padding:4px 6px;">${callSvg}</button>`
    + `${waBtn}</span>`;
}
const sep = '<span style="opacity:0.3;margin:0 2px;">\u00b7</span>';

function infoRow(entries){
  const html = entries.map(chip).join(sep);
  return `<span class="info-row" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">${html}</span>`;
}

// Realistic worst-case Sri Lankan combos
const cards = [
  { biz: 'Typical mobile — WhatsApp', entries: [ {number:'0770 200 7473', label:'WhatsApp', isWhatsApp:true, showWhatsAppBtn:true} ] },
  { biz: 'Two numbers (mobile + office)', entries: [
      {number:'0770 200 7473', label:'WhatsApp', isWhatsApp:true, showWhatsAppBtn:true},
      {number:'011 234 5678', label:'office', isWhatsApp:false, showWhatsAppBtn:false},
    ] },
  { biz: 'International format', entries: [ {number:'+94 77 020 07473', label:'WhatsApp', isWhatsApp:true, showWhatsAppBtn:true} ] },
  { biz: 'Three numbers', entries: [
      {number:'0770 200 7473', label:'WhatsApp', isWhatsApp:true, showWhatsAppBtn:true},
      {number:'0112 345 678', label:'landline', isWhatsApp:false, showWhatsAppBtn:false},
      {number:'0718 889 900', label:'shop', isWhatsApp:true, showWhatsAppBtn:true},
    ] },
  // Deliberate overflow stress: unrealistically long unbroken number -> should ellipsis, not overflow
  { biz: 'STRESS: absurdly long number (edge)', entries: [ {number:'077020074730112345678911223344', label:'WhatsApp', isWhatsApp:true, showWhatsAppBtn:true} ] },
];

function cardHtml(c){
  return `
  <div class="prospect-card" data-prospect-id="x">
    <div class="prospect-card-header">
      <div>
        <div class="prospect-biz" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">${c.biz}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <span class="badge badge-gray" style="font-size:11px;opacity:0.7;">New \u00b7 no calls</span>
      ${infoRow(c.entries)}
      <button class="btn btn-outline btn-sm" style="margin-left:auto;">History</button>
      <button class="btn btn-cyan btn-sm">Log Call</button>
    </div>
  </div>`;
}

const WIDTHS = [320, 375, 430];
const frames = WIDTHS.map(w => `
  <div style="font:12px sans-serif;color:#8ab;padding:4px 0;">— device width ${w}px —</div>
  <div class="device-frame" data-w="${w}" style="width:${w}px;border:1px solid #345;box-sizing:border-box;overflow:visible;">
    <div id="page-prospects" class="page active" style="display:block;padding:12px;">
      <div class="prospect-grid" style="display:flex;flex-direction:column;gap:14px;">
        ${cards.map(cardHtml).join('')}
      </div>
    </div>
  </div>`).join('');

const doc = `<!DOCTYPE html><html><head><meta charset="utf-8">${style}</head>
<body class="dark" style="margin:0;">
  <pre id="dbg" style="color:#0f0;background:#000;font-size:11px;white-space:pre-wrap;padding:8px;margin:0;"></pre>
  <div style="display:flex;flex-direction:column;gap:20px;padding:10px;align-items:flex-start;">
    ${frames}
  </div>
  <script>
    console.log('MEASURE SCRIPT START innerW='+window.innerWidth);
    try {
    var out=[];
    document.querySelectorAll('.device-frame').forEach(function(frame){
      var w=frame.getAttribute('data-w');
      frame.querySelectorAll('.prospect-card').forEach(function(card,ci){
        var cardOvf=card.scrollWidth-card.clientWidth;
        var irow=card.querySelector('.info-row');
        card.querySelectorAll('.prospect-phone-entry').forEach(function(chip){
          var num=chip.querySelector('span');
          var full=(num.offsetWidth>=num.scrollWidth-1)?'FULL':('CLIP(-'+(num.scrollWidth-num.offsetWidth)+')');
          out.push('W'+w+' card'+ci+' cardOvfX='+cardOvf+' irowCW='+irow.clientWidth
            +' numOW='+num.offsetWidth+'/'+num.scrollWidth+' '+full+' txt="'+num.textContent+'"');
        });
      });
    });
    document.getElementById('dbg').textContent=out.join(String.fromCharCode(10));
    out.forEach(function(l){ console.log('MEASURE '+l); });
    console.log('MEASURE doc.scrollWidth='+document.documentElement.scrollWidth+' innerW='+window.innerWidth);
    } catch(e){ console.log('MEASURE ERROR '+e.message+' @ '+e.stack); }
  </script>
</body></html>`;

fs.writeFileSync(path.join(__dirname, '.phone-harness.html'), doc);
console.log('wrote .phone-harness.html', doc.length, 'bytes');
