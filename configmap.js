const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

async function ensureDebugInConfigMap(namespace, configMapName, exec) {
  // exec: hàm thực thi PowerShell được truyền từ main.js (hoặc dùng require 'child_process' trong đây)
  try {
    const rawYaml = await exec(`kubectl get configmap ${configMapName} -n ${namespace} -o yaml`);
    const configMap = yaml.load(rawYaml);

    if (!configMap?.data) throw new Error(`❌ ConfigMap "${configMapName}" không có phần data.`);

    if (configMap.data['debug']?.toLowerCase() === 'true') {
      return '✅ ConfigMap đã có debug: true';
    }

    configMap.data['debug'] = 'true';

    const updatedYaml = yaml.dump(configMap);
    const tempFile = path.join(os.tmpdir(), `${configMapName}-patched.yaml`);
    fs.writeFileSync(tempFile, updatedYaml, 'utf8');

    const result = await exec(`kubectl apply -f "${tempFile}"`);
    fs.unlinkSync(tempFile);

    return `✅ ConfigMap updated:\n${result}`;
  } catch (err) {
    return `❌ Lỗi cập nhật ConfigMap: ${err.message}`;
  }
}

module.exports = { ensureDebugInConfigMap };
