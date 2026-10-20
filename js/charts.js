// Gestion des graphiques et indicateurs statistiques (Chart.js)

class StatsChartsManager {
  constructor() {
    this.chartInstances = {};
    this.currentYear = 'Global';
  }

  // Palette de couleurs harmonieuse pour thème sombre iOS
  getColors() {
    return [
      '#8b5cf6', // Violet
      '#ec4899', // Rose
      '#3b82f6', // Bleu
      '#10b981', // Émeraude
      '#f59e0b', // Ambre
      '#06b6d4', // Cyan
      '#f97316', // Orange
      '#a855f7', // Pourpre
      '#14b8a6', // Turquoise
      '#6366f1', // Indigo
      '#84cc16', // Lime
      '#e11d48'  // Rouge rubis
    ];
  }

  render(period = 'Global') {
    this.currentYear = period;
    const allEvents = window.dataManager.getAll();
    const filtered = period === 'Global'
      ? allEvents
      : allEvents.filter(e => (e.annee === period || (e.date && e.date.startsWith(period))));

    // 1. Mise à jour des cartes KPI
    this.updateKPIs(filtered);

    // 2. Mise à jour / création des graphiques
    this.renderTopArtists(filtered);
    this.renderEventTypes(filtered);
    this.renderPlacements(filtered);
    this.renderBudgetBreakdown(filtered);
    this.renderMerchItems(filtered);
    this.renderCompanions(filtered);
  }

  updateKPIs(events) {
    const totalEvents = events.length;
    let totalSpent = 0;
    const cities = new Set();

    events.forEach(e => {
      totalSpent += (e.cout_total || 0);
      if (e.ville && e.ville.trim()) {
        cities.add(e.ville.trim().toLowerCase());
      }
    });

    const avgSpent = totalEvents > 0 ? (totalSpent / totalEvents) : 0;

    const elTotal = document.getElementById('kpi-total-events');
    const elSpent = document.getElementById('kpi-total-spent');
    const elAvg = document.getElementById('kpi-avg-spent');
    const elCities = document.getElementById('kpi-cities');

    if (elTotal) elTotal.textContent = totalEvents;
    if (elSpent) elSpent.textContent = totalSpent.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    if (elAvg) elAvg.textContent = avgSpent.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    if (elCities) elCities.textContent = cities.size;
  }

  destroyChart(id) {
    if (this.chartInstances[id]) {
      this.chartInstances[id].destroy();
      delete this.chartInstances[id];
    }
  }

  // 1. Top 10 Artistes principaux
  renderTopArtists(events) {
    const canvas = document.getElementById('chart-top-artists');
    if (!canvas) return;
    this.destroyChart('top-artists');

    const counts = {};
    events.forEach(e => {
      if (e.artistes) {
        e.artistes.split(',').forEach(art => {
          const clean = art.trim();
          if (clean && clean.toLowerCase() !== 'nan' && clean.toLowerCase() !== 'none') {
            counts[clean] = (counts[clean] || 0) + 1;
          }
        });
      }
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const labels = sorted.map(i => i[0]);
    const data = sorted.map(i => i[1]);

    const ctx = canvas.getContext('2d');
    this.chartInstances['top-artists'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Nombre de fois',
          data: data,
          backgroundColor: '#8b5cf6',
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e1b2e',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            borderColor: '#3b2d54',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` ${ctx.raw} concert${ctx.raw > 1 ? 's' : ''}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', stepSize: 1 },
            grid: { color: 'rgba(255, 255, 255, 0.06)' }
          },
          y: {
            ticks: { color: '#e2e8f0', font: { size: 12, weight: '500' } },
            grid: { display: false }
          }
        }
      }
    });
  }

  // 2. Types d'événements
  renderEventTypes(events) {
    const canvas = document.getElementById('chart-event-types');
    if (!canvas) return;
    this.destroyChart('event-types');

    const counts = {};
    events.forEach(e => {
      const type = (e.type || 'Concert').trim();
      counts[type] = (counts[type] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    const ctx = canvas.getContext('2d');
    this.chartInstances['event-types'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: this.getColors().slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#12121a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#e2e8f0', boxWidth: 12, padding: 12, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#1e1b2e',
            borderColor: '#3b2d54',
            borderWidth: 1
          }
        },
        cutout: '58%'
      }
    });
  }

  // 3. Placements
  renderPlacements(events) {
    const canvas = document.getElementById('chart-placements');
    if (!canvas) return;
    this.destroyChart('placements');

    const counts = {};
    events.forEach(e => {
      const place = (e.placement || 'Autre').trim();
      counts[place] = (counts[place] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = Object.values(counts);

    const ctx = canvas.getContext('2d');
    this.chartInstances['placements'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: this.getColors().slice(3, 3 + labels.length),
          borderWidth: 2,
          borderColor: '#12121a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#e2e8f0', boxWidth: 12, padding: 12, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#1e1b2e',
            borderColor: '#3b2d54',
            borderWidth: 1
          }
        },
        cutout: '58%'
      }
    });
  }

  // 4. Répartition du Budget Réel
  renderBudgetBreakdown(events) {
    const canvas = document.getElementById('chart-budget');
    if (!canvas) return;
    this.destroyChart('budget');

    let billets = 0;
    let transport = 0;
    let logement = 0;
    let merch = 0;

    events.forEach(e => {
      if (e.billet_paye === 'Oui' && !e.prix_billet_inconnu && e.prix_billet) {
        billets += Number(e.prix_billet);
      }
      if (!e.transport_inconnu && e.transport) {
        transport += Number(e.transport);
      }
      if (!e.logement_inconnu && e.logement) {
        logement += Number(e.logement);
      }
      if (!e.merch_inconnu && e.merch) {
        merch += Number(e.merch);
      }
    });

    const categories = ['Billets (payés)', 'Transport', 'Logement', 'Merch'];
    const data = [
      Math.round(billets * 100) / 100,
      Math.round(transport * 100) / 100,
      Math.round(logement * 100) / 100,
      Math.round(merch * 100) / 100
    ];

    const ctx = canvas.getContext('2d');
    this.chartInstances['budget'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: data,
          backgroundColor: ['#8b5cf6', '#3b82f6', '#10b981', '#ec4899'],
          borderWidth: 2,
          borderColor: '#12121a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#e2e8f0', boxWidth: 12, padding: 12, font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#1e1b2e',
            borderColor: '#3b2d54',
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
            }
          }
        },
        cutout: '58%'
      }
    });
  }

  // 5. Articles Merch
  renderMerchItems(events) {
    const canvas = document.getElementById('chart-merch-items');
    if (!canvas) return;
    this.destroyChart('merch-items');

    const counts = {};
    events.forEach(e => {
      if (e.articles_merch) {
        e.articles_merch.split(',').forEach(m => {
          const clean = m.trim();
          if (clean && clean.toLowerCase() !== 'nan' && clean.toLowerCase() !== 'none') {
            counts[clean] = (counts[clean] || 0) + 1;
          }
        });
      }
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const labels = sorted.map(i => i[0]);
    const data = sorted.map(i => i[1]);

    const ctx = canvas.getContext('2d');
    this.chartInstances['merch-items'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Aucun merch'],
        datasets: [{
          label: 'Quantité',
          data: labels.length > 0 ? data : [0],
          backgroundColor: '#ec4899',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e1b2e',
            borderColor: '#3b2d54',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', stepSize: 1 },
            grid: { color: 'rgba(255, 255, 255, 0.06)' }
          },
          y: {
            ticks: { color: '#e2e8f0', font: { size: 12 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  // 6. Compagnons de concert
  renderCompanions(events) {
    const canvas = document.getElementById('chart-companions');
    if (!canvas) return;
    this.destroyChart('companions');

    const counts = {};
    events.forEach(e => {
      if (e.accompagnateurs) {
        e.accompagnateurs.split(',').forEach(acc => {
          const clean = acc.trim();
          if (clean && clean.toLowerCase() !== 'nan' && clean.toLowerCase() !== 'none') {
            counts[clean] = (counts[clean] || 0) + 1;
          }
        });
      }
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const labels = sorted.map(i => i[0]);
    const data = sorted.map(i => i[1]);

    const ctx = canvas.getContext('2d');
    this.chartInstances['companions'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['Aucun'],
        datasets: [{
          label: 'Concerts partagés',
          data: labels.length > 0 ? data : [0],
          backgroundColor: '#06b6d4',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e1b2e',
            borderColor: '#3b2d54',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', stepSize: 1 },
            grid: { color: 'rgba(255, 255, 255, 0.06)' }
          },
          y: {
            ticks: { color: '#e2e8f0', font: { size: 12 } },
            grid: { display: false }
          }
        }
      }
    });
  }
}

window.statsManager = new StatsChartsManager();
