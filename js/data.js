// DataManager - Gestion des données de concerts (LocalStorage, Chiffrement AES-GCM, CSV, Calculs)

const STORAGE_KEY = 'mes_concerts_events_v2';
const SETTINGS_KEY = 'mes_concerts_settings_v2';

const CHOIX_PLACEMENT = [
  'Fosse',
  'Gradin',
  'Fosse assise',
  'Gradin puis fosse',
  'Festival / Debout extérieur',
  'Autre'
];

const CHOIX_PAIEMENT = [
  'Oui',
  'Non (invitation / cadeau)',
  'Pass Culture'
];

const TYPES_EVENT_DEFAUT = [
  'Concert',
  'Festival',
  'Showcase',
  'Plateau radio',
  'Co-plateau',
  'Comédie musicale',
  'Émission',
  'Dédicace',
  'Autre'
];

// Nettoie automatiquement les numéros entre parenthèses à la fin des noms d'artistes
// Ex: "Zélie (5)" -> "Zélie"
// Ex: "Star Academy 2024 (1)" -> "Star Academy 2024"
function cleanArtistNames(val) {
  if (!val) return '';
  return val
    .toString()
    .replace(/\s*\(\d+\)/g, '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');
}

class ConcertsDataManager {
  constructor() {
    this.events = [];
    this.isEncrypted = false;
    this.isUnlocked = true;
    this.currentPassword = null;
    this.init();
  }

  init() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (settings.hasPassword) {
        this.isEncrypted = true;
        this.isUnlocked = false;
        // Données en attente de déverrouillage
        return;
      }

      // Tentative de chargement v2, ou migration depuis v1
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('mes_concerts_events_v1');
      if (stored) {
        this.events = JSON.parse(stored);
      } else if (window.INITIAL_CONCERTS && Array.isArray(window.INITIAL_CONCERTS) && window.INITIAL_CONCERTS.length > 0) {
        this.events = JSON.parse(JSON.stringify(window.INITIAL_CONCERTS));
      } else {
        this.events = [];
      }
    } catch (e) {
      console.error('Erreur chargement localStorage:', e);
      this.events = [];
    }

    // Nettoyage des artistes et recalcul des coûts
    this.normalizeEvents();
    if (this.events.length > 0) {
      this.save();
    }
  }

  normalizeEvents() {
    this.events.forEach((item, idx) => {
      if (!item.id) item.id = 'c_' + (idx + 1);
      // Nettoyage automatique des parenthèses
      item.artistes = cleanArtistNames(item.artistes);
      item.premiere_partie = cleanArtistNames(item.premiere_partie);
      item.guests = cleanArtistNames(item.guests);
      item.cout_total = this.calculateCost(item);
      if (!item.annee && item.date) {
        item.annee = item.date.includes('-') ? item.date.split('-')[0] : 'Inconnue';
      }
    });
  }

  async save() {
    try {
      if (this.isEncrypted && this.currentPassword) {
        // Sauvegarde chiffrée AES-GCM
        const encrypted = await window.cryptoVault.encrypt(this.events, this.currentPassword);
        localStorage.setItem(STORAGE_KEY, encrypted);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
      }
    } catch (e) {
      console.error('Erreur sauvegarde localStorage:', e);
    }
  }

  // Déverrouille le coffre-fort avec le mot de passe
  async unlock(password) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        this.events = [];
        this.isUnlocked = true;
        this.currentPassword = password;
        return true;
      }

      const decrypted = await window.cryptoVault.decrypt(stored, password);
      this.events = decrypted;
      this.normalizeEvents();
      this.isUnlocked = true;
      this.currentPassword = password;
      return true;
    } catch (e) {
      return false;
    }
  }

  // Active le verrouillage par mot de passe
  async setPassword(password) {
    this.isEncrypted = true;
    this.currentPassword = password;
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    settings.hasPassword = true;
    settings.passwordHint = 'AES-256 Vault';
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    await this.save();
  }

  // Désactive le mot de passe
  async removePassword() {
    this.isEncrypted = false;
    this.currentPassword = null;
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
  }

  getAll() {
    if (!this.isUnlocked) return [];
    return [...this.events].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      return (b.id || '').localeCompare(a.id || '');
    });
  }

  getById(id) {
    return this.events.find(e => e.id === id);
  }

  add(data) {
    const newItem = {
      id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      date: data.date || new Date().toISOString().split('T')[0],
      annee: (data.date && data.date.includes('-')) ? data.date.split('-')[0] : 'Inconnue',
      type: data.type || 'Concert',
      nom_evenement: data.nom_evenement || '',
      artistes: cleanArtistNames(data.artistes || ''),
      premiere_partie: cleanArtistNames(data.premiere_partie || ''),
      guests: cleanArtistNames(data.guests || ''),
      lieu: data.lieu || '',
      ville: data.ville || '',
      pays: data.pays || 'France',
      billet_paye: data.billet_paye || 'Oui',
      prix_billet_inconnu: Boolean(data.prix_billet_inconnu),
      prix_billet: data.prix_billet_inconnu ? null : (data.prix_billet !== null && data.prix_billet !== '' ? Number(data.prix_billet) : null),
      transport_inconnu: Boolean(data.transport_inconnu),
      transport: data.transport_inconnu ? null : (data.transport !== null && data.transport !== '' ? Number(data.transport) : null),
      logement_inconnu: Boolean(data.logement_inconnu),
      logement: data.logement_inconnu ? null : (data.logement !== null && data.logement !== '' ? Number(data.logement) : null),
      merch_inconnu: Boolean(data.merch_inconnu),
      merch: data.merch_inconnu ? null : (data.merch !== null && data.merch !== '' ? Number(data.merch) : null),
      articles_merch: data.articles_merch || '',
      accompagnateurs: data.accompagnateurs || '',
      placement: data.placement || 'Fosse'
    };

    newItem.cout_total = this.calculateCost(newItem);
    this.events.unshift(newItem);
    this.save();
    return newItem;
  }

  update(id, data) {
    const idx = this.events.findIndex(e => e.id === id);
    if (idx === -1) return null;

    const current = this.events[idx];
    const updated = {
      ...current,
      ...data,
      id: current.id,
      artistes: cleanArtistNames(data.artistes !== undefined ? data.artistes : current.artistes),
      premiere_partie: cleanArtistNames(data.premiere_partie !== undefined ? data.premiere_partie : current.premiere_partie),
      guests: cleanArtistNames(data.guests !== undefined ? data.guests : current.guests),
      annee: (data.date && data.date.includes('-')) ? data.date.split('-')[0] : current.annee
    };

    updated.prix_billet = updated.prix_billet_inconnu ? null : (updated.prix_billet !== null && updated.prix_billet !== '' ? Number(updated.prix_billet) : null);
    updated.transport = updated.transport_inconnu ? null : (updated.transport !== null && updated.transport !== '' ? Number(updated.transport) : null);
    updated.logement = updated.logement_inconnu ? null : (updated.logement !== null && updated.logement !== '' ? Number(updated.logement) : null);
    updated.merch = updated.merch_inconnu ? null : (updated.merch !== null && updated.merch !== '' ? Number(updated.merch) : null);

    updated.cout_total = this.calculateCost(updated);
    this.events[idx] = updated;
    this.save();
    return updated;
  }

  delete(id) {
    const prevCount = this.events.length;
    this.events = this.events.filter(e => e.id !== id);
    if (this.events.length !== prevCount) {
      this.save();
      return true;
    }
    return false;
  }

  calculateCost(item) {
    let total = 0.0;
    if (item.billet_paye === 'Oui' && !item.prix_billet_inconnu) {
      const val = parseFloat(item.prix_billet);
      if (!isNaN(val)) total += val;
    }
    if (!item.transport_inconnu) {
      const val = parseFloat(item.transport);
      if (!isNaN(val)) total += val;
    }
    if (!item.logement_inconnu) {
      const val = parseFloat(item.logement);
      if (!isNaN(val)) total += val;
    }
    if (!item.merch_inconnu) {
      const val = parseFloat(item.merch);
      if (!isNaN(val)) total += val;
    }
    return Math.round(total * 100) / 100;
  }

  getUniqueValues(field, isMulti = false) {
    if (!this.isUnlocked) return [];
    const values = new Set();
    this.events.forEach(item => {
      const val = item[field];
      if (!val) return;
      if (isMulti) {
        val.toString().split(',').forEach(sub => {
          const clean = sub.trim();
          if (clean && clean.toLowerCase() !== 'nan' && clean.toLowerCase() !== 'none') {
            values.add(clean);
          }
        });
      } else {
        const clean = val.toString().trim();
        if (clean && clean.toLowerCase() !== 'nan' && clean.toLowerCase() !== 'none') {
          values.add(clean);
        }
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }

  getYearsList() {
    if (!this.isUnlocked) return [];
    const years = new Set();
    this.events.forEach(item => {
      if (item.annee && item.annee !== 'Inconnue') {
        years.add(item.annee);
      } else if (item.date && item.date.includes('-')) {
        years.add(item.date.split('-')[0]);
      }
    });
    return Array.from(years).sort().reverse();
  }

  // Exportation CSV avec artistes nettoyés
  exportCSV() {
    const columns = [
      "Date", "Année", "Type d'événement", "Nom de l'événement", "Artiste(s) principal(aux)",
      "Première partie", "Guest(s)", "Lieu", "Ville", "Pays",
      "Billet payé", "Prix billet inconnu", "Prix billet (€)",
      "Transport inconnu", "Transport (€)",
      "Logement inconnu", "Logement (€)",
      "Merch inconnu", "Merch (€)", "Articles merch",
      "Coût total (€)", "Accompagnateur(s)", "Placement"
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = [columns.map(escapeCSV).join(',')];

    this.getAll().forEach(e => {
      const row = [
        e.date || '',
        e.annee || '',
        e.type || '',
        e.nom_evenement || '',
        cleanArtistNames(e.artistes || ''),
        cleanArtistNames(e.premiere_partie || ''),
        cleanArtistNames(e.guests || ''),
        e.lieu || '',
        e.ville || '',
        e.pays || '',
        e.billet_paye || '',
        e.prix_billet_inconnu ? 'True' : 'False',
        e.prix_billet !== null && e.prix_billet !== undefined ? e.prix_billet : '',
        e.transport_inconnu ? 'True' : 'False',
        e.transport !== null && e.transport !== undefined ? e.transport : '',
        e.logement_inconnu ? 'True' : 'False',
        e.logement !== null && e.logement !== undefined ? e.logement : '',
        e.merch_inconnu ? 'True' : 'False',
        e.merch !== null && e.merch !== undefined ? e.merch : '',
        e.articles_merch || '',
        e.cout_total !== null && e.cout_total !== undefined ? e.cout_total : '',
        e.accompagnateurs || '',
        e.placement || ''
      ];
      rows.push(row.map(escapeCSV).join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mes_concerts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Exportation Coffre-fort Chiffré AES-256
  async exportVault(password) {
    if (!password) throw new Error('Mot de passe requis pour chiffrer le coffre-fort.');
    const encryptedString = await window.cryptoVault.encrypt(this.events, password);
    const blob = new Blob([encryptedString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mes_concerts.vault`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Importation Coffre-fort Chiffré AES-256
  async importVault(vaultString, password) {
    const decrypted = await window.cryptoVault.decrypt(vaultString, password);
    if (!Array.isArray(decrypted)) {
      throw new Error('Contenu de coffre-fort non reconnu.');
    }
    this.events = decrypted;
    this.normalizeEvents();
    this.isUnlocked = true;
    this.currentPassword = password;
    await this.setPassword(password);
    return this.events.length;
  }

  // Importation CSV avec nettoyage automatique des artistes
  importCSV(file, replace = true) {
    return new Promise((resolve, reject) => {
      if (!window.Papa) {
        reject(new Error('PapaParse non chargé'));
        return;
      }

      window.Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const parsed = [];
            results.data.forEach((row, idx) => {
              const dateVal = row['Date'] || '';
              const anneeVal = row['Année'] || (dateVal.includes('-') ? dateVal.split('-')[0] : 'Inconnue');

              const toBool = (v) => {
                const s = String(v || '').trim().toLowerCase();
                return s === 'true' || s === '1' || s === 'oui';
              };

              const toNum = (v) => {
                if (v === null || v === undefined || String(v).trim() === '') return null;
                const n = parseFloat(String(v).replace(',', '.'));
                return isNaN(n) ? null : n;
              };

              const item = {
                id: 'c_' + (Date.now() + idx),
                date: dateVal,
                annee: anneeVal,
                type: row["Type d'événement"] || row['Type'] || 'Concert',
                nom_evenement: row["Nom de l'événement"] || '',
                artistes: cleanArtistNames(row["Artiste(s) principal(aux)"] || row['Artistes'] || ''),
                premiere_partie: cleanArtistNames(row["Première partie"] || ''),
                guests: cleanArtistNames(row["Guest(s)"] || ''),
                lieu: row["Lieu"] || '',
                ville: row["Ville"] || '',
                pays: row["Pays"] || 'France',
                billet_paye: row["Billet payé"] || 'Oui',
                prix_billet_inconnu: toBool(row["Prix billet inconnu"]),
                prix_billet: toNum(row["Prix billet (€)"] || row["Prix billet"]),
                transport_inconnu: toBool(row["Transport inconnu"]),
                transport: toNum(row["Transport (€)"] || row["Transport"]),
                logement_inconnu: toBool(row["Logement inconnu"]),
                logement: toNum(row["Logement (€)"] || row["Logement"]),
                merch_inconnu: toBool(row["Merch inconnu"]),
                merch: toNum(row["Merch (€)"] || row["Merch"]),
                articles_merch: row["Articles merch"] || '',
                accompagnateurs: row["Accompagnateur(s)"] || '',
                placement: row["Placement"] || 'Fosse'
              };

              item.cout_total = this.calculateCost(item);
              if (item.artistes || item.nom_evenement) {
                parsed.push(item);
              }
            });

            if (parsed.length === 0) {
              reject(new Error('Aucune donnée valide trouvée dans le fichier CSV.'));
              return;
            }

            if (replace) {
              this.events = parsed;
            } else {
              this.events = [...parsed, ...this.events];
            }

            this.normalizeEvents();
            this.save();
            resolve({ count: parsed.length });
          } catch (err) {
            reject(err);
          }
        },
        error: (err) => reject(err)
      });
    });
  }
}

// Instance globale
window.dataManager = new ConcertsDataManager();
