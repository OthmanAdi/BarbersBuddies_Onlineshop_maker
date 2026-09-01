const fs = require('fs');
const {spawn} = require('child_process');

const DEMO_PROJECT_ID = 'demo-barbersbuddies';
const EMULATED_SERVICES = 'auth,firestore,functions,storage';

const environment = {...process.env};

if (process.platform === 'win32') {
    const emulatorTemp = process.env.BARBERSBUDDIES_EMULATOR_TEMP || 'C:\\jtmp';
    fs.mkdirSync(emulatorTemp, {recursive: true});
    environment.TEMP = emulatorTemp;
    environment.TMP = emulatorTemp;
}

const firebaseCli = require.resolve('firebase-tools/lib/bin/firebase');
const firebase = spawn(process.execPath, [
    firebaseCli,
    'emulators:start',
    '--project',
    DEMO_PROJECT_ID,
    '--only',
    EMULATED_SERVICES
], {
    env: environment,
    stdio: 'inherit',
    windowsHide: true
});

firebase.on('error', () => {
    process.stderr.write('The Firebase Local Emulator Suite could not be started.\n');
    process.exitCode = 1;
});

firebase.on('exit', (code) => {
    process.exitCode = code === null ? 1 : code;
});
