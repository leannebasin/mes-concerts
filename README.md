# 🎫 Mes Concerts — Application Cloud Supabase pour iPhone & Ordinateur

Application de suivi de concerts connectée à une base de données cloud **Supabase** sécurisée, hébergée sur **GitHub Pages** et installable sur **iPhone**.

---

## 🔒 Confidentialité & Sécurité

- ☁️ **Base de données Cloud Supabase** : Vos données sont stockées dans le cloud sécurisé de votre projet Supabase (`jokiruvgopcmumacfcie.supabase.co`).
- 🚫 **Zéro donnée dans le code GitHub** : Aucun concert, prix, date ou nom n'est codé en dur dans le site public.
- 📱 **Synchronisation instantanée iPhone ⇄ Ordinateur** : Tout concert ajouté, modifié ou supprimé sur votre iPhone se met à jour en temps réel sur votre ordinateur.
- 🧹 **Noms d'artistes nettoyés** : Tous les numéros entre parenthèses (`(1)`, `(2)`, etc.) ont été automatiquement supprimés (`Zélie`, `Mosimann`, `Helena`, `Pierre Garnier`, etc.).

---

## 🚀 Étape 1 : Initialiser la base de données Supabase (1 minute)

Vos 57 concerts et la structure de la table sont prêts dans le fichier local [supabase_schema.sql](file:///c:/Users/basin/Documents/MesConcerts/supabase_schema.sql).

1. Ouvrez votre projet Supabase :  
   👉 [https://supabase.com/dashboard/project/jokiruvgopcmumacfcie](https://supabase.com/dashboard/project/jokiruvgopcmumacfcie)
2. Dans le menu de gauche, cliquez sur **SQL Editor** (icône `>_`).
3. Cliquez sur **New query** (en haut à gauche).
4. Ouvrez le fichier **`supabase_schema.sql`** situé dans votre dossier `MesConcerts`, copiez tout son contenu et collez-le dans l'éditeur Supabase.
5. Cliquez sur le bouton vert **Run** (en bas à droite).

> ✅ **C'est fait !** La table `concerts` est créée avec la sécurité RLS et vos 57 concerts nettoyés sont immédiatement enregistrés dans votre base Supabase.

---

## 🌐 Étape 2 : Envoyer le code sur GitHub

Dans votre terminal PowerShell :

```powershell
cd "C:\Users\basin\Documents\MesConcerts"

git add .
git commit -m "Connexion Cloud Supabase et synchronisation multi-appareils"
git push origin main
```

---

## 📱 Étape 3 : Utiliser l'application sur iPhone et Ordinateur

1. **Sur Ordinateur** :
   - Ouvrez votre lien GitHub Pages (ou en local avec `python -m http.server 8000`).
   - Vos concerts se chargent directement depuis votre base Supabase !
   - Vous pouvez cliquer sur l'icône **☁️** en haut à droite pour vous connecter avec un compte email/mot de passe Supabase.

2. **Sur iPhone** :
   - Ouvrez votre lien GitHub Pages dans **Safari**.
   - Touchez le bouton **Partager** (**⎋**) puis **« Sur l'écran d'accueil » ➕**.
   - Ouvrez l'application : tous vos concerts sont synchronisés en direct depuis Supabase.
