// edit-file.js

const nsSelect = document.getElementById('namespace-select');
const podSelect = document.getElementById('pod-select');
const fileSelect = document.getElementById('file-select');
const fileContent = document.getElementById('file-content');
const status = document.getElementById('status');
const saveBtn = document.getElementById('save-btn');

let nsSelectInstance, podSelectInstance, fileSelectInstance;

function showLoading() {
  document.getElementById('loading-spinner').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-spinner').style.display = 'none';
}

async function loadNamespaces() {
  showLoading();
  try {
    nsSelectInstance?.clearOptions();
    const output = await window.powershell.run(`kubectl get ns -o json`);
    const data = JSON.parse(output);
    
    nsSelectInstance.addOption(data.items.map(ns => ({
      value: ns.metadata.name,
      text: ns.metadata.name
    })));
    nsSelectInstance.refreshOptions(false);
    nsSelectInstance.setValue(""); // hoặc giá trị mặc định nếu cần

    nsSelect.dispatchEvent(new Event('change'));
  } catch (err) {
    console.error('Error loading namespaces:', err);
    alert(err);
  } finally {
    hideLoading();
  }
}

async function loadPods(namespace, prefix) {
  try {
    showLoading();
    podSelectInstance.clearOptions();

    const safePrefix = prefix.replace(/"/g, ''); // tránh lỗi nếu có dấu "

    const psCommand = `(kubectl get pods -n ${namespace} -o json | ConvertFrom-Json).items | Where-Object { $_.metadata.name -like "${safePrefix}*" } | Select-Object -First 100 | ConvertTo-Json -Depth 2`;
    const output = await window.powershell.run(psCommand);

    if (!output || !output.trim().startsWith('[')) {
      throw new Error('Load failed, maybe the response is too much, please add filter prefix. Error message:\n' + output);
    }

    const pods = JSON.parse(output);

    podSelectInstance.addOption(pods.map(pod => ({
      value: pod.metadata.name,
      text: pod.metadata.name
    })));
    podSelectInstance.refreshOptions(false);
    podSelectInstance.setValue("");

  } catch (err) {
    console.error('Failed to load pods:', err);
    alert('Error loading pods: ' + err.message);
  } finally {
    hideLoading();
  }
}


async function loadFiles(namespace, podName) {
  try {
    showLoading();
    fileSelectInstance.clearOptions();

    // Lấy danh sách file trong /app (hoặc thư mục bạn đang target)
    const psCommand = `kubectl exec -n ${namespace} ${podName} -- powershell -Command "Get-ChildItem -Recurse -Filter *.config | Select-Object -ExpandProperty FullName"`;

    const output = await window.powershell.run(psCommand);

    const lines = output.trim().split(/\r?\n/).filter(x => x.trim() !== '');

    fileSelectInstance.addOption(lines.map(file => ({
      value: file,
      text: file
    })));
    fileSelectInstance.refreshOptions(false);
    fileSelectInstance.setValue("");

  } catch (err) {
    console.error('Failed to load files:', err);
    alert('Error loading .config files: ' + err.message);
  } finally {
    hideLoading();
  }
}


async function loadFileContent(namespace, pod, filePath) {
  showLoading();
  try {
  const cmd = `kubectl exec -n ${namespace} ${pod} -- powershell -Command "Get-Content -Path '${filePath}' -Raw"`;
  const output = await window.powershell.run(cmd);
  //fileContent.value = output;
  editor.setValue(output, -1);
  } catch (err) {
    console.error('Error loading file content:', err);
    alert(err);
  } finally {
    hideLoading();
  }
}

async function saveFileContent(namespace, pod, filePath, content) {
  showLoading();
  try {
    // Gọi preload API để tạo file tạm trong thư mục hệ thống
    const tempFilePath = await window.powershell.saveTempFile('k8s-temp.config', content);

    // Replace \ -> / cho đúng format của path khi dùng trong kubectl cp
    const destPath = filePath.replace(/\\/g, '/');

    // Thực thi lệnh kubectl cp để đẩy file vào pod
    const cmd = `kubectl cp "${tempFilePath}" ${namespace}/${pod}:${destPath}`;
    console.log('Running:', cmd);

    const result = await window.powershell.run(cmd);
    console.log('✅ kubectl cp result:', result);

    status.textContent = '✅ File saved!';

    await window.powershell.deleteTempFile('k8s-temp.config');
  } catch (err) {
    console.error('❌ Error saving file content:', err);
    status.textContent = '❌ Save error: ' + (err.message || err);
    alert('❌ Save error:\n' + (err.message || err));
  } finally {
    hideLoading();
  }
}


function getConfigMapNameFromPod(podName) {
  const parts = podName.split('-');
  if (parts.length < 2) {
    throw new Error('❌ Cannot parse pod name to get configMap name.');
  }

  const prefix = parts.slice(0, 2).join('-');
  return `${prefix}-force-variables`;
}

document.getElementById('pod-prefix').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const ns = nsSelect.value;
    const prefix = e.target.value.trim();
    if (!ns || !prefix) return;
    loadPods(ns, prefix);
  }
});

podSelect.addEventListener('change', () => {
  const ns = nsSelect.value;
  const pod = podSelect.value;
  editor.setValue('', -1);
  status.textContent = '';
  if (!pod) return;
  loadFiles(ns, pod);
});

nsSelect.addEventListener('change', () => {
  editor.setValue('', -1);
  status.textContent = '';
});


fileSelect.addEventListener('change', () => {
  const ns = nsSelect.value;
  const pod = podSelect.value;
  const path = fileSelect.value;
  if (!ns || !pod || !path) return;
  loadFileContent(ns, pod, path);
});


saveBtn.addEventListener('click', async () => {
  const ns = nsSelect.value;
  const pod = podSelect.value;
  const path = fileSelect.value;
  const content = editor.getValue();

  showLoading();
  try {
    await saveFileContent(ns, pod, path, content);
    status.textContent = '✅ File saved!';
  } catch (err) {
    status.textContent = `❌ Error saving file:\n${err}`;
  } finally {
    hideLoading();
  }
});

document.getElementById('reload-btn').addEventListener('click', async () => {
  try {
    showLoading();

    // Clear selections
    nsSelectInstance.clear(true);
    podSelectInstance.clear(true);
    fileSelectInstance.clear(true);

    nsSelectInstance.clearOptions();
    podSelectInstance.clearOptions();
    fileSelectInstance.clearOptions();

    fileContent.value = '';
    status.textContent = '';
    document.getElementById('pod-prefix').value = '';

    // Reload namespace (mặc định sẽ kéo theo load pod)
    await loadNamespaces();
  } catch (err) {
    console.error('❌ Error when reloading:', err);
    alert('❌ Error when reloading:\n' + err.message);
  } finally {
    hideLoading();
  }
});


document.addEventListener('DOMContentLoaded', () => {
  nsSelectInstance = new TomSelect("#namespace-select", {
    maxOptions: 500,
    allowEmptyOption: true,
    create: false,
    sortField: { field: "text", direction: "asc" }
  });

  podSelectInstance = new TomSelect("#pod-select", {
    maxOptions: 500,
    allowEmptyOption: true,
    create: false,
    sortField: { field: "text", direction: "asc" }
  });

  fileSelectInstance = new TomSelect("#file-select", {
    maxOptions: 500,
    allowEmptyOption: true,
    create: false,
    sortField: { field: "text", direction: "asc" }
  });
});



// Load all on start
loadNamespaces();
