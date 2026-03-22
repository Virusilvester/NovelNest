const fr = {
  common: {
    ok: "OK",
    cancel: "Annuler",
    close: "Fermer",
    done: "Terminé",
    preparing: "Préparation…",
    unknown: "Inconnu",
  },
  screens: {
    library: { title: "Bibliothèque" },
    updates: { title: "Mises à jour" },
    history: { title: "Historique" },
    extensions: { title: "Extensions" },
    downloadQueue: {
      title: "File de téléchargement",
      pausedTitle: "File (En pause)",
    },
    reader: { title: "Lecteur" },
    sources: { title: "Sources" },
    dataManagement: { title: "Gestion des données" },
    categories: { title: "Catégories" },
    readerSettings: { title: "Paramètres du lecteur" },
    readerTheme: { title: "Thème du lecteur" },
    legacyBackup: { title: "Sauvegarde (Legacy)" },
    remoteBackup: { title: "Sauvegarde distante" },
    trackingServices: { title: "Services de suivi" },
    ttsSettings: { title: "Synthèse vocale" },
  },
  epub: {
    importingTitle: "Importation EPUB",
    importCompleteTitle: "Import terminé",
    importAddedToLibrary: '"{title}" a été ajouté à votre bibliothèque.',
    exportTitle: "Exportation EPUB",
  },
  library: {
    actions: { open: "Ouvrir" },
    import: {
      failedTitle: "Import échoué",
      failedBody: "Impossible d'importer l'EPUB.",
    },
    update: {
      title: "Bibliothèque mise à jour",
      foundNew: "{count} nouveau(x) chapitre(s) trouvé(s).",
      viewUpdates: "Voir les mises à jour",
      noneFound: "Aucun nouveau chapitre trouvé.",
      nothingToUpdate: "Rien à mettre à jour.",
      errors: "Erreurs : {count}.",
    },
  },
  downloads: {
    title: "Téléchargements",
    noneToDownload: "Aucun chapitre à télécharger.",
    queuedChapters: "{count} chapitre(s) ajouté(s) à la file.",
  },
  downloadQueue: {
    alerts: {
      cancelTitle: "Annuler le téléchargement",
      cancelMessage:
        "Annuler ce chapitre ou tous les téléchargements de ce roman ?",
      keep: "Garder",
      cancelChapter: "Annuler le chapitre",
      cancelNovel: "Annuler le roman",
      clearTitle: "Effacer les terminés",
      clearMessage: "Supprimer tous les téléchargements terminés de la file ?",
      clear: "Effacer",
    },
    summary: {
      active: "{count} actifs",
      queued: "{count} en attente",
      failed: "{count} échoués",
      done: "{count} terminés",
    },
    empty: {
      title: "Aucun téléchargement",
      subtitle: "Les chapitres téléchargés apparaîtront ici",
    },
  },
  categories: {
    delete: {
      title: "Supprimer la catégorie",
      body: 'Retirer "{name}" de votre bibliothèque ? Les romans dans cette catégorie deviendront non classés.',
      action: "Supprimer",
    },
  },
  backup: {
    sectionTitle: "Sauvegardes",
    footer: "Les sauvegardes sont stockées sous forme de fichiers JSON.",
    shareTitle: "Partager la sauvegarde NovelNest",
    exportedTitle: "Sauvegarde exportée",
    savedTo: "Enregistré dans :\n{uri}",
    exportFailedTitle: "Échec de l'export",
    exportFailedBody: "Impossible d'exporter la sauvegarde.",
    confirmImportTitle: "Confirmer l'import",
    confirmImportBodyReplace:
      "Vous allez remplacer votre bibliothèque avec cette sauvegarde :\n\n{summary}\n\nContinuer ?",
    confirmImportBodyMerge:
      "Vous allez fusionner votre bibliothèque avec cette sauvegarde :\n\n{summary}\n\nContinuer ?",
    actions: {
      merge: "Fusionner",
      replace: "Remplacer",
    },
    settingsNote:
      "Note : les paramètres de cette sauvegarde ont également été appliqués et prendront pleinement effet après le redémarrage de l'application.",
    importCompleteTitle: "Import terminé",
    importCompleteReplaced:
      "La base de données de votre bibliothèque a été remplacée par la sauvegarde.",
    importCompleteMerged:
      "La sauvegarde a été fusionnée dans la base de données de votre bibliothèque.",
    importFailedTitle: "Import échoué",
    importFailedBody: "Impossible d'importer la sauvegarde.",
    importPickerFailedBody: "Impossible d'ouvrir le sélecteur de fichiers.",
    importPickTitle: "Importer une sauvegarde",
    importPickBody: "Comment voulez-vous importer cette sauvegarde ?",
    export: {
      title: "Exporter la sauvegarde",
      description:
        "Sauvegarder votre bibliothèque, historique et paramètres dans un fichier JSON",
    },
    import: {
      title: "Importer une sauvegarde",
      description: "Restaurer une sauvegarde JSON exportée",
    },
  },
  extensions: {
    alerts: {
      invalidUrlTitle: "URL invalide",
      invalidUrlBody: "L'URL du dépôt doit commencer par http(s)://",
      removeRepoTitle: "Supprimer le dépôt ?",
      remove: "Supprimer",
      installedTitle: "Installé",
      installedBody:
        "Les métadonnées du plugin ont été enregistrées, mais le téléchargement du fichier n'est pas pris en charge sur cette plateforme.",
      errorTitle: "Erreur",
      errorBody: "Impossible d'installer/désinstaller le plugin.",
    },
    filters: {
      sortAz: "Trier : A-Z",
      sortZa: "Trier : Z-A",
      language: "Langue",
      languageAny: "Langue : Toutes",
      allLanguages: "Toutes les langues",
    },
  },
  history: {
    remove: {
      title: "Retirer de l'historique",
      body: 'Retirer "{title}" de votre historique de lecture ?',
      action: "Retirer",
    },
  },
  updates: {
    clear: {
      title: "Effacer les mises à jour",
      body: "Supprimer toutes les entrées de mise à jour ?",
      action: "Effacer",
    },
    download: {
      noneNew: "Aucun nouveau chapitre à télécharger.",
    },
    notFound: {
      title: "Introuvable",
      body: "Ce roman n'est plus dans votre bibliothèque.",
    },
    lastChecked: "Dernière vérification : {date}",
  },
  reader: {
    errors: {
      novelNotFound: "Roman introuvable.",
      noSource: "Ce roman n'a pas de source et ne peut pas être lu.",
    },
  },
  tracking: {
    note: "",
    connected: "Connecté",
    notConnected: "Non connecté",
    connect: "Connecter",
    reauth: "Ré-auth",
    disconnect: "Déconnecter",
    expiresAt: "Expire : {date}",
    noExpiry: "Pas d'expiration",
    alerts: {
      authFailedTitle: "Échec d'authentification",
      authFailedBody: "Impossible de s'authentifier.",
      disconnectTitle: "Déconnecter le tracker",
      disconnectBody:
        "Supprimer la connexion enregistrée pour ce service de suivi ?",
      disconnectAction: "Déconnecter",
    },
    search: {
      title: "Rechercher",
      placeholder: "Tapez un titre…",
      search: "Rechercher",
      empty: "Recherchez un titre pour lier le suivi.",
      failed: "La recherche a échoué.",
      chapters: "Chapitres",
    },
  },
  settings: {
    title: "Paramètres",
    sections: {
      general: "Général",
      appearance: "Apparence",
      reader: "Lecteur",
      tracking: "Suivi",
      backup: "Sauvegarde",
      advanced: "Avancé",
      about: "À propos",
    },
    general: {
      startScreen: "Écran de démarrage",
      language: "Langue",
      downloadLocation: "Emplacement des téléchargements",
    },
    appearance: {
      title: "Apparence",
      themeMode: "Thème",
      themeSystem: "Système",
      themeLight: "Clair",
      themeDark: "Sombre",
      appLanguage: "Langue de l'app",
      appLanguageDefault: "Par défaut",
    },
  },
} as const;

export default fr;
