document.getElementById('command-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const command = document.getElementById('ps-command').value;
  const outputEl = document.getElementById('output');

  outputEl.textContent = 'Running...';

  try {
    const result = await window.powershell.run(command);
    outputEl.textContent = result;
  } catch (err) {
    outputEl.textContent = '❌ Error:\n' + err;
  }
});
