try {
  const mod = await import('electron/common');
  console.log('keys:', Object.keys(mod));
  console.log('default-type:', typeof mod.default);
  console.log('default-value:', mod.default);
  console.log('app-type:', typeof mod.app);
} catch (error) {
  console.error('ERR', error && error.message ? error.message : error);
  process.exit(1);
}
