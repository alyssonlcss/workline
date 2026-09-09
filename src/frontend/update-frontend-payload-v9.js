const fs = require('fs');
const file = 'c:/Users/BR0083895903/source/workline/src/frontend/src/app/features/dashboard/dashboard.component.ts';
let content = fs.readFileSync(file, 'utf8');

const target1 = `                          <ng-container *ngFor="let tag of getIncidenceTags(analysis.team)">
                            <span class="rpt-osdia-badge" [class.rpt-osdia-badge--blue]="tag.color === 'blue'" [class.rpt-osdia-badge--orange]="tag.color === 'orange'">
                              {{ tag.label }}
                            </span>
                          </ng-container>`;

const target2 = `                        <span class="incidence-tags-row" *ngIf="getIncidenceTags(analysis.team).length > 0">
                          <span *ngFor="let tag of getIncidenceTags(analysis.team)" class="incidence-tag" [ngClass]="'incidence-tag--' + tag.color">{{ tag.label }}</span>
                        </span>`;

// Replace all occurrences using split-join
content = content.split(target1).join('');
content = content.split(target2).join('');

fs.writeFileSync(file, content);
console.log('Literal replacement successful');
