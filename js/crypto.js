// Gestionnaire de chiffrement AES-GCM 256-bit pour Coffre-fort Privé (Web Crypto API)

class CryptoVault {
  // Convertit un ArrayBuffer en chaîne Base64
  bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convertit une chaîne Base64 en Uint8Array
  base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Dérivation d'une clé AES-GCM 256 bits à partir du mot de passe et d'un sel
  async deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Chiffre des données (objet ou texte) avec un mot de passe
  async encrypt(data, password) {
    const enc = new TextEncoder();
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    const plainBytes = enc.encode(jsonStr);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await this.deriveKey(password, salt);
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      plainBytes
    );

    return JSON.stringify({
      version: 1,
      type: 'mes_concerts_encrypted_vault',
      created_at: new Date().toISOString(),
      salt: this.bufferToBase64(salt),
      iv: this.bufferToBase64(iv),
      data: this.bufferToBase64(cipherBuffer)
    });
  }

  // Déchiffre un coffre-fort avec le mot de passe
  async decrypt(vaultString, password) {
    try {
      const payload = typeof vaultString === 'string' ? JSON.parse(vaultString) : vaultString;
      if (!payload.salt || !payload.iv || !payload.data) {
        throw new Error('Format de coffre-fort invalide');
      }

      const salt = this.base64ToBuffer(payload.salt);
      const iv = this.base64ToBuffer(payload.iv);
      const cipherBytes = this.base64ToBuffer(payload.data);

      const key = await this.deriveKey(password, salt);
      const decBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        cipherBytes
      );

      const dec = new TextDecoder();
      const plainText = dec.decode(decBuffer);
      return JSON.parse(plainText);
    } catch (e) {
      throw new Error('Mot de passe incorrect ou fichier endommagé.');
    }
  }

  // Calcule un hash de vérification rapide
  async hash(str) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return this.bufferToBase64(buf);
  }
}

window.cryptoVault = new CryptoVault();
