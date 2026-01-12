let isDebugMode = false;

// 2. Fonction de configuration (à exporter pour l'utilisateur de la lib)
export function setDebugMode(enable: boolean) {
  isDebugMode = enable;
}

// 3. Le logger lui-même
// On ajoute un préfixe pour que l'utilisateur sache que ça vient de votre lib
const prefix = '[MaSuperLib]';

export const logger = {
  log: (...args: any[]) => {
    if (!isDebugMode) return;
    console.log(prefix, ...args);
  },
  warn: (...args: any[]) => {
    if (!isDebugMode) return;
    console.warn(prefix, ...args);
  },
  error: (...args: any[]) => {
    // Note : Souvent, on veut voir les erreurs même si le debug est off.
    // Mais si vous voulez TOUT couper, gardez la condition.
    console.error(prefix, ...args);
  }
};