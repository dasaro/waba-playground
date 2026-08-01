/**
 * CredibilityManager -- renders the price-weighted credibility table into the output log.
 *
 * The scores come from ClingoManager.computeCredibility; this module only formats. Every
 * row shows the omega-discounted share, the mean cost of the standpoints containing the
 * assumption, and how many of them there are, so the number stays decomposable on sight.
 */
export class CredibilityManager {
    constructor(outputElement) {
        this.output = outputElement;
    }

    render(data) {
        const prior = this.output.querySelector('.credibility-block');
        if (prior) prior.remove();
        const block = document.createElement('div');
        block.className = 'credibility-block';
        const caption = document.createElement('div');
        caption.className = 'credibility-caption';
        const fam = data.discount === 'exponential'
            ? 'exponential \u03c9 = e^(-c/K), odds reading'
            : 'harmonic \u03c9 = \u03ba/(\u03ba+c), affordability reading';
        caption.textContent = `Price-weighted credibility over ${data.standpoints.length} `
            + `budget-feasible standpoint${data.standpoints.length === 1 ? '' : 's'} `
            + `(${fam}; scale = ${data.kappa}${data.kappaAuto ? ', auto' : ''}; `
            + `costs ${data.standpoints.map((sp) => sp.cost).sort((a, b) => a - b).join(', ')})`;
        block.appendChild(caption);

        const table = document.createElement('table');
        table.className = 'credibility-table';
        table.innerHTML = '<thead><tr><th scope="col">assumption</th>'
            + '<th scope="col">cred</th><th scope="col"></th>'
            + '<th scope="col">avg cost</th><th scope="col"># standpoints</th></tr></thead>';
        const body = document.createElement('tbody');
        for (const row of data.rows) {
            const tr = document.createElement('tr');
            const bar = `<div class="cred-bar"><div class="cred-bar-fill" style="width:${(row.cred * 100).toFixed(1)}%"></div></div>`;
            tr.innerHTML = `<td class="cred-atom"></td>`
                + `<td class="cred-value">${row.cred.toFixed(3)}</td>`
                + `<td class="cred-bar-cell">${bar}</td>`
                + `<td class="cred-cost">${row.avgCost === null ? '–' : Math.round(row.avgCost)}</td>`
                + `<td class="cred-count">${row.count}/${data.standpoints.length}</td>`;
            tr.querySelector('.cred-atom').textContent = row.atom;
            body.appendChild(tr);
        }
        table.appendChild(body);
        block.appendChild(table);
        this.output.appendChild(block);
        const emptyState = this.output.querySelector('#output-empty-state');
        if (emptyState) emptyState.remove();
    }
}
