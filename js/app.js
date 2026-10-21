// Application Controller - Mes Concerts PWA (Mode Supabase Cloud & Multi-appareils)

class ConcertsApp {
  constructor() {
    this.currentTab = 'carnet';
    this.searchQuery = '';
    this.selectedYearFilter = 'all';
    this.selectedTypeFilter = 'all';
    this.editingId = null;
    this.activeTagInputs = {};

    this.init();
  }

  async init() {
    // 1. Enregistrement Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.log('SW registration failed:', err);
        });
      });
    }

    // 2. Initialisation des composants UI
    this.setupNavigation();
    this.setupFiltersAndSearch();
    this.setupAddForm();
    this.setupEditModal();
    this.setupSettings();
    this.setupSupabaseAuthModal();
    this.setupMainAuthScreen();
    this.setupInstallPrompt();
    this.setupStarRatings();
    this.setupRankingFilters();
    this.setupNotifications();
    this.startCountdownTimer();

    // 3. Initialisation des données Cloud Supabase
    if (window.dataManager) {
      await window.dataManager.init();
    }

    // 4. État d'authentification initial & affichage de la bonne vue
    this.updateUserSessionState();
    this.populateDatalists();

    // 5. Détection iOS Standalone
    this.checkStandaloneMode();
  }

  updateUserSessionState() {
    const user = window.dataManager.currentUser;
    const headerEmail = document.getElementById('header-user-email');
    const headerLogout = document.getElementById('btn-header-logout');
    const bottomNav = document.querySelector('.bottom-nav');

    if (user) {
      if (headerEmail) {
        headerEmail.textContent = `👤 ${user.email}`;
        headerEmail.classList.remove('hidden');
      }
      if (headerLogout) {
        headerLogout.classList.remove('hidden');
      }
      if (bottomNav) {
        bottomNav.classList.remove('hidden');
      }
      this.switchTab('carnet');
      this.renderCarnet();
      this.checkAndTriggerReminders();
    } else {
      if (headerEmail) headerEmail.classList.add('hidden');
      if (headerLogout) headerLogout.classList.add('hidden');
      if (bottomNav) bottomNav.classList.add('hidden');
      this.switchTab('auth');
    }

    this.updateSupabaseStatus();
  }

  // Navigation entre les onglets
  setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-item');
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    document.querySelectorAll('[data-switch-tab]').forEach(el => {
      el.addEventListener('click', () => {
        const tab = el.getAttribute('data-switch-tab');
        this.switchTab(tab);
      });
    });

    // Bouton paramètres dans l'en-tête (roue crantée)
    document.getElementById('btn-header-settings')?.addEventListener('click', () => {
      this.switchTab('settings');
    });

    // Clic sur l'email dans l'en-tête ouvre les paramètres / compte
    document.getElementById('header-user-email')?.addEventListener('click', () => {
      this.switchTab('settings');
    });
  }

  switchTab(tab) {
    this.currentTab = tab;

    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    document.querySelectorAll('.view-container').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tab}`);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tab === 'carnet') {
      this.renderCarnet();
    } else if (tab === 'a-venir') {
      this.renderUpcoming();
    } else if (tab === 'classement') {
      this.renderRanking();
    } else if (tab === 'stats') {
      this.renderStatsTabs();
    } else if (tab === 'ajouter') {
      this.populateDatalists();
      this.initTagInputs('form-add');
    }
  }

  // Configuration de la recherche et filtres dans l'historique
  setupFiltersAndSearch() {
    const searchInput = document.getElementById('carnet-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderCarnet();
      });
    }

    const typeFilter = document.getElementById('carnet-filter-type');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        this.selectedTypeFilter = e.target.value;
        this.renderCarnet();
      });
    }

    const toggleViewBtn = document.getElementById('btn-toggle-view');
    if (toggleViewBtn) {
      toggleViewBtn.addEventListener('click', () => {
        const listEl = document.getElementById('carnet-list');
        const tableEl = document.getElementById('carnet-table-container');
        const isTable = tableEl.classList.contains('hidden');

        if (isTable) {
          tableEl.classList.remove('hidden');
          listEl.classList.add('hidden');
          toggleViewBtn.innerHTML = '📱 Vue Cartes';
          this.renderTable();
        } else {
          tableEl.classList.add('hidden');
          listEl.classList.remove('hidden');
          toggleViewBtn.innerHTML = '📋 Vue Tableau';
        }
      });
    }
  }

  renderYearPills() {
    const container = document.getElementById('carnet-year-pills');
    if (!container) return;

    const years = window.dataManager.getYearsList();
    let html = `
      <button class="pill-btn ${this.selectedYearFilter === 'all' ? 'active' : ''}" data-year="all">
        Tous (${window.dataManager.getAll().length})
      </button>
    `;

    years.forEach(y => {
      const count = window.dataManager.getAll().filter(e => (e.annee === y || (e.date && e.date.startsWith(y)))).length;
      html += `
        <button class="pill-btn ${this.selectedYearFilter === y ? 'active' : ''}" data-year="${y}">
          ${y} <span class="pill-count">${count}</span>
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedYearFilter = btn.getAttribute('data-year');
        this.renderYearPills();
        this.renderCarnet();
      });
    });
  }

  renderCarnet() {
    this.renderYearPills();
    this.populateTypeFilter();

    let items = window.dataManager.getAll();

    // Filtre année
    if (this.selectedYearFilter !== 'all') {
      items = items.filter(e => (e.annee === this.selectedYearFilter || (e.date && e.date.startsWith(this.selectedYearFilter))));
    }

    // Filtre type
    if (this.selectedTypeFilter !== 'all') {
      items = items.filter(e => (e.type || '').toLowerCase() === this.selectedTypeFilter.toLowerCase());
    }

    // Recherche texte
    if (this.searchQuery) {
      const q = this.searchQuery;
      items = items.filter(e => {
        return (
          (e.artistes && e.artistes.toLowerCase().includes(q)) ||
          (e.nom_evenement && e.nom_evenement.toLowerCase().includes(q)) ||
          (e.lieu && e.lieu.toLowerCase().includes(q)) ||
          (e.ville && e.ville.toLowerCase().includes(q)) ||
          (e.type && e.type.toLowerCase().includes(q)) ||
          (e.premiere_partie && e.premiere_partie.toLowerCase().includes(q)) ||
          (e.guests && e.guests.toLowerCase().includes(q)) ||
          (e.accompagnateurs && e.accompagnateurs.toLowerCase().includes(q)) ||
          (e.date && e.date.includes(q))
        );
      });
    }

    const countLabel = document.getElementById('carnet-count');
    if (countLabel) {
      countLabel.textContent = `${items.length} événement${items.length > 1 ? 's' : ''}`;
    }

    // Mise à jour du badge concerts à venir dans la navigation
    const upcomingCount = window.dataManager.getUpcomingConcerts().length;
    const badgeUpcoming = document.getElementById('nav-badge-upcoming');
    if (badgeUpcoming) {
      if (upcomingCount > 0) {
        badgeUpcoming.textContent = upcomingCount;
        badgeUpcoming.classList.remove('hidden');
      } else {
        badgeUpcoming.classList.add('hidden');
      }
    }

    const listContainer = document.getElementById('carnet-list');
    if (!listContainer) return;

    if (items.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="max-width: 520px; margin: 30px auto; background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 26px; text-align: center;">
          <div class="empty-icon">☁️</div>
          <h3 style="font-size: 1.25rem; margin-bottom: 8px;">Aucun concert dans Supabase</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 18px;">
            Vos données sont gérées dans le cloud sécurisé Supabase. Si vous venez de créer votre projet, assurez-vous d'avoir exécuté le script SQL fourni dans Supabase.
          </p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button class="btn btn-primary" id="btn-empty-refresh-supabase">
              🔄 Actualiser depuis Supabase
            </button>
            <button class="btn btn-secondary" id="btn-empty-upload-csv">
              📂 Envoyer concerts_cleaned.csv vers Supabase
            </button>
            <button class="btn btn-secondary" data-switch-tab="ajouter">
              ➕ Saisir un concert manuellement
            </button>
          </div>
        </div>
      `;
      listContainer.querySelector('[data-switch-tab]')?.addEventListener('click', () => this.switchTab('ajouter'));
      listContainer.querySelector('#btn-empty-refresh-supabase')?.addEventListener('click', async () => {
        await window.dataManager.loadFromSupabase();
        this.renderCarnet();
        this.populateDatalists();
        this.updateSupabaseStatus();
      });
      listContainer.querySelector('#btn-empty-upload-csv')?.addEventListener('click', () => {
        document.getElementById('input-import-csv')?.click();
      });
      return;
    }

    let html = '';
    items.forEach(e => {
      const dateFormatted = this.formatDate(e.date);
      const costFormatted = (e.cout_total || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

      const artists = e.artistes || 'Artiste inconnu';
      const eventName = e.nom_evenement ? `<div class="card-event-name">${this.escape(e.nom_evenement)}</div>` : '';
      const location = [e.lieu, e.ville].filter(Boolean).join(', ') || (e.pays || '');
      const ratingBadge = (e.note && e.note >= 1) ? `<span class="badge-rating" title="Note : ${e.note}/5">★ ${e.note}/5</span>` : '';

      let companionsBadges = '';
      if (e.accompagnateurs) {
        companionsBadges = e.accompagnateurs.split(',').map(c => `<span class="chip-sm">👥 ${this.escape(c.trim())}</span>`).join(' ');
      }

      html += `
        <div class="concert-card" data-id="${e.id}">
          <div class="card-header">
            <div class="card-tags">
              <span class="badge badge-date">${dateFormatted}</span>
              <span class="badge badge-type">${this.escape(e.type || 'Concert')}</span>
              <span class="badge badge-placement">${this.escape(e.placement || 'Fosse')}</span>
              ${ratingBadge}
            </div>
            <div class="card-cost">${costFormatted}</div>
          </div>

          <div class="card-body">
            <h3 class="card-title">${this.escape(artists)}</h3>
            ${eventName}
            ${location ? `<div class="card-location">📍 ${this.escape(location)}</div>` : ''}
            ${companionsBadges ? `<div class="card-companions">${companionsBadges}</div>` : ''}
          </div>

          <!-- Section détails pliables -->
          <div class="card-details hidden" id="details-${e.id}">
            <div class="details-grid">
              ${e.premiere_partie ? `<div><span class="detail-label">Première partie :</span> ${this.escape(e.premiere_partie)}</div>` : ''}
              ${e.guests ? `<div><span class="detail-label">Guest(s) :</span> ${this.escape(e.guests)}</div>` : ''}
              <div><span class="detail-label">Billet :</span> ${this.escape(e.billet_paye || 'Oui')} ${e.prix_billet_inconnu ? '(prix inconnu)' : (e.prix_billet ? `(${e.prix_billet} €)` : '')}</div>
              <div><span class="detail-label">Transport :</span> ${e.transport_inconnu ? 'Inconnu' : (e.transport !== null ? `${e.transport} €` : '0 €')}</div>
              <div><span class="detail-label">Logement :</span> ${e.logement_inconnu ? 'Inconnu' : (e.logement !== null ? `${e.logement} €` : '0 €')}</div>
              <div><span class="detail-label">Merch :</span> ${e.merch_inconnu ? 'Inconnu' : (e.merch !== null ? `${e.merch} €` : '0 €')} ${e.articles_merch ? `(${this.escape(e.articles_merch)})` : ''}</div>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-action btn-toggle-details" data-id="${e.id}">
              ℹ️ Détails
            </button>
            <div class="action-right">
              <button class="btn-action btn-edit" data-id="${e.id}">
                ✏️ Modifier
              </button>
              <button class="btn-action btn-delete" data-id="${e.id}">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;

    listContainer.querySelectorAll('.btn-toggle-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const detailsEl = document.getElementById(`details-${id}`);
        if (detailsEl) {
          const isHidden = detailsEl.classList.toggle('hidden');
          btn.innerHTML = isHidden ? 'ℹ️ Détails' : '▲ Réduire';
        }
      });
    });

    listContainer.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.openEditModal(id);
      });
    });

    listContainer.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        this.confirmDelete(id);
      });
    });
  }

  renderTable() {
    const tableBody = document.getElementById('carnet-table-body');
    if (!tableBody) return;

    let items = window.dataManager.getAll();
    if (this.selectedYearFilter !== 'all') {
      items = items.filter(e => (e.annee === this.selectedYearFilter || (e.date && e.date.startsWith(this.selectedYearFilter))));
    }

    let html = '';
    items.forEach(e => {
      html += `
        <tr>
          <td>${this.escape(e.date || '')}</td>
          <td><strong>${this.escape(e.artistes || '')}</strong></td>
          <td>${this.escape(e.type || '')}</td>
          <td>${this.escape(e.lieu || '')}</td>
          <td>${this.escape(e.ville || '')}</td>
          <td>${this.escape(e.placement || '')}</td>
          <td>${(e.cout_total || 0).toFixed(2)} €</td>
          <td>
            <button class="btn-table-edit" data-id="${e.id}">✏️</button>
            <button class="btn-table-del" data-id="${e.id}">🗑️</button>
          </td>
        </tr>
      `;
    });

    tableBody.innerHTML = html;

    tableBody.querySelectorAll('.btn-table-edit').forEach(b => {
      b.addEventListener('click', () => this.openEditModal(b.getAttribute('data-id')));
    });
    tableBody.querySelectorAll('.btn-table-del').forEach(b => {
      b.addEventListener('click', () => this.confirmDelete(b.getAttribute('data-id')));
    });
  }

  populateTypeFilter() {
    const select = document.getElementById('carnet-filter-type');
    if (!select || select.options.length > 1) return;

    const types = window.dataManager.getUniqueValues('type');
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      select.appendChild(opt);
    });
  }

  // Configuration du formulaire d'ajout
  setupAddForm() {
    const form = document.getElementById('form-add-concert');
    if (!form) return;

    const dateInput = document.getElementById('add-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    const costInputs = [
      'add-billet-paye', 'add-prix-billet', 'add-cb-billet-inc',
      'add-prix-trans', 'add-cb-trans-inc',
      'add-prix-log', 'add-cb-log-inc',
      'add-prix-merch', 'add-cb-merch-inc'
    ];

    costInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateLiveCost('add'));
        el.addEventListener('change', () => this.updateLiveCost('add'));
      }
    });

    this.setupUnknownToggle('add-cb-billet-inc', 'add-prix-billet', 'add');
    this.setupUnknownToggle('add-cb-trans-inc', 'add-prix-trans', 'add');
    this.setupUnknownToggle('add-cb-log-inc', 'add-prix-log', 'add');
    this.setupUnknownToggle('add-cb-merch-inc', 'add-prix-merch', 'add');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAddSubmit();
    });

    this.initTagInputs('form-add');
  }

  setupUnknownToggle(cbId, inputId, prefix) {
    const cb = document.getElementById(cbId);
    const input = document.getElementById(inputId);
    if (!cb || !input) return;

    cb.addEventListener('change', () => {
      input.disabled = cb.checked;
      if (cb.checked) {
        input.value = '';
      }
      this.updateLiveCost(prefix);
    });
  }

  updateLiveCost(prefix) {
    const billetPaye = document.getElementById(`${prefix}-billet-paye`)?.value || 'Oui';
    const billetInc = document.getElementById(`${prefix}-cb-billet-inc`)?.checked || false;
    const prixBillet = parseFloat(document.getElementById(`${prefix}-prix-billet`)?.value) || 0;

    const transInc = document.getElementById(`${prefix}-cb-trans-inc`)?.checked || false;
    const prixTrans = parseFloat(document.getElementById(`${prefix}-prix-trans`)?.value) || 0;

    const logInc = document.getElementById(`${prefix}-cb-log-inc`)?.checked || false;
    const prixLog = parseFloat(document.getElementById(`${prefix}-prix-log`)?.value) || 0;

    const merchInc = document.getElementById(`${prefix}-cb-merch-inc`)?.checked || false;
    const prixMerch = parseFloat(document.getElementById(`${prefix}-prix-merch`)?.value) || 0;

    let total = 0.0;
    if (billetPaye === 'Oui' && !billetInc) total += prixBillet;
    if (!transInc) total += prixTrans;
    if (!logInc) total += prixLog;
    if (!merchInc) total += prixMerch;

    const displayEl = document.getElementById(`${prefix}-total-live`);
    if (displayEl) {
      displayEl.textContent = total.toFixed(2) + ' €';
    }
  }

  async handleAddSubmit() {
    const artistes = this.getTagValues('add-tags-artistes');
    if (!artistes || artistes.length === 0) {
      this.showToast('Veuillez renseigner au moins un artiste principal.', 'error');
      document.getElementById('add-input-artistes')?.focus();
      return;
    }

    const dateVal = document.getElementById('add-date')?.value || new Date().toISOString().split('T')[0];
    const typeVal = document.getElementById('add-type')?.value || 'Concert';
    const nomEventVal = document.getElementById('add-nom-event')?.value.trim() || '';
    const openersVal = this.getTagValues('add-tags-openers').join(', ');
    const guestsVal = this.getTagValues('add-tags-guests').join(', ');
    const lieuVal = document.getElementById('add-lieu')?.value.trim() || '';
    const villeVal = document.getElementById('add-ville')?.value.trim() || 'Paris';
    const paysVal = document.getElementById('add-pays')?.value.trim() || 'France';

    const billetPaye = document.getElementById('add-billet-paye')?.value || 'Oui';
    const billetInc = document.getElementById('add-cb-billet-inc')?.checked || false;
    const prixBillet = billetInc ? null : document.getElementById('add-prix-billet')?.value;

    const transInc = document.getElementById('add-cb-trans-inc')?.checked || false;
    const prixTrans = transInc ? null : document.getElementById('add-prix-trans')?.value;

    const logInc = document.getElementById('add-cb-log-inc')?.checked || false;
    const prixLog = logInc ? null : document.getElementById('add-prix-log')?.value;

    const merchInc = document.getElementById('add-cb-merch-inc')?.checked || false;
    const prixMerch = merchInc ? null : document.getElementById('add-prix-merch')?.value;

    const merchArticlesVal = this.getTagValues('add-tags-merch').join(', ');
    const accompagnateursVal = this.getTagValues('add-tags-acc').join(', ');
    const placementVal = document.getElementById('add-placement')?.value || 'Fosse';
    const noteVal = document.getElementById('add-note')?.value;

    const newConcert = {
      date: dateVal,
      type: typeVal,
      nom_evenement: nomEventVal,
      artistes: artistes.join(', '),
      premiere_partie: openersVal,
      guests: guestsVal,
      lieu: lieuVal,
      ville: villeVal,
      pays: paysVal,
      billet_paye: billetPaye,
      prix_billet_inconnu: billetInc,
      prix_billet: prixBillet,
      transport_inconnu: transInc,
      transport: prixTrans,
      logement_inconnu: logInc,
      logement: prixLog,
      merch_inconnu: merchInc,
      merch: prixMerch,
      articles_merch: merchArticlesVal,
      accompagnateurs: accompagnateursVal,
      placement: placementVal,
      note: (noteVal !== '' && noteVal !== null && noteVal !== undefined) ? Number(noteVal) : null
    };

    try {
      await window.dataManager.add(newConcert);
      this.showToast(`Événement avec ${artistes.join(', ')} enregistré dans Supabase !`, 'success');
      this.resetAddForm();
      this.switchTab('carnet');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  resetAddForm() {
    const form = document.getElementById('form-add-concert');
    if (form) form.reset();

    const dateInput = document.getElementById('add-date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    ['artistes', 'openers', 'guests', 'merch', 'acc'].forEach(key => {
      this.clearTags(`add-tags-${key}`);
    });

    this.setStarRatingWidget('add-star-rating-box', null);
    this.updateLiveCost('add');
    this.populateDatalists();
  }

  initTagInputs(scope) {
    const configs = [
      { id: `${scope === 'form-add' ? 'add' : 'edit'}-tags-artistes`, inputId: `${scope === 'form-add' ? 'add' : 'edit'}-input-artistes`, field: 'artistes' },
      { id: `${scope === 'form-add' ? 'add' : 'edit'}-tags-openers`, inputId: `${scope === 'form-add' ? 'add' : 'edit'}-input-openers`, field: 'premiere_partie' },
      { id: `${scope === 'form-add' ? 'add' : 'edit'}-tags-guests`, inputId: `${scope === 'form-add' ? 'add' : 'edit'}-input-guests`, field: 'guests' },
      { id: `${scope === 'form-add' ? 'add' : 'edit'}-tags-merch`, inputId: `${scope === 'form-add' ? 'add' : 'edit'}-input-merch`, field: 'articles_merch' },
      { id: `${scope === 'form-add' ? 'add' : 'edit'}-tags-acc`, inputId: `${scope === 'form-add' ? 'add' : 'edit'}-input-acc`, field: 'accompagnateurs' }
    ];

    configs.forEach(cfg => {
      const container = document.getElementById(cfg.id);
      const input = document.getElementById(cfg.inputId);
      if (!container || !input) return;

      if (!this.activeTagInputs[cfg.id]) {
        this.activeTagInputs[cfg.id] = [];

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = input.value.trim().replace(/^,+|,+$/g, '');
            if (val) {
              this.addTag(cfg.id, val);
              input.value = '';
            }
          } else if (e.key === 'Backspace' && input.value === '' && this.activeTagInputs[cfg.id].length > 0) {
            this.removeTag(cfg.id, this.activeTagInputs[cfg.id].length - 1);
          }
        });

        const addBtn = container.parentElement?.querySelector('.btn-add-tag');
        if (addBtn) {
          addBtn.addEventListener('click', () => {
            const val = input.value.trim().replace(/^,+|,+$/g, '');
            if (val) {
              this.addTag(cfg.id, val);
              input.value = '';
            }
          });
        }
      }
    });
  }

  addTag(containerId, value) {
    if (!value || !value.trim()) return;
    const clean = value.trim();
    if (!this.activeTagInputs[containerId]) this.activeTagInputs[containerId] = [];

    if (!this.activeTagInputs[containerId].includes(clean)) {
      this.activeTagInputs[containerId].push(clean);
      this.renderTags(containerId);
    }
  }

  removeTag(containerId, index) {
    if (this.activeTagInputs[containerId]) {
      this.activeTagInputs[containerId].splice(index, 1);
      this.renderTags(containerId);
    }
  }

  setTags(containerId, arrayOrString) {
    let list = [];
    if (Array.isArray(arrayOrString)) {
      list = arrayOrString;
    } else if (typeof arrayOrString === 'string' && arrayOrString.trim()) {
      list = arrayOrString.split(',').map(s => s.trim()).filter(Boolean);
    }
    this.activeTagInputs[containerId] = list;
    this.renderTags(containerId);
  }

  clearTags(containerId) {
    this.activeTagInputs[containerId] = [];
    this.renderTags(containerId);
  }

  getTagValues(containerId) {
    return this.activeTagInputs[containerId] || [];
  }

  renderTags(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const input = container.querySelector('.tag-input');
    container.querySelectorAll('.tag-chip').forEach(c => c.remove());

    const values = this.activeTagInputs[containerId] || [];
    values.forEach((val, idx) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${this.escape(val)} <button type="button" class="btn-remove-tag" data-index="${idx}">×</button>`;
      chip.querySelector('.btn-remove-tag').addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeTag(containerId, idx);
      });
      container.insertBefore(chip, input);
    });
  }

  // Configuration Modal Modification
  setupEditModal() {
    const modal = document.getElementById('modal-edit');
    const closeBtn = document.getElementById('btn-close-edit');
    const form = document.getElementById('form-edit-concert');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeEditModal());
    }

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeEditModal();
      });
    }

    this.setupUnknownToggle('edit-cb-billet-inc', 'edit-prix-billet', 'edit');
    this.setupUnknownToggle('edit-cb-trans-inc', 'edit-prix-trans', 'edit');
    this.setupUnknownToggle('edit-cb-log-inc', 'edit-prix-log', 'edit');
    this.setupUnknownToggle('edit-cb-merch-inc', 'edit-prix-merch', 'edit');

    const costInputs = [
      'edit-billet-paye', 'edit-prix-billet', 'edit-cb-billet-inc',
      'edit-prix-trans', 'edit-cb-trans-inc',
      'edit-prix-log', 'edit-cb-log-inc',
      'edit-prix-merch', 'edit-cb-merch-inc'
    ];

    costInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateLiveCost('edit'));
        el.addEventListener('change', () => this.updateLiveCost('edit'));
      }
    });

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleEditSubmit();
      });
    }
  }

  openEditModal(id) {
    const item = window.dataManager.getById(id);
    if (!item) return;

    this.editingId = id;
    this.initTagInputs('form-edit');

    document.getElementById('edit-id').value = item.id;
    document.getElementById('edit-date').value = item.date || '';
    document.getElementById('edit-type').value = item.type || 'Concert';
    document.getElementById('edit-nom-event').value = item.nom_evenement || '';

    this.setTags('edit-tags-artistes', item.artistes || '');
    this.setTags('edit-tags-openers', item.premiere_partie || '');
    this.setTags('edit-tags-guests', item.guests || '');

    document.getElementById('edit-lieu').value = item.lieu || '';
    document.getElementById('edit-ville').value = item.ville || '';
    document.getElementById('edit-pays').value = item.pays || 'France';

    document.getElementById('edit-billet-paye').value = item.billet_paye || 'Oui';
    const bInc = Boolean(item.prix_billet_inconnu);
    document.getElementById('edit-cb-billet-inc').checked = bInc;
    const pBillet = document.getElementById('edit-prix-billet');
    pBillet.disabled = bInc;
    pBillet.value = bInc ? '' : (item.prix_billet !== null ? item.prix_billet : '');

    const tInc = Boolean(item.transport_inconnu);
    document.getElementById('edit-cb-trans-inc').checked = tInc;
    const pTrans = document.getElementById('edit-prix-trans');
    pTrans.disabled = tInc;
    pTrans.value = tInc ? '' : (item.transport !== null ? item.transport : '');

    const lInc = Boolean(item.logement_inconnu);
    document.getElementById('edit-cb-log-inc').checked = lInc;
    const pLog = document.getElementById('edit-prix-log');
    pLog.disabled = lInc;
    pLog.value = lInc ? '' : (item.logement !== null ? item.logement : '');

    const mInc = Boolean(item.merch_inconnu);
    document.getElementById('edit-cb-merch-inc').checked = mInc;
    const pMerch = document.getElementById('edit-prix-merch');
    pMerch.disabled = mInc;
    pMerch.value = mInc ? '' : (item.merch !== null ? item.merch : '');

    this.setTags('edit-tags-merch', item.articles_merch || '');
    this.setTags('edit-tags-acc', item.accompagnateurs || '');

    document.getElementById('edit-placement').value = item.placement || 'Fosse';

    this.setStarRatingWidget('edit-star-rating-box', item.note || null);
    this.updateLiveCost('edit');

    const modal = document.getElementById('modal-edit');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  closeEditModal() {
    const modal = document.getElementById('modal-edit');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    this.editingId = null;
  }

  async handleEditSubmit() {
    if (!this.editingId) return;

    const artistes = this.getTagValues('edit-tags-artistes');
    if (!artistes || artistes.length === 0) {
      this.showToast('Veuillez renseigner au moins un artiste principal.', 'error');
      return;
    }

    const dateVal = document.getElementById('edit-date')?.value;
    const typeVal = document.getElementById('edit-type')?.value;
    const nomEventVal = document.getElementById('edit-nom-event')?.value.trim();
    const openersVal = this.getTagValues('edit-tags-openers').join(', ');
    const guestsVal = this.getTagValues('edit-tags-guests').join(', ');
    const lieuVal = document.getElementById('edit-lieu')?.value.trim();
    const villeVal = document.getElementById('edit-ville')?.value.trim();
    const paysVal = document.getElementById('edit-pays')?.value.trim();

    const billetPaye = document.getElementById('edit-billet-paye')?.value;
    const billetInc = document.getElementById('edit-cb-billet-inc')?.checked;
    const prixBillet = billetInc ? null : document.getElementById('edit-prix-billet')?.value;

    const transInc = document.getElementById('edit-cb-trans-inc')?.checked;
    const prixTrans = transInc ? null : document.getElementById('edit-prix-trans')?.value;

    const logInc = document.getElementById('edit-cb-log-inc')?.checked;
    const prixLog = logInc ? null : document.getElementById('edit-prix-log')?.value;

    const merchInc = document.getElementById('edit-cb-merch-inc')?.checked;
    const prixMerch = merchInc ? null : document.getElementById('edit-prix-merch')?.value;

    const merchArticlesVal = this.getTagValues('edit-tags-merch').join(', ');
    const accompagnateursVal = this.getTagValues('edit-tags-acc').join(', ');
    const placementVal = document.getElementById('edit-placement')?.value;
    const noteVal = document.getElementById('edit-note')?.value;

    try {
      await window.dataManager.update(this.editingId, {
        date: dateVal,
        type: typeVal,
        nom_evenement: nomEventVal,
        artistes: artistes.join(', '),
        premiere_partie: openersVal,
        guests: guestsVal,
        lieu: lieuVal,
        ville: villeVal,
        pays: paysVal,
        billet_paye: billetPaye,
        prix_billet_inconnu: billetInc,
        prix_billet: prixBillet,
        transport_inconnu: transInc,
        transport: prixTrans,
        logement_inconnu: logInc,
        logement: prixLog,
        merch_inconnu: merchInc,
        merch: prixMerch,
        articles_merch: merchArticlesVal,
        accompagnateurs: accompagnateursVal,
        placement: placementVal,
        note: (noteVal !== '' && noteVal !== null && noteVal !== undefined) ? Number(noteVal) : null
      });

      this.showToast('Concert modifié dans Supabase !', 'success');
      this.closeEditModal();
      this.renderCarnet();
      if (this.currentTab === 'a-venir') this.renderUpcoming();
      if (this.currentTab === 'classement') this.renderRanking();
      this.checkAndTriggerReminders();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async confirmDelete(id) {
    const item = window.dataManager.getById(id);
    if (!item) return;

    const nom = item.artistes || item.nom_evenement || 'cet événement';
    if (confirm(`Voulez-vous vraiment supprimer "${nom}" du ${item.date} ?`)) {
      try {
        await window.dataManager.delete(id);
        this.showToast('Concert supprimé de Supabase.', 'warning');
        this.renderCarnet();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    }
  }

  // Section Statistiques
  renderStatsTabs() {
    const container = document.getElementById('stats-period-pills');
    if (!container) return;

    const years = window.dataManager.getYearsList();
    let currentPeriod = window.statsManager.currentYear || 'Global';

    let html = `
      <button class="pill-btn ${currentPeriod === 'Global' ? 'active' : ''}" data-period="Global">
        Global (tout l'historique)
      </button>
    `;

    years.forEach(y => {
      html += `
        <button class="pill-btn ${currentPeriod === y ? 'active' : ''}" data-period="${y}">
          ${y}
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const period = btn.getAttribute('data-period');
        container.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b === btn));
        window.statsManager.render(period);
      });
    });

    window.statsManager.render(currentPeriod);
  }

  // Section Paramètres & Cloud Supabase
  setupSettings() {
    // 1. Bouton Actualiser depuis Supabase
    const refreshBtn = document.getElementById('btn-refresh-supabase');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳ Chargement...';
        try {
          const list = await window.dataManager.loadFromSupabase();
          this.renderCarnet();
          this.populateDatalists();
          this.updateSupabaseStatus();
          this.showToast(`${list.length} concerts synchronisés avec Supabase !`, 'success');
        } catch (e) {
          this.showToast('Erreur synchronisation Supabase', 'error');
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = '🔄 Synchroniser maintenant avec Supabase';
        }
      });
    }

    // 2. Bouton Importer CSV vers Supabase
    const inputCsv = document.getElementById('input-import-csv');
    const uploadCleanedBtn = document.getElementById('btn-upload-cleaned-supabase');
    if (uploadCleanedBtn && inputCsv) {
      uploadCleanedBtn.addEventListener('click', () => inputCsv.click());
      inputCsv.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (confirm(`Envoyer les concerts du fichier "${file.name}" directement dans Supabase ?`)) {
          uploadCleanedBtn.disabled = true;
          uploadCleanedBtn.textContent = '⏳ Envoi vers Supabase...';
          window.dataManager.importCSV(file)
            .then(res => {
              this.showToast(`${res.count} concerts enregistrés dans Supabase !`, 'success');
              this.renderCarnet();
              this.populateDatalists();
              inputCsv.value = '';
            })
            .catch(err => {
              this.showToast(`Erreur Supabase : ${err.message}`, 'error');
              inputCsv.value = '';
            })
            .finally(() => {
              uploadCleanedBtn.disabled = false;
              uploadCleanedBtn.textContent = '🚀 Envoyer concerts_cleaned.csv vers Supabase';
            });
        }
      });
    }

    // 3. Bouton Export CSV
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        window.dataManager.exportCSV();
        this.showToast('Téléchargement du CSV démarré !', 'success');
      });
    }
  }

  // Modal Auth Supabase (Connexion / Inscription)
  setupSupabaseAuthModal() {
    const modal = document.getElementById('modal-supabase-auth');
    const openBtn1 = document.getElementById('btn-open-supabase-auth');
    const openBtn2 = document.getElementById('btn-supabase-status');
    const closeBtn = document.getElementById('btn-close-supabase-auth');
    const form = document.getElementById('form-supabase-login');
    const signupBtn = document.getElementById('btn-auth-signup');
    const logoutBtn = document.getElementById('btn-supabase-logout');

    const openModal = () => {
      if (modal) {
        modal.classList.remove('hidden');
        this.updateAuthModalView();
      }
    };

    if (openBtn1) openBtn1.addEventListener('click', openModal);
    if (openBtn2) openBtn2.addEventListener('click', openModal);
    if (closeBtn && modal) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // Connexion
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('input-auth-email')?.value.trim();
        const password = document.getElementById('input-auth-password')?.value;
        const signinBtn = document.getElementById('btn-auth-signin');

        if (signinBtn) {
          signinBtn.disabled = true;
          signinBtn.textContent = 'Connexion...';
        }

        try {
          const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
          if (error) throw error;

          modal.classList.add('hidden');
          this.showToast('Connectée avec succès à Supabase !', 'success');
          await window.dataManager.loadFromSupabase();
          this.renderCarnet();
          this.updateSupabaseStatus();
        } catch (err) {
          this.showToast(`Erreur : ${err.message}`, 'error');
        } finally {
          if (signinBtn) {
            signinBtn.disabled = false;
            signinBtn.textContent = 'Se connecter';
          }
        }
      });
    }

    // Inscription
    if (signupBtn) {
      signupBtn.addEventListener('click', async () => {
        const email = document.getElementById('input-auth-email')?.value.trim();
        const password = document.getElementById('input-auth-password')?.value;

        if (!email || !password) {
          this.showToast('Veuillez renseigner un email et un mot de passe (min 6 car.)', 'warning');
          return;
        }

        signupBtn.disabled = true;
        signupBtn.textContent = 'Création...';

        try {
          const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
          if (error) throw error;

          this.showToast('Compte créé ! Vérifiez votre email pour confirmer si requis.', 'success');
          modal.classList.add('hidden');
          this.updateSupabaseStatus();
        } catch (err) {
          this.showToast(`Erreur création compte : ${err.message}`, 'error');
        } finally {
          signupBtn.disabled = false;
          signupBtn.textContent = 'Créer un compte';
        }
      });
    }

    // Déconnexion
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await window.supabaseClient.auth.signOut();
          modal.classList.add('hidden');
          this.showToast('Déconnectée de Supabase.', 'info');
          this.updateUserSessionState();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // Déconnexion depuis l'en-tête
    const headerLogoutBtn = document.getElementById('btn-header-logout');
    if (headerLogoutBtn) {
      headerLogoutBtn.addEventListener('click', async () => {
        if (confirm('Voulez-vous vous déconnecter ?')) {
          await window.supabaseClient.auth.signOut();
          this.showToast('Déconnectée.', 'info');
          this.updateUserSessionState();
        }
      });
    }
  }

  // Écran d'authentification principal (Accès réservé par utilisateur)
  setupMainAuthScreen() {
    const form = document.getElementById('form-auth-screen');
    const toggleBtn = document.getElementById('btn-auth-screen-toggle');
    const submitBtn = document.getElementById('btn-auth-screen-submit');
    const desc = document.getElementById('auth-screen-desc');
    let isSignupMode = false;

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        isSignupMode = !isSignupMode;
        if (isSignupMode) {
          submitBtn.textContent = 'Créer mon compte';
          toggleBtn.textContent = 'J\'ai déjà un compte (Se connecter)';
          if (desc) desc.textContent = 'Créez votre compte pour démarrer votre carnet de concerts sécurisé.';
        } else {
          submitBtn.textContent = 'Se connecter';
          toggleBtn.textContent = 'Créer un nouveau compte';
          if (desc) desc.textContent = 'Connectez-vous pour accéder à votre carnet personnel et sécurisé.';
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-screen-email')?.value.trim();
        const password = document.getElementById('auth-screen-password')?.value;

        if (!email || !password) return;

        submitBtn.disabled = true;
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Patientez...';

        try {
          if (isSignupMode) {
            const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
            if (error) throw error;
            this.showToast('Compte créé avec succès !', 'success');
            // Si session automatique créée
            if (data.session) {
              window.dataManager.currentUser = data.user;
              await window.dataManager.loadFromSupabase();
              this.updateUserSessionState();
            } else {
              this.showToast('Compte créé ! Vous pouvez maintenant vous connecter.', 'info');
              toggleBtn.click();
            }
          } else {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.dataManager.currentUser = data.user;
            await window.dataManager.loadFromSupabase();
            this.updateUserSessionState();
            this.showToast(`Bienvenue ${email} !`, 'success');
          }
        } catch (err) {
          this.showToast(`Erreur : ${err.message}`, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    }
  }

  updateAuthModalView() {
    const loggedInView = document.getElementById('auth-logged-in-view');
    const loggedOutView = document.getElementById('auth-logged-out-view');
    const userBadge = document.getElementById('auth-user-email-badge');

    if (window.dataManager.currentUser) {
      if (loggedInView) loggedInView.classList.remove('hidden');
      if (loggedOutView) loggedOutView.classList.add('hidden');
      if (userBadge) userBadge.textContent = window.dataManager.currentUser.email;
    } else {
      if (loggedInView) loggedInView.classList.add('hidden');
      if (loggedOutView) loggedOutView.classList.remove('hidden');
    }
  }

  updateSupabaseStatus() {
    const badge = document.getElementById('supabase-status-badge');
    const userDisplay = document.getElementById('supabase-user-display');
    const headerBtn = document.getElementById('btn-supabase-status');

    const isConnected = window.dataManager.supabaseConnected;
    const user = window.dataManager.currentUser;

    if (badge) {
      if (isConnected) {
        badge.textContent = `🟢 Connecté (${window.dataManager.getAll().length} concerts)`;
        badge.style.color = '#34d399';
      } else {
        badge.textContent = `⚪ Non connecté / En attente`;
        badge.style.color = '#94a3b8';
      }
    }

    if (userDisplay) {
      if (user) {
        userDisplay.innerHTML = `<strong>Compte :</strong> ${this.escape(user.email)} (Sécurisé RLS)`;
      } else {
        userDisplay.innerHTML = `<strong>Compte :</strong> Mode Clé Publishable`;
      }
    }

    if (headerBtn) {
      headerBtn.style.color = isConnected ? '#34d399' : '#94a3b8';
    }
  }

  populateDatalists() {
    this.fillDatalist('dl-types', TYPES_EVENT_DEFAUT.concat(window.dataManager.getUniqueValues('type')));
    this.fillDatalist('dl-lieux', window.dataManager.getUniqueValues('lieu'));
    this.fillDatalist('dl-villes', window.dataManager.getUniqueValues('ville'));
    this.fillDatalist('dl-pays', ['France', 'Belgique', 'Suisse', 'Royaume-Uni', 'Allemagne'].concat(window.dataManager.getUniqueValues('pays')));
    this.fillDatalist('dl-artistes', window.dataManager.getUniqueValues('artistes', true));
    this.fillDatalist('dl-merch', window.dataManager.getUniqueValues('articles_merch', true));
    this.fillDatalist('dl-acc', window.dataManager.getUniqueValues('accompagnateurs', true));
  }

  fillDatalist(id, values) {
    const dl = document.getElementById(id);
    if (!dl) return;
    const unique = Array.from(new Set(values.map(v => v.trim()).filter(Boolean))).sort();
    dl.innerHTML = unique.map(v => `<option value="${this.escape(v)}">`).join('');
  }

  setupInstallPrompt() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    const banner = document.getElementById('ios-install-banner');
    if (banner) {
      if (isIOS && !isStandalone) {
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }

      document.getElementById('btn-close-banner')?.addEventListener('click', () => {
        banner.classList.add('hidden');
      });
    }

    const openGuideBtn = document.getElementById('btn-open-install-guide');
    const modalGuide = document.getElementById('modal-install-guide');
    const closeGuideBtn = document.getElementById('btn-close-guide');

    if (openGuideBtn && modalGuide) {
      openGuideBtn.addEventListener('click', () => modalGuide.classList.remove('hidden'));
    }
    if (closeGuideBtn && modalGuide) {
      closeGuideBtn.addEventListener('click', () => modalGuide.classList.add('hidden'));
    }
    if (modalGuide) {
      modalGuide.addEventListener('click', (e) => {
        if (e.target === modalGuide) modalGuide.classList.add('hidden');
      });
    }
  }

  // =========================================================================
  // GESTION DES NOTES ET CLASSEMENT (1 à 5 étoiles)
  // =========================================================================
  setupStarRatings() {
    ['add', 'edit'].forEach(prefix => {
      const box = document.getElementById(`${prefix}-star-rating-box`);
      if (!box) return;

      const stars = box.querySelectorAll('.star-item');
      const clearBtn = document.getElementById(`${prefix}-btn-clear-rating`);

      stars.forEach(star => {
        star.addEventListener('click', () => {
          const val = Number(star.getAttribute('data-value'));
          this.setStarRatingWidget(`${prefix}-star-rating-box`, val);
        });
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          this.setStarRatingWidget(`${prefix}-star-rating-box`, null);
        });
      }
    });
  }

  setStarRatingWidget(boxId, val) {
    const box = document.getElementById(boxId);
    if (!box) return;

    const prefix = boxId.startsWith('add') ? 'add' : 'edit';
    const stars = box.querySelectorAll('.star-item');
    const input = document.getElementById(`${prefix}-note`);
    const label = document.getElementById(`${prefix}-rating-label`);
    const clearBtn = document.getElementById(`${prefix}-btn-clear-rating`);

    const labelsMap = {
      1: '1 / 5 ★ Décevant',
      2: '2 / 5 ★★ Moyen',
      3: '3 / 5 ★★★ Bien',
      4: '4 / 5 ★★★★ Très bon',
      5: '5 / 5 ★★★★★ Exceptionnel !'
    };

    const num = (val !== null && val !== undefined && val !== '') ? Number(val) : null;
    if (input) input.value = num !== null ? num : '';

    stars.forEach(s => {
      const sVal = Number(s.getAttribute('data-value'));
      s.classList.toggle('active', num !== null && sVal <= num);
    });

    if (label) {
      label.textContent = num !== null ? (labelsMap[num] || `${num} / 5 ★`) : 'Non noté';
    }

    if (clearBtn) {
      clearBtn.classList.toggle('hidden', num === null);
    }
  }

  setupRankingFilters() {
    this.rankingFilter = 'all';
    const pills = document.querySelectorAll('#ranking-filter-pills .pill');
    pills.forEach(p => {
      p.addEventListener('click', () => {
        pills.forEach(btn => btn.classList.remove('active'));
        p.classList.add('active');
        this.rankingFilter = p.getAttribute('data-filter') || 'all';
        this.renderRanking();
      });
    });
  }

  renderRanking() {
    const allEvents = window.dataManager.getAll();
    const ratedEvents = allEvents.filter(e => e.note && e.note >= 1 && e.note <= 5);

    // 1. KPI Stats du classement
    const countEl = document.getElementById('ranking-rated-count');
    const avgEl = document.getElementById('ranking-avg-score');

    if (countEl) countEl.textContent = ratedEvents.length;
    if (avgEl) {
      if (ratedEvents.length > 0) {
        const sum = ratedEvents.reduce((acc, curr) => acc + curr.note, 0);
        const avg = (sum / ratedEvents.length).toFixed(1);
        avgEl.textContent = `${avg} ★ / 5`;
      } else {
        avgEl.textContent = `- / 5`;
      }
    }

    // 2. Podium des 3 Meilleurs Concerts (1er, 2e, 3e)
    const podiumContainer = document.getElementById('podium-container');
    if (podiumContainer) {
      const top3 = [...ratedEvents].sort((a, b) => {
        if (b.note !== a.note) return b.note - a.note;
        return (b.date || '').localeCompare(a.date || '');
      }).slice(0, 3);

      if (top3.length === 0) {
        podiumContainer.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 22px 10px; width: 100%;">
            ⭐ Aucun concert noté pour l'instant.<br>Attribuez vos étoiles ci-dessous pour composer votre podium !
          </div>
        `;
      } else {
        let podiumHtml = '';

        // 2e Place (Silver)
        if (top3[1]) {
          const c2 = top3[1];
          podiumHtml += `
            <div class="podium-col silver">
              <div class="podium-card" data-id="${c2.id}">
                <div class="podium-medal">🥈</div>
                <strong class="podium-artist" title="${this.escape(c2.artistes)}">${this.escape(c2.artistes)}</strong>
                <div class="podium-score">${'★'.repeat(c2.note)}</div>
                <div class="podium-date">${this.formatDate(c2.date)}</div>
              </div>
            </div>
          `;
        } else {
          podiumHtml += `<div class="podium-col silver"></div>`;
        }

        // 1ère Place (Gold)
        const c1 = top3[0];
        podiumHtml += `
          <div class="podium-col gold">
            <div class="podium-card" data-id="${c1.id}">
              <div class="podium-medal">🥇</div>
              <strong class="podium-artist" title="${this.escape(c1.artistes)}">${this.escape(c1.artistes)}</strong>
              <div class="podium-score">${'★'.repeat(c1.note)}</div>
              <div class="podium-date">${this.formatDate(c1.date)}</div>
            </div>
          </div>
        `;

        // 3e Place (Bronze)
        if (top3[2]) {
          const c3 = top3[2];
          podiumHtml += `
            <div class="podium-col bronze">
              <div class="podium-card" data-id="${c3.id}">
                <div class="podium-medal">🥉</div>
                <strong class="podium-artist" title="${this.escape(c3.artistes)}">${this.escape(c3.artistes)}</strong>
                <div class="podium-score">${'★'.repeat(c3.note)}</div>
                <div class="podium-date">${this.formatDate(c3.date)}</div>
              </div>
            </div>
          `;
        } else {
          podiumHtml += `<div class="podium-col bronze"></div>`;
        }

        podiumContainer.innerHTML = podiumHtml;

        podiumContainer.querySelectorAll('.podium-card').forEach(card => {
          card.addEventListener('click', () => {
            const id = card.getAttribute('data-id');
            if (id) this.openEditModal(id);
          });
        });
      }
    }

    // 3. Liste ordonnée selon filtre
    const listContainer = document.getElementById('ranked-list');
    if (!listContainer) return;

    const filtered = window.dataManager.getRankedConcerts(this.rankingFilter || 'all');

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state" style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
          Aucun concert correspondant à ce filtre.
        </div>
      `;
      return;
    }

    let listHtml = '';
    filtered.forEach((c, idx) => {
      const pos = idx + 1;
      const posClass = pos === 1 ? 'top-1' : (pos === 2 ? 'top-2' : (pos === 3 ? 'top-3' : ''));
      const artists = c.artistes || 'Artiste inconnu';
      const loc = [c.lieu, c.ville].filter(Boolean).join(', ');

      let starsHtml = `<div class="star-rating-widget" data-rate-id="${c.id}">`;
      for (let s = 1; s <= 5; s++) {
        const active = (c.note && s <= c.note) ? 'active' : '';
        starsHtml += `<span class="star-item ${active}" data-star-val="${s}">★</span>`;
      }
      starsHtml += `</div>`;

      listHtml += `
        <div class="ranked-item-card" data-id="${c.id}">
          <div class="ranked-position ${posClass}">#${pos}</div>
          <div class="ranked-item-info">
            <div class="ranked-item-artist">${this.escape(artists)}</div>
            <div class="ranked-item-meta">${this.formatDate(c.date)} ${loc ? `• ${this.escape(loc)}` : ''}</div>
          </div>
          <div class="ranked-item-rating">
            ${starsHtml}
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = listHtml;

    // Modification de la note en un clic directement depuis le classement
    listContainer.querySelectorAll('.star-item').forEach(star => {
      star.addEventListener('click', async (e) => {
        e.stopPropagation();
        const parentWidget = star.closest('[data-rate-id]');
        const concertId = parentWidget.getAttribute('data-rate-id');
        const newScore = Number(star.getAttribute('data-star-val'));

        const currentItem = window.dataManager.getById(concertId);
        const finalScore = (currentItem && currentItem.note === newScore) ? null : newScore;

        try {
          await window.dataManager.rateConcert(concertId, finalScore);
          if (finalScore) {
            this.showToast(`Note de ${finalScore}★ enregistrée !`, 'success');
          } else {
            this.showToast('Note retirée.', 'warning');
          }
          this.renderRanking();
          this.renderCarnet();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    });

    listContainer.querySelectorAll('.ranked-item-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.star-rating-widget')) return;
        const id = card.getAttribute('data-id');
        if (id) this.openEditModal(id);
      });
    });
  }

  // =========================================================================
  // GESTION DES NOTIFICATIONS ET RAPPELS DE CONCERTS
  // =========================================================================
  setupNotifications() {
    const notifBox = document.getElementById('notif-permission-box');
    const btnEnable = document.getElementById('btn-enable-notifications');

    if (!('Notification' in window)) {
      if (notifBox) notifBox.classList.add('hidden');
      return;
    }

    if (Notification.permission === 'granted') {
      if (notifBox) notifBox.classList.add('hidden');
    }

    if (btnEnable) {
      btnEnable.addEventListener('click', async () => {
        try {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            this.showToast('🔔 Notifications activées avec succès !', 'success');
            if (notifBox) notifBox.classList.add('hidden');
            this.checkAndTriggerReminders(true);
          } else {
            this.showToast('Notifications refusées ou bloquées.', 'warning');
          }
        } catch (err) {
          console.warn('Erreur permission notification:', err);
        }
      });
    }
  }

  checkAndTriggerReminders(forceSystemNotif = false) {
    const banner = document.getElementById('app-reminder-banner');
    if (!banner || !window.dataManager) return;

    const today = new Date().toISOString().split('T')[0];

    // Date d'hier
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yesterday = yDate.toISOString().split('T')[0];

    const events = window.dataManager.getAll();

    // 1. Concert AUJOURD'HUI (Rappel avant concert)
    const todayConcert = events.find(e => e.date === today);
    if (todayConcert) {
      const artist = todayConcert.artistes || 'Votre artiste';
      const lieu = todayConcert.lieu ? ` au ${todayConcert.lieu}` : '';
      banner.className = 'reminder-banner day-of';
      banner.innerHTML = `
        <div class="reminder-banner-content" id="btn-banner-view-today">
          <span class="reminder-banner-icon">🎤</span>
          <div class="reminder-banner-text">
            <strong>JOUR J : Concert ce soir !</strong>
            <span>${this.escape(artist)}${this.escape(lieu)} — Préparez-vous à chanter !</span>
          </div>
        </div>
        <button class="btn-close-reminder" id="btn-close-reminder-banner" title="Fermer">✕</button>
      `;
      banner.classList.remove('hidden');

      document.getElementById('btn-banner-view-today')?.addEventListener('click', () => {
        this.switchTab('a-venir');
      });

      document.getElementById('btn-close-reminder-banner')?.addEventListener('click', (e) => {
        e.stopPropagation();
        banner.classList.add('hidden');
      });

      if (('Notification' in window) && Notification.permission === 'granted') {
        const notifKey = `notif_dayof_${todayConcert.id}_${today}`;
        if (!localStorage.getItem(notifKey) || forceSystemNotif) {
          try {
            new Notification(`🎤 Concert ce soir : ${artist} !`, {
              body: `C'est le grand jour${lieu} ! Prépare-toi pour une super soirée.`,
              icon: 'icons/apple-touch-icon.png'
            });
            localStorage.setItem(notifKey, 'true');
          } catch (err) {
            console.warn('Notification system non supportée ou silencieuse:', err);
          }
        }
      }
      return;
    }

    // 2. Concert HIER (Rappel lendemain pour noter / ajouter souvenirs)
    const yesterdayConcert = events.find(e => e.date === yesterday);
    if (yesterdayConcert) {
      const artist = yesterdayConcert.artistes || 'Votre concert';
      banner.className = 'reminder-banner day-after';
      banner.innerHTML = `
        <div class="reminder-banner-content" id="btn-banner-edit-yesterday">
          <span class="reminder-banner-icon">✨</span>
          <div class="reminder-banner-text">
            <strong>C'ÉTAIT HIER SOIR : ${this.escape(artist)}</strong>
            <span>Cliquez ici pour noter le concert et compléter vos souvenirs (guests, merch...).</span>
          </div>
        </div>
        <button class="btn-close-reminder" id="btn-close-reminder-banner" title="Fermer">✕</button>
      `;
      banner.classList.remove('hidden');

      document.getElementById('btn-banner-edit-yesterday')?.addEventListener('click', () => {
        this.openEditModal(yesterdayConcert.id);
      });

      document.getElementById('btn-close-reminder-banner')?.addEventListener('click', (e) => {
        e.stopPropagation();
        banner.classList.add('hidden');
      });

      if (('Notification' in window) && Notification.permission === 'granted') {
        const notifKey = `notif_dayafter_${yesterdayConcert.id}_${yesterday}`;
        if (!localStorage.getItem(notifKey) || forceSystemNotif) {
          try {
            new Notification(`✨ Souvenirs d'hier : ${artist}`, {
              body: `Alors, c'était comment ? Ouvre l'app pour donner ta note et renseigner les guests !`,
              icon: 'icons/apple-touch-icon.png'
            });
            localStorage.setItem(notifKey, 'true');
          } catch (err) {
            console.warn('Notification system non supportée ou silencieuse:', err);
          }
        }
      }
      return;
    }

    banner.classList.add('hidden');
  }

  // =========================================================================
  // GESTION DES CONCERTS À VENIR & COMPTE À REBOURS
  // =========================================================================
  renderUpcoming() {
    const heroContainer = document.getElementById('upcoming-hero-container');
    const listContainer = document.getElementById('upcoming-list');
    const countBadge = document.getElementById('upcoming-count');
    const navBadge = document.getElementById('nav-badge-upcoming');

    const upcoming = window.dataManager.getUpcomingConcerts();

    if (countBadge) countBadge.textContent = upcoming.length;
    if (navBadge) {
      if (upcoming.length > 0) {
        navBadge.textContent = upcoming.length;
        navBadge.classList.remove('hidden');
      } else {
        navBadge.classList.add('hidden');
      }
    }

    if (upcoming.length === 0) {
      if (heroContainer) {
        heroContainer.innerHTML = `
          <div class="empty-state" style="background: var(--surface-color); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); padding: 32px 20px;">
            <div class="empty-icon">⏳</div>
            <h3 style="font-size: 1.25rem; margin-bottom: 8px;">Aucun concert à venir</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px;">
              Vous n'avez aucun concert programmé pour les jours à venir. Ajoutez vos futurs billets pour déclencher le compte à rebours !
            </p>
            <button class="btn btn-primary" data-switch-tab="ajouter">
              ➕ Ajouter un concert à venir
            </button>
          </div>
        `;
        heroContainer.querySelector('[data-switch-tab]')?.addEventListener('click', () => this.switchTab('ajouter'));
      }
      if (listContainer) listContainer.innerHTML = '';
      return;
    }

    // 1. Prochain concert à la Une (Hero)
    const nextConcert = upcoming[0];
    const nextDateFormatted = this.formatFullFrenchDate(nextConcert.date);
    const location = [nextConcert.lieu, nextConcert.ville].filter(Boolean).join(', ') || nextConcert.pays || '';

    if (heroContainer) {
      heroContainer.innerHTML = `
        <div class="hero-upcoming-card">
          <div class="hero-top-badge-row">
            <span class="hero-pill-tag">🔥 Prochain Rendez-vous</span>
            <span class="hero-days-badge" id="hero-days-countdown" data-date="${nextConcert.date}">Calcul...</span>
          </div>

          <h2 class="hero-artist-name">${this.escape(nextConcert.artistes || 'Artiste inconnu')}</h2>
          ${nextConcert.nom_evenement ? `<div class="hero-event-name">${this.escape(nextConcert.nom_evenement)}</div>` : ''}

          <div class="hero-meta-grid">
            <div class="hero-meta-item">
              <span>📅</span>
              <span><strong>${nextDateFormatted}</strong></span>
            </div>
            ${location ? `
              <div class="hero-meta-item">
                <span>📍</span>
                <span>${this.escape(location)}</span>
              </div>
            ` : ''}
            <div class="hero-meta-item">
              <span>💺</span>
              <span>Placement : ${this.escape(nextConcert.placement || 'Fosse')}</span>
            </div>
          </div>

          <!-- Compte à rebours dynamique -->
          <div class="countdown-grid" data-hero-target="${nextConcert.date}">
            <div class="countdown-box">
              <span class="countdown-num" id="cd-hero-days">--</span>
              <span class="countdown-unit">Jours</span>
            </div>
            <div class="countdown-box">
              <span class="countdown-num" id="cd-hero-hours">--</span>
              <span class="countdown-unit">Heures</span>
            </div>
            <div class="countdown-box">
              <span class="countdown-num" id="cd-hero-mins">--</span>
              <span class="countdown-unit">Min</span>
            </div>
            <div class="countdown-box">
              <span class="countdown-num" id="cd-hero-secs">--</span>
              <span class="countdown-unit">Sec</span>
            </div>
          </div>

          <div class="hero-actions-row">
            <button class="btn btn-secondary btn-sm" id="btn-hero-edit" data-id="${nextConcert.id}">
              ✏️ Modifier / Compléter
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-hero-carnet" data-id="${nextConcert.id}">
              📋 Voir le carnet
            </button>
          </div>
        </div>
      `;

      heroContainer.querySelector('#btn-hero-edit')?.addEventListener('click', () => {
        this.openEditModal(nextConcert.id);
      });
      heroContainer.querySelector('#btn-hero-carnet')?.addEventListener('click', () => {
        this.switchTab('carnet');
      });
    }

    // 2. Autres concerts à venir
    const otherUpcoming = upcoming.slice(1);
    if (listContainer) {
      if (otherUpcoming.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; color: var(--text-dim); padding: 16px; font-size: 0.88rem;">
            Aucun autre concert programmé pour le moment.
          </div>
        `;
      } else {
        let listHtml = '';
        otherUpcoming.forEach(c => {
          const dFormatted = this.formatDate(c.date);
          const loc = [c.lieu, c.ville].filter(Boolean).join(', ');
          listHtml += `
            <div class="upcoming-item-card" data-id="${c.id}">
              <div class="upcoming-item-top">
                <div class="upcoming-item-artist">${this.escape(c.artistes || 'Artiste')}</div>
                <span class="upcoming-item-timer-badge" data-countdown-badge="${c.date}">Calcul...</span>
              </div>
              <div class="upcoming-item-meta">
                <div>📅 ${dFormatted}</div>
                ${loc ? `<div>📍 ${this.escape(loc)}</div>` : ''}
                <div>💺 ${this.escape(c.placement || 'Fosse')}</div>
              </div>
              <div class="upcoming-item-footer">
                <span class="chip-sm" style="font-size: 0.75rem;">🎫 ${this.escape(c.billet_paye || 'Oui')}</span>
                <button class="btn-action btn-edit-upcoming" data-id="${c.id}">
                  ✏️ Modifier
                </button>
              </div>
            </div>
          `;
        });
        listContainer.innerHTML = listHtml;

        listContainer.querySelectorAll('.btn-edit-upcoming').forEach(btn => {
          btn.addEventListener('click', () => {
            this.openEditModal(btn.getAttribute('data-id'));
          });
        });
      }
    }

    this.tickCountdowns();
  }

  formatFullFrenchDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {}
    return dateStr;
  }

  startCountdownTimer() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      this.tickCountdowns();
    }, 1000);
  }

  tickCountdowns() {
    const now = new Date();

    // 1. Hero Countdown
    const heroGrid = document.querySelector('[data-hero-target]');
    if (heroGrid) {
      const targetDateStr = heroGrid.getAttribute('data-hero-target');
      if (targetDateStr) {
        const targetTime = new Date(`${targetDateStr}T20:00:00`).getTime();
        const diff = targetTime - now.getTime();

        const daysEl = document.getElementById('cd-hero-days');
        const hoursEl = document.getElementById('cd-hero-hours');
        const minsEl = document.getElementById('cd-hero-mins');
        const secsEl = document.getElementById('cd-hero-secs');
        const heroDaysBadge = document.getElementById('hero-days-countdown');

        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);

          if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
          if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
          if (minsEl) minsEl.textContent = String(minutes).padStart(2, '0');
          if (secsEl) secsEl.textContent = String(seconds).padStart(2, '0');

          if (heroDaysBadge) {
            if (days === 0) heroDaysBadge.textContent = "Aujourd'hui ! 🎉";
            else if (days === 1) heroDaysBadge.textContent = "Demain ! ⏳";
            else heroDaysBadge.textContent = `Dans ${days} jours`;
          }
        } else {
          if (daysEl) daysEl.textContent = '00';
          if (hoursEl) hoursEl.textContent = '00';
          if (minsEl) minsEl.textContent = '00';
          if (secsEl) secsEl.textContent = '00';
          if (heroDaysBadge) heroDaysBadge.textContent = "Ce soir ! 🎉";
        }
      }
    }

    // 2. Badges des autres concerts à venir
    document.querySelectorAll('[data-countdown-badge]').forEach(badge => {
      const dateStr = badge.getAttribute('data-countdown-badge');
      if (dateStr) {
        const targetTime = new Date(`${dateStr}T20:00:00`).getTime();
        const diff = targetTime - now.getTime();
        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          if (days === 0) badge.textContent = `Ce soir (${hours}h)`;
          else if (days === 1) badge.textContent = `Demain (${hours}h)`;
          else badge.textContent = `J-${days}`;
        } else {
          badge.textContent = `Terminé`;
        }
      }
    });
  }

  checkStandaloneMode() {
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      document.body.classList.add('pwa-standalone');
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    } catch (e) {}
    return dateStr;
  }

  escape(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ConcertsApp();
});
