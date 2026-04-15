try {
  const mod = await import('electron/main');
  console.log('keys:', Object.keys(mod));
  console.log('app-type:', typeof mod.app);
  console.log('default-type:', typeof mod.default);
  console.log('default-value:', mod.default);
} catch (error) {
  console.error('ERR', error && error.message ? error.message : error);
  process.exit(1);
}
