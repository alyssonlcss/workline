const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/scanner_analytics/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('getDashboardChips')) {
  code = code.replace(
    /import \{ DashboardPdfService \} from '.\/services\/dashboard-pdf.service';/,
    `import { DashboardPdfService } from './services/dashboard-pdf.service';\nimport { getDashboardChips, getDashboardAlerts, DashboardChip, DashboardAlert } from '../../shared/utils/dashboard-presentation.utils';`
  );
}

if (!code.includes('protected getChips')) {
  code = code.replace(
    /protected readonly allOption = ALL_OPTION;/,
    `protected readonly allOption = ALL_OPTION;\n\n  protected getChips(kpi: string, analysis: any): DashboardChip[] {\n    return getDashboardChips(kpi, analysis);\n  }\n\n  protected getAlerts(kpi: string, ev: any): DashboardAlert[] {\n    return getDashboardAlerts(kpi, ev);\n  }`
  );
}

// OS Dia Chips
code = code.replace(
  /<div class="osdia-chips-row">[\s\S]*?(<span class="rpt-osdia-chip"[\s\S]*?<\/span>\s*)+<\/div>/g,
  `<div class="osdia-chips-row">
                              <span class="rpt-osdia-chip" *ngFor="let chip of getChips('OS Dia', analysis)">
                                {{ chip.label }} <strong [innerHTML]="chip.value"></strong>
                              </span>
                            </div>`
);

// OS Dia Alerts
code = code.replace(
  /<ul class="osdia-ev-alerts">\s*<li \*ngIf="ev\.flags\.includes\('tr_excede_hd'\)"[\s\S]*?<\/ul>/g,
  `<ul class="osdia-ev-alerts">
                                <li *ngFor="let alert of getAlerts('OS Dia', ev)" class="osdia-ev-alert" [class.osdia-ev-alert--warn]="alert.isWarn">
                                  <strong>{{ alert.title }}</strong> <span [innerHTML]="highlightMin(alert.bodyHtml)"></span>
                                </li>
                              </ul>`
);

// Eficiencia Chips
code = code.replace(
  /<div class="rpt-osdia-card-meta">\s*<span class="rpt-osdia-chip">Utilização[\s\S]*?<\/div>/g,
  `<div class="rpt-osdia-card-meta">
                        <span class="rpt-osdia-chip" *ngFor="let chip of getChips('Eficiência', analysis)">
                          {{ chip.label }} <strong [innerHTML]="chip.value"></strong>
                        </span>
                      </div>`
);

// Eficiencia Alerts
code = code.replace(
  /<ul class="osdia-ev-alerts">\s*<li \*ngIf="ev\.flags\.includes\('baixa_eficiencia'\)"[\s\S]*?<\/ul>/g,
  `<ul class="osdia-ev-alerts">
                            <li *ngFor="let alert of getAlerts('Eficiência', ev)" class="osdia-ev-alert" [class.osdia-ev-alert--warn]="alert.isWarn">
                              <strong>{{ alert.title }}</strong> <span [innerHTML]="highlightMin(alert.bodyHtml)"></span>
                            </li>
                          </ul>`
);

// TME IMP Chips
code = code.replace(
  /<div class="rpt-osdia-card-meta">\s*<span class="rpt-osdia-chip">TME IMP[\s\S]*?<\/div>/g,
  `<div class="rpt-osdia-card-meta">
                        <span class="rpt-osdia-chip" *ngFor="let chip of getChips('TME Improdutivo', analysis)">
                          {{ chip.label }} <strong [innerHTML]="chip.value"></strong>
                        </span>
                      </div>`
);

// TME IMP Alerts
code = code.replace(
  /<ul class="osdia-ev-alerts">\s*<li \*ngIf="ev\.flags\.includes\('tme_muito_alto'\)"[\s\S]*?<\/ul>/g,
  `<ul class="osdia-ev-alerts">
                            <li *ngFor="let alert of getAlerts('TME Improdutivo', ev)" class="osdia-ev-alert" [class.osdia-ev-alert--warn]="alert.isWarn">
                              <strong>{{ alert.title }}</strong> <span [innerHTML]="highlightMin(alert.bodyHtml)"></span>
                            </li>
                          </ul>`
);

// 1º Login Chips
code = code.replace(
  /<div class="rpt-osdia-card-meta">\s*<span class="rpt-osdia-chip">1º Login[\s\S]*?<\/div>/g,
  `<div class="rpt-osdia-card-meta">
                        <span class="rpt-osdia-chip" *ngFor="let chip of getChips('1º Login', analysis)">
                          {{ chip.label }} <strong [innerHTML]="chip.value"></strong>
                        </span>
                      </div>`
);

// 1º Login Alerts
code = code.replace(
  /<ul class="osdia-ev-alerts">\s*<li \*ngIf="ev\.flags\.includes\('login_muito_tardio'\)"[\s\S]*?<\/ul>/g,
  `<ul class="osdia-ev-alerts">
                            <li *ngFor="let alert of getAlerts('1º Login', ev)" class="osdia-ev-alert" [class.osdia-ev-alert--warn]="alert.isWarn">
                              <strong>{{ alert.title }}</strong> <span [innerHTML]="highlightMin(alert.bodyHtml)"></span>
                            </li>
                          </ul>`
);

// 1º Desloc Chips
code = code.replace(
  /<div class="rpt-osdia-card-meta">\s*<span class="rpt-osdia-chip">1º Desloc\.[\s\S]*?<\/div>/g,
  `<div class="rpt-osdia-card-meta">
                        <span class="rpt-osdia-chip" *ngFor="let chip of getChips('1º Desloc.', analysis)">
                          {{ chip.label }} <strong [innerHTML]="chip.value"></strong>
                        </span>
                      </div>`
);

// 1º Desloc Alerts
code = code.replace(
  /<ul class="osdia-ev-alerts">\s*<li \*ngIf="ev\.flags\.includes\('despacho_tardio'\)"[\s\S]*?<\/ul>/g,
  `<ul class="osdia-ev-alerts">
                            <li *ngFor="let alert of getAlerts('1º Desloc.', ev)" class="osdia-ev-alert" [class.osdia-ev-alert--warn]="alert.isWarn">
                              <strong>{{ alert.title }}</strong> <span [innerHTML]="highlightMin(alert.bodyHtml)"></span>
                            </li>
                          </ul>`
);

// Retorno Base Chips
code = code.replace(
  /<div class="rpt-osdia-card-meta">\s*<span class="rpt-osdia-chip">Retorno Base[\s\S]*?<\/div>/g,
  `<div class="rpt-osdia-card-meta">
                        <span class="rpt-osdia-chip" *ngFor="let chip of getChips('Retorno Base', analysis)">
                          {{ chip.label }} <strong [innerHTML]="chip.value"></strong>
                        </span>
                      </div>`
);

// Retorno Base Alerts
code = code.replace(
  /<ul class="osdia-ev-alerts">\s*<li \*ngIf="ev\.flags\.includes\('retorno_muito_alto'\)"[\s\S]*?<\/ul>/g,
  `<ul class="osdia-ev-alerts">
                            <li *ngFor="let alert of getAlerts('Retorno Base', ev)" class="osdia-ev-alert" [class.osdia-ev-alert--warn]="alert.isWarn">
                              <strong>{{ alert.title }}</strong> <span [innerHTML]="highlightMin(alert.bodyHtml)"></span>
                            </li>
                          </ul>`
);

fs.writeFileSync(file, code, 'utf8');
console.log('done dashboard.component.ts refactor!');
