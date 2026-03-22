const es = {
  common: {
    ok: "OK",
    cancel: "Cancelar",
    close: "Cerrar",
    done: "Hecho",
    preparing: "Preparando…",
    unknown: "Desconocido",
  },
  screens: {
    library: { title: "Biblioteca" },
    updates: { title: "Actualizaciones" },
    history: { title: "Historial" },
    extensions: { title: "Extensiones" },
    downloadQueue: {
      title: "Cola de descargas",
      pausedTitle: "Cola (Pausada)",
    },
    reader: { title: "Lector" },
    sources: { title: "Fuentes" },
    dataManagement: { title: "Gestión de datos" },
    categories: { title: "Categorías" },
    readerSettings: { title: "Ajustes del lector" },
    readerTheme: { title: "Tema del lector" },
    legacyBackup: { title: "Copia de seguridad (Legacy)" },
    remoteBackup: { title: "Copia de seguridad remota" },
    trackingServices: { title: "Servicios de seguimiento" },
    ttsSettings: { title: "Texto a voz" },
  },
  epub: {
    importingTitle: "Importando EPUB",
    importCompleteTitle: "Importación completa",
    importAddedToLibrary: '"{title}" se añadió a tu biblioteca.',
    exportTitle: "Exportando EPUB",
  },
  library: {
    actions: { open: "Abrir" },
    import: {
      failedTitle: "Importación fallida",
      failedBody: "No se pudo importar el EPUB.",
    },
    update: {
      title: "Biblioteca actualizada",
      foundNew: "Se encontraron {count} capítulo(s) nuevo(s).",
      viewUpdates: "Ver actualizaciones",
      noneFound: "No se encontraron capítulos nuevos.",
      nothingToUpdate: "Nada que actualizar.",
      errors: "Errores: {count}.",
    },
  },
  downloads: {
    title: "Descargas",
    noneToDownload: "No hay capítulos para descargar.",
    queuedChapters: "Se encolaron {count} capítulo(s) para descargar.",
  },
  downloadQueue: {
    alerts: {
      cancelTitle: "Cancelar descarga",
      cancelMessage:
        "¿Cancelar este capítulo o todas las descargas de esta novela?",
      keep: "Mantener",
      cancelChapter: "Cancelar capítulo",
      cancelNovel: "Cancelar novela",
      clearTitle: "Borrar completados",
      clearMessage: "¿Quitar todas las descargas completadas de la cola?",
      clear: "Borrar",
    },
    summary: {
      active: "{count} activas",
      queued: "{count} en cola",
      failed: "{count} fallidas",
      done: "{count} hechas",
    },
    empty: {
      title: "Sin descargas",
      subtitle: "Los capítulos descargados aparecerán aquí",
    },
  },
  categories: {
    delete: {
      title: "Eliminar categoría",
      body: '¿Quitar "{name}" de tu biblioteca? Las novelas en esta categoría quedarán sin categorizar.',
      action: "Eliminar",
    },
  },
  backup: {
    sectionTitle: "Copias de seguridad",
    footer: "Las copias se guardan como archivos JSON.",
    shareTitle: "Compartir copia de NovelNest",
    exportedTitle: "Copia exportada",
    savedTo: "Guardado en:\n{uri}",
    exportFailedTitle: "Exportación fallida",
    exportFailedBody: "No se pudo exportar la copia.",
    confirmImportTitle: "Confirmar importación",
    confirmImportBodyReplace:
      "Vas a reemplazar tu biblioteca con esta copia:\n\n{summary}\n\n¿Continuar?",
    confirmImportBodyMerge:
      "Vas a fusionar tu biblioteca con esta copia:\n\n{summary}\n\n¿Continuar?",
    actions: {
      merge: "Fusionar",
      replace: "Reemplazar",
    },
    settingsNote:
      "Nota: Los ajustes de esta copia también se aplicaron y tendrán efecto completo tras reiniciar la app.",
    importCompleteTitle: "Importación completa",
    importCompleteReplaced: "Tu biblioteca fue reemplazada con la copia.",
    importCompleteMerged: "La copia se fusionó con tu biblioteca.",
    importFailedTitle: "Importación fallida",
    importFailedBody: "No se pudo importar la copia.",
    importPickerFailedBody: "No se pudo abrir el selector de archivos.",
    importPickTitle: "Importar copia",
    importPickBody: "¿Cómo quieres importar esta copia?",
    export: {
      title: "Exportar copia",
      description:
        "Guarda tu biblioteca, historial y ajustes en un archivo JSON",
    },
    import: {
      title: "Importar copia",
      description: "Restaura una copia JSON exportada anteriormente",
    },
  },
  extensions: {
    alerts: {
      invalidUrlTitle: "URL inválida",
      invalidUrlBody: "La URL del repositorio debe empezar con http(s)://",
      removeRepoTitle: "¿Quitar repositorio?",
      remove: "Quitar",
      installedTitle: "Instalado",
      installedBody:
        "Los metadatos del plugin se guardaron, pero la descarga del archivo no está soportada en esta plataforma.",
      errorTitle: "Error",
      errorBody: "No se pudo instalar/desinstalar el plugin.",
    },
    filters: {
      sortAz: "Ordenar: A-Z",
      sortZa: "Ordenar: Z-A",
      language: "Idioma",
      languageAny: "Idioma: Cualquiera",
      allLanguages: "Todos los idiomas",
    },
  },
  history: {
    remove: {
      title: "Quitar del historial",
      body: '¿Quitar "{title}" de tu historial de lectura?',
      action: "Quitar",
    },
  },
  updates: {
    clear: {
      title: "Borrar actualizaciones",
      body: "¿Quitar todas las entradas de actualización?",
      action: "Borrar",
    },
    download: {
      noneNew: "No hay capítulos nuevos para descargar.",
    },
    notFound: {
      title: "No encontrado",
      body: "Esta novela ya no está en tu biblioteca.",
    },
    lastChecked: "Última comprobación: {date}",
  },
  reader: {
    errors: {
      novelNotFound: "Novela no encontrada.",
      noSource: "Esta novela no tiene fuente y no se puede leer.",
    },
  },
  tracking: {
    note: "",
    connected: "Conectado",
    notConnected: "No conectado",
    connect: "Conectar",
    reauth: "Reautorizar",
    disconnect: "Desconectar",
    expiresAt: "Expira: {date}",
    noExpiry: "Sin caducidad",
    alerts: {
      authFailedTitle: "Autenticación fallida",
      authFailedBody: "No se pudo autenticar.",
      disconnectTitle: "Desconectar tracker",
      disconnectBody: "¿Quitar el inicio de sesión guardado de este servicio?",
      disconnectAction: "Desconectar",
    },
    search: {
      title: "Buscar",
      placeholder: "Escribe un título…",
      search: "Buscar",
      empty: "Busca un título para vincular el seguimiento.",
      failed: "La búsqueda falló.",
      chapters: "Capítulos",
    },
  },
  settings: {
    title: "Ajustes",
    sections: {
      general: "General",
      appearance: "Apariencia",
      reader: "Lector",
      tracking: "Seguimiento",
      backup: "Copia de seguridad",
      advanced: "Avanzado",
      about: "Acerca de",
    },
    general: {
      startScreen: "Pantalla inicial",
      language: "Idioma",
      downloadLocation: "Ubicación de descargas",
    },
    appearance: {
      title: "Apariencia",
      themeMode: "Tema",
      themeSystem: "Sistema",
      themeLight: "Claro",
      themeDark: "Oscuro",
      appLanguage: "Idioma de la app",
      appLanguageDefault: "Predeterminado",
    },
  },
} as const;

export default es;
