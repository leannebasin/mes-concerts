# 🎫 Mes Concerts — Application Web & PWA Sécurisée pour iPhone & Ordinateur

Application de suivi de concerts transformée en **Progressive Web App (PWA)** hébergeable gratuitement sur **GitHub Pages**, utilisable sur **iPhone et Ordinateur**, avec un **Coffre-fort chiffré AES-256 bits (Zéro donnée publique)**.

---

## 🔒 Confidentialité & Sécurité (Zéro donnée dans le code)

1. **Aucune donnée personnelle sur GitHub** : Le dépôt GitHub ne contient que le moteur de l'application. Vos concerts, dates, artistes, prix et compagnons ne sont **jamais** envoyés en clair sur Internet ni lisibles dans le code source.
2. **Noms d'artistes nettoyés** : Tous les numéros entre parenthèses (`(1)`, `(2)`, etc.) ont été automatiquement retirés (`Zélie (5)` devient `Zélie`).
3. **Chiffrement AES-GCM 256 bits** : Vous pouvez définir un mot de passe pour verrouiller l'application. Vos données sont chiffrées localement sur vos appareils grâce à l'API cryptographique native du navigateur (`Web Crypto API`).
4. **Accès exclusif iPhone + PC** :
   - Vous importez vos données sur votre ordinateur.
   - Vous pouvez exporter un coffre-fort chiffré (`mes_concerts.vault`) ou votre fichier `concerts_cleaned.csv` et l'ouvrir sur votre iPhone (via AirDrop, iCloud Drive, Fichiers).
   - Une fois importées, vos données restent enregistrées dans votre iPhone de manière permanente et hors-ligne.

---

## 🚀 Étape 1 : Mettre à jour votre dépôt GitHub

Comme nous avons nettoyé l'historique pour retirer vos données privées, mettez à jour votre dépôt GitHub avec la commande :

```powershell
cd "C:\Users\basin\Documents\MesConcerts"

# Envoyer le code propre sans aucune donnée personnelle
git push --force origin main
```

*(Si vous aviez l'erreur Pages, n'oubliez pas d'aller dans **Settings** ⚙️ > **Pages** sur GitHub et de sélectionner **Source : GitHub Actions**).*

---

## 💻 Étape 2 : Charger vos concerts sur votre ordinateur

1. Ouvrez votre application sur GitHub Pages (ou lancez `python -m http.server 8000` en local).
2. Cliquez sur le bouton violet **« 📂 Importer concerts_cleaned.csv »** (ou allez dans l'onglet **Données ⚙️** > **Importer un fichier CSV**).
3. Sélectionnez le fichier **`concerts_cleaned.csv`** situé dans votre dossier `C:\Users\basin\Documents\MesConcerts\`.
4. Vos 57 concerts s'affichent instantanément, nettoyés de tous les numéros entre parenthèses !
5. *(Recommandé)* Dans l'onglet **Données ⚙️**, cliquez sur **« 🔑 Définir / Modifier le mot de passe »** pour activer le chiffrement du coffre.

---

## 📱 Étape 3 : Installer et charger vos concerts sur votre iPhone

1. Sur votre **iPhone**, ouvrez **Safari** et accédez à votre URL GitHub Pages.
2. **Installez l'app sur l'écran d'accueil** :
   - Touchez l'icône de partage **⎋** (en bas au milieu de Safari).
   - Touchez **« Sur l'écran d'accueil » ➕** puis **Ajouter**.
3. **Pour transférer vos concerts sur votre iPhone** :
   - Sur votre ordinateur, dans l'onglet **Données ⚙️**, cliquez sur **« 📦 Exporter le Coffre-fort chiffré (.vault) »** (ou utilisez le fichier `concerts_cleaned.csv`).
   - Envoyez le fichier sur votre iPhone (via **AirDrop**, **iCloud Drive**, Mail ou Messages).
   - Sur votre iPhone, ouvrez l'application **Mes Concerts**, allez dans **Données ⚙️** > **« 📥 Ouvrir un Coffre-fort chiffré (.vault) »** et tapez votre mot de passe.
4. 🎉 Vos concerts sont chargés sur votre iPhone, enregistrés localement, et vous êtes la seule personne au monde à y avoir accès !
