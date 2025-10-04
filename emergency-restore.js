// emergency-restore.js - аварийное восстановление
const fs = require('fs');
const path = require('path');

class CodeProtector {
    static createBackup(filePath, content) {
        const backupDir = path.join(process.cwd(), 'CODE_BACKUPS');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
        
        const backupFile = path.join(backupDir, 
            `${path.basename(filePath)}_${Date.now()}.bak`);
        
        fs.writeFileSync(backupFile, content);
        console.log(`✅ Бэкап создан: ${backupFile}`);
    }

    static restoreLatest(filePath) {
        const backupDir = path.join(process.cwd(), 'CODE_BACKUPS');
        const backups = fs.readdirSync(backupDir)
            .filter(f => f.startsWith(path.basename(filePath)))
            .sort()
            .reverse();
        
        if (backups.length > 0) {
            const latestBackup = path.join(backupDir, backups[0]);
            const content = fs.readFileSync(latestBackup, 'utf8');
            fs.writeFileSync(filePath, content);
            console.log(`✅ Восстановлен из: ${latestBackup}`);
        }
    }
}

module.exports = CodeProtector;