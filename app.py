import streamlit as st
import pandas as pd
import plotly.express as px
import os
import inspect
from datetime import date

DATA_FILE = "concerts.csv"

COLUMNS = [
    "Date", "Année", "Type d'événement", "Nom de l'événement", "Artiste(s) principal(aux)", "Première partie", "Guest(s)",
    "Lieu", "Ville", "Pays", 
    "Billet payé", "Prix billet inconnu", "Prix billet (€)",
    "Transport inconnu", "Transport (€)",
    "Logement inconnu", "Logement (€)",
    "Merch inconnu", "Merch (€)", "Articles merch",
    "Coût total (€)", "Accompagnateur(s)", "Placement"
]

CHOIX_PLACEMENT = ["Fosse", "Gradin", "Fosse assise", "Gradin puis fosse", "Festival / Debout extérieur", "Autre"]
CHOIX_PAIEMENT = ["Oui", "Non (invitation / cadeau)", "Pass Culture"]
TYPES_EVENT_DEFAUT = ["Concert", "Festival", "Showcase", "Plateau radio", "Co-plateau", "Comédie musicale", "Émission", "Dédicace", "Autre"]

# Détection de support pour accept_new_options
SUPPORTS_ACCEPT_NEW = "accept_new_options" in inspect.signature(st.multiselect).parameters

def load_data():
    if os.path.exists(DATA_FILE):
        df = pd.read_csv(DATA_FILE)
        # Gestion de la transition si ancienne colonne 'Événement'
        if "Événement" in df.columns and "Type d'événement" not in df.columns:
            df["Type d'événement"] = df["Événement"].fillna("Concert")
            df["Nom de l'événement"] = ""
        
        for col in COLUMNS:
            if col not in df.columns:
                df[col] = None
        df["Date"] = df["Date"].astype(str)
        df["Année"] = df["Date"].apply(lambda d: str(d).split("-")[0] if "-" in str(d) else "Inconnue")
        return df
    return pd.DataFrame(columns=COLUMNS)

def save_data(df):
    cols_to_save = [c for c in COLUMNS if c in df.columns]
    df[cols_to_save].to_csv(DATA_FILE, index=False)

def get_unique_items(df, column_name):
    """Extrait les valeurs uniques nettoyées."""
    if df.empty or column_name not in df.columns:
        return []
    raw = df[column_name].dropna().astype(str).str.split(",").explode().str.strip()
    return sorted(list(set([x for x in raw if x and x.lower() not in ["nan", "none", ""]])))

def recalculate_totals(df):
    """Recalcule automatiquement le coût personnel total et l'année pour chaque ligne."""
    df["Date"] = df["Date"].astype(str)
    df["Année"] = df["Date"].apply(lambda d: str(d).split("-")[0] if "-" in str(d) else "Inconnue")
    
    def row_cost(r):
        total = 0.0
        # Billet payé de sa poche uniquement si "Oui" (exclut Pass Culture et Cadeau/Invitation)
        if r.get("Billet payé") == "Oui" and not bool(r.get("Prix billet inconnu")):
            try: total += float(r.get("Prix billet (€)", 0) or 0)
            except: pass
        if not bool(r.get("Transport inconnu")):
            try: total += float(r.get("Transport (€)", 0) or 0)
            except: pass
        if not bool(r.get("Logement inconnu")):
            try: total += float(r.get("Logement (€)", 0) or 0)
            except: pass
        if not bool(r.get("Merch inconnu")):
            try: total += float(r.get("Merch (€)", 0) or 0)
            except: pass
        return round(total, 2)

    df["Coût total (€)"] = df.apply(row_cost, axis=1)
    return df

st.set_page_config(page_title="Mes Concerts", layout="wide", page_icon="🎫")
st.title("🎫 Carnet de Concerts & Statistiques")

df = load_data()

# Options connues
connus_types = sorted(list(set(TYPES_EVENT_DEFAUT + get_unique_items(df, "Type d'événement"))))
connus_events = get_unique_items(df, "Nom de l'événement")
connus_artistes = get_unique_items(df, "Artiste(s) principal(aux)")
connus_openers = get_unique_items(df, "Première partie")
connus_guests = get_unique_items(df, "Guest(s)")
connus_lieux = sorted(list(set(df["Lieu"].dropna().astype(str).unique()))) if not df.empty else []
connus_villes = sorted(list(set(df["Ville"].dropna().astype(str).unique()))) if not df.empty else ["Paris", "Amiens", "Lille", "Lyon"]
connus_pays = sorted(list(set(df["Pays"].dropna().astype(str).unique()))) if not df.empty else ["France", "Belgique", "Suisse"]
connus_personnes = get_unique_items(df, "Accompagnateur(s)")
connus_merch = get_unique_items(df, "Articles merch")

# Initialisation du session_state
for k, base_list in [
    ("opts_type", connus_types),
    ("opts_event", connus_events),
    ("opts_art", connus_artistes),
    ("opts_op", connus_openers),
    ("opts_guest", connus_guests),
    ("opts_merch", connus_merch),
    ("opts_acc", connus_personnes),
    ("opts_lieu", connus_lieux),
    ("opts_ville", connus_villes),
    ("opts_pays", connus_pays),
]:
    if k not in st.session_state:
        st.session_state[k] = list(base_list)

def champ_combobox_multi(label, session_key, widget_key, placeholder="Choisir ou taper..."):
    current_options = sorted(list(set(st.session_state[session_key])))
    if SUPPORTS_ACCEPT_NEW:
        return st.multiselect(
            label,
            options=current_options,
            key=widget_key,
            placeholder=placeholder,
            accept_new_options=True
        )
    else:
        val = st.text_input(
            f"{label} (ex: {', '.join(current_options[:4]) if current_options else 'nouveau'})",
            key=widget_key,
            placeholder="Tapez le(s) nom(s) séparés par une virgule..."
        )
        return [x.strip() for x in val.split(",") if x.strip()]

def champ_combobox_single(label, session_key, widget_key, defaut=""):
    current_options = sorted(list(set(st.session_state[session_key])))
    if "" not in current_options:
        current_options = [""] + current_options
    if SUPPORTS_ACCEPT_NEW:
        idx = current_options.index(defaut) if defaut in current_options else 0
        return st.selectbox(
            label,
            options=current_options,
            index=idx,
            key=widget_key,
            accept_new_options=True
        )
    else:
        return st.text_input(f"{label}", value=defaut, key=widget_key)

tab_saisie, tab_historique, tab_stats = st.tabs([
    "➕ Nouveau Concert",
    "📋 Historique & Modifications",
    "📊 Statistiques"
])

# =========================================================
# 1. NOUVEAU CONCERT
# =========================================================
with tab_saisie:
    st.subheader("Ajouter un nouveau concert")
    
    col_g, col_d = st.columns(2)
    
    with col_g:
        date_c = st.date_input("Date de l'événement", value=date.today())
        
        col_t1, col_t2 = st.columns(2)
        with col_t1:
            type_c = champ_combobox_single("Type d'événement *", "opts_type", "w_type", defaut="Concert")
        with col_t2:
            event_c = champ_combobox_single("Nom de l'événement (facultatif)", "opts_event", "w_event", defaut="")
            
        artistes_selection = champ_combobox_multi("Artiste(s) principal(aux) *", "opts_art", "w_art")
        openers_selection = champ_combobox_multi("Première(s) partie(s)", "opts_op", "w_op")
        guests_selection = champ_combobox_multi("Guest(s) / Invité(s)", "opts_guest", "w_guest")

        lieu_c = champ_combobox_single("Lieu / Salle", "opts_lieu", "w_lieu", defaut="")
        ville_c = champ_combobox_single("Ville", "opts_ville", "w_ville", defaut="Paris")
        pays_c = champ_combobox_single("Pays", "opts_pays", "w_pays", defaut="France")

    with col_d:
        st.markdown("### Dépenses & Logistique")
        
        billet_paye = st.selectbox("Billet payé par vous-même ?", CHOIX_PAIEMENT)
        
        c_b1, c_b2 = st.columns([3, 2])
        with c_b2:
            billet_inconnu = st.checkbox("Prix billet inconnu", key="cb_b_inc")
        with c_b1:
            prix_billet = st.number_input("Prix billet (€)", min_value=0.0, step=0.5, disabled=billet_inconnu)

        c_t1, c_t2 = st.columns([3, 2])
        with c_t2:
            trans_inconnu = st.checkbox("Prix transport inconnu", key="cb_t_inc")
        with c_t1:
            prix_trans = st.number_input("Transport (€)", min_value=0.0, step=0.5, disabled=trans_inconnu)

        c_l1, c_l2 = st.columns([3, 2])
        with c_l2:
            log_inconnu = st.checkbox("Prix logement inconnu", key="cb_l_inc")
        with c_l1:
            prix_log = st.number_input("Logement (€)", min_value=0.0, step=0.5, disabled=log_inconnu)

        c_m1, c_m2 = st.columns([3, 2])
        with c_m2:
            merch_inconnu = st.checkbox("Prix merch inconnu", key="cb_m_inc")
        with c_m1:
            prix_merch = st.number_input("Merch (€)", min_value=0.0, step=0.5, disabled=merch_inconnu)

        merch_articles = champ_combobox_multi("Article(s) de merch acheté(s)", "opts_merch", "w_merch")
        accompagnateurs = champ_combobox_multi("Avec qui y êtes-vous allée ?", "opts_acc", "w_acc")

        placement = st.selectbox("Placement", CHOIX_PLACEMENT)

    if st.button("💾 Enregistrer", type="primary"):
        artistes_str = ", ".join(artistes_selection) if isinstance(artistes_selection, list) else str(artistes_selection)
        openers_str = ", ".join(openers_selection) if isinstance(openers_selection, list) else str(openers_selection)
        guests_str = ", ".join(guests_selection) if isinstance(guests_selection, list) else str(guests_selection)
        merch_str = ", ".join(merch_articles) if isinstance(merch_articles, list) else str(merch_articles)
        acc_str = ", ".join(accompagnateurs) if isinstance(accompagnateurs, list) else str(accompagnateurs)
        type_val = type_c or "Concert"
        event_val = event_c or ""
        lieu_val = lieu_c or ""
        ville_val = ville_c or ""
        pays_val = pays_c or ""

        if not artistes_str.strip():
            st.error("Veuillez renseigner au moins un artiste principal.")
        else:
            cout_total = 0.0
            if billet_paye == "Oui" and not billet_inconnu:
                cout_total += prix_billet
            if not trans_inconnu:
                cout_total += prix_trans
            if not log_inconnu:
                cout_total += prix_log
            if not merch_inconnu:
                cout_total += prix_merch

            nouveau_c = {
                "Date": str(date_c),
                "Année": str(date_c.year),
                "Type d'événement": type_val,
                "Nom de l'événement": event_val,
                "Artiste(s) principal(aux)": artistes_str,
                "Première partie": openers_str,
                "Guest(s)": guests_str,
                "Lieu": lieu_val,
                "Ville": ville_val,
                "Pays": pays_val,
                "Billet payé": billet_paye,
                "Prix billet inconnu": billet_inconnu,
                "Prix billet (€)": None if billet_inconnu else prix_billet,
                "Transport inconnu": trans_inconnu,
                "Transport (€)": None if trans_inconnu else prix_trans,
                "Logement inconnu": log_inconnu,
                "Logement (€)": None if log_inconnu else prix_log,
                "Merch inconnu": merch_inconnu,
                "Merch (€)": None if merch_inconnu else prix_merch,
                "Articles merch": merch_str,
                "Coût total (€)": round(cout_total, 2),
                "Accompagnateur(s)": acc_str,
                "Placement": placement
            }
            df = pd.concat([df, pd.DataFrame([nouveau_c])], ignore_index=True)
            save_data(df)
            
            # Mise à jour des options session
            for k, val in [("opts_art", artistes_selection), ("opts_op", openers_selection), 
                           ("opts_guest", guests_selection), ("opts_merch", merch_articles), 
                           ("opts_acc", accompagnateurs)]:
                if isinstance(val, list):
                    st.session_state[k].extend(val)
            if type_val: st.session_state["opts_type"].append(type_val)
            if event_val: st.session_state["opts_event"].append(event_val)
            if lieu_val: st.session_state["opts_lieu"].append(lieu_val)
            if ville_val: st.session_state["opts_ville"].append(ville_val)
            if pays_val: st.session_state["opts_pays"].append(pays_val)

            st.success(f"Événement avec **{artistes_str}** enregistré avec succès !")
            st.rerun()

# =========================================================
# 2. HISTORIQUE AVEC MODIFICATION & SUPPRESSION DIRECTES
# =========================================================
with tab_historique:
    st.subheader("Historique des événements")
    st.caption("💡 **Pour modifier :** Double-cliquez directement sur la cellule souhaitée, puis cliquez sur '💾 Enregistrer les modifications'.")
    st.caption("🗑️ **Pour supprimer :** Cochez 'Supprimer' sur la/les ligne(s), le bouton de suppression s'affichera.")

    if df.empty:
        st.info("Aucun concert enregistré pour le moment.")
    else:
        edit_df = df.copy().sort_values(by="Date", ascending=False).reset_index(drop=True)
        edit_df.insert(0, "Supprimer", False)

        edited_table = st.data_editor(
            edit_df,
            hide_index=True,
            use_container_width=True,
            column_config={
                "Supprimer": st.column_config.CheckboxColumn(
                    "Supprimer",
                    help="Cocher pour supprimer cette ligne",
                    default=False
                ),
                "Type d'événement": st.column_config.SelectboxColumn(
                    "Type d'événement",
                    options=connus_types,
                    required=True
                ),
                "Placement": st.column_config.SelectboxColumn(
                    "Placement",
                    options=CHOIX_PLACEMENT,
                    required=True
                ),
                "Billet payé": st.column_config.SelectboxColumn(
                    "Billet payé",
                    options=CHOIX_PAIEMENT
                ),
                "Coût total (€)": st.column_config.NumberColumn(
                    "Coût total (€)",
                    disabled=True,
                    help="Calculé automatiquement."
                ),
                "Année": st.column_config.TextColumn("Année", disabled=True)
            },
            key="table_editor"
        )

        col_act1, col_act2, col_act3 = st.columns([2, 2, 3])

        a_supprimer = edited_table[edited_table["Supprimer"] == True]
        
        with col_act1:
            if not a_supprimer.empty:
                if st.button(f"🗑️ Supprimer la sélection ({len(a_supprimer)})", type="secondary"):
                    reste = edited_table[edited_table["Supprimer"] == False].drop(columns=["Supprimer"])
                    reste = recalculate_totals(reste)
                    save_data(reste)
                    st.warning(f"{len(a_supprimer)} entrée(s) supprimée(s).")
                    st.rerun()

        with col_act2:
            if st.button("💾 Enregistrer les modifications", type="primary"):
                data_mise_a_jour = edited_table.drop(columns=["Supprimer"])
                data_mise_a_jour = recalculate_totals(data_mise_a_jour)
                save_data(data_mise_a_jour)
                st.success("Modifications enregistrées avec succès !")
                st.rerun()

        with col_act3:
            csv_data = df.to_csv(index=False).encode('utf-8')
            st.download_button("📥 Exporter en CSV", data=csv_data, file_name="mes_concerts.csv", mime="text/csv")

# =========================================================
# 3. STATISTIQUES (GLOBAL / PAR ANNÉE)
# =========================================================
with tab_stats:
    if df.empty:
        st.info("Ajoutez des concerts pour générer les statistiques.")
    else:
        annees_dispos = sorted([str(a) for a in df["Année"].dropna().unique() if a != "Inconnue"], reverse=True)
        choix_periode = st.radio("Période :", ["Global (tout l'historique)"] + annees_dispos, horizontal=True)

        if choix_periode.startswith("Global"):
            sub_df = df.copy()
            st.subheader("📊 Statistiques Globales")
        else:
            sub_df = df[df["Année"] == choix_periode].copy()
            st.subheader(f"📊 Statistiques de l'année {choix_periode}")

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Nombre d'événements", len(sub_df))
        total_dep = sub_df["Coût total (€)"].dropna().sum()
        m2.metric("Dépenses personnelles", f"{total_dep:,.2f} €")
        moy_dep = sub_df["Coût total (€)"].dropna().mean() if len(sub_df) > 0 else 0
        m3.metric("Moyenne par événement", f"{moy_dep:,.2f} €")
        m4.metric("Villes visitées", sub_df["Ville"].nunique())

        st.divider()

        c1, c2 = st.columns(2)

        with c1:
            st.markdown("#### 🎤 Artistes principaux les plus vus")
            art_series = sub_df["Artiste(s) principal(aux)"].dropna().astype(str).str.split(",").explode().str.strip()
            art_series = art_series[art_series != ""]
            if not art_series.empty:
                top_art = art_series.value_counts().head(10).reset_index()
                top_art.columns = ["Artiste", "Nombre de fois"]
                fig_art = px.bar(top_art, x="Nombre de fois", y="Artiste", orientation="h", color="Nombre de fois", text_auto=True)
                fig_art.update_layout(yaxis=dict(autorange="reversed"))
                st.plotly_chart(fig_art, use_container_width=True)
            else:
                st.write("Aucune donnée.")

        with c2:
            st.markdown("#### 🎪 Répartition par Type d'événement")
            types_counts = sub_df["Type d'événement"].value_counts().reset_index()
            types_counts.columns = ["Type", "Total"]
            fig_types = px.pie(types_counts, names="Type", values="Total", hole=0.4)
            st.plotly_chart(fig_types, use_container_width=True)

        c3, c4 = st.columns(2)

        with c3:
            st.markdown("#### 💺 Répartition des Placements")
            placements = sub_df["Placement"].value_counts().reset_index()
            placements.columns = ["Placement", "Total"]
            fig_p = px.pie(placements, names="Placement", values="Total", hole=0.4)
            st.plotly_chart(fig_p, use_container_width=True)

        with c4:
            st.markdown("#### 💸 Répartition du Budget Réel Personnel")
            dep_dict = {
                "Billets (payés)": sub_df[sub_df["Billet payé"] == "Oui"]["Prix billet (€)"].dropna().sum(),
                "Transport": sub_df["Transport (€)"].dropna().sum(),
                "Logement": sub_df["Logement (€)"].dropna().sum(),
                "Merch": sub_df["Merch (€)"].dropna().sum(),
            }
            dep_plot = pd.DataFrame(list(dep_dict.items()), columns=["Catégorie", "Montant (€)"])
            fig_b = px.pie(dep_plot, names="Catégorie", values="Montant (€)", hole=0.4)
            st.plotly_chart(fig_b, use_container_width=True)

        c5, c6 = st.columns(2)

        with c5:
            st.markdown("#### 🛍️ Articles de Merch les plus achetés")
            merch_series = sub_df["Articles merch"].dropna().astype(str).str.split(",").explode().str.strip()
            merch_series = merch_series[merch_series != ""]
            if not merch_series.empty:
                top_m = merch_series.value_counts().head(10).reset_index()
                top_m.columns = ["Article", "Quantité"]
                fig_m = px.bar(top_m, x="Quantité", y="Article", orientation="h", text_auto=True)
                fig_m.update_layout(yaxis=dict(autorange="reversed"))
                st.plotly_chart(fig_m, use_container_width=True)
            else:
                st.write("Aucun article de merch sur cette période.")

        with c6:
            st.markdown("#### 👥 Compagnons de concert")
            acc_series = sub_df["Accompagnateur(s)"].dropna().astype(str).str.split(",").explode().str.strip()
            acc_series = acc_series[acc_series != ""]
            if not acc_series.empty:
                top_acc = acc_series.value_counts().head(10).reset_index()
                top_acc.columns = ["Accompagnateur", "Concerts"]
                fig_acc = px.bar(top_acc, x="Concerts", y="Accompagnateur", orientation="h", text_auto=True)
                fig_acc.update_layout(yaxis=dict(autorange="reversed"))
                st.plotly_chart(fig_acc, use_container_width=True)
            else:
                st.write("Aucun accompagnateur sur cette période.")